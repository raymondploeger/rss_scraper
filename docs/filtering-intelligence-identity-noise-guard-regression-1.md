# Filtering Intelligence - Identity Noise Guard Regression Investigation 1

## Executive summary

The likely regression is not that the Identity noise guards were removed. The code still contains several hard false-positive guards, passport relevance checks, Keesing-style document relevance checks, and Identity-specific negative scoring.

The more likely regression is pipeline placement. The old global visible-articles path still runs the rich `getVisibleArticles()` compatibility wrapper, which applies `isHardPassportNoise()`, passport relevance gates, Keesing relevance, high-confidence passport subject checks, banknote relevance, `isUiRelevantIntelligenceArticle()`, and then `articleMatchesFilters()`.

The backend-query, date, and selected-feed/full-pool provider paths do not run that full wrapper. They normalize branch-local results with narrower filtering, usually `articleMatchesFilters()` plus Personal Dashboard matching. That means Personal Dashboard views can see a broader candidate set and can allow consumer passport/travel articles through if they pass the domain/subinterest score threshold.

The current diagnostics replay can make this look cleaner than it is: it reports conceptual stages in the order feed scope -> Personal Dashboard -> advanced filters -> sorting -> grouping, but some provider branches already filtered and sorted the branch-local output before replay. The replay explains counts; it does not prove that all legacy relevance guards ran in the same production path.

Smallest safe next step: add diagnostics only. Specifically, add Identity noise guard diagnostics for surviving ID Cards articles showing whether each legacy guard would reject the article, whether the article came from `global-visible-articles` or `backend-query`, and whether it survived because the branch bypassed `getVisibleArticles()` relevance gates.

## A. Current pipeline order

The current Pipeline v2 structure is:

1. Candidate retrieval/provider execution.
2. Provider result normalization.
3. Legacy filter pipeline diagnostics replay.
4. Pagination.
5. Render model and render dispatch.
6. DOM rendering.

The important implementation detail is that the candidate provider can already produce filtered/sorted/grouped branch-local outputs before the diagnostic replay runs.

### Global memory path

`executeGlobalMemoryProvider()` still calls:

- `getGlobalArticleCandidateSource()`
- `getVisibleArticles({ ignoreFeedId: shouldIgnoreFeedIdForGrouping })`
- `prepareDateFirstGroupedArticles(visibleArticles)`

Code evidence:

- `executeGlobalMemoryProvider()` sets branch `global-visible-articles` and calls `getVisibleArticles()` in `frontend/public/app.js` around lines 25346-25367.
- `getVisibleArticles()` begins with `state.articles` and applies hard passport noise and relevance gates before `articleMatchesFilters()` in `frontend/public/app.js` around lines 20000-20070.

For this path, the order is effectively:

candidate source -> hard passport noise -> identity/passport relevance guards -> UI relevance -> advanced filters and Personal Dashboard through `articleMatchesFilters()` -> sorting -> grouping -> pagination -> render.

### Backend-query path

`normalizeBackendProviderResultStage()` uses:

```js
cachedQuery.articles.filter((article) => articleMatchesFilters(article, { ignoreFeedId: true }))
```

Code evidence:

- `normalizeBackendProviderResultStage()` creates `candidatePool = cachedQuery.articles`, then filters with `articleMatchesFilters(article, { ignoreFeedId: true })`, sorts, and groups in `frontend/public/app.js` around lines 25232-25256.

For this path, the order is effectively:

backend candidate pool -> `articleMatchesFilters()` -> Personal Dashboard inside `articleMatchesFilters()` unless ignored -> sorting -> grouping -> diagnostics replay -> pagination -> render.

This path does not call `getVisibleArticles()`, so the rich legacy identity/passport relevance gates in that wrapper do not run as a single prefilter.

### Date path

`executeDateFilterProvider()` uses:

```js
state.articles.filter(articleMatchesFilters)
```

Code evidence:

- `executeDateFilterProvider()` filters `state.articles` directly through `articleMatchesFilters` in `frontend/public/app.js` around lines 25324-25343.

This path also does not run the full `getVisibleArticles()` relevance wrapper.

### Diagnostics replay order

The diagnostic replay stage runs:

