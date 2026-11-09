import path from "node:path";
import process from "node:process";
import xlsx from "xlsx";
import { upsertWishlistItem } from "../src/database/wishlistRepository.js";
import { clearWishlistItemCache, normalizeWishlistText } from "../src/services/wishlistMatchingService.js";

const inputPath = process.argv[2];
const dryRun = process.argv.includes("--dry-run");

if (!inputPath) {
  throw new Error("Usage: node scripts/import-wishlist-tracker.js /absolute/path/to/tracker.xlsx");
}

const workbook = xlsx.readFile(path.resolve(inputPath), { cellDates: false });
const worksheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
const WISHLIST_STATUSES = new Set(["wishlist", "priority wishlist"]);

let imported = 0;
let skipped = 0;

for (const row of rows) {
  const title = String(row[0] || "").trim();
  const acquisitionStatus = String(row[1] || "").trim();
  const workflowStatus = String(row[2] || "").trim();
  if (!title || !WISHLIST_STATUSES.has(acquisitionStatus.toLowerCase())) {
    skipped += 1;
    continue;
  }

  const item = {
    title,
    normalizedTitle: normalizeWishlistText(title),
    acquisitionStatus,
    workflowStatus: workflowStatus || "Not started",
    priority: String(row[3] || "Medium").trim() || "Medium",
    category: String(row[15] || "").trim(),
    sourceReference: "Acquisition document tracker.xlsx",
    isActive: true,
  };
  if (!dryRun) {
    await upsertWishlistItem(item);
  }
  imported += 1;
}

if (!dryRun) clearWishlistItemCache();
console.log(JSON.stringify({ imported, skipped, dryRun, source: path.basename(inputPath) }));
