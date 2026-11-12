import assert from "node:assert/strict";
import { buildArticleWhere } from "../backend/src/database/articleRepository.js";

assert.deepEqual(
  buildArticleWhere({ wishlistOnly: true }),
  {
    wishlistMatches: {
      some: {
        confidence: "strong",
        wishlistItem: {
          isActive: true,
          workflowStatus: { not: "Completed" },
        },
      },
    },
  },
  "wishlistOnly requires a strong match for an active, non-completed wishlist item"
);

console.log("Wishlist repository contract checks passed.");
