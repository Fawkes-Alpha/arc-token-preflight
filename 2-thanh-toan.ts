/**
 * Ky seller proof + gui thanh toan toi Facilitator Service.
 * Chay: npx tsx --env-file=.env 2-thanh-toan.ts
 */
import { privateKeyToAccount } from "viem/accounts";
import { keccak256, toBytes, toHex } from "viem";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const CHAIN_ID = 5042;
const NETWORK = "eip155:5042";
const USDC = "0x3600000000000000000000000000000000000000";
const API = "https://api.circle.com/v1/facilitator/x402";

async function main() {
  const seller = privateKeyToAccount(process.env.SELLER_PRIVATE_KEY as `0x${string}`);
  const payTo = process.env.SELLER_ADDRESS as `0x${string}`;
  const uyQuyen = JSON.parse(readFileSync("uy-quyen.json", "utf8"));

  // Ma chong tra trung. Goi lai phai dung DUNG ma nay.
  let payId: string;
  if (existsSync("pay-id.txt")) {
    payId = readFileSync("pay-id.txt", "utf8").trim();
    console.log("Dung lai ma cu:", payId);
  } else {
    payId = "pay_" + toHex(crypto.getRandomValues(new Uint8Array(12))).slice(2);
    writeFileSync("pay-id.txt", payId);
    console.log("Ma thanh toan moi:", payId);
  }

  const yeuCau = {
    scheme: "exact",
    network: NETWORK,
    amount: uyQuyen.authorization.value,
    asset: USDC,
    payTo,
    maxTimeoutSeconds: 12,
    extra: { name: "USDC", version: "2" },
  };

  const body = JSON.stringify({
    x402Version: 2,
    paymentPayload: {
      x402Version: 2,
      resource: {
        url: "https://api.example.com/premium",
        description: "Bai kiem thu x402 tren Arc mainnet",
        mimeType: "application/json",
      },
      accepted: { ...yeuCau, extra: { ...yeuCau.extra, assetTransferMethod: "eip3009" } },
      payload: uyQuyen,
      extensions: {
        "payment-identifier": { info: { required: true, id: payId } },
      },
    },
    paymentRequirements: yeuCau,
  });

  // ===== SELLER PROOF: ky len DUNG chuoi body o tren =====
  const nonce = toHex(crypto.getRandomValues(new Uint8Array(32)));
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + 300;

  const chuKy = await seller.signTypedData({
    domain: { name: "Circle Facilitator Seller Request", version: "1", chainId: CHAIN_ID },
    types: {
      SellerRequest: [
        { name: "purpose",   type: "string"  },
        { name: "method",    type: "string"  },
        { name: "bodyHash",  type: "bytes32" },
        { name: "network",   type: "string"  },
        { name: "payTo",     type: "address" },
        { name: "nonce",     type: "bytes32" },
        { name: "issuedAt",  type: "uint64"  },
        { name: "expiresAt", type: "uint64"  },
      ],
    },
    primaryType: "SellerRequest",
    message: {
      purpose: "settle",
      method: "POST",
      bodyHash: keccak256(toBytes(body)),
      network: NETWORK,
      payTo,
      nonce,
      issuedAt: BigInt(issuedAt),
      expiresAt: BigInt(expiresAt),
    },
  });

  const proof = Buffer.from(JSON.stringify({
    version: 1, signature: chuKy, network: NETWORK, payTo, nonce, issuedAt, expiresAt,
  })).toString("base64url");

  // Luu ra file de co the thu lai bang curl neu fetch hong
  writeFileSync("body.json", body);
  writeFileSync("proof.txt", proof);

  console.log("\n--- Thong tin chan doan ---");
  console.log("Do dai body :", body.length, "ky tu");
  console.log("Do dai proof:", proof.length, "ky tu");
  console.log("Nguoi ban   :", payTo);
  console.log("So tien     :", Number(yeuCau.amount) / 1e6, "USDC");
  console.log("Da luu body.json va proof.txt");

  console.log("\nDang gui toi Facilitator Service...\n");

  let res: Response;
  try {
    res = await fetch(`${API}/settle`, {
      method: "POST",
      headers: {
        "Facilitator-Seller-Proof": proof,
        "Content-Type": "application/json",
      },
      body,
    });
  } catch (e: any) {
    console.error("FETCH HONG:", e.message);
    console.error("CAUSE:", e.cause);
    console.error("\nThu lai bang curl:");
    console.error('curl.exe -X POST https://api.circle.com/v1/facilitator/x402/settle -H "Facilitator-Seller-Proof: $(Get-Content proof.txt -Raw)" -H "Content-Type: application/json" --data-binary "@body.json"');
    return;
  }

  const text = await res.text();
  console.log("HTTP", res.status);
  console.log(text);

  try {
    const kq = JSON.parse(text);
    if (kq.success === true) {
      console.log("\n=== THANH CONG ===");
      console.log("Giao dich:", kq.transaction);
      console.log("Xem tai : https://explorer.arc.io/tx/" + kq.transaction);
    } else if (kq.extensions?.["settlement-status"]?.status === "pending") {
      console.log("\n=== DANG CHO ===");
      console.log("KHONG duoc giao hang khi con pending.");
      console.log("paymentId:", kq.extensions["settlement-status"].paymentId);
    }
  } catch {}
}

main().catch((e) => {
  console.error("Loi:", e.message);
  console.error("CAUSE:", e.cause);
});