# Filtering Intelligence - UI Relevance Guard Investigation 1

## Executive Summary

`isUiRelevantIntelligenceArticle(article)` is not a Personal Dashboard relevance check. It is an intelligence-signal/event relevance check.

That distinction explains the current diagnostics:

- Personal Dashboard can correctly identify a professional Identity Documents article as relevant to ID Cards.
- The Identity professional relevance guard can clear passport/noise gates.
- The article can still fail UI relevance if it does not look like a recognized event/signal under the current signal taxonomy.

After the professional Identity rescue, the current result set is much healthier. The remaining `ui_relevance` false negatives are likely articles that are professionally relevant but written as vendor/newsroom/market intelligence rather than as explicit rollout, regulation, fraud, border, release, redesign, biometric system, or security-feature events.

No application code was modified in this investigation.

## A. Current UI Relevance Flow

The top-level guard is `isUiRelevantIntelligenceArticle(article)` in `frontend/public/app.js` lines 19879-19886.

Its logic is simple:

1. Call `getArticleSignalMatches(article)`.
2. If any signal matches exist, return `true`.
3. Otherwise call `isRelevantSignalText(getArticleSignalText(article))`.
4. Return that boolean.

The full flow is:

```text
isUiRelevantIntelligenceArticle(article)
  -> getArticleSignalMatches(article)
       -> getArticleSignalText(article)
       -> isRelevantSignalText(haystack)
       -> hasSignalCoreObject(haystack)
       -> hasSignalNoiseContext(haystack)
       -> getNormalizedEventSignalMatch(article)
       -> getIdDocumentSignalMatches(haystack)
       -> getBanknoteSignalMatches(haystack)
       -> generic SIGNAL_CATEGORIES heuristics
  -> if no matches:
       isRelevantSignalText(getArticleSignalText(article))
```

The input text is built by `getArticleSignalText(article)` at lines 18311-18327 from:

- title
- description
- summary
- summaryShort
- contentSnippet
- source
- topic
- tags
- filter tags

## B. Exact Pass/Fail Conditions

### `isUiRelevantIntelligenceArticle(article)`

At lines 19879-19886:

- Passes if `getArticleSignalMatches(article)` returns at least one match.
- Otherwise passes only if `isRelevantSignalText(getArticleSignalText(article))` returns true.

### `getArticleSignalMatches(article)`

Defined at lines 19780-19870.

It returns no matches if:

1. signal text is empty.
2. `isRelevantSignalText(haystack)` is false.
3. the text lacks a core object from `SIGNAL_CORE_OBJECT_KEYWORDS`.
4. the text contains generic signal noise context from `SIGNAL_NOISE_CONTEXT_KEYWORDS`.

If these gates pass, it creates possible matches from:

- normalized event classification
- Identity document signal matches
- banknote signal matches
- generic `SIGNAL_CATEGORIES`

### `isRelevantSignalText(text)`

Defined at lines 19391-19430.

It fails immediately when `SIGNAL_RELEVANCE_NOISE_KEYWORDS` match. Current examples include economy, inflation, interest rate, central bank, monetary policy, GDP, forex, borrowing, bond, stock market, currency rate, and yen at lines 2994-3007.

If an Identity object is detected via `ID_SIGNAL_OBJECT_KEYWORDS`, it then:

1. rejects if any `ID_SIGNAL_NOISE_KEYWORDS` match.
2. otherwise requires `isAllowedIdentityIntent(text)`.

`isAllowedIdentityIntent(text)` at lines 19482-19487 rejects weak intent unless there is an override, and otherwise requires strong Identity intent.

If no Identity object is detected, the helper can still pass for:

- banknote signal objects with high or low priority banknote signals,
- strict include keywords,
- release variant plus release object combinations.

### `getIdDocumentSignalMatches(text)`

Defined at lines 19603-19705.

It has several early fail gates:

1. no Identity object keyword
2. Identity noise context
3. invalid Identity context
4. non-impact Identity content
5. no system impact
6. non-system Identity noise
7. no system event
8. Identity noise keyword
9. weak or absent allowed Identity intent

Only after all of those gates pass does it assign signal categories such as regulations, delay, travel disruption, criminal misuse, fraud, identity theft, biometric, border control, security features, technology, redesign, rollout, and new releases.