1. `applyFeedScopeStage()`
2. `applyPersonalDashboardStage()`
3. `applyAdvancedFiltersStage()`
4. `applySortingStage()`
5. `applyGroupingStage()`

Code evidence:

- `replayFilterDiagnosticsStage()` applies feed scope, Personal Dashboard, advanced filters, sorting, and grouping in that order in `frontend/public/app.js` around lines 24378-24430.

This is useful for explaining a conceptual pipeline, but it does not mean every provider branch originally executed in exactly that order. `applySortingStage()` explicitly reports "existing branch-local sorted output", which confirms sorting/grouping are reporting branch-local results rather than recomputing the whole production path.

## B. Old/legacy intended order

The strongest clue about the old intended order is `getVisibleArticles()`.

`getVisibleArticles()` is still the legacy all-in-one visible article helper. It combines:

- source article access from `state.articles`
- hard passport noise rejection
- identity/passport relevance scoring
- Keesing relevance checks
- high-confidence passport assessment
- banknote relevance rejection
- UI relevance filtering
- `articleMatchesFilters()`
- final current-mode sorting

Code evidence:

- `getVisibleArticles()` starts at `frontend/public/app.js` line 20000.
- It runs `isHardPassportNoise(article)` before the relevance block around lines 20002-20014.
- It calculates `getIdentityDocumentRelevance(article)`, `getHighConfidencePassportAssessment(article)`, `getKeesingIdentityRelevance(article)`, and `getBanknoteIntelligenceRelevance(article)` around lines 20017-20024.
- It rejects if `shouldRejectPassportArticle(article)`, `isLowRelevancePassportArticle(article)`, or low banknote relevance match around lines 20022-20024.

The old intended order therefore appears to be:

candidate articles -> hard/noise relevance gate -> general visible-intelligence gate -> advanced filters and Personal Dashboard -> sort -> render.

After the architecture migration, this order still holds for the global-memory provider, but not for backend-query/date/selected-feed provider paths that do not invoke `getVisibleArticles()`.

## C. Noise guard functions found

### `articleMatchesFilters(article, options = {})`

Purpose:

General advanced filter gate for fallback pages, topic keyword false positives, explicit keyword false positives, source/feed/date/search/topic/tag/signal filters, and Personal Dashboard matching unless ignored.

Called by:

- backend provider normalization
- date provider
- advanced filter diagnostics stage
- legacy visible article wrapper via downstream filters

Noise handled:

- official fallback articles
- topic keyword false positives
- passport false positives from user keyword filters
- driver-license music false positives
- coin/gaming false positives

Limit:

This is not the full Identity professional relevance gate. It does not call the `getVisibleArticles()` passport/Keesing/high-confidence relevance block.

### `isKeywordRuleFalsePositive(article, rule)`

Purpose:

Rejects articles matching active topic exclusion keywords unless include terms rescue the article.

Noise handled:

- active topic-specific keyword false positives.

Limit:

Only active when a topic keyword rule exists.

### `isPassportFalsePositive(article)`

Purpose:

Rejects passport articles based on `state.keywordFilters.exclude`, unless `state.keywordFilters.include` rescues them.

Noise handled:

- coarse user/filter-configured passport false positives.

Limit:

It depends on keyword filter state. It is not a broad hard-coded passport consumer-news noise guard.

### `isDriverLicenseMusicFalsePositive(article)`

Purpose:

Rejects articles where driver-license terms are present in music/entertainment contexts.

Noise handled:

- music/album/song style "driver license" articles.

### `isCoinGamingFalsePositive(article)`

Purpose:

Rejects coin articles in gaming/game-currency contexts when coin context is weak.

Noise handled:

- gaming currency and game item articles.

### `getVisibleArticles(options = {})`

Purpose:

Legacy visible article compatibility wrapper.

Noise handled:

- hard passport noise
- low-relevance passport articles
- Keesing identity relevance failures
- primary passport subject failures
- banknote topic articles that fail banknote relevance
- UI intelligence relevance

Limit:

Currently only the global memory provider visibly relies on this full wrapper.

### `isHardPassportNoise(article)`

Purpose:

Hard prefilter for passport noise before visible article relevance scoring.

Called by:

- `getVisibleArticles()`.

Risk:

