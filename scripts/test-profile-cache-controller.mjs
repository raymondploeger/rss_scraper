import assert from "node:assert/strict";
import { normalizeProfileCacheId } from "../backend/src/controllers/articleController.js";

assert.equal(normalizeProfileCacheId("central-bank"), "central_bank", "legacy central-bank route aliases the persistent cache profile");
assert.equal(normalizeProfileCacheId("passport_authority"), "passport_authority", "canonical profile ids pass through unchanged");

process.stdout.write(`${JSON.stringify({ status: "passed", checks: 2 })}\n`);
