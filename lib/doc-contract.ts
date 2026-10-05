// lib/doc-contract.ts
//
// Day la "hang" ma API cua ban ban: mot ban kiem tra nhanh (pre-flight check)
// mot contract token tren Arc mainnet.
//
// Khong co bi mat nao trong file nay. Chi doc du lieu cong khai tu chuoi.

import { createPublicClient, http, getAddress, formatUnits } from "viem";
import { arc } from "viem/chains";

// RPC cong khai cua Arc mainnet. Co the ghi de bang bien moi truong ARC_RPC_URL.
const RPC = process.env.ARC_RPC_URL || "https://rpc.mainnet.arc.io";

export const chuoi = createPublicClient({
  chain: arc,
  transport: http(RPC),
});

// --- Cac dia chi dac biet tren Arc, dung de canh bao ---
const USDC_PRECOMPILE = "0x3600000000000000000000000000000000000000".toLowerCase();
const EMITTER_HE_THONG = "0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE".toLowerCase();

// --- ABI toi thieu. Chi khai bao dung ham can goi. ---
const ABI_ERC20 = [
  { name: "name", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { name: "symbol", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { name: "decimals", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { name: "totalSupply", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;

const ABI_INTERFACE = [
  {
    name: "supportsInterface",
    type: "function",
    stateMutability: "view",
    inputs: [{ type: "bytes4" }],
    outputs: [{ type: "bool" }],
  },
] as const;

// Ma nhan dang chuan ERC-165 cho tung loai token
const ID_ERC721 = "0x80ac58cd";
const ID_ERC1155 = "0xd9b67a26";
const ID_METADATA_721 = "0x5b5e139f";

// Kieu du lieu tra ve. Dinh nghia ro rang de sau nay dung lam tai lieu API.
export type BaoCaoContract = {
  diaChi: string;
  mang: "arc-mainnet";
  chainId: number;
  khoiKiemTra: string;
  thoiDiem: string;

  coMaNguon: boolean;
  kichThuocMa: number;

  loai: "ERC-20" | "ERC-721" | "ERC-1155" | "khong-ro" | "khong-phai-contract";

  ten: string | null;
  kyHieu: string | null;
  soThapPhan: number | null;
  tongCung: string | null;
  tongCungDangDoc: string | null;

  canhBao: string[];
};

/** Goi mot ham contract, loi thi tra ve null thay vi nem ra ngoai. */
async function thuDoc<T>(viec: () => Promise<T>): Promise<T | null> {
  try {
    return await viec();
  } catch {
    return null;
  }
}

export async function kiemTraContract(diaChiNhapVao: string): Promise<BaoCaoContract> {
  // getAddress se nem loi neu dia chi sai dinh dang -> route se bat va tra 400
  const diaChi = getAddress(diaChiNhapVao.trim());
  const thap = diaChi.toLowerCase();

  const [khoi, ma] = await Promise.all([
    chuoi.getBlockNumber(),
    chuoi.getCode({ address: diaChi }),
  ]);

  const kichThuocMa = ma && ma !== "0x" ? (ma.length - 2) / 2 : 0;
  const coMaNguon = kichThuocMa > 0;

  const canhBao: string[] = [];

  // --- Cac dia chi dac biet cua Arc. Phai kiem tra DOC LAP voi viec
  //     co bytecode hay khong: USDC tai 0x3600... VAN co bytecode (1798 byte),
  //     nhung no la dong tien ban dia cua chuoi nen van co hai giao dien. ---
  if (thap === USDC_PRECOMPILE) {
    canhBao.push(
      "Day la USDC - dong tien ban dia dung de tra gas cua Arc, khong phai token thuong. " +
        "No co HAI giao dien dung CHUNG mot so du: ban dia 18 so thap phan va ERC-20 6 so thap phan. " +
        "Tron lan hai giao dien gay sai so 10^12. Luu y: balanceOf() tra ve 0 KHONG co nghia la so du ban dia bang 0 " +
        "(do lam tron khi chia cho 10^12)."
    );
  } else if (thap === EMITTER_HE_THONG) {
    canhBao.push(
      "Day la dia chi phat su kien cua he thong Arc (EIP-7708), khong phai token. " +
        "Chuyen khoan ban dia phat log Transfer tu dia chi nay."
    );
  }

  // Truong hop: khong co ma nguon o dia chi nay
  if (!coMaNguon) {
    if (thap !== USDC_PRECOMPILE && thap !== EMITTER_HE_THONG) {
      canhBao.push(
        "Khong co ma nguon o dia chi nay tren Arc mainnet. " +
          "Day co the la vi thuong, hoac contract chi ton tai tren testnet."
      );
      return {
        diaChi,
        mang: "arc-mainnet",
        chainId: arc.id,
        khoiKiemTra: khoi.toString(),
        thoiDiem: new Date().toISOString(),
        coMaNguon: false,
        kichThuocMa: 0,
        loai: "khong-phai-contract",
        ten: null,
        kyHieu: null,
        soThapPhan: null,
        tongCung: null,
        tongCungDangDoc: null,
        canhBao,
      };
    }
  }

  // Doc song song moi thu. Cai nao loi thi la null.
  const [ten, kyHieu, soThapPhan, tongCung, la721, la1155, coMeta721] = await Promise.all([
    thuDoc(() => chuoi.readContract({ address: diaChi, abi: ABI_ERC20, functionName: "name" })),
    thuDoc(() => chuoi.readContract({ address: diaChi, abi: ABI_ERC20, functionName: "symbol" })),
    thuDoc(() => chuoi.readContract({ address: diaChi, abi: ABI_ERC20, functionName: "decimals" })),
    thuDoc(() => chuoi.readContract({ address: diaChi, abi: ABI_ERC20, functionName: "totalSupply" })),
    thuDoc(() =>
      chuoi.readContract({ address: diaChi, abi: ABI_INTERFACE, functionName: "supportsInterface", args: [ID_ERC721] })
    ),
    thuDoc(() =>
      chuoi.readContract({ address: diaChi, abi: ABI_INTERFACE, functionName: "supportsInterface", args: [ID_ERC1155] })
    ),
    thuDoc(() =>
      chuoi.readContract({
        address: diaChi,
        abi: ABI_INTERFACE,
        functionName: "supportsInterface",
        args: [ID_METADATA_721],
      })
    ),
  ]);

  // Phan loai
  let loai: BaoCaoContract["loai"] = "khong-ro";
  if (la721 === true) loai = "ERC-721";
  else if (la1155 === true) loai = "ERC-1155";
  else if (soThapPhan !== null) loai = "ERC-20";

  // --- Sinh canh bao ---
  if (loai === "ERC-20" && soThapPhan !== null) {
    if (soThapPhan !== 18 && soThapPhan !== 6) {
      canhBao.push(
        `So thap phan la ${soThapPhan}, khong phai 18 cung khong phai 6. ` +
          `Phai chia cho 10^${soThapPhan} khi hien thi. Hard-code 18 se sai so.`
      );
    }
  }

  if (loai === "khong-ro" && coMaNguon) {
    canhBao.push(
      "Contract co ton tai nhung khong tra loi decimals() cung khong khai bao ERC-165. " +
        "Co the khong phai token, hoac la proxy chua tro toi implementation."
    );
  }

  if (tongCung !== null && tongCung === 0n) {
    canhBao.push("Tong cung bang 0. Token da trien khai nhung chua phat hanh gi.");
  }

  if (ten === null && kyHieu === null && coMaNguon) {
    canhBao.push("Khong doc duoc ca name() va symbol(). Contract khong theo chuan metadata.");
  }

  if (loai === "ERC-721" && coMeta721 !== true) {
    canhBao.push("La ERC-721 nhung khong ho tro phan metadata. Se khong co tokenURI / anh.");
  }

  return {
    diaChi,
    mang: "arc-mainnet",
    chainId: arc.id,
    khoiKiemTra: khoi.toString(),
    thoiDiem: new Date().toISOString(),
    coMaNguon,
    kichThuocMa,
    loai,
    ten: (ten as string) ?? null,
    kyHieu: (kyHieu as string) ?? null,
    soThapPhan: (soThapPhan as number) ?? null,
    tongCung: tongCung !== null ? (tongCung as bigint).toString() : null,
    tongCungDangDoc:
      tongCung !== null && soThapPhan !== null
        ? formatUnits(tongCung as bigint, soThapPhan as number)
        : null,
    canhBao,
  };
}
