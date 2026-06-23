# Filtering Intelligence - Identity Documents Investigation 1

## Executive Summary

Identity Documents matching is not one matcher. It is a layered architecture:

1. Candidate retrieval chooses a broad candidate pool.
2. `getArticleDominantDomain()` classifies the article as `banknotes`, `identity_documents`, `digital_identity_biometrics`, or `other`.
3. `articleMatchesPersonalDashboardSelection()` applies the selected Personal Dashboard interests.
4. Identity Documents articles pass when the primary domain is `identity_documents` and selected identity subinterests score at least `18`.
5. Identity + Shared Security combinations can also pass through bridge logic, especially for `ID Cards + Holography/OVD` and broader selected Identity subinterest + Shared Security technique combinations.

The most likely false negatives are not caused by one obvious threshold. They are most likely caused by interactions between:

- dominant-domain assignment,
- selected identity subinterest score `< 18`,
- subinterest mismatch penalties,
- hard context gates for passports / residence permits / ICAO / border control,
- Shared Security technique evidence being present but not accepted for the selected technique,
- and missing or implicit UI vocabulary, especially for concepts such as laser engraving, chip, biometric, and personalization.

The smallest safe next improvement is diagnostics-first: add Identity-specific decision trace metadata before changing thresholds or vocabulary.

## A. Identity Documents Decision Flow

Current high-level flow:

```text
state.personalDashboard.interests
  -> normalizePersonalDashboardInterests()
  -> getSelectedMainDomains()
  -> getSelectedIdentityDocumentSubinterests()
  -> getSelectedSharedSecuritySubinterests()
  -> articleMatchesPersonalDashboardSelection(article)
      -> isSharedSecurityOnlyPersonalSelection()
      -> articleMatchesSelectedIdentityTechniqueBridge()
      -> articleMatchesSelectedBanknoteTechniqueBridge()
      -> getArticleDominantDomain()
      -> selected main-domain gate
      -> selected shared-security technique gate
      -> if primaryDomain === "identity_documents"
          -> isIdentityNavigationPageArticle()
          -> selected identity interest score >= 18
          -> matchesIdCardsHolographyOvdCombinationBridge()
          -> identityScopeMatched && sharedSecurityTechniqueMatched
```

For Identity Documents selections, the important surface-level decision in `articleMatchesPersonalDashboardSelection()` is:

```js
const identityScopeMatched = !selectedIdentityInterests.length
  || selectedIdentityInterests.some((interestId) => computePersonalInterestBoost(article, interestId).score >= 18)
  || idCardsHolographyOvdBridgeMatched;

return identityScopeMatched && sharedSecurityTechniqueMatched;
```

So the final identity branch requires:

- `primaryDomain === "identity_documents"`,
- not an identity navigation page,
- identity scope match,
- and any selected Shared Security technique match.

If the article is not primarily classified as Identity Documents, it can still pass only if `articleMatchesSelectedIdentityTechniqueBridge()` is true and `identity_documents` is among selected main domains.

## B. Complete Call Graph

### Selection Helpers

```text
normalizePersonalDashboardInterests()
  -> getSelectedMainDomains()
  -> getSelectedIdentityDocumentSubinterests()
  -> getSelectedSharedSecuritySubinterests()
```

### Domain Classification

```text
getArticleDominantDomain(article)
  -> getPersonalBoostContext(article)
  -> getPersonalDomainContextProfile(context, "banknote_intelligence")
  -> getPersonalDomainContextProfile(context, "identity_documents")
  -> getPersonalDomainContextProfile(context, "digital_identity_biometrics")
  -> getBanknoteInterestSignals(article)
  -> getStrongBanknoteDomainSignalAssessment(article)
```

The dominant domain returns `other` when the best score is less than `8`, or when the top two domains are too close and the top score is less than `14`.

### Domain Match / Domain Score

```text
calculatePersonalDomainScore(article, selectedInterests)
  -> getPersonalDomainContextProfile()
  -> contextMatchesSpecialistSource()
  -> computePersonalInterestBoost()
  -> getIdentityDocumentSourceAuthority()
  -> getIdentityDocumentInterestSignals()
  -> getIdentityDocumentSubinterestScore()
  -> hasRequiredContextCombo()
  -> identity profile / intent / noise helpers
```

