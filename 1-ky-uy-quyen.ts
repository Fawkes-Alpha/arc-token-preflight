/**
 * Nguoi mua ky uy quyen chuyen USDC (EIP-3009).
 * KHONG gui giao dich nao len chuoi - chi la mot chu ky.
 *
 * Chay: npx tsx --env-file=.env 1-ky-uy-quyen.ts
 */
import { privateKeyToAccount } from "viem/accounts";
import { toHex } from "viem";
import { writeFileSync } from "node:fs";

// ===== CAU HINH ARC MAINNET =====
const CHAIN_ID = 5042;
const USDC = "0x3600000000000000000000000000000000000000" as `0x${string}`;
const SO_TIEN = 100000n;              // 0.1 USDC (giao dien ERC-20 dung 6 so)

async function main() {
  const buyer = privateKeyToAccount(process.env.BUYER_PRIVATE_KEY as `0x${string}`);
  const payTo = process.env.SELLER_ADDRESS as `0x${string}`;

  const nonce = toHex(crypto.getRandomValues(new Uint8Array(32)));
  const validBefore = BigInt(Math.floor(Date.now() / 1000) + 3600);  // het han sau 1 gio

  const uyQuyen = {
    from: buyer.address,
    to: payTo,
    value: SO_TIEN,
    validAfter: 0n,
    validBefore,
    nonce,
  };

  const chuKy = await buyer.signTypedData({
    domain: { name: "USDC", version: "2", chainId: CHAIN_ID, verifyingContract: USDC },
    types: {
      TransferWithAuthorization: [
        { name: "from",        type: "address" },
        { name: "to",          type: "address" },
        { name: "value",       type: "uint256" },
        { name: "validAfter",  type: "uint256" },
        { name: "validBefore", type: "uint256" },
        { name: "nonce",       type: "bytes32" },
      ],
    },
    primaryType: "TransferWithAuthorization",
    message: uyQuyen,
  });

  // Luu lai de buoc sau dung. BigInt phai doi sang chuoi.
  const ketQua = {
    signature: chuKy,
    authorization: {
      from: uyQuyen.from,
      to: uyQuyen.to,
      value: uyQuyen.value.toString(),
      validAfter: uyQuyen.validAfter.toString(),
      validBefore: uyQuyen.validBefore.toString(),
      nonce: uyQuyen.nonce,
    },
  };
  writeFileSync("uy-quyen.json", JSON.stringify(ketQua, null, 2));

  console.log("Nguoi mua :", uyQuyen.from);
  console.log("Nguoi ban :", uyQuyen.to);
  console.log("So tien   :", Number(SO_TIEN) / 1e6, "USDC");
  console.log("Het han   :", new Date(Number(validBefore) * 1000).toLocaleString());
  console.log("\nChu ky:", chuKy.slice(0, 30) + "...");
  console.log("\nDa luu vao uy-quyen.json");
  console.log("Luu y: CHUA co giao dich nao len chuoi. Day chi la mot chu ky.");
}

main().catch((e) => console.error("Loi:", e.shortMessage ?? e.message));