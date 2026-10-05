// 4-thu-doc-contract.ts
//
// Thu phan DU LIEU truoc, chua dinh gi den thanh toan.
// Chay:  npx tsx 4-thu-doc-contract.ts

import { kiemTraContract } from "./lib/doc-contract";

const MAU = [
  { nhan: "cirBTC (8 so thap phan - bay thuong gap)", dc: "0x171A4217B86A807A64eB94757Db6849fb4bDbAA0" },
  { nhan: "EURC", dc: "0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1" },
  { nhan: "USDC precompile (2 giao dien)", dc: "0x3600000000000000000000000000000000000000" },
  { nhan: "ERC-8004 registry (chua co tren mainnet)", dc: "0x8004A818BFB912233c491871b3d84c89A494BD9e" },
];

async function main() {
  for (const m of MAU) {
    console.log("\n" + "=".repeat(60));
    console.log(m.nhan);
    console.log("=".repeat(60));
    try {
      const bc = await kiemTraContract(m.dc);
      console.log(`  Loai        : ${bc.loai}`);
      console.log(`  Ten         : ${bc.ten ?? "-"}`);
      console.log(`  Ky hieu     : ${bc.kyHieu ?? "-"}`);
      console.log(`  So thap phan: ${bc.soThapPhan ?? "-"}`);
      console.log(`  Tong cung   : ${bc.tongCungDangDoc ?? "-"}`);
      console.log(`  Kich thuoc  : ${bc.kichThuocMa} byte`);
      console.log(`  Khoi        : ${bc.khoiKiemTra}`);
      if (bc.canhBao.length) {
        console.log(`  CANH BAO:`);
        bc.canhBao.forEach((c) => console.log(`    - ${c}`));
      } else {
        console.log(`  Khong co canh bao.`);
      }
    } catch (e: any) {
      console.log(`  LOI: ${e.message}`);
    }
  }
  console.log("");
}

main();
