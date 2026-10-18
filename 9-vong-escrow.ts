/**
 * 9-vong-escrow.ts — hoan tat vong escrow tren Arc mainnet bang dong lenh.
 *
 * Dung khi giao dien khong doi duoc vai client/provider.
 *
 * Chay:
 *   npx tsx --env-file=.env 9-vong-escrow.ts submit 1    (provider nop viec)
 *   npx tsx --env-file=.env 9-vong-escrow.ts approve 1   (client duyet + tra tien)
 *   npx tsx --env-file=.env 9-vong-escrow.ts refund 1    (client hoan tien, sau deadline)
 *   npx tsx --env-file=.env 9-vong-escrow.ts claim 1     (provider tu nhan, sau cua so duyet)
 *
 * TIEN THAT. Script in ra moi thu va hoi xac nhan truoc khi gui.
 */

import { createWalletClient, createPublicClient, http, formatUnits, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arc } from "viem/chains";
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";

const ESCROW = "0xd7589da91061f2f27ac118b22fcc3822f569359c" as const;
const PHI_TOI_THIEU = 20_000_000_000n; // 20 Gwei — muc day cua Arc
const TRANG_THAI = ["Funded", "Submitted", "Approved", "Refunded"] as const;

const artifact = JSON.parse(readFileSync("./escrow/AgentEscrow.json", "utf8"));
const chuoi = createPublicClient({ chain: arc, transport: http() });

/** Ai duoc phep goi hanh dong nao. */
const VAI: Record<string, { ham: string; khoa: string; ten: string }> = {
  submit: { ham: "submitWork", khoa: "SELLER_PRIVATE_KEY", ten: "Provider" },
  approve: { ham: "approve", khoa: "BUYER_PRIVATE_KEY", ten: "Client" },
  refund: { ham: "refund", khoa: "BUYER_PRIVATE_KEY", ten: "Client" },
  claim: { ham: "claimTimeout", khoa: "SELLER_PRIVATE_KEY", ten: "Provider" },
};

function gach(s: string) {
  console.log("\n" + "=".repeat(64));
  console.log(s);
  console.log("=".repeat(64));
}

async function main() {
  const lenh = process.argv[2];
  const jobId = BigInt(process.argv[3] ?? "1");

  const vai = VAI[lenh];
  if (!vai) {
    console.log("Lenh phai la mot trong: submit | approve | refund | claim");
    console.log("Vi du: npx tsx --env-file=.env 9-vong-escrow.ts submit 1");
    return;
  }

  const pk = process.env[vai.khoa];
  if (!pk) throw new Error(`Thieu ${vai.khoa}. Nho chay kem --env-file=.env`);
  const nguoiKy = privateKeyToAccount(pk.trim() as `0x${string}`);
  const vi = createWalletClient({ account: nguoiKy, chain: arc, transport: http() });

  // ---------- Doc trang thai truoc ----------
  gach("TRANG THAI TRUOC");

  const khoi = await chuoi.getBlockNumber();
  const j: any = await chuoi.readContract({
    address: ESCROW, abi: artifact.abi, functionName: "getJob", args: [jobId],
  });

  console.log("Job #" + jobId.toString());
  console.log("  Trang thai :", TRANG_THAI[Number(j.status)]);
  console.log("  So tien    :", formatUnits(j.amount, 6), "USDC");
  console.log("  Client     :", j.client);
  console.log("  Provider   :", j.provider);
  console.log("  Deadline   : khoi", j.deadline.toString(), j.deadline > khoi ? "(chua toi)" : "(da qua)");
  console.log("  Khoi hien tai:", khoi.toString());

  console.log("\nHanh dong :", vai.ham);
  console.log("Ky bang   :", vai.ten, nguoiKy.address);

  // Kiem tra dia chi co dung vai khong — chan loi truoc khi ton gas
  const dungVai =
    (vai.ten === "Client" && nguoiKy.address.toLowerCase() === j.client.toLowerCase()) ||
    (vai.ten === "Provider" && nguoiKy.address.toLowerCase() === j.provider.toLowerCase());
  if (!dungVai) {
    console.log(`\nSAI VAI. Vi dang ky khong phai ${vai.ten} cua job nay. Dung lai.`);
    return;
  }

  // ---------- Mo phong truoc khi gui ----------
  gach("MO PHONG");
  try {
    await chuoi.simulateContract({
      address: ESCROW, abi: artifact.abi, functionName: vai.ham, args: [jobId], account: nguoiKy,
    });
    console.log("Mo phong thanh cong. Giao dich se khong revert.");
  } catch (e: any) {
    const ten = e?.cause?.data?.errorName ?? e?.shortMessage ?? e?.message;
    console.log("MO PHONG THAT BAI:", ten);
    console.log("Khong gui gi ca. Khong ton gas.");
    return;
  }

  // ---------- Xac nhan ----------
  const hoi = createInterface({ input: process.stdin, output: process.stdout });
  const traLoi = (await hoi.question('\nGo "yes" de gui len mainnet: ')).trim();
  hoi.close();
  if (traLoi !== "yes") { console.log("Da huy."); return; }

  // ---------- Gui ----------
  gach("DANG GUI");
  const phi = await chuoi.getGasPrice();
  const phiDung = (phi > PHI_TOI_THIEU ? phi : PHI_TOI_THIEU) * 2n;

  const hash = await vi.writeContract({
    address: ESCROW, abi: artifact.abi, functionName: vai.ham, args: [jobId],
    maxFeePerGas: phiDung, maxPriorityFeePerGas: 1_000_000_000n,
  });
  console.log("Ma giao dich:", hash);

  const bienLai = await chuoi.waitForTransactionReceipt({ hash, timeout: 120_000 });
  if (bienLai.status !== "success") {
    console.log("THAT BAI. Xem: https://explorer.arc.io/tx/" + hash);
    return;
  }

  // ---------- Trang thai sau ----------
  gach("XONG");
  const sau: any = await chuoi.readContract({
    address: ESCROW, abi: artifact.abi, functionName: "getJob", args: [jobId],
  });
  console.log("Trang thai moi :", TRANG_THAI[Number(sau.status)]);
  if (sau.reviewDeadline > 0n) console.log("Review deadline:", "khoi " + sau.reviewDeadline.toString());
  console.log("Gas da dung    :", bienLai.gasUsed.toString());
  console.log("Chi phi        :", formatEther(bienLai.gasUsed * bienLai.effectiveGasPrice), "USDC");
  console.log("\nXem: https://explorer.arc.io/tx/" + hash);

  const soDuContract = (await chuoi.readContract({
    address: "0x3600000000000000000000000000000000000000",
    abi: [{ name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] }],
    functionName: "balanceOf", args: [ESCROW],
  })) as bigint;
  console.log("USDC con trong contract:", formatUnits(soDuContract, 6));
}

main().catch((e) => console.error("\nLoi:", e.shortMessage ?? e.message));
