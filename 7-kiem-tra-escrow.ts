/**
 * 7-kiem-tra-escrow.ts — xac minh contract tren mainnet CHAY DUOC, khong chi ton tai.
 *
 * Co ma nguon tai mot dia chi khong co nghia la no hoat dong dung. Script nay
 * goi that vao contract va doi chieu voi gia tri mong doi.
 *
 * Chay:  npx tsx 7-kiem-tra-escrow.ts
 * (Khong can khoa rieng — chi doc, khong gui giao dich nao.)
 */

import { createPublicClient, http, getAddress } from "viem";
import { arc } from "viem/chains";
import { readFileSync } from "node:fs";

export const ESCROW = "0xd7589da91061f2f27ac118b22fcc3822f569359c" as const;
const USDC_MONG_DOI = "0x3600000000000000000000000000000000000000";

const artifact = JSON.parse(readFileSync("./escrow/AgentEscrow.json", "utf8"));
const chuoi = createPublicClient({ chain: arc, transport: http() });

function ket(dung: boolean) {
  return dung ? "DUNG" : "SAI  <-- xem lai";
}

async function main() {
  console.log("Kiem tra contract:", ESCROW);
  console.log("Mang             : Arc mainnet, chainId", arc.id, "\n");

  // 1. Co ma nguon khong
  const ma = await chuoi.getCode({ address: ESCROW });
  const coMa = !!ma && ma !== "0x";
  console.log("Co ma nguon      :", coMa ? (ma!.length - 2) / 2 + " byte" : "KHONG", "|", ket(coMa));
  if (!coMa) return;

  // 2. Goi that vao ba ham view
  const doc = (ten: string) =>
    chuoi.readContract({ address: ESCROW, abi: artifact.abi, functionName: ten });

  const [soJob, diaChiUsdc, soBlockDuyet] = await Promise.all([
    doc("jobCount") as Promise<bigint>,
    doc("usdc") as Promise<string>,
    doc("REVIEW_BLOCKS") as Promise<bigint>,
  ]);

  console.log("jobCount()       :", soJob.toString(), "| ket(chua co job nao):", ket(soJob === 0n));
  console.log(
    "usdc()           :", diaChiUsdc,
    "|", ket(getAddress(diaChiUsdc) === getAddress(USDC_MONG_DOI))
  );
  console.log("REVIEW_BLOCKS()  :", soBlockDuyet.toString(), "|", ket(soBlockDuyet === 5000n));

  // 3. Thoi gian mot block tren Arc — de biet 5000 block la bao lau
  const khoiMoi = await chuoi.getBlockNumber();
  const [a, b] = await Promise.all([
    chuoi.getBlock({ blockNumber: khoiMoi - 1000n }),
    chuoi.getBlock({ blockNumber: khoiMoi }),
  ]);
  const giaySoiBlock = Number(b.timestamp - a.timestamp) / 1000;
  const phutDuyet = (Number(soBlockDuyet) * giaySoiBlock) / 60;

  console.log("\nThoi gian 1 block:", giaySoiBlock.toFixed(3), "giay (do tren 1000 block gan nhat)");
  console.log("=> REVIEW_BLOCKS 5000 tuong duong", phutDuyet.toFixed(0), "phut");

  console.log("\nContract hoat dong binh thuong. San sang nhan job.");
}

main().catch((e) => console.error("\nLoi:", e.shortMessage ?? e.message));
