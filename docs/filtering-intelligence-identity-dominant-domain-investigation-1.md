# Filtering Intelligence Investigation

## Identity Dominant Domain Investigation 1

Date: 2026-06-23

Scope: read-only architecture investigation. No filtering, scoring, threshold, keyword, bridge, diagnostics, rendering, grouping, pagination, backend request, or cache behavior was changed.

## Executive Summary

The `primaryDomainMismatch` rejections come from an early dominant-domain gate in the Personal Dashboard matcher and rejection classifier.

For Identity Documents selections, `getArticleDominantDomain(article)` is evaluated before Identity child-interest scoring. If the dominant domain is `banknotes`, `digital_identity_biometrics`, or `other`, and no selected Identity/Shared Security bridge can rescue it, the article is rejected before the Identity-specific `computePersonalInterestBoost(article, interestId).score >= 18` threshold is evaluated.

That means many articles are classified as `primaryDomainMismatch` instead of `scoreTooLow` / `identity_score_below_threshold` because the article never reaches the Identity branch where child-interest scores are checked.

In current production behavior, dominant domain is a hard gate for inclusion in `articleMatchesPersonalDashboardSelection()`, not merely a ranking signal. Separately, `calculatePersonalDomainScore()` uses dominant domain as a decay/ranking input for lanes and sorting, but that later score does not override the early hard gate.

## Architecture

### Dominant Domain Inputs

`getArticleDominantDomain(article)` reads an article through `getPersonalBoostContext(article)`, which normalizes these fields into lower-case text buckets:

- title text: `title`, `normalizedTitle`
- tag text: article tags, keywords, filter tags
- metadata text: topic, source, feed, signal labels, normalized event fields
- body text: summary, short summary, content snippet
- source/domain text: article source, feed name, link domains
- structured fields: `topicType`, `topic`, `signalIds`, `eventType`, normalized event domain

The dominant-domain function then compares three candidate domains:

- `banknotes`
- `identity_documents`
- `digital_identity_biometrics`

`shared_security` is not currently returned by `getArticleDominantDomain()`. Shared Security is handled as a technique layer and bridge path rather than as a dominant-domain candidate.

### Dominant Domain Scoring

`getArticleDominantDomain(article)` calculates:

- `banknoteScore`
- `identityScore`
- `digitalScore`

The scores come from `getPersonalDomainContextProfile(context, groupId)`, plus domain-specific bonuses and penalties.

Banknote score:

- starts with the banknote domain-context score
- adds `+18` for banknote topic
- adds `+28` for banknote authority source
- adds up to `+18` from banknote context hits
- adds `getStrongBanknoteDomainSignalAssessment(article).boost`

Identity score:

- starts with the Identity Documents domain-context score
- adds `+18` for `travel_passport`, `identity_document`, or `dmv_driver_license` topic type
- adds `+14` for Identity specialist source
- subtracts `strongBanknoteSignals.identityPenalty`

Digital Identity score:

- starts with the Digital Identity/Biometrics domain-context score
- adds `+20` for digital identity topic/domain
- adds `+14` for Digital Identity specialist source

### Weighting Source

The shared helper `getPersonalDomainContextProfile(context, groupId)` provides baseline domain scores:

- strong title hits: `5`
- strong tag hits: `4`
- strong metadata hits: `3.5`
- strong body hits: `1.25`
- weak title hits: `2`
- weak tag hits: `1.5`
- weak metadata hits: `1.25`
- weak body hits: `0.35`

For Identity Documents, it also adds topic-type support and title bonuses for terms such as biometric passport, electronic passport, eMRTD, MRTD, identity card, residence permit, driver license, polycarbonate, document security, and document fraud. It subtracts title-level travel/social/general noise such as passport appointment, passport photo, travel tips, vacation, visa requirements, celebrity passport, political passport, passport renewal, immigration lawyer, YouTube, TikTok, and Instagram.

### Tie Breaking And Fallback

After computing the three scores, `getArticleDominantDomain(article)` sorts candidates descending by score.

It returns `other` when:

- the best score is below `8`, or
- the top two candidates are within `2` points and the best score is below `14`

Otherwise it returns the top candidate domain.

This creates a low-confidence fallback to `other`, but it does not create an Identity-specific fallback. If another domain wins clearly, that domain becomes authoritative for early Personal Dashboard gating.

### Caching

`getArticleDominantDomain(article)` is cached per article under `personalDominantDomain` by `getCachedArticleValue(article, cacheKey, computeValue)`.

## Helper Relationships

### Core Dominant-Domain Helpers

- `getPersonalBoostContext(article)`: creates normalized text/context buckets.
- `getPersonalDomainContextProfile(context, groupId)`: produces baseline keyword/context score and excluded-hit count for one domain group.
- `getBanknoteInterestSignals(article)`: contributes banknote topic/source/context hits.
- `getStrongBanknoteDomainSignalAssessment(article)`: contributes banknote boost and Identity penalty when strong banknote evidence is present.
- `contextMatchesSpecialistSource(context, groupId)`: checks whether source/domain text matches specialist source lists.
- `countBoostKeywordMatches(text, keywords)`: counts keyword matches used by domain profiles.
- `getCachedArticleValue(article, cacheKey, computeValue)`: memoizes per-article derived values.