This means professional but descriptive articles can fail if they do not contain system-impact and system-event phrasing.

## C. Signal Categories Used

The generic `SIGNAL_CATEGORIES` list begins at line 2435.

Categories include:

- `new-releases`
- `regulations`
- `design-changes`
- `security-features`
- `technology`
- `fraud`
- `counterfeit`
- `withdrawal`
- `redesign`
- `polymer`
- `commemorative`
- `rollout`
- `delay`
- `travel-disruption`
- `criminal-misuse`
- `biometric`
- `identity-theft`
- `border-control`

For Identity-specific matching, `getIdDocumentSignalMatches(text)` can produce:

- `regulations`
- `delay`
- `travel-disruption`
- `criminal-misuse`
- `fraud`
- `identity-theft`
- `biometric`
- `border-control`
- `security-features`
- `technology`
- `redesign`
- `design-changes`
- `rollout`
- `new-releases`

Normalized event types are mapped in `getNormalizedEventSignalMatch(article)` at lines 19727-19777. Identity-related mappings include:

- `passport_fraud` -> `fraud`
- `forged_document` -> `criminal-misuse`
- `identity_theft` -> `identity-theft`
- `passport_revocation` -> `regulations`
- `citizenship_law` -> `regulations`
- `visa_policy` -> `regulations`
- `border_delay` -> `delay`
- `border_rollout` -> `rollout`
- `biometric_border_check` -> `biometric`
- `ees_event` -> `delay`, `rollout`, or `border-control`
- `etias_event` -> `delay`, `rollout`, or `border-control`
- `digital_id_regulation` -> `regulations`
- `identity_infrastructure` -> `technology`
- `document_security_technology` -> `technology`

## D. Why Professional ID Articles Can Fail UI Relevance

Professional ID articles can fail UI relevance because the UI relevance layer is looking for event/signal language, not just professional relevance.

Examples likely to fail are articles that say, in effect:

- a vendor targets demand for secure ID documents,
- a manufacturer discusses secure ID document materials,
- a government digitizes renewal process,
- a vendor pilots biometric ID documents,
- a national ID card adds credential features.

These may be very relevant to Identity Documents but can miss one of the UI relevance gates:

### Missing system-impact language

`getIdDocumentSignalMatches()` requires `hasIdentitySystemImpact(text)` at lines 19621-19623. The impact vocabulary at lines 2768-2787 is focused on rollout, launch, implementation, deployment, system upgrade, mandatory/compliance terms, biometric system change, passport system change, ID verification change, border control change, breach, fraud network, or system vulnerability.

An article can be professional and important while not using those exact impact terms.

### Missing system-event language

`getIdDocumentSignalMatches()` requires `isIdentitySystemEvent(text)` at lines 19629-19631. The event vocabulary at lines 2748-2767 includes rollout, launched, introduced, deployed, implemented, law, regulation, mandate, policy change, compliance, breach, biometric system, fraud network, passport system, ID system, identity platform, and verification system.

Vendor or product articles often use softer wording such as "targets demand", "features", "pilot", "secure documents", "credentials", or "renewal process".

### Weak intent without override

`isAllowedIdentityIntent(text)` requires strong Identity intent unless an override exists. Weak editorial or explanatory language can block a match.

### Broad generic signal noise

`getArticleSignalMatches()` rejects any text with `SIGNAL_NOISE_CONTEXT_KEYWORDS` after the relevant-text check. These include central bank, inflation, interest rate, economy, finance, market, loan, borrowing, and investment at lines 3008-3018.

This is useful for banknote/economic noise, but it can affect market/vendor articles if they include "market" or similar finance language.

### Generic fallback is too shallow for some ID articles

If `getArticleSignalMatches()` returns no categories, `isUiRelevantIntelligenceArticle()` falls back to `isRelevantSignalText()`. For Identity-object articles, that still requires `isAllowedIdentityIntent(text)`. So the fallback is not a professional-ID rescue; it remains a strong-intent gate.

## E. Which Failures Are Probably Correct Noise

UI relevance failures are probably correct when the article is:

