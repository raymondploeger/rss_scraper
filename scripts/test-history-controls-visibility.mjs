import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const styles = await readFile(new URL("../frontend/public/styles.css", import.meta.url), "utf8");

assert.match(
  styles,
  /\.profile-history-control\[hidden\]\s*\{[^}]*display:\s*none\s*!important\s*;[^}]*\}/s,
  "the hidden attribute must override .profile-history-control's inline-flex display",
);

process.stdout.write(`${JSON.stringify({ status: "passed", checks: 1 })}\n`);