### Personal Dashboard Domain Helpers

- `getSelectedMainDomains(selectedInterests)`: maps selected Personal Dashboard groups to main domains: `banknotes`, `identity_documents`, `digital_identity_biometrics`. Shared Security is intentionally omitted as a main domain.
- `getSelectedIdentityDocumentSubinterests(selectedInterests)`: returns selected Identity child interests.
- `getSelectedSharedSecuritySubinterests(selectedInterests)`: returns selected Shared Security techniques.
- `articleMatchesSelectedIdentityTechniqueBridge(article, selectedInterests)`: allows Identity + Shared Security combinations to pass when Identity evidence and selected technique evidence are both sufficient.
- `articleMatchesSelectedBanknoteTechniqueBridge(article, selectedInterests)`: analogous Banknotes + Shared Security bridge.
- `matchesIdCardsHolographyOvdCombinationBridge(article, identityInterests, sharedInterests)`: narrow bridge for selected ID Cards plus Holography/OVD.

### Related But Not Authoritative For Early Gate

- `calculatePersonalDomainScore(article, selectedInterests)`: calculates a richer Personal Dashboard domain score for ranking/lane relevance. It uses `getDomainDecayMultiplier(article, selectedMainDomains)`, which itself uses dominant domain. It does not decide the early pass/fail gate in `articleMatchesPersonalDashboardSelection()`.
- `getPersonalDashboardDomainMatch(article)`: computes selected-domain score threshold matching for lane/relevance explanations. It is used by `getPersonalIntelligenceLane(article)`, not by the main `articleMatchesPersonalDashboardSelection()` inclusion gate.
- `computePersonalInterestBoost(article, interestId)`: calculates interest/subinterest strength. For Identity selections, its score is only checked after an article has passed the dominant-domain gate or bridge gate.

## Call Flow

### Rendering / Filter Pipeline Path

1. Candidate retrieval provides a candidate article pool.
2. `applyPersonalDashboardStage()` evaluates each candidate with `articleMatchesPersonalDashboardSelection(article)`.
3. When rejected, diagnostics call `classifyPersonalDashboardRejection(article)`.
4. `buildPersonalDashboardScore(article, { passed, rejection })` packages diagnostic score/contribution data.
5. Identity diagnostics call `getIdentityDecisionDiagnostics(article, { passed, rejection })`.

### Authoritative Inclusion Flow

`articleMatchesPersonalDashboardSelection(article)`:

1. Normalize selected interests.
2. If no Personal Dashboard interests are selected, return `true`.
3. If this is Shared Security only, bypass dominant-domain gating and evaluate `matchesSelectedSharedSecurityTechnique(article, selectedInterests)`.
4. Compute:
   - `selectedMainDomains`
   - `selectedSharedInterests`
   - `identityTechniqueBridgeMatched`
   - `banknoteTechniqueBridgeMatched`
   - `primaryDomain = getArticleDominantDomain(article)`
5. If `primaryDomain === "other"` and neither bridge matched, return `false`.
6. If selected main domains exist and do not include `primaryDomain`, allow only when the relevant selected bridge matched. Otherwise return `false`.
7. Compute `sharedSecurityTechniqueMatched`.
8. If this is a Banknotes selection, enter Banknotes-specific logic.
9. If `primaryDomain === "identity_documents"`, enter Identity-specific logic.
10. If `primaryDomain === "digital_identity_biometrics"`, enter Digital Identity-specific logic.
11. Otherwise return `sharedSecurityTechniqueMatched`.

### Identity-Specific Inclusion Flow

The Identity branch is only reached when `primaryDomain === "identity_documents"`.

Within that branch:

1. Reject Identity navigation pages.
2. Collect selected Identity child interests.
3. Evaluate the ID Cards Holography/OVD bridge.
4. If no Identity child interests are selected, Identity scope is satisfied.
5. If child interests are selected, require at least one:
   - `computePersonalInterestBoost(article, interestId).score >= 18`
   - `matchesIdCardsHolographyOvdCombinationBridge(...)`
6. Return `identityScopeMatched && sharedSecurityTechniqueMatched`.

## Decision Tree

For a selection such as Identity Documents + ID Cards:

```text
articleMatchesPersonalDashboardSelection(article)
  selected interests exist
  not Shared Security only
  primaryDomain = getArticleDominantDomain(article)

  primaryDomain == "other" and no bridge?
    reject

  selectedMainDomains excludes primaryDomain and no selected bridge?
    reject

  primaryDomain == "identity_documents"?
    reject navigation pages
    if selected child interests exist:
      require computePersonalInterestBoost(child).score >= 18
      or ID Cards Holography/OVD bridge
    require selected Shared Security technique if selected

  primaryDomain == another domain?
    never reaches Identity child score threshold
```

