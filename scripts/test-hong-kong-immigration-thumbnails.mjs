import assert from "node:assert/strict";
import { isLikelyGenericMetadataImage } from "../backend/src/services/thumbnailService.js";

assert.equal(
  isLikelyGenericMetadataImage("https://www.immd.gov.hk/images/common/footer/top.png"),
  true,
);
assert.equal(
  isLikelyGenericMetadataImage("https://www.immd.gov.hk/images/press/20260213a.jpg"),
  false,
);

process.stdout.write(`${JSON.stringify({ status: "passed", checks: 2 })}\n`);
