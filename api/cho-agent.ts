// api/cho-agent.ts
//
// Proxy doc Agent Marketplace cua Circle.
//
// VI SAO CAN FILE NAY:
// Trinh duyet khong cho mot trang web doc du lieu tu may chu khac tru khi
// may chu do cho phep (quy tac CORS). api.circle.com khong cho phep, nen goi
// thang tu trang se bi chan. May chu thi khong bi rang buoc do.
//
// File nay dung giua: no goi Circle, gom lai cho gon, roi tra ve kem header
// cho phep moi trang doc.
//
// Khong can khoa API. Endpoint cua Circle la cong khai.

import type { VercelRequest, VercelResponse } from "../lib/kieu-vercel";

const GOC = "https://api.circle.com/v2/x402/discovery/resources";
const ARC = "eip155:5042";

type MucGon = {
  diaChi: string;
  nhaCungCap: string | null;
  moTa: string | null;
  danhMuc: string | null;
  giaUSDC: string | null;
  luocDo: string | null;
  canNapGatewayTruoc: boolean;
  capNhatLuc: string | null;
};

/** Lay dung con so `total`, khong tai ve ca danh sach. */
async function demTong(network?: string): Promise<number> {
  const u = new URL(GOC);
  u.searchParams.set("limit", "1");
  if (network) u.searchParams.set("network", network);
  const r = await fetch(u.toString());
  if (!r.ok) throw new Error(`Circle tra ve HTTP ${r.status}`);
  const j: any = await r.json();
  return j?.pagination?.total ?? 0;
}

function gonLai(muc: any): MucGon {
  const accepts: any[] = Array.isArray(muc?.accepts) ? muc.accepts : [];
  // Mot dich vu co the nhan nhieu mang. Chi lay dieu khoan cua Arc.
  const dkArc = accepts.find((a) => a?.network === ARC) ?? null;

  const ten = dkArc?.extra?.name ?? null;

  return {
    diaChi: muc?.resource ?? "",
    nhaCungCap: muc?.metadata?.provider?.name ?? null,
    moTa: muc?.metadata?.description ?? muc?.metadata?.provider?.description ?? null,
    danhMuc: muc?.metadata?.provider?.category ?? null,
    // USDC qua giao dien ERC-20 dung 6 so thap phan.
    giaUSDC: dkArc?.amount != null ? (Number(dkArc.amount) / 1e6).toFixed(6).replace(/0+$/, "").replace(/\.$/, "") : null,
    luocDo: ten,
    // "GatewayWalletBatched" nghia la nguoi mua PHAI nap vao Gateway truoc.
    // Chi co USDC trong vi la khong du.
    canNapGatewayTruoc: ten === "GatewayWalletBatched" || muc?.metadata?.supportsCircleGateway === true,
    capNhatLuc: muc?.lastUpdated ?? null,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Day la diem mau chot: cho phep moi trang doc ket qua nay.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  // Luu dem 5 phut o bien Vercel. Danh sach khong doi tung giay,
  // va khong nen goi Circle lai moi lan co nguoi mo trang.
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");

  if (req.method === "OPTIONS") return res.status(204).end();

  const soLuong = Math.min(Number(req.query.limit ?? 50) || 50, 200);
  const boQua = Math.max(Number(req.query.offset ?? 0) || 0, 0);

  try {
    const u = new URL(GOC);
    u.searchParams.set("network", ARC);
    u.searchParams.set("limit", String(soLuong));
    u.searchParams.set("offset", String(boQua));

    const [tong, danhSach] = await Promise.all([demTong(), fetch(u.toString())]);

    if (!danhSach.ok) {
      return res.status(502).json({ loi: `Circle tra ve HTTP ${danhSach.status}` });
    }

    const j: any = await danhSach.json();
    const soTrenArc: number = j?.pagination?.total ?? 0;
    const muc: MucGon[] = (j?.items ?? []).map(gonLai);

    return res.status(200).json({
      capNhat: new Date().toISOString(),
      nguon: GOC,
      tongDichVu: tong,
      soTrenArc,
      tyLeArc: tong > 0 ? Math.round((soTrenArc / tong) * 1000) / 10 : 0,
      phanTrang: { soLuong, boQua, conNua: boQua + muc.length < soTrenArc },
      dichVu: muc,
    });
  } catch (e: any) {
    return res.status(502).json({ loi: "Khong doc duoc Agent Marketplace: " + String(e?.message ?? e) });
  }
}
