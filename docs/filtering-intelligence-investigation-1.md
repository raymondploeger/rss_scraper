# Filtering Intelligence Investigation 1

## Summary

This investigation maps the legacy Personal Dashboard decision path in `frontend/public/app.js`.
No application behavior was changed.

The key finding is that `articleMatchesPersonalDashboardSelection()` is the authoritative pass/fail decision point. The best existing signals to connect to `personalDashboardScore` are produced immediately around that function:

- `getPersonalDashboardDomainMatch()`
- `calculatePersonalDomainScore()`
- `getArticleDominantDomain()`
- `computePersonalInterestBoost()`
- `matchesSelectedSharedSecurityTechnique()`
- `articleMatchesSelectedIdentityTechniqueBridge()`
- `articleMatchesSelectedBanknoteTechniqueBridge()`
- `classifyPersonalDashboardRejection()`

## A. Key Functions Found

### `articleMatchesPersonalDashboardSelection(article)`

This is the main legacy matcher. It returns the final Personal Dashboard boolean for an article.

It handles:

- no Personal Dashboard selection
- Shared Security-only selections
- primary domain mismatch
- Identity + Shared Security bridge
- Banknotes + Shared Security bridge
- Shared Security technique matching
- Banknotes parent/child logic
- Identity Documents interest thresholds
- Digital Identity subgroup matching

### `classifyPersonalDashboardRejection(article)`

This is the diagnostics-side mirror for rejection reasons. It does not decide inclusion for rendering, but it categorizes why the same legacy logic would reject an article.

It returns categories such as:

- `techniqueRejected`
- `primaryDomainMismatch`
- `parentChildMismatch`
- `banknoteMismatch`
- `scoreTooLow`
- `identityMismatch`
- `sharedSecurityMismatch`
- `unknown`

### `getArticleDominantDomain(article)`

This determines the article's primary domain:

- `banknotes`
- `identity_documents`
- `digital_identity_biometrics`
- `other`

It compares banknote, identity, and digital identity scores using existing context profiles and source/topic signals.

### `getPersonalDashboardDomainMatch(article)`

This computes selected-domain matching and returns:

- `matched`
- `matchedDomains`
- `selectedDomains`
- `domainScores`

This is a strong candidate for populating main-domain score contributions because it already exposes selected-domain matches and thresholds.

### `calculatePersonalDomainScore(article, selectedInterests)`

This computes the aggregate Personal Dashboard domain score and relevance band. It is used by `computePersonalBoost()`.

It returns:

- `domainScore`
- `domain`
- `relevanceBand`

### `computePersonalInterestBoost(article, interestId)`

This computes per-interest scores and simple match state.

It returns:

- `score`
- `matched`

Many group-specific match decisions use this score, especially Identity Documents where the legacy threshold is commonly `score >= 18`.

### `matchesSelectedSharedSecurityTechnique(article, selectedInterests)`

This decides whether any selected Shared Security technique is included by `getSharedSecurityStandaloneAssessment()`.

### `getSharedSecurityStandaloneAssessment(article, interestId)`

This exposes detailed technique evidence such as:

- `included`
- `directMatch`
- `hybridMatch`
- `bodyContextBridgeMatch`
- `interestScore`
- hit counts and negative hits

### Bridge Functions

These functions provide existing combination bridge decisions:

- `articleMatchesSelectedIdentityTechniqueBridge(article, selectedInterests)`
- `articleMatchesSelectedBanknoteTechniqueBridge(article, selectedInterests)`
- `matchesIdCardsHolographyOvdCombinationBridge(article, selectedIdentityInterests, selectedSharedInterests)`

### `getVisibleArticles(options)`

This is a legacy visible-article helper used outside the matcher itself. It combines filtering, Personal Dashboard checks, sorting, and other article visibility rules in some paths.

### `articleMatchesFilters(article, options)`

This applies non-dashboard article filters and can call `articleMatchesPersonalDashboardSelection()` unless `ignorePersonalDashboard` is set.

## B. Call Flow

Current high-level flow:

1. Pipeline candidate provider returns article candidates.
2. Legacy filter pipeline replay applies:
   - feed scope
   - Personal Dashboard
   - advanced filters
   - sorting
   - grouping
   - pagination
3. Personal Dashboard stage calls `articleMatchesPersonalDashboardSelection(article)`.
4. If rejected, diagnostics call `classifyPersonalDashboardRejection(article)`.
5. Decision tracing records the stage result.
6. `buildPersonalDashboardScore()` currently runs in the Personal Dashboard diagnostics stage.

