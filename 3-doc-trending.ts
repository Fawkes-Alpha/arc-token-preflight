/**
 * Doc du lieu trending, tu xu ly moi kieu ma hoa cua Windows.
 * Chay: npx tsx 3-doc-trending.ts
 */
import { readFileSync } from "node:fs";

/** Doc file, tu nhan dien UTF-16 hay UTF-8, bo BOM */
function docFile(ten: string): string {
  const buf = readFileSync(ten);
  if (buf[0] === 0xFF && buf[1] === 0xFE) {
    return buf.toString("utf16le").replace(/^\uFEFF/, "");   // UTF-16 LE (PowerShell >)
  }
  if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
    return buf.toString("utf8").slice(1);                    // UTF-8 co BOM
  }
  return buf.toString("utf8");                               // UTF-8 thuong
}

const d = JSON.parse(docFile("trending.json"));

console.log("\n=== COIN DANG THINH HANH ===\n");
for (const c of d.coins) {
  const i = c.item;
  const gia = i.data.price;
  const doi = i.data.price_change_percentage_24h.usd;
  const dau = doi >= 0 ? "+" : "";
  console.log(
    `#${String(i.market_cap_rank).padStart(4)}  ${i.symbol.padEnd(8)} ${i.name.padEnd(20)}` +
    `  $${(gia < 1 ? gia.toFixed(6) : gia.toFixed(2)).padStart(10)}   ${dau}${doi.toFixed(1)}%`
  );
}

console.log("\n=== NFT DANG THINH HANH ===\n");
for (const n of d.nfts ?? []) {
  console.log(
    `${n.symbol.padEnd(12)} ${n.name.padEnd(28)} san: ${String(n.data.floor_price).padEnd(12)}` +
    ` 24h: ${Number(n.floor_price_24h_percentage_change).toFixed(1)}%`
  );
}