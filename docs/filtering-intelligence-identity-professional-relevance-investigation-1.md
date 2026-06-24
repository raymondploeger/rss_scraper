# Filtering Intelligence - Identity Professional Relevance Guard Investigation 1

## Executive Summary

The Identity professional relevance guard is intentionally narrow and is currently applied as a hard post-filter on backend-query Personal Dashboard paths for Identity Documents selections.

For the current `Identity Documents + ID Cards` case, the pipeline behaves as:

1. Backend query returns candidates.
2. `articleMatchesFilters(article, { ignoreFeedId: true })` applies advanced filters.
3. `articlePassesLegacyIdentityProfessionalRelevance(article, { branch: "backend-query" })` applies the Identity guard.
4. Only articles passing that guard are sorted, grouped, paginated, and rendered.

The observed drop from `afterAdvancedFilters: 361` to `after identity_professional_relevance_guard: 4` is therefore real filtering, not a diagnostics artifact. The likely reason is that the guard reuses the old passport/Identity professional relevance layer as a hard gate, and that layer requires both strong Identity/passport relevance and UI intelligence relevance. Many articles that pass the Personal Dashboard ID Cards matcher can still fail because they are not high-confidence passport/Identity intelligence events under these stricter legacy relevance checks.

The broadest likely gate is `shouldRejectPassportArticle(article)`, because it rejects passport-or-identity-topic articles unless they pass `getHighConfidencePassportAssessment(article)` and `getKeesingIdentityRelevance(article)` with required components and thresholds. `isUiRelevantIntelligenceArticle(article)` is also strict because it requires recognized intelligence signal text or signal categories.

No code was changed in this investigation.

## A. Current Guard Flow

### Activation

The guard is controlled by `shouldApplyIdentityProfessionalRelevanceGuard(options)` in `frontend/public/app.js` lines 5314-5331.

It activates only when all of these are true:

- Personal Dashboard has selections.
- The current branch is `backend-query` or `backend-query-loading`.
- Selected main domains include `identity_documents`.
- At least one Identity Documents subinterest is selected.
- Either `id_cards` is selected, or at least one Shared Security interest is selected.

That means the guard does not run globally, does not run for all frontend memory paths, and does not run for non-backend selected feed fallback branches.

### Assessment

`getIdentityProfessionalRelevanceGuardAssessment(article, options)` in lines 5388-5482 computes the full assessment.

It evaluates:

- `isHardPassportNoise(article)`
- `shouldRejectPassportArticle(article)`
- `isLowRelevancePassportArticle(article)`
- `getKeesingIdentityRelevance(article)`
- `getHighConfidencePassportAssessment(article)`
- `getIdentityDocumentRelevance(article)`
- `isUiRelevantIntelligenceArticle(article)`
- Identity + Shared Security bridge state
- ID Cards score and dominant domain for diagnostics

The legacy pass condition is:

```js
!hardPassportNoise &&
!passportRejected &&
!lowRelevancePassportArticle &&
uiRelevantIntelligenceArticle
```

If the guard is enabled, an article passes when:

- the legacy guard passes, or
- an Identity + Shared Security bridge rescues it.

For ID Cards-only, there is no Shared Security combination rescue.

### Boolean wrapper

`articlePassesLegacyIdentityProfessionalRelevance(article, options)` in lines 5485-5490 is the public gate:

- If the guard is inactive, return `true`.
- If active, return `getIdentityProfessionalRelevanceGuardAssessment(...).passed`.

### Pipeline integration

The real backend-query provider applies the guard in `normalizeBackendProviderResultStage()` at lines 25983-26018:

```js
const advancedFilteredBackendArticles = cachedQuery.articles
  .filter((article) => articleMatchesFilters(article, { ignoreFeedId: true }));
const filteredBackendArticles = advancedFilteredBackendArticles
  .filter((article) => articlePassesLegacyIdentityProfessionalRelevance(article, { branch: "backend-query" }));
```

Diagnostics replay mirrors that order in `replayFilterDiagnosticsStage()` lines 25122-25158:

1. feed scope
2. Personal Dashboard
3. advanced filters
4. Identity professional relevance guard
5. sorting
6. grouping

The trace stage itself is implemented by `applyIdentityProfessionalRelevanceGuardStage()` at lines 25002-25061.

## B. Exact Rejection Order

When enabled and not passed, `getIdentityProfessionalRelevanceGuardAssessment()` assigns the first rejection reason in this priority order, lines 5439-5451:

1. `isHardPassportNoise(article)`
   - Reason: `legacy hard passport noise guard rejected article`
2. `shouldRejectPassportArticle(article)`
   - Reason: `legacy passport professional relevance guard rejected article`
3. `isLowRelevancePassportArticle(article)`
   - Reason: `legacy low-relevance passport guard rejected article`
4. `!isUiRelevantIntelligenceArticle(article)`
   - Reason: `legacy UI intelligence relevance guard rejected article`
5. fallback
   - Reason: `legacy Identity professional relevance guard rejected article`

This is important because diagnostics may show several triggered helpers, but the rejection reason is single-priority. For example, an article can trigger both `shouldRejectPassportArticle` and `getKeesingIdentityRelevance`, but the final reason will be the passport professional relevance guard if `shouldRejectPassportArticle` is true.

## C. Hard Gates

These checks directly affect pass/fail inside the guard:

### `isHardPassportNoise(article)`

Defined at lines 18147-18165.

This is a direct hard gate. It checks title, description, summary, source, and tags against `PASSPORT_HARD_NOISE_KEYWORDS` from lines 21140-21184.

It catches clear non-document uses such as product passports, pet passports, skills passports, tourism passports, material passports, software passports, foldables, and other metaphorical or consumer categories.

### `shouldRejectPassportArticle(article)`

Defined at lines 18797-18841.

This is a direct hard gate through the `passportRejected` variable.

It only evaluates strictly when `isPassportOrIdentityTopicArticle(article)` is true. If the article is not passport/Identity-topic-like, it returns false.

For passport-or-Identity-topic articles, it rejects if:

- `isHighConfidencePassportIntelligence(article)` is false.
- `getKeesingIdentityRelevance(article).hasRequiredComponent` is false.
- `getKeesingIdentityRelevance(article).primarySubject === "unrelated"`.
- `getKeesingIdentityRelevance(article).score < KEESING_RELEVANCE_THRESHOLD`.
- there is negative context and `getIdentityDocumentRelevance(article) < IDENTITY_DOCUMENT_RELEVANCE_THRESHOLD`.

This is the likely broadest gate because it turns several scoring/relevance helpers into required conditions.

### `isLowRelevancePassportArticle(article)`

Defined at lines 18843-18862.

This is also a hard gate through `lowRelevancePassportArticle`.

It only applies to passport-topic content and rejects if:

- `shouldRejectPassportArticle(article)` is true, or
- `getIdentityDocumentRelevance(article) < IDENTITY_DOCUMENT_RELEVANCE_THRESHOLD`.

Because it delegates to `shouldRejectPassportArticle`, it often reinforces the same decision rather than adding an independent one.

### `isUiRelevantIntelligenceArticle(article)`

Defined at lines 19561-19568.

This is a hard gate because `legacyGuardPassed` requires it to be true.

It passes when:

- `getArticleSignalMatches(article).length > 0`, or
- `isRelevantSignalText(getArticleSignalText(article))` is true.

`getArticleSignalMatches()` has strict event/signal gates at lines 19462-19552, and the Identity signal helper `getIdDocumentSignalMatches()` has multiple early returns at lines 19285-19387 for noise context, invalid context, non-impact content, missing system impact, non-system noise, missing system event, ID noise, or weak intent.

## D. Scoring/Relevance Helpers

These helpers produce scores or relevance assessments. They do not reject by themselves everywhere, but the professional guard uses their outputs as hard conditions.

### `getIdentityDocumentRelevance(article)`

Defined at lines 18327-18396.

It computes an Identity relevance score from:

- high relevance signals
- medium relevance signals
- negative relevance signals
- government, border, immigration, fraud, security, issuance, infrastructure, and travel-rule context
- lifestyle, sports, pets, entertainment, education, and generic travel penalties

Threshold:

- `IDENTITY_DOCUMENT_RELEVANCE_THRESHOLD = 3` at line 21280.

This helper is used by `getHighConfidencePassportAssessment()` and by the negative-context fallback in `shouldRejectPassportArticle()`.

### `getHighConfidencePassportAssessment(article)`

Defined at lines 18399-18496.

It starts from `getIdentityDocumentRelevance(article)`, adds weighted high-confidence passport signals, subtracts negative signals, adjusts for context and primary subject, and requires a central signal.

Threshold:

- `HIGH_CONFIDENCE_PASSPORT_THRESHOLD = 14` at line 21578.

It returns:

- `score`
- `primarySubject`
- `kept`
- `rejectedReason`

