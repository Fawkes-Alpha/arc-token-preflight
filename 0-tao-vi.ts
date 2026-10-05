/**
 * Tao hai vi cho x402: nguoi mua va nguoi ban.
 * Chay: npx tsx 0-tao-vi.ts
 */
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { existsSync, appendFileSync, readFileSync } from "node:fs";

const cu = existsSync(".env") ? readFileSync(".env", "utf8") : "";

function tao(ten: string) {
  if (cu.includes(`${ten}_PRIVATE_KEY=`)) {
    console.log(`${ten}: da co trong .env, bo qua`);
    return;
  }
  const khoa = generatePrivateKey();
  const vi = privateKeyToAccount(khoa);
  appendFileSync(".env", `${ten}_PRIVATE_KEY=${khoa}\n${ten}_ADDRESS=${vi.address}\n`);
  console.log(`${ten}: ${vi.address}`);
}

tao("BUYER");
tao("SELLER");
console.log("\nDa ghi vao .env. KHONG BAO GIO commit file nay.");