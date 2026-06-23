# Filtering Intelligence - Polymer Analysis 1

## Executive Summary

For the Personal Dashboard selection `Banknotes + Polymer`, the large `parentChildMismatch` count is caused by the intended parent/child behavior:

1. `Banknotes` acts as a parent domain gate.
2. `Polymer` becomes the effective child filter.
3. Articles must be classified as `banknotes` and then pass `matchesBanknoteInterest(article, "polymer")`.
4. If the article passes the Banknotes domain gate but does not pass the Polymer child matcher, `classifyPersonalDashboardRejection()` records `parentChildMismatch`.

The reported diagnostics are therefore consistent with the current implementation: the candidate pool is broad and many articles receive positive banknote-related scoring, but the Polymer child gate is much stricter than the Banknotes parent gate.

The likely bottleneck is a combination of:

- missing or uneven Polymer vocabulary between different parts of the code,
- strict hit thresholds for Polymer/substrate child matching,
- and parent/child handling that intentionally narrows `Banknotes + Polymer` to Polymer-specific banknote articles.

This does not look primarily like a backend candidate-pool issue.

## A. Where Polymer Matching Is Implemented

Polymer appears in several different layers of `frontend/public/app.js`.

### Personal Dashboard Interest Configuration

The Banknote Intelligence dashboard defines Polymer as a child interest:

```js
{ id: "polymer", label: "Polymer", strong: ["polymer note", "polymer banknote", "polymer banknotes", "polymer substrate"], weak: ["polymer"], eventTypes: ["polymer_migration", "banknote_redesign"] }
```

This configuration lives near the Banknote Intelligence interest list. It defines the UI interest and its declared strong/weak terms, but the final child match is not decided directly by this object.

### Backend Retrieval Term Profile

The Personal Dashboard backend retrieval plan has Polymer-specific search terms:

```js
polymer: [
  "polymer",
  "polymer banknote",
  "polymer note",
  "polymer substrate",
]
```

This helps retrieve candidate articles when Polymer is selected. It expands the candidate pool, but it does not decide final inclusion.

### Banknote Signal Extraction

`getBanknoteInterestSignals(article)` calculates weighted signal counts. Polymer and substrate are counted separately:

```js
const polymerTerms = [
  "polymer note",
  "polymer banknote",
  "polymer banknotes",
  "polymer substrate",
  "polymer currency",
  "guardian substrate",
  "ccl substrate",
  "hybrid substrate",
  "plastic banknote",
];

const substrateTerms = [
  "substrate",
  "polymer substrate",
  "paper substrate",
  "guardian substrate",
  "ccl substrate",
  "hybrid substrate",
  "substrate migration",
];
```

The weighting function gives more weight to title matches than body matches:

```js
title * 5 + tags * 2 + metadata * 2 + body
```

### Banknote Signal Tags

`getBanknoteSignalMatches(text)` also treats Polymer as a high-confidence signal when the text contains:

```js
"polymer", "polymer substrate", "substrate migration", "polymer transition", "plastic banknote"
```

This signal/tag layer is broader than the Polymer child matcher. That matters because an article can look Polymer-relevant in signal metadata while still failing `matchesBanknoteInterest(article, "polymer")`.

## B. Function That Decides Polymer Child Match

The authoritative child matcher is:

```js
matchesBanknoteInterest(article, "polymer")
```

For every banknote child interest, the function first requires:

```js
getArticleDominantDomain(article) === "banknotes"
```

Then Polymer passes only when:

```js
signals.polymerHits >= 3 || signals.substrateHits >= 4
```

So the Polymer child match requires both:

- dominant domain: `banknotes`,
- and enough weighted Polymer or substrate hits.

## C. Current Polymer Signals

### Declared Strong Terms

From the Personal Dashboard interest config:

- `polymer note`
- `polymer banknote`
- `polymer banknotes`
- `polymer substrate`

### Declared Weak Terms

- `polymer`

### Event Types

- `polymer_migration`
- `banknote_redesign`

### Final Child-Matcher Polymer Terms

The actual child matcher receives `polymerHits` from:

- `polymer note`
- `polymer banknote`
- `polymer banknotes`
- `polymer substrate`
- `polymer currency`
- `guardian substrate`
- `ccl substrate`
- `hybrid substrate`
- `plastic banknote`

### Final Child-Matcher Substrate Terms

The child matcher receives `substrateHits` from:

- `substrate`
- `polymer substrate`
- `paper substrate`
- `guardian substrate`
- `ccl substrate`
- `hybrid substrate`
- `substrate migration`

## D. Strong vs Weak Signal Behavior

There is a declared strong/weak distinction in the Personal Dashboard interest configuration, but `matchesBanknoteInterest(article, "polymer")` does not directly use that strong/weak object.

Instead, the final child matcher uses weighted hit counts from `getBanknoteInterestSignals()`:

- title hits are strong in practice because they count 5 times,
- tag and metadata hits count 2 times,
- body hits count 1 time.