If a Personal Dashboard path does not run through `getVisibleArticles()`, this guard does not run in that path.

### `shouldRejectPassportArticle(article)`

Purpose:

Rejects low-quality or unrelated passport/identity articles using richer relevance assessments.

Called by:

- `getVisibleArticles()`.

Risk:

Not called by backend provider normalization directly.

### `isLowRelevancePassportArticle(article)`

Purpose:

Rejects passport/identity articles that do not meet the relevance bar.

Called by:

- `getVisibleArticles()`.

Risk:

Not called by backend provider normalization directly.

### `isUiRelevantIntelligenceArticle(article)`

Purpose:

General visible-intelligence relevance gate after passport/banknote relevance checks.

Called by:

- `getVisibleArticles()`.

Risk:

Provider paths that do not call `getVisibleArticles()` bypass this gate.

### `getIdentityDocumentSubinterestScore(article, selectedInterests)`

Purpose:

Scores selected Identity subinterests. For `id_cards`, it rewards ID-card/polycarbonate/issuance evidence and subtracts driver-license, passport, and noisy hits.

Code evidence:

- The `id_cards` score uses `signals.idCardHits`, `signals.polycarbonateHits`, `signals.issuanceHits`, and subtracts `signals.driverLicenseHits`, `signals.passportHits`, and `signals.noisyHits` in `frontend/public/app.js` around lines 12275-12282.

Important observation:

`travelNoiseArticle` is calculated, but the large travel-noise penalty is applied only to `passports`, `residence_permits`, and `icao`, not to `id_cards`. That means ID Cards can still rely mainly on softer `passportHits`/`noisyHits` deductions.

### `computePersonalInterestBoost(article, interestId)`

Purpose:

Computes Personal Dashboard subinterest score/boost and penalties.

Noise handled:

- noisy identity terms
- soft-noise penalties
- Google News penalties
- low selected score penalties
- mismatch penalties
- generic DMV noise
- travel-noise penalties for selected Passport/Residence Permit/ICAO cases
- border travel and marketing penalties
- passport lifestyle noise
- visa spam

Risk:

For `id_cards`, the explicit branch adds ID-card and polycarbonate evidence and subtracts passport hits, but it does not apply the same hard travel-noise penalty used for passports/residence/ICAO.

### `articleMatchesPersonalDashboardSelection(article)`

Purpose:

Authoritative Personal Dashboard pass/fail function.

Identity behavior:

- Gets selected interests.
- Computes shared-security bridge state.
- Determines primary domain with `getArticleDominantDomain(article)`.
- Rejects `primaryDomain === "other"` unless a bridge matches.
- For `primaryDomain === "identity_documents"`, rejects navigation pages, then passes when selected Identity interests have `computePersonalInterestBoost(article, interestId).score >= 18` or bridge logic passes.

Risk:

This function is a Personal Dashboard matcher, not the full legacy professional relevance gate. It does not call `isHardPassportNoise()`, `shouldRejectPassportArticle()`, or `isLowRelevancePassportArticle()`.

### `classifyPersonalDashboardRejection(article)`

Purpose:

Explains why Personal Dashboard rejected an article.

Risk:

It is diagnostic/explanatory after rejection. It does not reject surviving ID Cards articles.

### Identity retrieval exclusion helpers

The code includes Identity retrieval exclusion concepts and comments such as "Identity Documents retrieval should start from secure-document intent, not generic travel/passport mentions." There are retrieval exclusion terms and secure anchors for travel/passport noise.

Risk:

Retrieval exclusions help candidate quality, but they are not equivalent to a final visible relevance guard. A backend targeted candidate pool can still include broad passport/identity articles that later rely on `articleMatchesPersonalDashboardSelection()` and `articleMatchesFilters()`.

## D. Identity-specific noise handling

### Passport lost/stolen crime stories

Current handling:

- Passport/fraud/crime can be treated as relevant Identity evidence in some contexts.
- Rich relevance checks in `getVisibleArticles()` can reject unrelated or low-relevance passport stories through `shouldRejectPassportArticle()`, `isLowRelevancePassportArticle()`, Keesing relevance, and primary subject assessment.
- Personal Dashboard scoring may still see passport/fraud/security terms as domain evidence.

