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

const albaniaServicePassport = [
  { id: "albania-service-passport", title: "Albania Service Passport 2017" },
];

assert.deepEqual(
  matchArticleAgainstWishlist(
    { title: "Albania passport 2017" },
    albaniaServicePassport
  ),
  [],
  "a service passport must not match an ordinary passport"
);

assert.deepEqual(
  matchArticleAgainstWishlist(
    { title: "Albania service passport 2017" },
    albaniaServicePassport
  ),
  [{
    wishlistItemId: "albania-service-passport",
    confidence: "strong",
    matchedTerms: ["albania", "service", "passport", "2017"],
    imageCandidate: null,
  }],
  "a service passport produces a strong match"
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
  [],
  "an item with an explicit year must not fall back to a candidate without that year"
);

assert.deepEqual(
  matchArticleAgainstWishlist({ title: "Afghanistan issues 2018 driving licence" }, wishlist),
  [],
  "a different edition year must not match"
);

assert.deepEqual(
  matchArticleAgainstWishlist({ title: "Afghanistan issues 2019 driving license" }, wishlist),
  [{
    wishlistItemId: "afghan-licence",
    confidence: "strong",
    matchedTerms: ["afghanistan", "driving license", "2019"],
    imageCandidate: null,
  }],
  "licence and license are equivalent"
);

assert.deepEqual(
  matchArticleAgainstWishlist(
    { title: "Germany issues its 2024 driving licence" },
    [{ id: "germany-heavy", title: "Germany Driving licence heavy vehicle 2024" }]
  ),
  [],
  "a meaningful document variant must be present"
);

assert.deepEqual(
  matchArticleAgainstWishlist(
    { title: "Germany issues 2024 heavy vehicle driving licence" },
    [{ id: "germany-heavy", title: "Germany Driving licence heavy vehicle 2024" }]
  ),
  [{
    wishlistItemId: "germany-heavy",
    confidence: "strong",
    matchedTerms: ["germany", "driving license", "heavy", "vehicle", "2024"],
    imageCandidate: null,
  }],
  "a complete document variant produces a strong match"
);

assert.deepEqual(
  matchArticleAgainstWishlist(
    { title: "Albania presents the 2017 passport edition" },
    [
      { id: "albania-2017", title: "Albania Passport 2017" },
      { id: "albania-2020", title: "Albania Passport 2020" },
    ]
  ),
  [{
    wishlistItemId: "albania-2017",
    confidence: "strong",
    matchedTerms: ["albania", "passport", "2017"],
    imageCandidate: null,
  }],
  "only the exact active edition may be returned when multiple years are active"
);

assert.deepEqual(
  matchArticleAgainstWishlist(
    { title: "Albania introduces a 2017 passport", source: "Albania Passport 2020" },
    [
      { id: "albania-2017", title: "Albania Passport 2017" },
      { id: "albania-2020", title: "Albania Passport 2020" },
    ]
  ),
  [{
    wishlistItemId: "albania-2017",
    confidence: "strong",
    matchedTerms: ["albania", "passport", "2017"],
    imageCandidate: null,
  }],
  "source metadata must not create a second match"
);

assert.deepEqual(
  matchArticleAgainstWishlist(
    { title: "Albania passport 2017 and 2020 editions compared" },
    [
      { id: "albania-2017", title: "Albania Passport 2017" },
      { id: "albania-2020", title: "Albania Passport 2020" },
    ]
  ),
  [],
  "ambiguous articles must not store any wishlist match"
);

assert.deepEqual(
  matchArticleAgainstWishlist(
    { title: "Albania introduces passport 2017" },
    [{ id: "completed", title: "Albania Passport 2017", isActive: true, workflowStatus: "Completed" }]
  ),
  [],
  "completed wishlist items are not active matching targets"
);

assert.deepEqual(
  matchArticleAgainstWishlist(
    { title: "Albania introduces passport 2017" },
    [{ id: "inactive", title: "Albania Passport 2017", isActive: false, workflowStatus: "Not started" }]
  ),
  [],
  "inactive wishlist items are not matching targets"
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
