// Offline reproducibility check. Run after npm ci; production postinstall uses
// checked data directly and never needs a compiler or HarfBuzz installation.
import { readFile, writeFile } from "node:fs/promises";
import compile from "dfa/compile.js";
import assert from "node:assert/strict";
const path = new URL("./fontkit-myanmar-data.json", import.meta.url);
const data = JSON.parse(await readFile(path, "utf8"));
const grammar = await readFile(
  new URL("./fontkit-myanmar.machine", import.meta.url),
  "utf8",
);
const machine = compile.default(grammar);
assert.ok(
  machine.stateTable.every((row) => row.length === 42),
  "All Myanmar category columns, including unused values, must exist.",
);
if (process.argv.includes("--write")) {
  data.machine = machine;
  await writeFile(path, JSON.stringify(data) + "\n");
} else assert.deepEqual(JSON.parse(JSON.stringify(machine)), data.machine);
console.log(
  `Myanmar DFA reproduced: ${machine.stateTable.length} states, 42 category columns.`,
);