## Rejection Flow

### How `primaryDomainMismatch` Is Assigned

`classifyPersonalDashboardRejection(article)` mirrors the early gate:

1. If Shared Security only and technique fails, return `techniqueRejected`.
2. Compute:
   - `identityTechniqueBridgeMatched`
   - `banknoteTechniqueBridgeMatched`
   - `primaryDomain = getArticleDominantDomain(article)`
3. If `primaryDomain === "other"` and neither bridge matched:
   - category: `primaryDomainMismatch`
   - reason: `primary domain is other and no bridge matched`
4. If selected main domains exist and do not include `primaryDomain`:
   - category: `primaryDomainMismatch`
   - reason: `primary domain X is outside selected main domains`
5. Only after those checks does the classifier reach Identity-specific score logic.

### Why It Is Not `identity_score_below_threshold`

The Identity score-below-threshold classification only happens if:

- `primaryDomain === "identity_documents"`, and
- selected Identity interests exist, and
- none of those selected Identity interests has `computePersonalInterestBoost(article, interestId).score >= 18`

So an article with an Identity child score below 18 but dominant domain `banknotes`, `digital_identity_biometrics`, or `other` is labeled `primaryDomainMismatch`, not `scoreTooLow`.

### Diagnostics Naming Nuance

`getIdentityDecisionDiagnostics(article)` uses the likely failure reason `identity_score_below_threshold` when:

- the diagnostic logic gets past dominant-domain miss checks, and
- selected Identity child score is below `18`, and
- the ID Cards Holography/OVD bridge did not match.

But the exported rejection bucket uses `classifyPersonalDashboardRejection(article)`, where the category is `scoreTooLow`, not `identity_score_below_threshold`.

## Ordering: Dominant Domain Versus Identity Child Matching

Dominant domain is evaluated before Identity child matching.

In `articleMatchesPersonalDashboardSelection(article)`, `primaryDomain = getArticleDominantDomain(article)` is computed before the Identity branch. The branch that checks `computePersonalInterestBoost(article, interestId).score >= 18` only executes when `primaryDomain === "identity_documents"`.

This ordering means dominant domain is a precondition for normal Identity child-interest evaluation.

## Hard Gate Or Ranking Signal?

Dominant domain currently serves both roles, depending on the path.

### Hard Gate

In `articleMatchesPersonalDashboardSelection(article)`, dominant domain is a hard inclusion gate:

- `primaryDomain === "other"` rejects unless an Identity/Banknote technique bridge matched.
- selected main domains excluding `primaryDomain` reject unless the matching bridge for the selected domain is active.
- Identity child matching is only reached under `primaryDomain === "identity_documents"`.

This is the authoritative production pass/fail path.

### Ranking / Lane Signal

In `calculatePersonalDomainScore(article, selectedInterests)`, dominant domain contributes through `getDomainDecayMultiplier(article, selectedMainDomains)`. This affects domain score and relevance band used later for ranking/lane logic.

`getPersonalDashboardDomainMatch(article)` computes selected-domain score threshold matches and is used by `getPersonalIntelligenceLane(article)`.

These scoring/lane helpers do not override the early hard gate in `articleMatchesPersonalDashboardSelection()`.

## Observations

1. `primaryDomainMismatch` is expected to be large when selected Identity content has adjacent or mixed-domain articles, because dominant-domain mismatch is evaluated before Identity child scores.
2. The dominant-domain decision is deliberately conservative for low-confidence articles: best score below `8` becomes `other`, and weak near-ties can become `other`.
3. Strong banknote signals can actively suppress Identity dominance through `strongBanknoteSignals.identityPenalty`.
4. Shared Security is not a dominant-domain output. It can only help through technique matching or bridge logic.
5. `calculatePersonalDomainScore()` may contain richer Identity evidence than the early hard gate uses, but it happens in a separate scoring/ranking path.
6. Current diagnostics report the winning dominant domain but do not expose the three competing domain scores or the exact tie/fallback reason.
7. The current `dominantDomainMisses` Identity diagnostic count means: dominant domain was not `identity_documents` and no Identity technique bridge matched. It does not necessarily mean the article had no Identity evidence.

## Recommended Next Step

Do not change the gate yet.

The smallest architectural improvement for future diagnostics is to add a diagnostics-only helper:

```js
getDominantDomainDecisionDiagnostics(article)
```

It should expose:

- the three raw candidate domain scores
- selected winner
- fallback reason (`best_score_below_minimum`, `low_confidence_tie`, or `winner`)
- contributing domain-context scores
- banknote authority/context bonuses
- strong banknote boost and Identity penalty
- Identity topic/source bonuses
- Digital Identity topic/source bonuses
- whether the selected Personal Dashboard main domain was excluded by the winner
- whether a bridge rescued the mismatch

This would preserve behavior while making `primaryDomainMismatch` explainable at the exact point it is produced. After that diagnostic layer is proven, any future behavior change can be targeted at specific false-negative patterns rather than loosening the hard gate broadly.