Important rendering path:

`executePipelineOrchestrator()`
to `executeArticlePipeline()`
to `applyLegacyFilterPipeline()`
to `replayFilterDiagnosticsStage()`
to `applyPersonalDashboardStage()`
to `articleMatchesPersonalDashboardSelection()`

## C. Where Pass/Fail Is Decided

The final legacy Personal Dashboard pass/fail decision is made in:

`articleMatchesPersonalDashboardSelection(article)`

Major branches:

- No selections: returns `true`.
- Shared Security-only: returns `matchesSelectedSharedSecurityTechnique(...)`.
- Primary domain `other` without bridge: returns `false`.
- Selected main domain mismatch without selected bridge: returns `false`.
- Shared Security selected: requires technique match or bridge.
- Banknotes-only: uses contamination guard, parent/child resolution, `matchesBanknoteInterest()`, and banknote bridge.
- Identity Documents: rejects navigation pages, then requires selected identity interest score `>= 18` or ID Cards Holography/OVD bridge.
- Digital Identity: requires selected subgroup hybrid assessment if child interests are selected.
- Fallback: returns shared-security technique result.

## D. Where Rejection Reasons Are Created

Rejection reasons are created in:

`classifyPersonalDashboardRejection(article)`

This function is not the production matcher, but it mirrors important rejection paths for diagnostics.

It is currently the best source for rejected score contributions because it already describes:

- which rejection category fired
- the user-facing reason string
- the relevant selected interests
- primary domain mismatch
- technique mismatch
- parent/child mismatch
- low score threshold cases

## E. Where Domain/Interest Matches Are Known

Domain and interest matches are available in several places:

- Primary domain: `getArticleDominantDomain(article)`
- Selected main-domain match: `getPersonalDashboardDomainMatch(article)`
- Aggregate score: `calculatePersonalDomainScore(article, selectedInterests)`
- Per-interest score: `computePersonalInterestBoost(article, interestId)`
- Banknote child match: `matchesBanknoteInterest(article, interestId)`
- Identity child match: `computePersonalInterestBoost(article, interestId).score >= 18`
- Shared Security technique match: `getSharedSecurityStandaloneAssessment(article, interestId).included`
- Digital Identity child match: `getDigitalSubgroupHybridAssessment(article, interestId).included`
- Bridge matches:
  - `articleMatchesSelectedIdentityTechniqueBridge(...)`
  - `articleMatchesSelectedBanknoteTechniqueBridge(...)`
  - `matchesIdCardsHolographyOvdCombinationBridge(...)`

## F. Best Function To Connect To `personalDashboardScore`

The best safe connection point is:

`applyPersonalDashboardStage()`

Reason:

- It already calls `articleMatchesPersonalDashboardSelection(article)`.
- It already has the legacy pass/fail result.
- It already calls `classifyPersonalDashboardRejection(article)` on rejects.
- It is diagnostics-only stage replay, not production matching.
- It can build a score object from existing helper outputs without changing rendering behavior.

The best signal source is a small read-only helper that packages existing legacy signals, for example:

`getLegacyPersonalDashboardDecisionSignals(article, { passed, rejection })`

That helper should call existing functions only and return:

- selected interests
- selected main domains
- primary domain
- domain match result
- aggregate domain score
- per-interest boost results
- banknote interest matches
- identity threshold matches
- shared-security assessments
- digital identity subgroup assessments
- bridge matches
- rejection category/reason

## G. Recommended Smallest Safe Next Implementation Step

Create a diagnostics-only helper:

`getLegacyPersonalDashboardDecisionSignals(article, options)`

Then update `buildPersonalDashboardScore()` to consume that helper instead of partially reconstructing signals inline.

The smallest safe implementation should:

1. Keep `articleMatchesPersonalDashboardSelection()` unchanged.
2. Keep all threshold constants unchanged.
3. Keep `classifyPersonalDashboardRejection()` unchanged.
4. Call `buildPersonalDashboardScore(article, { passed, rejection })` only from `applyPersonalDashboardStage()`.
5. Populate `personalDashboardScore.contributions` from the packaged legacy signal object.
6. Continue setting `personalDashboardScore.passed` from the legacy matcher result, not from score totals.
7. Keep `decisionSource: "legacy-pass-fail"`.

This should make `averageScore`, `positiveScoreCount`, and `zeroScoreCount` meaningful without moving any articles.

