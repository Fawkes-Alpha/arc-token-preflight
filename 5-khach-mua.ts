/**
 * 5-khach-mua.ts — phia NGUOI MUA (agent).
 *
 * Day la vong lap x402 day du, tu dong:
 *   1. Goi API khong kem tien       -> nhan 402 + bang gia
 *   2. DOC bang gia tu phan hoi      -> khong ghi cung gia o day
 *   3. Ky uy quyen EIP-3009          -> khong gui giao dich nao
 *   4. Goi lai kem chu ky            -> nhan hang + ma giao dich
 *
 * Buoc 2 la diem quan trong: agent khong biet truoc gia. No hoi, roi tra.
 *
 * Chay:
 *   npx tsx --env-file=.env 5-khach-mua.ts <dia-chi-contract>
 */

import { privateKeyToAccount } from "viem/accounts";
import { toHex, createPublicClient, http, formatUnits } from "viem";
import { arc } from "viem/chains";

const API_GOC = process.env.API_URL || "https://arc-token-preflight.vercel.app";
const USDC = "0x3600000000000000000000000000000000000000" as `0x${string}`;

const ABI_SO_DU = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

function gach(tieuDe: string) {
  console.log("\n" + "=".repeat(64));
  console.log(tieuDe);
  console.log("=".repeat(64));
}

async function main() {
  const diaChiCanTra = process.argv[2] || "0x171A4217B86A807A64eB94757Db6849fb4bDbAA0";

  if (!process.env.BUYER_PRIVATE_KEY) {
    throw new Error("Thieu BUYER_PRIVATE_KEY. Nho chay kem --env-file=.env");
  }
  const buyer = privateKeyToAccount(process.env.BUYER_PRIVATE_KEY as `0x${string}`);
  const url = `${API_GOC}/api/kiem-tra?address=${diaChiCanTra}`;

  // ---------- BUOC 1: goi khong kem tien ----------
  gach("BUOC 1 — Goi API khong kem tien");
  console.log("GET", url);

  const lan1 = await fetch(url);
  console.log("May chu tra ve: HTTP", lan1.status);

  if (lan1.status === 200) {
    console.log("API nay dang mien phi, khong can tra tien.");
    console.log(JSON.stringify(await lan1.json(), null, 2));
    return;
  }
  if (lan1.status !== 402) {
    console.log("Khong phai 402. Noi dung:", (await lan1.text()).slice(0, 400));
    return;
  }

  const baoGia: any = await lan1.json();
  const gia = baoGia.accepts?.[0];
  if (!gia) throw new Error("Phan hoi 402 khong co mang accepts");

  // ---------- BUOC 2: doc bang gia ----------
  gach("BUOC 2 — Doc bang gia tu chinh phan hoi");
  const soTien = BigInt(gia.maxAmountRequired ?? gia.amount);
  const chainId = Number(String(gia.network).split(":")[1]);

  console.log("Luoc do (scheme) :", gia.scheme);
  console.log("Mang             :", gia.network, `(chainId ${chainId})`);
  console.log("Tai san          :", gia.asset);
  console.log("Tra cho          :", gia.payTo);
  console.log("So tien          :", formatUnits(soTien, 6), "USDC");

  if (gia.scheme !== "exact") {
    throw new Error(`Khach nay chi biet luoc do "exact", may chu doi "${gia.scheme}".`);
  }

  // ---------- Kiem tra so du truoc khi ky ----------
  const chuoi = createPublicClient({ chain: arc, transport: http() });
  const soDu = await chuoi.readContract({
    address: USDC,
    abi: ABI_SO_DU,
    functionName: "balanceOf",
    args: [buyer.address],
  });
  console.log("\nVi nguoi mua     :", buyer.address);
  console.log("So du hien co    :", formatUnits(soDu, 6), "USDC");

  if (soDu < soTien) {
    console.log("\nKHONG DU TIEN. Can it nhat", formatUnits(soTien, 6), "USDC trong vi nguoi mua.");
    return;
  }

  // ---------- BUOC 3: ky uy quyen ----------
  gach("BUOC 3 — Ky uy quyen EIP-3009");

  const uyQuyen = {
    from: buyer.address,
    to: gia.payTo as `0x${string}`,
    value: soTien,
    validAfter: 0n,
    validBefore: BigInt(Math.floor(Date.now() / 1000) + 3600),
    nonce: toHex(crypto.getRandomValues(new Uint8Array(32))),
  };

  const chuKy = await buyer.signTypedData({
    domain: {
      name: gia.extra?.name ?? "USDC",
      version: gia.extra?.version ?? "2",
      chainId,
      verifyingContract: gia.asset as `0x${string}`,
    },
    types: {
      TransferWithAuthorization: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "validAfter", type: "uint256" },
        { name: "validBefore", type: "uint256" },
        { name: "nonce", type: "bytes32" },
      ],
    },
    primaryType: "TransferWithAuthorization",
    message: uyQuyen,
  });

  console.log("Da ky. Chu ky:", chuKy.slice(0, 26) + "...");
  console.log("Luu y: CHUA co giao dich nao len chuoi. Moi chi la mot chu ky.");

  // ---------- BUOC 4: goi lai kem chu ky ----------
  gach("BUOC 4 — Goi lai, lan nay kem chu ky");

  const goiThanhToan = {
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

  const header = Buffer.from(JSON.stringify(goiThanhToan)).toString("base64");
  const lan2 = await fetch(url, { headers: { "X-PAYMENT": header } });
  console.log("May chu tra ve: HTTP", lan2.status);

  const kq: any = await lan2.json();

  if (lan2.status !== 200) {
    console.log("\nTHAT BAI. May chu noi:");
    console.log(JSON.stringify(kq, null, 2));
    return;
  }

  // ---------- Ket qua ----------
  gach("DA TRA TIEN VA NHAN HANG");
  console.log("Ma giao dich :", kq.thanhToan.giaoDich);
  console.log("Xem tai      :", kq.thanhToan.explorer);
  console.log("So tien      :", formatUnits(BigInt(kq.thanhToan.soTien), 6), "USDC");

  const bc = kq.baoCao;
  console.log("\n--- BAO CAO DA MUA ---");
  console.log("Dia chi      :", bc.diaChi);
  console.log("Loai         :", bc.loai);
  console.log("Ten          :", bc.ten ?? "-");
  console.log("Ky hieu      :", bc.kyHieu ?? "-");
  console.log("So thap phan :", bc.soThapPhan ?? "-");
  console.log("Tong cung    :", bc.tongCungDangDoc ?? "-");
  if (bc.canhBao?.length) {
    console.log("CANH BAO:");
    bc.canhBao.forEach((c: string) => console.log("  -", c));
  } else {
    console.log("Khong co canh bao.");
  }

  const soDuSau = await chuoi.readContract({
    address: USDC,
    abi: ABI_SO_DU,
    functionName: "balanceOf",
    args: [buyer.address],
  });
  console.log("\nSo du truoc  :", formatUnits(soDu, 6), "USDC");
  console.log("So du sau    :", formatUnits(soDuSau, 6), "USDC");
}

main().catch((e) => console.error("\nLoi:", e.shortMessage ?? e.message));