Regression risk:

If a backend Personal Dashboard path bypasses `getVisibleArticles()`, crime stories involving passports can pass when the Identity domain/subinterest score remains above threshold.

### Murder cases involving passports

Current handling:

- These are most likely handled by high-confidence passport subject and relevance assessments, not by the generic `articleMatchesFilters()` hard guards.

Regression risk:

If the rich passport subject guard is bypassed, "passport" can remain a positive Identity signal even when the article topic is a murder/crime story.

### Passport renewal and service articles

Current handling:

- Renewal/application/service terms are mixed. They can be noisy in consumer travel contexts, but they can also be legitimate issuance/system terms.
- Identity profile and interest scoring include negative/noisy terms, but issuance can also be positive evidence.

Regression risk:

`id_cards` does not receive the same large travel-noise penalty applied to selected `passports`, `residence_permits`, and `icao`. Service/renewal articles may therefore survive if they also contain ID/card/identity/issuance signals.

### Airport queue / EES travel disruption stories

Current handling:

- EES and border terms are legitimate in border-control contexts.
- Generic travel disruption can be noise, especially if the selected interest is ID Cards rather than border-control.

Regression risk:

The hard border travel-noise penalties are concentrated in `border_control` scoring. For ID Cards, airport/EES content may not be rejected unless other negative signals dominate.

### Citizenship and travel advice articles

Current handling:

- Generic travel advice, visa-free travel, tourism, destination, strongest passports, and immigration-lawyer content appear in Identity noisy terms/profile negatives.

Regression risk:

These are mostly scoring penalties, not always hard gates. If candidate retrieval is broad and branch-level relevance gates are bypassed, some may survive.

### YouTube, TikTok, Instagram

Current handling:

- Social platform terms appear in Identity noisy terms and profile negatives.
- Generic hard guards in `articleMatchesFilters()` do not blanket-reject every YouTube/TikTok/Instagram Identity result.

Regression risk:

Social media articles can survive if positive Identity terms outweigh soft noise penalties.

### General immigration / visa content

Current handling:

- Visa and immigration terms are split between legitimate Identity context and consumer/legal-advice noise.
- Visa spam and immigration-lawyer style content has penalties in Personal Dashboard scoring.

Regression risk:

The Personal Dashboard matcher is calibrated to selected Identity interests. If the selected interest is ID Cards, generic immigration/passport/visa articles should ideally fail ID-card scope, but broad Identity domain scoring can still make them candidates unless ID-card child scoring is decisive.

## E. Regression suspects

### 1. Backend-query Personal Dashboard paths bypass the legacy `getVisibleArticles()` relevance guard

Likelihood: high.

Evidence:

- Global memory provider calls `getVisibleArticles()` directly.
- Backend provider normalization calls `articleMatchesFilters()` directly.
- Date provider calls `articleMatchesFilters()` directly.

Impact:

Personal Dashboard ID Cards results can include articles that would have been rejected by `isHardPassportNoise()`, `shouldRejectPassportArticle()`, `isLowRelevancePassportArticle()`, Keesing relevance, or primary-subject relevance in the global path.

### 2. Diagnostics replay order hides branch-local filtering differences

Likelihood: high.

Evidence:

- `replayFilterDiagnosticsStage()` reports feed scope -> Personal Dashboard -> advanced filters -> sorting -> grouping.
- Backend provider already creates `filteredRawArticles` from `articleMatchesFilters()` before replay.
- Sorting stage notes say it reports "existing branch-local sorted output".

Impact:

Diagnostics may imply a unified stage pipeline while production behavior remains branch-local.

### 3. `articleMatchesFilters()` hard guards are narrower than the old relevance gate

Likelihood: high.

Evidence:

- `articleMatchesFilters()` hard false-positive guards are mostly topic keyword false positives, passport false positives from configured keyword filters, driver-license music false positives, and coin gaming false positives.
- The rich passport/Keesing/high-confidence relevance checks live in `getVisibleArticles()`, not in `articleMatchesFilters()`.

Impact:

Consumer passport/travel noise can survive in branch paths that only use `articleMatchesFilters()`.

### 4. ID Cards scoring has softer travel/passport noise handling than Passport/Residence/ICAO

Likelihood: medium-high.

