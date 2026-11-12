import assert from "node:assert/strict";
import { matchArticleAgainstWishlist, normalizeWishlistText } from "../backend/src/services/wishlistMatchingService.js";

const wishlist = [
  { id: "albania-passport", title: "Albania Passport 2017" },
  { id: "afghan-licence", title: "Afghanistan Driving licence 2019" },
];

assert.equal(normalizeWishlistText("Côte d’Ivoire ID card"), "cote d ivoire id card");

assert.deepEqual(
  matchArticleAgainstWishlist({ title: "Albania unveils new passport design for 2017" }, wishlist),
  [{
    wishlistItemId: "albania-passport",
    confidence: "strong",
    matchedTerms: ["albania", "passport", "2017"],
    imageCandidate: null,
  }],
  "country, document type and edition year produce a strong match"
);

assert.deepEqual(
  matchArticleAgainstWishlist({ title: "Luxembourgers discuss visa-free travel" }, [
    { id: "luxembourg-passport", title: "Luxembourg passport May 2026" },
  ]),
  [],
  "country names must not match longer demonyms"
);

assert.deepEqual(
  matchArticleAgainstWishlist({ title: "Afghanistan issues updated driving licence" }, wishlist),
  [{
    wishlistItemId: "afghan-licence",
    confidence: "candidate",
    matchedTerms: ["afghanistan", "driving licence", "licence"],
    imageCandidate: null,
  }],
  "country and document type without an edition year stay a candidate"
);

assert.deepEqual(
  matchArticleAgainstWishlist({ title: "Albania launches a new border facility" }, wishlist),
  [],
  "country-only news must not create a wishlist flag"
);

assert.deepEqual(
  matchArticleAgainstWishlist({
    title: "Kosovo introduces a new passport",
    source: "Albania document news",
  }, wishlist),
  [],
  "publisher source metadata must not supply the wishlist country"
);

assert.deepEqual(
  matchArticleAgainstWishlist({
    title: "Pakistan licence reform announced",
    source: "Afghanistan transport updates",
  }, wishlist),
  [],
  "publisher source metadata must not supply the wishlist country"
);

console.log("Wishlist matching checks passed.");
