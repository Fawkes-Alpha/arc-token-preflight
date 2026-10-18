/**
 * 6-deploy-escrow.ts — dua AgentEscrow len Arc MAINNET.
 *
 * Arc Studio chi deploy duoc len testnet. Buoc nay ban tu lam bang khoa cua minh,
 * dung nhu tai lieu Arc Studio ghi:
 *   "Any use of Arc Studio-generated code on mainnet is undertaken by you
 *    using your own credentials and at your own risk."
 *
 * Chay:
 *   npx tsx --env-file=.env 6-deploy-escrow.ts
 *
 * TIEN THAT. Doc ky phan in ra truoc khi go "yes".
 */

import { createWalletClient, createPublicClient, http, formatUnits, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arc } from "viem/chains";
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";

const USDC = "0x3600000000000000000000000000000000000000" as const;

// Arc co phi day toi thieu 20 Gwei. Duoi muc nay giao dich bi loai AM THAM:
// khong loi, khong bien lai, khong gi ca. Nen dat san mot muc an toan.
const PHI_TOI_THIEU = 20_000_000_000n; // 20 Gwei
const HE_SO_AN_TOAN = 2n; // tra gap doi muc toi thieu cho chac

const ABI_SO_DU = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

function gach(s: string) {
  console.log("\n" + "=".repeat(64));
  console.log(s);
  console.log("=".repeat(64));
}

async function main() {
  if (!process.env.BUYER_PRIVATE_KEY) {
    throw new Error("Thieu BUYER_PRIVATE_KEY. Nho chay kem --env-file=.env");
  }

  const artifact = JSON.parse(readFileSync("./escrow/AgentEscrow.json", "utf8"));
  const nguoiDeploy = privateKeyToAccount(process.env.BUYER_PRIVATE_KEY as `0x${string}`);

  const chuoi = createPublicClient({ chain: arc, transport: http() });
  const vi = createWalletClient({ account: nguoiDeploy, chain: arc, transport: http() });

  // ---------- Kiem tra truoc ----------
  gach("KIEM TRA TRUOC KHI DEPLOY");

  const [khoi, soDuGoc, soDuERC20, phiHienTai] = await Promise.all([
    chuoi.getBlockNumber(),
    chuoi.getBalance({ address: nguoiDeploy.address }),
    chuoi.readContract({ address: USDC, abi: ABI_SO_DU, functionName: "balanceOf", args: [nguoiDeploy.address] }),
    chuoi.getGasPrice(),
  ]);

  const phiDung = phiHienTai > PHI_TOI_THIEU ? phiHienTai * HE_SO_AN_TOAN : PHI_TOI_THIEU * HE_SO_AN_TOAN;

  console.log("Mang          : Arc mainnet, chainId", arc.id);
  console.log("Khoi hien tai :", khoi.toString());
  console.log("Vi deploy     :", nguoiDeploy.address);
  console.log("So du (ban dia, 18 so):", formatEther(soDuGoc), "USDC");
  console.log("So du (ERC-20, 6 so)  :", formatUnits(soDuERC20, 6), "USDC");
  console.log("Phi mang hien tai     :", (phiHienTai / 1_000_000_000n).toString(), "Gwei");
  console.log("Phi se tra            :", (phiDung / 1_000_000_000n).toString(), "Gwei");
  console.log("Kich thuoc bytecode   :", (artifact.bytecode.length - 2) / 2, "byte");

  // Uoc tinh chi phi
  let uocGas: bigint;
  try {
    uocGas = await chuoi.estimateGas({
      account: nguoiDeploy,
      data: artifact.bytecode as `0x${string}`,
    });
  } catch (e: any) {
    console.log("\nKhong uoc tinh duoc gas:", e.shortMessage ?? e.message);
    console.log("Dung tam 1.500.000 de tinh chi phi toi da.");
    uocGas = 1_500_000n;
  }

  const chiPhi = uocGas * phiDung;
  console.log("Gas uoc tinh          :", uocGas.toString());
  console.log("Chi phi toi da        :", formatEther(chiPhi), "USDC");

  if (soDuGoc < chiPhi) {
    console.log("\nKHONG DU TIEN TRA GAS. Can them", formatEther(chiPhi - soDuGoc), "USDC.");
    return;
  }

  // ---------- Hoi xac nhan ----------
  gach("XAC NHAN");
  console.log("Day la MAINNET. Tien that se bi tru.");
  const hoi = createInterface({ input: process.stdin, output: process.stdout });
  const traLoi = (await hoi.question('Go "yes" de deploy, bat ky phim nao khac de huy: ')).trim();
  hoi.close();

  if (traLoi !== "yes") {
    console.log("Da huy. Khong co gi duoc gui len chuoi.");
    return;
  }

  // ---------- Deploy ----------
  gach("DANG DEPLOY");

  const hash = await vi.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode as `0x${string}`,
    args: [],
    maxFeePerGas: phiDung,
    maxPriorityFeePerGas: 1_000_000_000n, // 1 Gwei
  });

  console.log("Ma giao dich:", hash);
  console.log("Dang cho bien lai...");

  const bienLai = await chuoi.waitForTransactionReceipt({ hash, timeout: 120_000 });

  if (bienLai.status !== "success") {
    console.log("\nDEPLOY THAT BAI. Trang thai:", bienLai.status);
    console.log("Xem tai: https://explorer.arc.io/tx/" + hash);
    return;
  }

  // ---------- Ket qua ----------
  gach("DEPLOY THANH CONG");
  console.log("Dia chi contract :", bienLai.contractAddress);
  console.log("Khoi             :", bienLai.blockNumber.toString());
  console.log("Gas da dung      :", bienLai.gasUsed.toString());
  console.log("Chi phi that     :", formatEther(bienLai.gasUsed * bienLai.effectiveGasPrice), "USDC");
  console.log("\nContract :", "https://explorer.arc.io/address/" + bienLai.contractAddress);
  console.log("Giao dich:", "https://explorer.arc.io/tx/" + hash);

  // Xac minh contract that su co ma nguon tai dia chi do
  const ma = await chuoi.getCode({ address: bienLai.contractAddress! });
  console.log("\nKiem chung: co", ma && ma !== "0x" ? (ma.length - 2) / 2 : 0, "byte ma nguon tai dia chi tren.");

  console.log("\nLUU LAI HAI DUONG LINK TREN. Chung la bang chung cho ho so Microgrants.");
}

main().catch((e) => console.error("\nLoi:", e.shortMessage ?? e.message));
