const fs = require("fs");
const path = require("path");

const contracts = ["MockUSDC", "RWAShare", "RWAVault"];
const outDir = path.join(__dirname, "..", "frontend", "src", "abi");
fs.mkdirSync(outDir, { recursive: true });

for (const name of contracts) {
  const artifactPath = path.join(
    __dirname,
    "..",
    "artifacts",
    "contracts",
    `${name}.sol`,
    `${name}.json`
  );
  const { abi } = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const content = `export const ${name}Abi = ${JSON.stringify(abi, null, 2)} as const;\n`;
  fs.writeFileSync(path.join(outDir, `${name}.ts`), content);
  console.log(`wrote ${name} (${abi.length} entries)`);
}