Evidence:

- `getIdentityDocumentSubinterestScore()` computes `travelNoiseArticle`, but the direct large penalty is applied only to `passports`, `residence_permits`, and `icao`.
- The `id_cards` score subtracts passport and noisy hits but does not receive the same hard travel-noise penalty.

Impact:

ID Cards can remain permissive for passport/travel articles that contain identity/card/issuance language.

### 5. Targeted backend retrieval can retrieve broader passport content

Likelihood: medium.

Evidence:

- Retrieval code contains Identity exclusion/anchor logic, but candidate retrieval is still separate from final professional relevance.
- Identity retrieval has to include terms like passport, issuance, office, application, border, EES, and biometric to find legitimate articles.

Impact:

Candidate pools may contain more consumer/passport service articles than the old newest/global visible pool did.

### 6. Relevance sorting is not a gate

Likelihood: medium.

Evidence:

- The current normal browsing/personal results use chronological ordering elsewhere in the architecture.
- Personal Dashboard scoring and labels remain available, but ordering is no longer a strict relevance-first exclusion mechanism.

Impact:

Older relevance-oriented ordering cannot hide or demote noisy survivors as effectively.

### 7. Grouping/rendering leakage

Likelihood: low to medium.

Evidence:

- Grouping reports existing branch-local output and can promote/group child articles.
- Prior work fixed grouped-primary behavior, but grouping can still make a noisy child visible if its group primary passed.

Impact:

Worth checking with diagnostics, but less likely to be the root of broad ID Cards noise.

### 8. Cache/state staleness

Likelihood: low.

Evidence:

- Diagnostics export state sync was recently improved to mark latest completed diagnostics.
- Stale diagnostics can confuse analysis, but it does not explain a systematic production-visible noise pattern.

Impact:

Still verify latest active diagnostics when comparing branches.

## F. Evidence from code

### Call path: global visible articles

```text
executeGlobalMemoryProvider()
  -> getVisibleArticles()
     -> isHardPassportNoise()
     -> getIdentityDocumentRelevance()
     -> getHighConfidencePassportAssessment()
     -> getKeesingIdentityRelevance()
     -> shouldRejectPassportArticle()
     -> isLowRelevancePassportArticle()
     -> isUiRelevantIntelligenceArticle()
     -> articleMatchesFilters()
        -> articleMatchesPersonalDashboardSelection()
```

Evidence:

- `executeGlobalMemoryProvider()` calls `getVisibleArticles()` around lines 25346-25367.
- `getVisibleArticles()` runs hard/relevance checks around lines 20000-20070.
- `articleMatchesFilters()` runs Personal Dashboard at the end unless ignored around lines 19909-19997.

### Call path: backend query

```text
executeBackendQueryProvider()
  -> normalizeBackendProviderResultStage()
     -> cachedQuery.articles.filter(articleMatchesFilters({ ignoreFeedId: true }))
        -> articleMatchesPersonalDashboardSelection()
     -> sortArticlesForCurrentDashboardMode()
     -> prepareDateFirstGroupedArticles()
```

Evidence:

- `normalizeBackendProviderResultStage()` filters cached backend articles using `articleMatchesFilters(article, { ignoreFeedId: true })` around lines 25232-25256.

Missing from this path:

- direct call to `getVisibleArticles()`
- direct call to `isHardPassportNoise()`
- direct call to `shouldRejectPassportArticle()`
- direct call to `isLowRelevancePassportArticle()`
- direct call to Keesing/high-confidence passport relevance gates

### Call path: date provider

```text
executeDateFilterProvider()
  -> state.articles.filter(articleMatchesFilters)
```

Evidence:

- `executeDateFilterProvider()` filters through `articleMatchesFilters` around lines 25324-25343.

Missing from this path:

- full `getVisibleArticles()` relevance/noise wrapper.

### Call path: diagnostics replay

```text
replayFilterDiagnosticsStage()
  -> applyFeedScopeStage()
  -> applyPersonalDashboardStage()
  -> applyAdvancedFiltersStage()
  -> applySortingStage()
  -> applyGroupingStage()
```

Evidence:

- `replayFilterDiagnosticsStage()` calls those stages around lines 24378-24430.

Important caveat:

