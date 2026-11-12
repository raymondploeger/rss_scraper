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
    { title: "Albania launches service passport 2017" },
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
  matchArticleAgainstWishlist({
    title: "European Entry/Exit System contractors selected after Estonia review",
    summary: "The procurement covers border technology and visa processing across participating states.",
    contentSnippet: "Officials expect the work to continue through 2022, with several suppliers involved.",
  }, [{ id: "estonia-visa", title: "Estonia Visa 2022" }]),
  [],
  "terms scattered across an EES contractor story without document evidence do not match"
);

assert.deepEqual(
  matchArticleAgainstWishlist({
    title: "Passport Index ranks Malaysia among leading visa-free travel destinations",
    summary: "The annual ranking compares how many countries travellers can enter without a visa.",
  }, [{ id: "malaysia-visa", title: "Malaysia Visa" }]),
  [],
  "passport-index and visa-free travel context is not document evidence"
);

assert.deepEqual(
  matchArticleAgainstWishlist({
    title: "Britain revokes passport after espionage investigation",
    summary: "The case has diplomatic implications for Russia.",
    contentSnippet: "Court records refer to a trip made in 2018.",
  }, [{ id: "russia-passport", title: "Russia Passport 2018" }]),
  [],
  "passport revocation context does not match a new passport target"
);

assert.deepEqual(
  matchArticleAgainstWishlist({
    title: "Nigeria launches ECOWAS National Biometric ID Card in 2025",
    summary: "The new card will support regional identity services.",
  }, [{ id: "nigeria-ecowas-id", title: "Nigeria ECOWAS ID card 2025" }]),
  [{
    wishlistItemId: "nigeria-ecowas-id",
    confidence: "strong",
    matchedTerms: ["nigeria", "ecowas", "id card", "2025"],
    imageCandidate: null,
  }],
  "a local card launch with a neighbouring year matches"
);

assert.deepEqual(
  matchArticleAgainstWishlist({
    title: "Slovenia to issue new residence permit cards with improved security",
    summary: "The redesigned cards will be issued from 2022.",
  }, [{ id: "slovenia-permit", title: "Slovenia Residence permit 2022" }]),
  [{
    wishlistItemId: "slovenia-permit",
    confidence: "strong",
    matchedTerms: ["slovenia", "residence permit", "2022"],
    imageCandidate: null,
  }],
  "a new security-improved residence permit issuance matches"
);

assert.deepEqual(
  matchArticleAgainstWishlist({
    title: "Contract signed for new, security-upgraded Slovenian residence permit cards",
    summary: "The new cards will start to be issued at the beginning of 2022.",
  }, [{ id: "slovenia-permit", title: "Slovenia residence permit 2022" }]),
  [{
    wishlistItemId: "slovenia-permit",
    confidence: "strong",
    matchedTerms: ["slovenia", "residence permit", "2022"],
    imageCandidate: null,
  }],
  "a signed contract for security-upgraded residence permit cards matches"
);

assert.deepEqual(
  matchArticleAgainstWishlist({
    title: "Estonia introduced the new generation of identity cards, residence permit cards, digital identity cards and diplomatic identity cards in December 2018.",
  }, [{ id: "estonia-diplomatic-id", title: "Estonia Diplomatic ID card 2018" }]),
  [{
    wishlistItemId: "estonia-diplomatic-id",
    confidence: "strong",
    matchedTerms: ["estonia", "diplomatic", "id card", "2018"],
    imageCandidate: null,
  }],
  "identity cards and ID cards are equivalent document types"
);

assert.deepEqual(
  matchArticleAgainstWishlist({
    title: "Malaysia introduces new visa document with security features",
    summary: "The document will be used for selected applications.",
  }, [{ id: "malaysia-visa", title: "Malaysia Visa" }]),
  [{
    wishlistItemId: "malaysia-visa",
    confidence: "strong",
    matchedTerms: ["malaysia", "visa"],
    imageCandidate: null,
  }],
  "a new Malaysia visa document with security features matches"
);

assert.deepEqual(
  matchArticleAgainstWishlist({
    title: "The new visa document of Malaysia incorporates advanced security features.",
  }, [{ id: "malaysia-visa", title: "Malaysia visa" }]),
  [{
    wishlistItemId: "malaysia-visa",
    confidence: "strong",
    matchedTerms: ["malaysia", "visa"],
    imageCandidate: null,
  }],
  "a new visa document formulation matches without weakening Visa payment-card exclusions"
);

assert.deepEqual(
  matchArticleAgainstWishlist({
    title: "The new Luxembourg passport comes into force.",
    pubDate: "2026-05-11T03:27:00Z",
  }, [{ id: "luxembourg-passport-may-2026", title: "Luxembourg passport May 2026" }]),
  [{
    wishlistItemId: "luxembourg-passport-may-2026",
    confidence: "strong",
    matchedTerms: ["luxembourg", "passport", "2026"],
    imageCandidate: null,
  }],
  "a calendar-month target matches a local document introduction published in that month"
);

assert.deepEqual(
  matchArticleAgainstWishlist({
    title: "Visa Introduces Refreshed Visa Infinite Suite In Malaysia With Three-Tier Structure",
    summary: "The Visa Infinite payment card suite adds Samsung Wallet and bank card benefits.",
  }, [{ id: "malaysia-visa", title: "Malaysia visa" }]),
  [],
  "Visa payment products are not travel visa documents"
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