```text
getPersonalDashboardDomainMatch(article)
  -> getPersonalDashboardSelectedDomainConfig()
  -> getPersonalDomainContextProfile()
  -> contextMatchesSpecialistSource()
  -> computePersonalInterestBoost()
  -> getPersonalDashboardDomainThreshold()
```

Domain threshold by mode:

- strict: `20`
- normal/default: `12`
- broad: `8`

### Interest Score

```text
computePersonalInterestBoost(article, interestId)
  -> PERSONAL_DASHBOARD_INTEREST_MAP
  -> getPersonalBoostContext()
  -> getPersonalDomainContextProfile()
  -> keyword hits from interest strong/weak lists
  -> topicSignals / tagSignals / signalIds / eventTypes
  -> for identity_documents:
      -> getIdentityDocumentInterestSignals()
      -> getIdentityDocumentSourceAuthority()
      -> getIdentityDocumentSubinterestScore()
      -> getSelectedIdentityDocumentSubinterests()
      -> getBorderControlAuthorityAdjustment()
      -> isGenericDmvNoise()
      -> hasRequiredContextCombo()
      -> hard context penalties
      -> getIdentityDocumentIntentBreakdown()
      -> getIdentityProfileSourcePriorityBoost()
      -> getIdentityProfileSoftNoiseAssessment()
      -> getBorderControlMarketingPagePenalty()
      -> getBorderControlNewsPriority()
      -> getBorderControlGuidancePenalty()
      -> getBorderControlRecencyAdjustment()
      -> getResidencePermitIntentAdjustment()
      -> getIdentityRecencyAdjustment()
      -> getIdentityGoogleNewsPenalty()
```

### Subinterest Score

```text
getIdentityDocumentSubinterestScore(article, selectedInterests)
  -> getSelectedIdentityDocumentSubinterests()
  -> getIdentityDocumentInterestSignals()
  -> getIdentityDocumentIntentBreakdown()
  -> calculateIdentityProfileScore() for:
      id_cards
      passports
      visas
      residence_permits
      border_control
      icao
      issuance
      fraud
  -> weighted scoreByInterest
  -> mismatchPenalty = strongest non-selected score - best selected score
```

### Profile Score

```text
calculateIdentityProfileScore(article, profileId)
  -> IDENTITY_INTELLIGENCE_PROFILES[profileId]
  -> evaluateIdentityDocumentHardContext()
  -> strong / medium / weak / negative profile hits
  -> requiredContextGroups
  -> authorityBoostSources
  -> hard context gate penalties
```

### Shared Security Bridges

```text
articleMatchesSelectedIdentityTechniqueBridge(article, selectedInterests)
  -> getSelectedIdentityDocumentSubinterests()
  -> getSelectedSharedSecuritySubinterests()
  -> computePersonalInterestBoost(article, identityInterest).score >= 18
  -> getSharedSecurityStandaloneAssessment(article, sharedInterest)
  -> IDENTITY_SHARED_SECURITY_COMBINATION_TECHNIQUE_TERMS fallback terms
```

```text
matchesIdCardsHolographyOvdCombinationBridge(article, selectedIdentityInterests, selectedSharedInterests)
  -> requires id_cards selected
  -> requires holography or ovd selected
  -> requires selected technique standalone assessment included
  -> requires strong technique evidence
  -> requires document-security context
```

### Rejection Classification

```text
classifyPersonalDashboardRejection(article)
  -> selected main-domain and shared technique state
  -> getArticleDominantDomain()
  -> bridge checks
  -> primaryDomainMismatch
  -> techniqueRejected
  -> scoreTooLow for identity_documents
  -> identityMismatch
```

## C. Where Identity Documents Pass/Fail Is Decided

The final authoritative pass/fail function is:

```js
articleMatchesPersonalDashboardSelection(article)
```

For Identity Documents, the decisive branch is:

```js
if (primaryDomain === "identity_documents") {
  if (isIdentityNavigationPageArticle(article)) {
    return false;
  }

  const selectedIdentityInterests = selectedInterests.filter(
    (interestId) => PERSONAL_DASHBOARD_INTEREST_MAP.get(interestId)?.groupId === "identity_documents"
  );
  const idCardsHolographyOvdBridgeMatched = matchesIdCardsHolographyOvdCombinationBridge(
    article,
    selectedIdentityInterests,
    selectedSharedInterests
  );
  const identityScopeMatched = !selectedIdentityInterests.length
    || selectedIdentityInterests.some((interestId) => computePersonalInterestBoost(article, interestId).score >= 18)
    || idCardsHolographyOvdBridgeMatched;
  return identityScopeMatched && sharedSecurityTechniqueMatched;
}
```

Important implications:

- Parent-only `Identity Documents` can pass if no identity child interest is selected.
- Child selections such as `ID Cards` or `Passports` require `computePersonalInterestBoost(...) >= 18`, unless the special ID Cards Holography/OVD bridge applies.
- Shared Security selections are ANDed with identity scope via `sharedSecurityTechniqueMatched`.
- Articles with `primaryDomain !== "identity_documents"` can be rejected before the identity branch unless the broader identity technique bridge passes.

## D. Where Bridge Logic Is Evaluated

Bridge logic is evaluated before the primary domain gate and again inside the identity branch:

1. `articleMatchesSelectedIdentityTechniqueBridge()` runs near the start of `articleMatchesPersonalDashboardSelection()`.
2. If `primaryDomain` is `other` or outside selected domains, this bridge can rescue an article for Identity Documents.
3. `matchesIdCardsHolographyOvdCombinationBridge()` runs inside the `primaryDomain === "identity_documents"` branch and can satisfy `identityScopeMatched`.

Bridge interaction:

```text
selected Shared Security interests
  -> matchesSelectedSharedSecurityTechnique()
  -> articleMatchesSelectedIdentityTechniqueBridge()
  -> matchesIdCardsHolographyOvdCombinationBridge()
```

`sharedSecurityTechniqueMatched` is true when:

```js
!selectedSharedInterests.length
|| matchesSelectedSharedSecurityTechnique(article, selectedInterests)
|| identityTechniqueBridgeMatched
|| banknoteTechniqueBridgeMatched
```

This means an Identity + Shared Security combination can pass if either:

- the selected technique passes standalone assessment,
- or the identity technique bridge passes.

## E. Current Thresholds And Gates

### Dominant Domain

`getArticleDominantDomain()`:

- returns `other` if top domain score `< 8`,
- returns `other` if top-two domain gap `< 2` and top score `< 14`,
- otherwise returns the highest domain.

### Personal Dashboard Domain Match

`getPersonalDashboardDomainThreshold()`:

- strict: `20`
- default: `12`
- broad: `8`

### Identity Scope Match

Inside `articleMatchesPersonalDashboardSelection()`:

- selected identity interest passes at `computePersonalInterestBoost(article, interestId).score >= 18`.

### Identity Technique Bridge

`articleMatchesSelectedIdentityTechniqueBridge()`:

- requires at least one selected Identity Documents interest,
- requires at least one selected Shared Security interest,
- requires identity scope score `>= 18`,
- then requires selected technique standalone assessment included, or selected technique terms from `IDENTITY_SHARED_SECURITY_COMBINATION_TECHNIQUE_TERMS`.

### ID Cards Holography/OVD Bridge

`matchesIdCardsHolographyOvdCombinationBridge()`:

- requires `id_cards` selected,
- requires `holography` or `ovd` selected,
- requires selected technique standalone assessment included,
- requires strong technique evidence,
- requires document-security context.

### Identity Subinterest Mismatch

`HARD_SUBINTEREST_MISMATCH_THRESHOLD = 12`.

`getIdentityDocumentSubinterestScore()` computes:

```js
mismatchPenalty = strongest non-selected score - best selected score
```

Then `computePersonalInterestBoost()` can apply a large penalty when:

```js
identitySubinterest.mismatchPenalty > 12
&& !selectedSubinterestHasStrongEvidence
```

That can penalize articles where another identity subinterest looks stronger than the selected one.

### Hard Context Penalties

`IDENTITY_REQUIRED_CONTEXT_STRICT_PENALTIES`:

- `icao`: `800`
- `border_control`: `600`
- `residence_permits`: `700`

`IDENTITY_DOCUMENT_HARD_CONTEXT_GATES`:

- `passports`: severe penalty `420`
- `residence_permits`: severe penalty `380`
- `icao`: severe penalty `420`
- `border_control`: severe penalty `360`