`applySortingStage()` receives `result.filteredRawArticles`, which was already created by the provider. Therefore diagnostics replay is partly explanatory, not fully authoritative execution.

### Personal Dashboard ID Cards pass/fail

```text
articleMatchesPersonalDashboardSelection()
  -> primaryDomain = getArticleDominantDomain(article)
  -> if primaryDomain === "identity_documents"
     -> reject identity navigation pages
     -> selectedIdentityInterests.some(computePersonalInterestBoost(article, interestId).score >= 18)
     -> bridge checks
```

Evidence:

- `articleMatchesPersonalDashboardSelection()` begins around line 13451.
- The Identity branch passes selected Identity interests when `computePersonalInterestBoost(...).score >= 18`.

Important caveat:

This function does not run the rich passport relevance gate from `getVisibleArticles()`.

### ID Cards noise scoring

`getIdentityDocumentSubinterestScore()` calculates ID Cards with:

- positive: ID-card hits, polycarbonate hits, issuance hits, profile score
- negative: driver-license hits, passport hits, noisy hits

Evidence:

- The `id_cards` formula is around lines 12275-12282.

Important caveat:

The explicit `travelNoiseArticle` penalty is applied later only to `passports`, `residence_permits`, and `icao`, not `id_cards`.

## G. Recommended smallest safe next implementation step

Do not change filters yet.

Add Identity noise guard diagnostics first.

### Proposed diagnostics-only helper

Add a helper such as:

```js
getIdentityNoiseGuardDiagnostics(article)
```

It should record, without changing behavior:

- active branch/provider
- selected Identity interests
- `getArticleDominantDomain(article)`
- `computePersonalInterestBoost(article, "id_cards").score`
- `getIdentityDocumentSubinterestScore(article)`
- `getIdentityDocumentInterestSignals(article).noisyHits`
- `isIdentityTravelNoiseArticle(article)`
- `isHardPassportNoise(article)`
- `shouldRejectPassportArticle(article)`
- `isLowRelevancePassportArticle(article)`
- `getKeesingIdentityRelevance(article)`
- `getHighConfidencePassportAssessment(article)`
- `getIdentityDocumentRelevance(article)`
- `articleMatchesFilters(article)`
- `articleMatchesPersonalDashboardSelection(article)`
- whether the article passed via backend-query/date/selected-feed/global-memory
- whether `getVisibleArticles()` would have rejected it

### Proposed browser helpers

Add:

```js
window.listNoisyIdentitySurvivors(limit)
window.explainIdentityNoiseByTitle(titlePart)
```

`window.listNoisyIdentitySurvivors(limit)` should list surviving ID Cards articles with strong noise evidence, including:

- title
- branch
- feed/source
- Personal Dashboard score
- ID Cards score
- noise guard outcomes
- likely noise category
- whether legacy `getVisibleArticles()` relevance would reject it

`window.explainIdentityNoiseByTitle(titlePart)` should return a full diagnostics-only breakdown for one traced article.

### Recommended comparison

For selected `Identity Documents + ID Cards`, compare:

1. Articles that survive current backend-query Personal Dashboard path.
2. The same articles evaluated against the legacy `getVisibleArticles()` relevance guard outcomes.

If many noisy survivors have:

- `articleMatchesPersonalDashboardSelection() === true`
- `articleMatchesFilters() === true`
- but `isHardPassportNoise()` or `shouldRejectPassportArticle()` or `isLowRelevancePassportArticle()` would reject

then the regression is confirmed as a pipeline placement issue.

### Why diagnostics first

This avoids prematurely tightening ID Cards scoring and accidentally losing true positives such as:

- official ID-card rollout articles
- identity-document security feature articles
- polycarbonate/card substrate articles
- identity fraud articles with legitimate document-security content

Once diagnostics identify the exact surviving noise categories, the smallest safe behavior fix would likely be one of:

1. Reapply the legacy Identity/passport professional relevance guard inside the backend-query Personal Dashboard path.
2. Add a unified "identity noise guard" stage after Personal Dashboard and before sorting.
3. Add only ID Cards-specific hard diagnostics-confirmed exclusions for consumer passport/travel noise.

The safest implementation order is diagnostics first, then a narrow guarded behavior change.