This means a single title hit such as `polymer banknote` should generally pass the `polymerHits >= 3` threshold, while body-only mentions may need repeated evidence.

## E. Why `parentChildMismatch` Fires

For `Banknotes + Polymer`, `resolvePersonalDashboardParentChildInterests()` marks the parent as a domain gate:

```js
parentActsAsDomainGate = hasParent && childIds.length > 0
```

When this is true, the effective interests become only the selected children:

```js
effectiveInterestIds: parentActsAsDomainGate ? childIds : groupInterestIds
```

Then `articleMatchesPersonalDashboardSelection(article)` requires:

```js
banknoteInterestIds.some((interestId) => matchesBanknoteInterest(article, interestId))
```

For `Banknotes + Polymer`, that effectively becomes:

```js
matchesBanknoteInterest(article, "polymer")
```

If that returns false, `classifyPersonalDashboardRejection(article)` reports:

```js
{
  category: "parentChildMismatch",
  reason: "banknote parent matched as domain gate but selected child did not match"
}
```

So the high `parentChildMismatch` count means:

- the article is within or near the Banknotes domain,
- but the Polymer child interest did not meet the current Polymer/substrate hit threshold.

## F. Likely False Negatives

Based on code rules, likely false negatives are articles that humans may treat as Polymer-related but that do not produce `polymerHits >= 3` or `substrateHits >= 4`.

Examples of likely patterns:

- Articles using `polymer transition` or `transition to polymer`. `polymer transition` exists in banknote signal tagging, but not in the final `polymerTerms` array used for `polymerHits`.
- Articles using `polymer migration`. `polymer_migration` is configured as an event type, but the child matcher is driven by weighted keyword hits rather than direct event-type acceptance.
- Articles saying `Guardian` without the phrase `guardian substrate`. The final matcher knows `guardian substrate`, but not standalone `Guardian`.
- Articles saying `CCL Secure`, `SAFENOTE`, or other substrate product/source terminology without `ccl substrate` or `polymer substrate`.
- Articles discussing a `new substrate`, `durable substrate`, `synthetic substrate`, or `composite substrate` with banknote context. The current substrate matcher includes generic `substrate`, but requires `substrateHits >= 4`, so sparse body-only mentions can fail.
- Articles where Polymer appears only once in the body. A single body hit scores 1, below the `polymerHits >= 3` threshold.

These are likely false-negative classes, not confirmed records, because this analysis did not modify the app or run a new article-level trace export.

## G. Root Cause Classification

### Missing Polymer Vocabulary

Likely yes.

The code already has multiple Polymer vocabularies, and they are not identical:

- interest config includes the high-level UI terms,
- backend retrieval includes broad retrieval terms,
- signal tagging includes `polymer transition`,
- final child matching includes `plastic banknote` but omits some transition/product terminology.

The mismatch between these vocabularies can make diagnostics look positive while the child matcher still rejects the article.

### Too Strict Threshold

Possibly yes.

`polymerHits >= 3` is reasonable for title/tag/metadata matches, but strict for body-only matches. `substrateHits >= 4` is especially strict for articles that mention substrate once or twice in body text.

Lowering thresholds broadly would be risky because `polymer` alone can appear in generic materials contexts. A safer approach would be to add precise vocabulary and context-aware signal capture before changing thresholds.

### Wrong Parent/Child Handling

Not clearly.

The parent/child logic is doing what the current design says:

- parent-only `Banknotes` is broad,
- parent + child `Banknotes + Polymer` is narrow.

The mismatch count is high because Polymer is narrow, not because the parent/child mechanism is obviously broken.

### Backend Candidate Pool Too Broad

No, not as the primary issue.

The reported candidate pool of 1370 and positive score count of 1255 indicate retrieval is broad enough for this scenario. The losses happen at the Personal Dashboard child-matching stage.

### Combined Assessment

The issue is most likely a combination of missing/uneven Polymer vocabulary and strict child thresholds, amplified by correct but narrow parent/child handling.

## H. Recommended Smallest Safe Next Step

The safest next implementation should be diagnostics-first, then vocabulary-first:

1. Add Polymer-specific trace metadata to the existing Personal Dashboard score/decision trace:
   - `polymerHits`
   - `substrateHits`
   - matched Polymer terms if already cheaply available
   - matched substrate terms if already cheaply available
   - dominant domain
   - parent/child resolution state

2. Use those traces on `Banknotes + Polymer` to confirm the top false-negative patterns.

3. If confirmed, add only high-precision Polymer/substrate vocabulary to the final `polymerTerms` / `substrateTerms` arrays before lowering any threshold.

Candidate precise terms to evaluate later:

- `polymer transition`
- `transition to polymer`
- `polymer migration`
- `guardian`
- `guardian polymer`
- `guardian substrate`
- `safenote`
- `ccl secure`
- `synthetic substrate`
- `composite substrate`
- `durable substrate`

The smallest safe behavior change later would be to expand the Polymer child vocabulary with high-precision terms that still require Banknotes dominant-domain context, rather than reducing `polymerHits` or `substrateHits` thresholds globally.