These gates are not generic Identity Documents gates. They apply in profile scoring for specific subinterests.

## F. Current Identity Vocabulary

### Personal Dashboard Identity Documents Interests

The current Identity Documents group contains:

- `passports`
- `id_cards`
- `residence_permits`
- `drivers_licenses`
- `visas`
- `laminate`
- `polycarbonate`
- `issuance`
- `fraud`
- `icao`
- `border_control`

### Shared Security Interests Commonly Combined With Identity Documents

These are in the Shared Security Printing group, not in the Identity Documents group:

- `security_printing_core`
- `security_inks`
- `micro_optics`
- `holography`
- `ovd`
- `intaglio`
- `anti_counterfeit`
- `personalization`
- `secure_documents`

### Important Concepts That Are Vocabulary But Not Identity Child Interests

These are present in scoring vocabularies but are not standalone Identity Documents child interests:

- Laser engraving
- Laser personalization / personalisation
- Chip
- Passport chip
- Biometric
- Biometric passport
- Document authentication
- Document verification
- Personalization / personalisation
- Security feature
- Security printing
- Micro optics
- OVD
- Holography

This matters for user expectations. For example, `Identity Documents + Laser Engraving` cannot currently map to a selected `laser_engraving` child interest, because no such Personal Dashboard interest exists. Laser terminology can only influence scoring indirectly through profile/context terms.

### Identity Signal Terms

`getIdentityDocumentInterestSignals()` includes weighted hit buckets for:

- primary context
- passport
- ID card
- residence permit
- driver license
- polycarbonate
- fraud
- ICAO
- border
- visa
- issuance
- laminate
- personalization
- noisy terms

Title hits weigh `5`, tag/metadata hits weigh `2.5`, and body hits weigh `1`.

### Intent Profiles

`IDENTITY_SUBINTEREST_INTENTS` covers:

- passports
- visas
- residence permits
- ICAO
- border control

It does not currently define separate intent profiles for:

- ID cards
- driver licenses
- laminate
- polycarbonate
- issuance
- fraud

Those subinterests depend more heavily on `getIdentityDocumentInterestSignals()` and `IDENTITY_INTELLIGENCE_PROFILES`.

### Semantic Profiles

`IDENTITY_INTELLIGENCE_PROFILES` covers:

- `id_cards`
- `passports`
- `visas`
- `residence_permits`
- `border_control`
- `icao`
- `issuance`
- `fraud`

It does not define profiles for:

- `drivers_licenses`
- `laminate`
- `polycarbonate`

Those are still scored through interest config and signal buckets, but they lack the richer profile scoring path.

## G. Current Bridge Combinations

### General Identity + Shared Security Bridge

`articleMatchesSelectedIdentityTechniqueBridge()` supports any selected Identity Documents subinterest combined with any selected Shared Security interest that has entries in `IDENTITY_SHARED_SECURITY_COMBINATION_TECHNIQUE_TERMS`.

Current combination term map includes:

- `security_inks`
- `holography`
- `ovd`
- `micro_optics`
- `security_printing_core`
- `secure_documents`

It does not include:

- `intaglio`
- `anti_counterfeit`
- `personalization`

Even though those are Shared Security interests, they do not currently have combination bridge term lists in `IDENTITY_SHARED_SECURITY_COMBINATION_TECHNIQUE_TERMS`.

### ID Cards + Holography/OVD Special Bridge

`matchesIdCardsHolographyOvdCombinationBridge()` is narrower and only applies to:

- `id_cards + holography`
- `id_cards + ovd`

It requires:

- selected technique standalone assessment included,
- strong technique evidence from holography/OVD terms,
- document-security context from ID/document/security terms.

### Shared Security Standalone Assessment Dependency

Both bridge paths rely heavily on:

```js
getSharedSecurityStandaloneAssessment(article, interestId).included
```

For combinations like `ID Cards + Security Inks`, the bridge does not have the special ID-card bridge and must rely on:

- identity scope score `>= 18`,
- selected Security Inks standalone assessment,
- or Security Inks combination terms.

## H. Likely False-Negative Areas

### 1. Concepts Expected By Users But Missing As Selectable Interests

Estimated impact: high.

Examples:

- Identity Documents + Laser Engraving
- Identity Documents + Chip
- Identity Documents + Biometric
- Identity Documents + Personalization

Laser, chip, biometric, and personalization appear in scoring vocabulary, but not all are selectable Identity Documents subinterests. Some are in Shared Security or Digital Identity, and some are only context terms.

False negatives can occur when users expect these concepts to behave like first-class Identity filters.

### 2. Shared Security Combination Term Map Gaps

Estimated impact: high.

`IDENTITY_SHARED_SECURITY_COMBINATION_TECHNIQUE_TERMS` currently covers:

- Security Inks
- Holography
- OVD
- Micro Optics
- Security Printing
- Secure Documents

It does not cover:

- Intaglio
- Anti-counterfeit
- Personalization

For selected Identity + these Shared Security interests, relevant articles may depend entirely on standalone technique assessment rather than combination bridge vocabulary.

### 3. Dominant Domain Gate Before Identity Branch

Estimated impact: medium-high.

If a relevant identity/security article is classified as:

- `other`,
- `digital_identity_biometrics`,
- or `banknotes`,

it can be rejected before the Identity Documents branch unless `articleMatchesSelectedIdentityTechniqueBridge()` rescues it.

This is especially likely for vendor articles focused on security features where the document type appears only weakly.

### 4. Selected Identity Interest Score Below 18

Estimated impact: medium-high.

The final Identity branch requires:

```js
computePersonalInterestBoost(article, selectedIdentityInterest).score >= 18
```

False negatives can happen when an article has the right document-security subject but uses adjacent vocabulary that scores below 18.

Examples:

- ID card articles using `physical identity documents` or vendor product names without `id card`.
- Passport-security articles using `travel document`, `booklet`, `datapage`, `chip`, or `PKI` without repeated passport anchors.
- Residence permit articles using local authority names or card-product names without `residence permit`.

### 5. Hard Context Gates And Travel Noise Penalties

Estimated impact: medium.

Passports, residence permits, ICAO, and border control have hard context gates and strong travel/tourism/noise penalties.

This is valuable for precision, but can reject relevant articles when:

- the article title is travel-adjacent,
- the source is Google News,
- body context is sparse,
- or the document-security context is in the body but not in title/metadata.

### 6. Subinterest Mismatch Penalty

Estimated impact: medium.

If an article selected for `passports` scores more strongly as `border_control`, `visas`, or another identity subinterest, `mismatchPenalty` can push the selected score down. This is especially relevant for passport/border/ICAO overlap.

### 7. Identity Navigation Page Guard

Estimated impact: low-medium.

`isIdentityNavigationPageArticle()` rejects navigation/marketing pages unless strong context exists. This is probably correct, but vendor product pages with sparse article-like context may be borderline.

## I. Recommended Smallest Safe Improvement

Do not change thresholds first.

The highest-quality next step is diagnostics-only:

1. Add Identity Documents decision trace metadata mirroring the Polymer diagnostics approach.
2. Capture, per article:
   - `dominantDomain`
   - selected identity interests
   - selected shared security interests
   - `computePersonalInterestBoost` score per selected identity interest
   - `getIdentityDocumentSubinterestScore()` output
   - `bestSelectedScore`
   - `mismatchPenalty`
   - matched subinterest
   - selected subinterest
   - `articleMatchesSelectedIdentityTechniqueBridge()` result
   - `matchesIdCardsHolographyOvdCombinationBridge()` result
   - selected technique standalone assessment
   - combination bridge term hits where available
   - rejection category and reason

Then add helper functions:

```js
window.explainIdentityMatchByTitle(titlePart)
window.listIdentityScoreTooLow(limit)
window.listIdentityTechniqueBridgeMisses(limit)
```

After those diagnostics identify actual false-negative classes, the smallest safe behavior improvement is likely one of:

1. Add combination term-map entries for high-precision missing Shared Security interests:
   - `personalization`
   - `intaglio`
   - `anti_counterfeit`

2. Add a first-class `laser_engraving` Shared Security or Identity-adjacent technique only if the UI needs to support `Identity Documents + Laser Engraving` explicitly.

3. Add vocabulary to existing identity profiles rather than lowering the `>= 18` pass threshold.

The preferred first behavior change should be vocabulary/bridge coverage, not threshold reduction.
