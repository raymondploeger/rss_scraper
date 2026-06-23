# Filtering Intelligence - Polymer False Negative Investigation 1

## Executive Summary

`Banknotes + Polymer` currently behaves as a strict parent/child Personal Dashboard selection:

1. `Banknotes` acts as the parent domain gate.
2. `Polymer` becomes the effective child interest.
3. The child match is decided by `matchesBanknoteInterest(article, "polymer")`.
4. Articles that pass the banknote domain gate but fail the Polymer child match are rejected as `parentChildMismatch`.

Many of those rejections are expected. Collectible banknote marketplace items, generic counterfeit-cash stories, and banknote-adjacent news without Polymer/substrate evidence should not pass `Banknotes + Polymer`.

The investigation question is narrower: among `parentChildMismatch` articles, are there real Polymer-banknote articles that contain high-precision Polymer/substrate clues but still fail the current thresholds?

## Current Decision Point

The authoritative Polymer child matcher is:

```js
matchesBanknoteInterest(article, "polymer")
```

Current pass conditions remain:

```js
getArticleDominantDomain(article) === "banknotes"
&& (signals.polymerHits >= 3 || signals.substrateHits >= 4)
```

The Polymer diagnostics added in the previous phase expose:

- `dominantDomain`
- `polymerHits`
- `substrateHits`
- `polymerThresholdPassed`
- `substrateThresholdPassed`
- `childMatched`
- `likelyReason`
- matched Polymer/substrate terms

This phase adds a debug-only helper to search the latest decision trace store for likely false negatives.

## Helper Added

When Filter Pipeline diagnostics are enabled, the browser console now exposes:

```js
window.listLikelyPolymerFalseNegatives(limit)
```

The helper inspects the latest trace store only. It does not fetch data, does not modify articles, and does not influence filtering.

It returns rejected `parentChildMismatch` articles that also contain high-precision Polymer/substrate clues.

Each result includes:

- `articleId`
- `title`
- `finalReason`
- `polymerHits`
- `substrateHits`
- `matchedClues`
- `likelyFalseNegativeReason`

## High-Precision Clues

The helper checks for these clues in the trace title and Polymer diagnostic matched-term metadata:

- `polymer transition`
- `transition to polymer`
- `polymer migration`
- `guardian`
- `guardian polymer`
- `guardian substrate`
- `ccl secure`
- `safenote`
- `synthetic substrate`
- `composite substrate`
- `durable substrate`
- `plastic banknote`
- `polymer banknote`
- `polymer note`
- `polymer substrate`

These clues are intentionally narrow. The helper should not flag generic banknote, collectible, or counterfeit-cash articles unless they also contain Polymer/substrate-specific language.

## How To Run The Investigation

1. Enable diagnostics:

```js
localStorage.setItem("debugFilterPipeline", "1")
```

2. Select:

- Personal Dashboard ON
- Banknotes
- Polymer

3. Run:

```js
window.listLikelyPolymerFalseNegatives()
```

4. Export compact diagnostics:

```js
window.exportFilterPipelineDiagnostics()
```

The export includes:

```js
polymerFalseNegativeDiagnostics: {
  enabled,
  evaluatedRejectedArticles,
  likelyFalseNegativeCount,
  topMatchedClues
}
```

Full article traces are still not exported by default.

## How To Interpret Results

### Likely True False Negative

An article is a strong false-negative candidate when:

- final rejection is `parentChildMismatch`,
- `dominantDomain` is `banknotes`,
- `polymerHits` is below `3`,
- `substrateHits` is below `4`,
- and `matchedClues` includes a high-precision clue such as `polymer transition`, `ccl secure`, `safenote`, or `guardian`.

These are the cases most likely to need vocabulary support.

### Likely Correct Rejection

An article is likely correctly rejected when:

- it has no high-precision Polymer/substrate clues,
- it is mostly about collectible notes, e-commerce, auctions, counterfeits, general cash crime, or generic currency news,
- or it has `dominantDomain` outside `banknotes`.

These should remain excluded from `Banknotes + Polymer`.

### Borderline Case

An article may be borderline when:

- it mentions `substrate` only once,
- it references a vendor or product indirectly,
- or the title suggests Polymer relevance but the trace metadata lacks enough supporting terms.

These should be reviewed before changing thresholds.

## Diagnostic Limitations

The helper only inspects the latest in-memory trace store. It does not query the database and does not re-run extraction.

Because full article objects are not stored in diagnostics, clue matching is limited to:

- trace title,
- matched Polymer terms,
- matched substrate terms.

That is enough to identify obvious false-negative classes, but it may miss body-only clues that were not already captured by Polymer diagnostic term metadata.

## Expected Findings

The most useful findings should fall into one of these buckets:

1. Articles with `polymer transition` / `transition to polymer` in the title or trace text.
2. Articles referencing substrate brands or product lines such as `Guardian`, `SAFENOTE`, or `CCL Secure`.
3. Articles using substrate terminology that is precise but currently under-counted, such as `synthetic substrate`, `composite substrate`, or `durable substrate`.
4. Articles with one high-precision body/title clue but hit counts below the current `polymerHits >= 3` or `substrateHits >= 4` thresholds.

## Recommended Smallest Safe Vocabulary Change

Do not lower thresholds first.

The safest next behavior change, if the helper confirms real false negatives, is to add narrow Polymer/substrate vocabulary to the existing Polymer child-match term arrays while keeping:

- the Banknotes dominant-domain requirement,
- `polymerHits >= 3`,
- `substrateHits >= 4`,
- and existing parent/child behavior.

Suggested terms to evaluate first:

- `polymer transition`
- `transition to polymer`
- `polymer migration`
- `guardian polymer`
- `ccl secure`
- `safenote`
- `synthetic substrate`
- `composite substrate`
- `durable substrate`

This should recover genuine Polymer-banknote articles without making `Banknotes + Polymer` behave like broad `Banknotes`.