- travel advice
- passport renewal tips
- airport queue or disruption advice without system-level significance
- lost/stolen passport consumer story
- celebrity/travel/lifestyle content
- general crime story where a passport is incidental
- social-media/video content
- generic market/economic content
- "what is/how to/guide/tips/explained" content without override signals

The current helper stack has many defenses for these:

- `ID_SIGNAL_NOISE_KEYWORDS` lines 2968-2993
- `ID_SIGNAL_WEAK_INTENT_KEYWORDS` lines 2931-2950
- `ID_SIGNAL_NON_SYSTEM_NOISE_KEYWORDS` lines 2788-2808
- `ID_SIGNAL_NON_IMPACT_KEYWORDS` lines 2809-2828
- `SIGNAL_RELEVANCE_NOISE_KEYWORDS` lines 2994-3007
- `SIGNAL_NOISE_CONTEXT_KEYWORDS` lines 3008-3018

Those failures should generally remain rejected.

## F. Which Failures May Be False Negatives

The most likely false negatives are professional Identity Documents articles that are not written as a canonical event.

Likely false-negative patterns:

- vendor/manufacturer articles about secure ID documents
- material supplier articles about ID document substrates
- biometric ID pilot articles that do not say "system" or "deployed"
- national ID renewal digitization articles that do not match the current event/action phrasing
- document personalization or enrollment platform articles
- digital travel credential feature articles
- security-document technology articles where "secure document" appears but no current signal category fires

The examples mentioned in the request fit this pattern:

- `Cyprus begins pilot of new biometric ID documents from Veridos`
- `Emptech, Covestro target growing demand for secure ID documents`
- `Bahrain adds digital travel credential features to national ID card`
- `Morocco Digitizes National ID Renewal Process`

These sound like professional Identity Documents intelligence, but each may fail if it lacks the exact signal combination required by `getIdDocumentSignalMatches()` or if it gets no normalized event match.

## G. How UI Relevance Differs From Personal Dashboard Relevance

Personal Dashboard relevance answers:

> Does this article match the selected user interest?

It uses domain/interest logic such as dominant domain, selected main domains, Identity subinterest scoring, Personal Dashboard boosts, bridge checks, and topic-specific matchers.

UI relevance answers:

> Does this article look like an intelligence event/signal worth rendering as a signal-bearing article?

It uses signal categories, event normalization, allowed intent, system impact, system event language, core object checks, and noise guards.

So an article can be:

- Personal Dashboard relevant, because it is clearly about ID Cards or Identity Documents.
- UI-relevance rejected, because it does not fit the current event/signal taxonomy.

That split is conceptually useful, but the UI relevance layer can be too event-shaped for professional vendor or product intelligence.

## H. Recommended Smallest Safe Next Step

Do not loosen UI relevance globally.

The smallest safe next step is diagnostics-first:

1. Add UI relevance failure diagnostics for the three `ui_relevance` rejects:
   - whether `isRelevantSignalText()` failed
   - whether `getArticleSignalMatches()` failed
   - whether `hasSignalCoreObject()` failed
   - whether `hasSignalNoiseContext()` failed
   - whether `getIdDocumentSignalMatches()` failed and at which early return
   - whether normalized event mapping was absent
   - which relevant Identity object, system impact, event, intent, and noise terms matched
2. Add a helper such as `window.listUiRelevanceRejectsForIdentityGuard(limit)`.
3. Use those diagnostics to determine whether the safe behavior fix should be:
   - extending the professional Identity rescue to cover these few UI-relevance false negatives,
   - or adding a narrow "professional Identity document intelligence" signal category.

If a behavior change follows, the safest direction is not to lower thresholds or remove UI relevance. It should be a narrow professional Identity Documents exception that still requires:

- professional Identity object evidence,
- vendor/government/manufacturer/infrastructure context,
- no passport/travel/crime/social noise,
- and no existing passport rejection.

That matches the current architecture direction: keep passport noise protection intact while allowing clear professional ID-document intelligence through.

## Validation Notes

- Application code was not modified.
- Filtering behavior remains unchanged.
- Personal Dashboard behavior remains unchanged.
- Thresholds, bridge logic, keyword lists, backend request parameters, cache keys, rendering, grouping, and pagination remain unchanged.
