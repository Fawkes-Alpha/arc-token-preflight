const solc = require("solc");
const fs = require("fs");
const path = require("path");

const input = {
  language: "Solidity",
  sources: { "AgentEscrow.sol": { content: fs.readFileSync("AgentEscrow.sol", "utf8") } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    evmVersion: "paris",            // an toan: tranh opcode moi hon EVM cua Arc
    outputSelection: { "*": { "*": ["abi", "evm.bytecode.object", "metadata"] } },
  },
};

function timFile(p) {
  const thu = [path.join("node_modules", p), p];
  for (const f of thu) if (fs.existsSync(f)) return { contents: fs.readFileSync(f, "utf8") };
  return { error: "Khong tim thay " + p };
}

const out = JSON.parse(solc.compile(JSON.stringify(input), { import: timFile }));

const loi = (out.errors || []).filter((e) => e.severity === "error");
const canhBao = (out.errors || []).filter((e) => e.severity !== "error");
canhBao.forEach((w) => console.log("CANH BAO:", w.formattedMessage.split("\n")[0]));
if (loi.length) { loi.forEach((e) => console.error("LOI:", e.formattedMessage)); process.exit(1); }

const c = out.contracts["AgentEscrow.sol"]["AgentEscrow"];
const bytecode = "0x" + c.evm.bytecode.object;
fs.writeFileSync("AgentEscrow.json", JSON.stringify({ abi: c.abi, bytecode }, null, 2));

console.log("BIEN DICH THANH CONG");
console.log("  solc        :", solc.version());
console.log("  bytecode    :", (bytecode.length - 2) / 2, "byte");
console.log("  so ham ABI  :", c.abi.filter((x) => x.type === "function").length);
console.log("  so su kien  :", c.abi.filter((x) => x.type === "event").length);
console.log("  so loi tuy chinh:", c.abi.filter((x) => x.type === "error").length);
