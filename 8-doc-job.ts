/**
 * 8-doc-job.ts — doc trang thai job tu contract escrow tren Arc mainnet.
 *
 * Khong can giao dien, khong can vi, khong gui giao dich nao.
 * Du lieu nam tren chuoi — trinh duyet treo khong anh huong gi.
 *
 * Chay:  npx tsx 8-doc-job.ts
 */

import { createPublicClient, http, formatUnits, parseAbiItem } from "viem";
import { arc } from "viem/chains";
import { readFileSync } from "node:fs";

const ESCROW = "0xd7589da91061f2f27ac118b22fcc3822f569359c" as const;
const KHOI_DEPLOY = 26576946n; // khoi contract duoc tao, khoi dau quet log tu day

const TRANG_THAI = ["Funded", "Submitted", "Approved", "Refunded"] as const;

const SU_KIEN = {
  JobCreated: parseAbiItem(
    "event JobCreated(uint256 indexed jobId, address indexed client, address indexed provider, uint256 amount, uint64 deadline)"
  ),
  WorkSubmitted: parseAbiItem(
    "event WorkSubmitted(uint256 indexed jobId, address indexed client, address indexed provider, uint256 amount)"
  ),
  JobApproved: parseAbiItem(
    "event JobApproved(uint256 indexed jobId, address indexed client, address indexed provider, uint256 amount)"
  ),
  JobRefunded: parseAbiItem(
    "event JobRefunded(uint256 indexed jobId, address indexed client, address indexed provider, uint256 amount)"
  ),
};

const artifact = JSON.parse(readFileSync("./escrow/AgentEscrow.json", "utf8"));
const chuoi = createPublicClient({ chain: arc, transport: http() });

async function main() {
  const khoi = await chuoi.getBlockNumber();
  console.log("Contract :", ESCROW);
  console.log("Khoi     :", khoi.toString(), "\n");

  const soJob = (await chuoi.readContract({
    address: ESCROW,
    abi: artifact.abi,
    functionName: "jobCount",
  })) as bigint;

  console.log("Tong so job:", soJob.toString());
  if (soJob === 0n) {
    console.log("Chua co job nao tren chuoi.");
    return;
  }

  // ---------- Trang thai tung job ----------
  for (let i = 1n; i <= soJob; i++) {
    const j: any = await chuoi.readContract({
      address: ESCROW,
      abi: artifact.abi,
      functionName: "getJob",
      args: [i],
    });

    console.log("\n" + "=".repeat(60));
    console.log("JOB #" + i.toString());
    console.log("=".repeat(60));
    console.log("  Trang thai     :", TRANG_THAI[Number(j.status)]);
    console.log("  Client         :", j.client);
    console.log("  Provider       :", j.provider);
    console.log("  So tien        :", formatUnits(j.amount, 6), "USDC");
    console.log("  Deadline       : khoi", j.deadline.toString(),
      j.deadline > khoi ? `(con ${(j.deadline - khoi).toString()} khoi)` : "(da qua)");
    console.log("  Review deadline:", j.reviewDeadline === 0n ? "chua dat" : "khoi " + j.reviewDeadline.toString());
  }

  // ---------- Truy ma giao dich tu su kien ----------
  console.log("\n" + "=".repeat(60));
  console.log("MA GIAO DICH (lay tu su kien tren chuoi)");
  console.log("=".repeat(60));

  for (const [ten, sk] of Object.entries(SU_KIEN)) {
    const logs = (await chuoi.getLogs({
      address: ESCROW,
      event: sk as any,
      fromBlock: KHOI_DEPLOY,
      toBlock: "latest",
    })) as any[];
    for (const l of logs) {
      const a: any = l.args;
      console.log(
        `\n  ${ten}  job #${a.jobId}  ${formatUnits(a.amount, 6)} USDC`
      );
      console.log("    khoi :", l.blockNumber!.toString());
      console.log("    tx   :", l.transactionHash);
      console.log("    xem  : https://explorer.arc.io/tx/" + l.transactionHash);
    }
  }

  // ---------- So du contract ----------
  const soDuContract = (await chuoi.readContract({
    address: "0x3600000000000000000000000000000000000000",
    abi: [
      { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
    ],
    functionName: "balanceOf",
    args: [ESCROW],
  })) as bigint;

  console.log("\n" + "=".repeat(60));
  console.log("USDC dang nam trong contract:", formatUnits(soDuContract, 6), "USDC");
  console.log("=".repeat(60));
}

main().catch((e) => console.error("\nLoi:", e.shortMessage ?? e.message));
