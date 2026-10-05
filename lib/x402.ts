// lib/x402.ts
//
// Lop THANH TOAN. Day chinh la logic trong 2-thanh-toan.ts cua ban,
// chuyen tu "script chay bang tay" thanh "ham goi duoc tu server".
//
// Khong co khoa nao ghi cung trong file nay. Doc tu bien moi truong.

import { keccak256, toBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { randomBytes } from "node:crypto";

export const CHAIN_ID = 5042;
export const NETWORK = "eip155:5042";
export const USDC = "0x3600000000000000000000000000000000000000";
const API = "https://api.circle.com/v1/facilitator/x402";

/** Vi nguoi ban. Chi DUNG DE KY, khong bao gio gui giao dich, khong can tien. */
function viNguoiBan() {
  const tho = process.env.SELLER_PRIVATE_KEY;
  if (!tho) throw new Error("Thieu bien moi truong SELLER_PRIVATE_KEY");

  // .trim() xu ly truong hop dan kem dau cach hoac xuong dong - loi rat hay gap.
  const pk = tho.trim();

  if (!/^0x[0-9a-fA-F]{64}$/.test(pk)) {
    // Thong bao chi mo ta HINH DANG, khong bao gio lo gia tri.
    throw new Error(
      "SELLER_PRIVATE_KEY sai dinh dang. Can dung 0x + 64 ky tu hex (tong 66). " +
        `Thuc te: dai ${pk.length} ky tu; ` +
        `bat dau bang "0x": ${pk.startsWith("0x")}; ` +
        `toan bo la hex: ${/^0x?[0-9a-fA-F]+$/.test(pk)}`
    );
  }
  return privateKeyToAccount(pk as `0x${string}`);
}

export function diaChiNhanTien(): string {
  const dc = process.env.SELLER_ADDRESS;
  if (!dc) throw new Error("Thieu bien moi truong SELLER_ADDRESS");
  return dc;
}

/**
 * Bang gia tra ve trong ma 402.
 * Day la cach server noi voi may khach: "muon dung thi tra bao nhieu, tra the nao".
 */
export function bangGia(urlTaiNguyen: string, moTa: string, giaMicroUSDC: string) {
  return {
    scheme: "exact",
    network: NETWORK,
    // Mot so may khach doc `maxAmountRequired`, so khac doc `amount`. Ghi ca hai.
    maxAmountRequired: giaMicroUSDC,
    amount: giaMicroUSDC,
    resource: urlTaiNguyen,
    description: moTa,
    mimeType: "application/json",
    payTo: diaChiNhanTien(),
    maxTimeoutSeconds: 12,
    asset: USDC,
    extra: { name: "USDC", version: "2" },
  };
}

export type KetQuaQuyetToan =
  | { ok: true; giaoDich: string; soTien: string }
  | { ok: false; loi: string; chiTiet?: unknown };

/**
 * Goi Facilitator Service de thu tien that.
 *
 * `uyQuyen` la do NGUOI MUA ky: { signature, authorization: {...} }
 */
export async function quyetToan(
  uyQuyen: any,
  gia: ReturnType<typeof bangGia>,
  urlTaiNguyen: string
): Promise<KetQuaQuyetToan> {
  const seller = viNguoiBan();
  const payTo = gia.payTo;

  // Ma chong tra trung. Moi lan quyet toan mot ma khac nhau.
  const payId = "0x" + randomBytes(32).toString("hex");

  // --- Dung body gui len Facilitator. Thu tu truong phai co dinh,
  //     vi chu ky nguoi ban duoc ky tren bam (hash) cua CHINH chuoi nay. ---
  const yeuCau = {
    scheme: gia.scheme,
    network: gia.network,
    amount: uyQuyen.authorization.value,
    asset: gia.asset,
    payTo,
    maxTimeoutSeconds: gia.maxTimeoutSeconds,
    extra: { name: "USDC", version: "2" },
  };

  const body = JSON.stringify({
    x402Version: 2,
    paymentPayload: {
      x402Version: 2,
      resource: {
        url: urlTaiNguyen,
        description: gia.description,
        mimeType: "application/json",
      },
      accepted: {
        ...yeuCau,
        extra: { ...yeuCau.extra, assetTransferMethod: "eip3009" },
      },
      payload: uyQuyen,
      extensions: {
        "payment-identifier": { info: { required: true, id: payId } },
      },
    },
    paymentRequirements: yeuCau,
  });

  // --- Chu ky nguoi ban (seller proof): chung minh minh so huu dia chi nhan tien ---
  const nonce = "0x" + randomBytes(32).toString("hex");
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + 300; // chu ky song 5 phut

  const chuKy = await seller.signTypedData({
    domain: {
      name: "Circle Facilitator Seller Request",
      version: "1",
      chainId: CHAIN_ID,
    },
    types: {
      SellerRequest: [
        { name: "purpose", type: "string" },
        { name: "method", type: "string" },
        { name: "bodyHash", type: "bytes32" },
        { name: "network", type: "string" },
        { name: "payTo", type: "address" },
        { name: "nonce", type: "bytes32" },
        { name: "issuedAt", type: "uint64" },
        { name: "expiresAt", type: "uint64" },
      ],
    },
    primaryType: "SellerRequest",
    message: {
      purpose: "settle",
      method: "POST",
      bodyHash: keccak256(toBytes(body)),
      network: NETWORK,
      payTo: payTo as `0x${string}`,
      nonce: nonce as `0x${string}`,
      issuedAt: BigInt(issuedAt),
      expiresAt: BigInt(expiresAt),
    },
  });

  const proof = Buffer.from(
    JSON.stringify({
      version: 1,
      signature: chuKy,
      network: NETWORK,
      payTo,
      nonce,
      issuedAt,
      expiresAt,
    })
  ).toString("base64url");

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
    return { ok: false, loi: "Khong goi duoc Facilitator Service: " + e.message };
  }

  const text = await res.text();
  let kq: any;
  try {
    kq = JSON.parse(text);
  } catch {
    return { ok: false, loi: `Facilitator tra ve khong phai JSON (HTTP ${res.status})`, chiTiet: text.slice(0, 500) };
  }

  if (!res.ok) {
    return { ok: false, loi: `Facilitator tu choi (HTTP ${res.status})`, chiTiet: kq };
  }

  // QUAN TRONG: chi tra hang khi success === true.
  // Tren Arc ket cuc la tuc thi nen khong co trang thai cho,
  // nhung tuyet doi khong duoc coi `pending` la da tra tien.
  if (kq.success !== true) {
    return { ok: false, loi: `Thanh toan chua thanh cong: ${kq.status ?? "khong ro"}`, chiTiet: kq };
  }

  return {
    ok: true,
    giaoDich: kq.transaction,
    soTien: kq.amount ?? yeuCau.amount,
  };
}
