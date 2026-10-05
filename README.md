# Arc Token Pre-Flight

A pay-per-call API on **Arc mainnet** that inspects any token contract and returns the
risk warnings an autonomous agent needs *before* it trades. No account, no API key,
no signup. Payment is the authentication.

**Live:** https://arc-token-preflight.vercel.app
**Endpoint:** `GET /api/kiem-tra?address=<contract>` — 0.01 USDC per call
**Network:** Arc mainnet, `eip155:5042`

---

## The problem

An agent that discovers a token on Arc and wants to trade it has to answer three
questions first, and all three have bitten me personally while building on Arc:

| Trap | What goes wrong |
|---|---|
| **cirBTC has 8 decimals** | Not 18, not 6. A client that hard-codes 18 misreads every balance by 10¹⁰. |
| **USDC on Arc has two interfaces** | Native at 18 decimals and ERC-20 at 6, sharing one balance. Mixing them is a 10¹² error. |
| **The address has no bytecode** | The contract exists on testnet but not mainnet. The ERC-8004 registries are the live example — documented, addressed, and absent from mainnet. |

Each of these is a silent failure. Nothing reverts; the numbers are just wrong.
This API returns them as explicit warnings alongside the metadata.

---

## Proof it works

Every claim below is verifiable on [explorer.arc.io](https://explorer.arc.io).

**Settled payment:**
[`0x76716ab73cb0a4ae6e955920745ce7a1401ccaf218327685bee389d4da6f9063`](https://explorer.arc.io/tx/0x76716ab73cb0a4ae6e955920745ce7a1401ccaf218327685bee389d4da6f9063)

| Field | Value |
|---|---|
| Status | success |
| Block | 24356199 |
| Buyer | `0x5dDCCf94A400341d243f01002f2003aD3100D314` |
| Seller | `0x170937d0755B93E2C1f5cA944708b7107c035B23` |
| Amount | 0.01 USDC |
| Gas used | 92,011 |
| **Transaction sender** | `0xa48381b79bba70ce4e98bcf71db43bad6ee1ad30` |

That last row is the interesting one. The sender is **neither the buyer nor the
seller** — it is Circle's Facilitator relayer. The buyer never submitted a
transaction; it only produced a signature. The seller's wallet has never held gas.

### The receipt demonstrates the bug this API warns about

The transaction emits **three** logs, and two of them are the *same payment counted
twice*:

| # | Emitter | Event | Value |
|---|---|---|---|
| 1 | `0x3600…0000` | `AuthorizationUsed` | — (EIP-3009 nonce consumed) |
| 2 | `0xffff…fffE` | `Transfer` | `10000000000000000` (1e16, **18 decimals**) |
| 3 | `0x3600…0000` | `Transfer` | `10000` (**6 decimals**) |

Log 2 comes from Arc's system event emitter under
[EIP-7708](https://docs.arc.io/arc/references/evm-differences) — native value
transfers emit `Transfer` logs. Log 3 is the ERC-20 interface of the same balance.

An indexer that sums both logs double-counts. An indexer that reads log 2 with
ERC-20 decimals reports a transfer of 10 billion USDC. This is exactly the hazard
the API flags on `0x3600…0000`, visible in its own payment receipt.

---

## How payment works

```
Agent                                   This API                    Circle Facilitator
  │                                        │                                │
  │  GET /api/kiem-tra?address=0x…         │                                │
  │ ──────────────────────────────────────>│                                │
  │                                        │                                │
  │  402 Payment Required                  │                                │
  │  { accepts: [{ scheme, network,        │                                │
  │               payTo, amount, asset }] }│                                │
  │ <──────────────────────────────────────│                                │
  │                                        │                                │
  │  signs EIP-3009 TransferWithAuthorization                               │
  │  (a signature — no transaction)        │                                │
  │                                        │                                │
  │  GET … with X-PAYMENT header           │                                │
  │ ──────────────────────────────────────>│                                │
  │                                        │  seller proof + settle         │
  │                                        │ ──────────────────────────────>│
  │                                        │                                │
  │                                        │  success + tx hash             │
  │                                        │ <──────────────────────────────│
  │  200 + report + tx hash                │                                │
  │ <──────────────────────────────────────│                                │
```

- **Protocol:** x402, scheme `exact`
- **Mechanism:** EIP-3009 `TransferWithAuthorization` — the buyer signs, never transacts
- **Settlement:** Circle Facilitator Service, which pays the gas
- **Seller proof:** EIP-712 `SellerRequest` signed over `keccak256` of the settle body
- **Finality:** instant. Arc has deterministic finality, so there is no `pending`
  state and no reorg handling. The report is returned only when settlement returns
  `success: true`.

---

## Why this is Arc-native

It is not a port of something that runs elsewhere.

1. **Instant finality removes a state machine.** On Base, an x402 seller has to wait
   for a block, then a receipt, then verify a `Transfer` event — and a reorg after
   completion turns a settled payment into `failed`. On Arc there is no such path,
   so the server has no pending queue, no retry logic, no reconciliation job.
2. **Circle pays settlement gas**, which is what makes a 0.01 USDC price viable at
   all. At a typical L2 gas cost the fee would exceed the product.
3. **The warnings it sells come from Arc's own EVM differences.** The dual-interface
   USDC precompile does not exist on any other chain. Neither does the EIP-7708
   system emitter. This product has no meaning off Arc.

---

## Run it yourself

```bash
git clone <this repo>
cd x402-mainnet
npm install
cp .env.example .env     # then fill in the four values
npx tsx 0-tao-vi.ts      # optional: generate two fresh wallets
```

Fund the buyer wallet with a little USDC on Arc, then:

```bash
# the free part — read contracts directly, no payment
npx tsx 4-thu-doc-contract.ts

# the full x402 loop against the live endpoint — costs 0.01 USDC
npx tsx --env-file=.env 5-khach-mua.ts 0x171A4217B86A807A64eB94757Db6849fb4bDbAA0
```

`5-khach-mua.ts` does not hard-code the price. It calls the endpoint, reads the
`accepts` array out of the 402 response, and signs for whatever the server asked
for. Change the price on the server and the client still works.

### Try it with no code

```bash
curl -i "https://arc-token-preflight.vercel.app/api/kiem-tra?address=0x171A4217B86A807A64eB94757Db6849fb4bDbAA0"
```

Returns `HTTP 402` and the machine-readable price list.

---

## Project layout

```
api/kiem-tra.ts        the paid endpoint: 402 when unpaid, settle then serve when paid
lib/doc-contract.ts    the product — reads a contract on Arc, emits warnings
lib/x402.ts            payment layer — seller proof, Facilitator settlement
lib/kieu-vercel.ts     minimal handler types (avoids a 112-package dependency)
public/index.html      landing page
0-tao-vi.ts            generate buyer and seller wallets
1-ky-uy-quyen.ts       standalone EIP-3009 signing demo
2-thanh-toan.ts        standalone settlement demo
3-doc-trending.ts      reads data purchased from a third-party x402 service
4-thu-doc-contract.ts  exercise the product with no payment
5-khach-mua.ts         full x402 client — the agent side
```

Runtime dependencies: `viem` and `dotenv`. That is all.

---

## Security notes

- `.env` is gitignored and `.vercelignored`. No key is in any committed file.
- The seller's private key lives only in a Vercel environment variable. It is used
  to **sign** the seller proof and nothing else — the seller wallet never sends a
  transaction and never needs gas.
- Error messages are passed through a filter that strips any hex string of 40+
  characters before returning them, so a library that echoes its input cannot leak a
  key into a public response. Full errors go to the server log only.
- The server returns the report **only** after settlement reports `success: true`.
  A `pending` status is never treated as paid.

---

## Honest limitations

- **One address per call.** No batch endpoint yet.
- **ERC-165 only.** A token that implements ERC-721 without declaring it via
  `supportsInterface` is classified `khong-ro` ("unknown") rather than guessed at.
- **No proxy resolution.** A proxy whose implementation is unset reads as a contract
  with no readable metadata. It is reported as such, not resolved.
- **No holder counts or transfer history.** Those need an indexer; this reads chain
  state directly.
- Identifiers and comments in the source are in Vietnamese. It is the language I
  think in while building, and renaming them for review would make the code less
  honest about how it was written.

---

## Author

Built by [@Fawkes_Alpha1](https://x.com/Fawkes_Alpha1) — a self-taught TypeScript
developer in Hanoi, building on Arc since testnet.

Written up in more detail, including four undocumented things I hit along the way:
*Three days after mainnet: I let an AI agent both sell and buy on Arc.*
