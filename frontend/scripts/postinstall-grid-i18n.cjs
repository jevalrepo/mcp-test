const fs = require("fs");
const path = require("path");

const target = path.join(
  __dirname,
  "..",
  "node_modules",
  "react-open-source-grid",
  "dist",
  "lib",
  "index.js",
);

if (!fs.existsSync(target)) {
  console.warn("[grid-i18n] Archivo no encontrado, se omite parche:", target);
  process.exit(0);
}

let content = fs.readFileSync(target, "utf8");
let changed = false;

// Revert accidental broken token replacement from previous script versions.
const repaired = content.replace(/for\s*\(const\s+([^)]+?)\s+de\s+([^)]+?)\)/g, "for (const $1 of $2)");
if (repaired !== content) {
  content = repaired;
  changed = true;
}

// Only replace user-facing string literals, never JS keywords.
const replacements = [
  ['"Rows per page:"', '"Filas por pagina:"'],
  ['"No rows"', '"Sin filas"'],
  ['" of "', '" de "'],
  [`fontFamily: 'Roboto, "Helvetica Neue", Arial, sans-serif'`, `fontFamily: '"Consolas", monospace'`],
];

for (const [from, to] of replacements) {
  if (content.includes(from)) {
    content = content.split(from).join(to);
    changed = true;
  }
}

if (changed) {
  fs.writeFileSync(target, content, "utf8");
  console.log("[grid-i18n] Traducciones aplicadas a react-open-source-grid.");
} else {
  console.log("[grid-i18n] No hubo cambios (posible version ya parcheada).");
}
