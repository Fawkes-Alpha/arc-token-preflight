// api/kiem-tra.ts
//
// Day la DIA CHI WEB cua dich vu. Vercel tu bien file trong thu muc api/
// thanh mot endpoint cong khai:  https://<ten>.vercel.app/api/kiem-tra
//
// Luong chay:
//   Goi khong kem tien  -> tra ma 402 + bang gia
//   Goi kem chu ky      -> quyet toan tren Arc -> tra du lieu

import type { VercelRequest, VercelResponse } from "../lib/kieu-vercel";
import { kiemTraContract } from "../lib/doc-contract";
import { bangGia, quyetToan } from "../lib/x402";

// Gia: 0.01 USDC. USDC qua giao dien ERC-20 co 6 so thap phan -> 10000.
const GIA = "10000";
const MO_TA = "Pre-flight check for any token contract on Arc mainnet: type, metadata, and risk warnings.";

/**
 * Xoa moi chuoi hex dai (>= 40 ky tu) khoi thong bao loi.
 * Mot so thu vien nhet gia tri dau vao vao thong bao loi - neu gia tri do
 * la khoa rieng thi no se bay thang ra phan hoi cong khai. Khong duoc phep.
 */
function locBiMat(s: string): string {
  return s.replace(/0x[a-fA-F0-9]{40,}/g, "0x<da-an>");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    return await xuLy(req, res);
  } catch (e: any) {
    // Ghi day du vao log cua Vercel (chi minh doc duoc)
    console.error("LOI KHONG BAT DUOC:", e);
    // Tra ra ngoai ban da loc
    return res.status(500).json({
      error: "Loi may chu",
      loai: locBiMat(String(e?.name ?? "Error")),
      thongBao: locBiMat(String(e?.shortMessage ?? e?.message ?? e)),
    });
  }
}

async function xuLy(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-PAYMENT");
  res.setHeader("Access-Control-Expose-Headers", "X-PAYMENT-RESPONSE");
  if (req.method === "OPTIONS") return res.status(204).end();

  // --- 1. Kiem tra tham so ---
  const diaChi = (req.query.address ?? req.query.diaChi) as string | undefined;
  if (!diaChi) {
    return res.status(400).json({
      error: "Missing required query parameter: address",
      example: "/api/kiem-tra?address=0x171A4217B86A807A64eB94757Db6849fb4bDbAA0",
    });
  }

  const urlTaiNguyen = `https://${req.headers.host}/api/kiem-tra?address=${diaChi}`;
  const gia = bangGia(urlTaiNguyen, MO_TA, GIA);

  // --- 2. Chua co tien: tra 402 kem bang gia ---
  const headerThanhToan = req.headers["x-payment"] as string | undefined;
  if (!headerThanhToan) {
    return res.status(402).json({
      x402Version: 2,
      error: "X-PAYMENT header is required",
      accepts: [gia],
    });
  }

  // --- 3. Giai ma chu ky uy quyen cua nguoi mua ---
  let uyQuyen: any;
  try {
    const giai = Buffer.from(headerThanhToan, "base64").toString("utf8");
    const goi = JSON.parse(giai);
    // Chap nhan ca hai dang: boc trong { payload: ... } hoac tran
    uyQuyen = goi.payload ?? goi;
    if (!uyQuyen?.signature || !uyQuyen?.authorization?.value) {
      throw new Error("thieu signature hoac authorization");
    }
  } catch (e: any) {
    return res.status(400).json({
      x402Version: 2,
      error: "X-PAYMENT header khong doc duoc: " + e.message,
      accepts: [gia],
    });
  }

  // --- 4. Nguoi mua phai tra dung so tien ---
  if (BigInt(uyQuyen.authorization.value) < BigInt(GIA)) {
    return res.status(402).json({
      x402Version: 2,
      error: `So tien uy quyen qua it. Can ${GIA}, nhan duoc ${uyQuyen.authorization.value}.`,
      accepts: [gia],
    });
  }

  // --- 5. Quyet toan tien THAT tren Arc mainnet ---
  const tien = await quyetToan(uyQuyen, gia, urlTaiNguyen);
  if (!tien.ok) {
    return res.status(402).json({ x402Version: 2, error: tien.loi, chiTiet: tien.chiTiet, accepts: [gia] });
  }

  // --- 6. Tien da ve. Gio moi giao hang. ---
  try {
    const baoCao = await kiemTraContract(diaChi);
    res.setHeader(
      "X-PAYMENT-RESPONSE",
      Buffer.from(JSON.stringify({ success: true, transaction: tien.giaoDich, network: "eip155:5042" })).toString(
        "base64"
      )
    );
    return res.status(200).json({
      thanhToan: {
        giaoDich: tien.giaoDich,
        soTien: tien.soTien,
        explorer: `https://explorer.arc.io/tx/${tien.giaoDich}`,
      },
      baoCao,
    });
  } catch (e: any) {
    // Da thu tien nhung khong doc duoc chuoi. Phai noi ro ma giao dich
    // de nguoi mua co bang chung doi lai.
    return res.status(500).json({
      error: "Da thu tien nhung doc chuoi that bai: " + locBiMat(String(e?.message ?? e)),
      giaoDichDaThu: tien.giaoDich,
    });
  }
}