It becomes a hard gate through `isHighConfidencePassportIntelligence(article)` and then `shouldRejectPassportArticle(article)`.

### `getKeesingIdentityRelevance(article)`

Defined at lines 18503-18602.

It computes a Keesing-style professional Identity relevance score from:

- `KEESING_POSITIVE_SIGNALS`
- `KEESING_NEGATIVE_SIGNALS`
- `KEESING_HARD_KEEP_SIGNALS`
- `KEESING_REQUIRED_COMPONENT_SIGNALS`
- primary passport subject
- Identity context
- government document confidence

Threshold:

- `KEESING_RELEVANCE_THRESHOLD = 16` at line 21708.

Required component terms are listed at lines 21682-21707 and include terms such as issuance, renewal, revocation, fraud, biometric, border control, ETIAS, EES, identity verification, government identity system, passport office, visa system, digital identity, eID, and ICAO.

This helper becomes a hard gate inside `shouldRejectPassportArticle()` when required components are absent, primary subject is unrelated, or score is below threshold.

### `getPrimaryPassportSubject(article)`

Defined at lines 18242-18300.

This helper scores possible article subjects with title, first sentence, body, and source weights. Subjects include border systems, immigration, citizenship, passport fraud, passport issuance, passport regulation, identity infrastructure, visa policy, travel document security, and unrelated.

If the best subject is absent, unrelated, or not stronger than unrelated, it returns `unrelated`.

It feeds both high-confidence passport assessment and Keesing relevance.

### `getIdentityContextSignals(article)`

Defined at lines 18303-18325.

This helper returns context booleans for government, border, immigration, fraud, security, issuance, infrastructure, travelRule, unrelatedLifestyle, sports, pets, entertainment, education, and genericTravel.

These booleans are used in Identity relevance, high-confidence passport assessment, and passport rejection.

### `isUiRelevantIntelligenceArticle(article)`

Defined at lines 19561-19568.

Although boolean, it is best understood as a UI/intelligence relevance classifier. It depends on `getArticleSignalMatches()` and `isRelevantSignalText()`, not on the Personal Dashboard pass/fail result.

## E. Identity-wide Checks

These checks can affect Identity backend-query results whenever the guard activation conditions are met:

- `isHardPassportNoise(article)`
- `shouldRejectPassportArticle(article)`
- `isLowRelevancePassportArticle(article)`
- `isUiRelevantIntelligenceArticle(article)`
- `getIdentityDocumentRelevance(article)`
- `getHighConfidencePassportAssessment(article)`
- `getKeesingIdentityRelevance(article)`
- `getPrimaryPassportSubject(article)`
- `getIdentityContextSignals(article)`

However, activation is not fully Identity-wide in all modes. It currently requires backend-query branch and either:

- `id_cards` selected, or
- a Shared Security interest selected with at least one Identity interest.

So the guard is Identity-domain logic, but it is not applied to every possible Identity-only selection.

## F. ID Cards-only Checks

For `Identity Documents + ID Cards`, the guard activates because `selectedIdentityInterests.includes("id_cards")` is true.

There is no combination bridge rescue in this mode because `getIdentitySharedSecurityGuardBridgeAssessment()` returns `combinationMode: false` unless both Identity interests and Shared Security interests are selected.

So an ID Cards-only article must satisfy the raw legacy pass:

- not hard passport noise
- not rejected by `shouldRejectPassportArticle`
- not low-relevance passport article
- UI-relevant intelligence article

This explains why the guard is especially strict for ID Cards-only backend-query results.

The assessment also records `idCardsScore` from `computePersonalInterestBoost(article, "id_cards")`, but that score does not rescue the article inside this guard.

## G. Identity + Shared Security Combination Checks

The combination bridge is implemented by `getIdentitySharedSecurityGuardBridgeAssessment()` at lines 5334-5385.

Combination mode requires:

- at least one selected Identity interest, and
- at least one selected Shared Security interest.

Bridge match passes if any of these are true:

- `articleMatchesSelectedIdentityTechniqueBridge(article, selectedInterests)`
- `matchesIdCardsHolographyOvdCombinationBridge(article, selectedIdentityInterests, selectedSharedSecurityInterests)`
- `matchesSelectedSharedSecurityTechnique(article, selectedInterests)` and an Identity interest score of at least 18

In `getIdentityProfessionalRelevanceGuardAssessment()`, a bridge rescue is allowed only when:

- guard is enabled,
- legacy guard did not pass, and
- bridge assessment matched.

Therefore Identity + Shared Security combinations have a controlled escape hatch that ID Cards-only does not have. This was added to avoid over-rejecting secure-document/security-feature articles that are relevant due to the combination rather than as general passport/Identity news.

## H. Why ID Cards Drops from 361 to 4

The drop from `afterAdvancedFilters: 361` to `after identity_professional_relevance_guard: 4` follows directly from the backend-query normalization path.

At lines 25985-25988, the backend-query provider first filters cached backend articles with `articleMatchesFilters(article, { ignoreFeedId: true })`, then applies `articlePassesLegacyIdentityProfessionalRelevance(article, { branch: "backend-query" })`.

For `Identity Documents + ID Cards`, the guard is active and bridge rescue is unavailable. Each of the 361 advanced-filter survivors must therefore pass the legacy professional relevance gate.

The strongest rejection pressure comes from:

1. `shouldRejectPassportArticle(article)`
   - Requires high-confidence passport/Identity intelligence.
   - Requires Keesing required component.
   - Requires Keesing score >= 16.
   - Rejects unrelated primary subjects.
2. `isUiRelevantIntelligenceArticle(article)`
   - Requires recognized intelligence signal matches or relevant signal text.
   - This can reject articles that match ID Cards Personal Dashboard scoring but do not look like actionable intelligence events.
3. `isLowRelevancePassportArticle(article)`
   - Re-applies `shouldRejectPassportArticle()` for passport-topic content and also enforces Identity relevance score.

The result is a two-layer model:

- Personal Dashboard matching answers: "Does this article resemble the selected interest?"
- Identity professional relevance guard answers: "Is this article professional, intelligence-relevant Identity content under the legacy visible-article quality layer?"

The second question is much stricter, so only 4 of 361 survive.

## I. Which Guard Is Likely Too Broad

The likely too-broad gate is `shouldRejectPassportArticle(article)`, not `isHardPassportNoise(article)`.

Reasons:

- `isHardPassportNoise()` targets explicit non-document meanings of "passport" and is likely appropriate as a hard reject.
- `shouldRejectPassportArticle()` treats a broad set of passport-or-Identity-topic articles as needing high-confidence passport intelligence plus Keesing professional relevance.
- It requires `getHighConfidencePassportAssessment(article).kept`, which itself requires central signal, non-unrelated primary subject, and score >= 14.
- It then requires Keesing required component, non-unrelated primary subject, and score >= 16.
- This combination is excellent at removing consumer/travel/crime noise, but can also reject valid ID-card/security-vendor/secure-document articles if they do not use passport-like professional news vocabulary or Keesing required terms.

The second likely strict gate is `isUiRelevantIntelligenceArticle(article)`. It is useful as a UI signal-quality check, but it can reject articles that pass Personal Dashboard relevance yet do not map to the current signal taxonomy.

`isLowRelevancePassportArticle(article)` is likely not the root cause by itself because it mostly repeats `shouldRejectPassportArticle()` for passport-topic articles.

## J. Recommended Smallest Safe Next Step

Do not tune thresholds or keyword lists yet.

The smallest safe next step is diagnostics-first:

1. Extend `identityProfessionalRelevanceGuardSummary` to break rejections down by the first failing hard gate:
   - hard passport noise
   - `shouldRejectPassportArticle`
   - low-relevance passport
   - UI intelligence relevance
   - fallback
2. Add compact per-gate examples for the first 25 rejected articles.
3. Add a helper such as `window.listIdentityProfessionalRelevanceRejectsByGuard(guardName, limit)` that returns:
   - title
   - source
   - selected interests
   - `idCardsScore`
   - `identityDocumentRelevance`
   - `highConfidencePassportAssessment`
   - `keesingIdentityRelevance`
   - `uiRelevantIntelligenceArticle`
   - final rejection reason
4. Use those diagnostics to decide whether the safe behavior change should be:
   - a narrow ID-card professional-source/vendor rescue,
   - a secure-document/security-feature rescue,
   - a relaxation of `shouldRejectPassportArticle()` only for non-passport ID-card articles,
   - or an expansion of bridge rescue outside Shared Security combinations.

If a behavior change is needed after that, the safest likely direction is not a broad threshold reduction. It would be a narrow ID Cards guard rescue that still requires strong ID-card or secure-document evidence and explicitly avoids consumer passport/travel/crime categories.

## Notes

- Application code was not modified.
- Filtering behavior remains unchanged.
- Thresholds remain unchanged.
- Bridge logic remains unchanged.
- Backend request parameters, cache keys, grouping, pagination, and rendering remain unchanged.
