# Filtering Intelligence v3 Architecture Proposal 1

## Executive Summary

The current filtering pipeline has become good at removing noise, but recent Identity Documents investigations exposed an architectural mismatch:

1. Professional relevance asks whether an article belongs in the platform's intelligence universe.
2. Event relevance asks whether an article describes a concrete intelligence event.

Those are related, but not equivalent.

The current UI relevance layer behaves mostly like an Event Intelligence gate. That is useful for rollouts, fraud, regulations, redesigns, deployments, border implementation, and similar time-bound events. It is less natural for professional intelligence such as vendor partnerships, secure document materials, personalization technology, enrollment systems, production capacity, supplier announcements, R&D, and document manufacturing strategy.

The recommended Filtering Intelligence v3 direction is to split intelligence classification into two explicit lanes:

- Event Intelligence
- Professional Intelligence

Both lanes should remain strict, explainable, and noise-aware. Both should eventually feed rendering. This document is design-only and proposes no behavior changes today.

## A. Current Architecture

Current logical flow:

```text
Candidate Pool
  |
  v
Personal Dashboard Matching
  |
  v
Professional Identity Rescue / Professional Relevance Guard
  |
  v
UI Relevance
  |
  v
Sorting / Grouping / Pagination
  |
  v
Rendering
```

Expanded current flow:

```text
Backend / memory candidate retrieval
  -> selected feed / dashboard / advanced filters
  -> Personal Dashboard interest match
  -> Identity professional relevance guard
       -> passport noise rejection
       -> passport professional relevance rejection
       -> low-relevance passport rejection
       -> professional Identity rescue
       -> UI relevance check
  -> date-first sorting
  -> event grouping
  -> pagination
  -> card rendering
```

The important architectural issue is that the guard sequence uses UI relevance as a final quality gate for Identity results. That gate is optimized for signal/event detection, so it can reject professional but non-event articles.

## B. Responsibilities

### Candidate Pool

Current responsibility:

- Retrieve the working set of articles.
- Respect current strategy/provider architecture.
- Provide candidate articles to downstream filters.

It should not decide final inclusion. Candidate retrieval should be broad enough that relevant articles can reach the filters, then downstream stages should make the strict inclusion decisions.

### Personal Dashboard

Current responsibility:

- Decide whether an article matches selected user interests.
- Use domain and subinterest logic, such as Banknotes, Identity Documents, Shared Security, Digital Identity, and child interests.
- Apply bridge logic for specific combinations.

This answers:

> Does the article match what the user selected?

It does not necessarily answer:

> Is this a concrete event?

### Professional Identity Rescue

Current responsibility:

- Preserve strict passport/consumer-noise protection.
- Rescue clearly professional Identity Documents articles that fail the UI event/signal gate.

This answers:

> Is this professional Identity Documents intelligence even if it does not look like a canonical event?

This layer exists because the UI relevance layer is narrower than professional relevance.

### UI Relevance

Current responsibility:

- Determine whether article text produces an intelligence signal.
- Detect categories such as rollout, regulation, fraud, biometric, border control, security features, technology, redesign, delay, and criminal misuse.
- Reject consumer/travel/generic/noise content.

This answers:

> Does this article look like an intelligence event or actionable signal?

It is not currently a complete professional relevance classifier.

### Rendering

Current responsibility:

- Display surviving articles.
- Preserve badges, grouping, sorting, pagination, and diagnostics.

Rendering should eventually receive a richer classification model so it can show professional and event intelligence without forcing both through the same gate.

## C. Problem Analysis

Professional Intelligence and Event Intelligence differ in both content shape and user value.

### Professional Intelligence

Professional intelligence is often strategic, market-facing, vendor-facing, or capability-facing.

Examples:

- Veridos works on new biometric ID documents.
- Emptech and Covestro target secure ID document demand.
- A document personalization vendor announces a new production line.
- A manufacturer discusses polycarbonate substrates.
- A security printing company announces R&D capacity.
- A supplier expands secure document materials.
- A vendor partnership supports enrollment platforms.

These articles may be highly useful, but they may not contain strong event words like rollout, regulation, deployment, withdrawal, fraud, launch, or border implementation.

### Event Intelligence

Event intelligence is more operational or timeline-bound.

Examples:

- A country launches a new national ID card.
- A passport redesign is rolled out.
- A regulation changes document issuance requirements.
- A fraud network using forged passports is dismantled.
- Biometric border checks are deployed.
- A banknote is withdrawn from circulation.
- A new polymer banknote series is issued.

These articles naturally fit the current UI relevance model because they contain event/action vocabulary.

### Current Mismatch

The current pipeline sometimes asks:

> Is this a professional article?

Then later asks:

> Is this an event article?

But the second answer can override the first.

This is especially visible in Identity Documents because professional vendor/source articles often contain strong Identity relevance without matching the current UI signal taxonomy.

## D. Possible Architecture Options

### Option 1: Keep Current Architecture

Keep Personal Dashboard, professional rescue, and UI relevance as they are.

Pros:

- Lowest engineering cost.
- Current passport noise protection remains strong.
- Event-oriented results remain clean.
- Minimal regression risk.

Cons:

- Professional non-event articles will continue to require one-off rescues.
- Diagnostics will remain harder to interpret because one gate is answering two questions.
- Future tuning may become brittle, with professional exceptions added inside event-oriented code.
- Identity Documents, Shared Security, vendor coverage, and market/technology intelligence may keep surfacing false negatives.

### Option 2: Extend UI Relevance

Keep one UI relevance layer, but expand it to recognize professional intelligence patterns.

Pros:

- Smaller conceptual change than a new lane.
- Existing diagnostics and helper structure can be reused.
- Rendering does not need a new model immediately.

Cons:

- UI relevance becomes a mixed event/professional classifier.
- The function name and mental model become less accurate.
- Risk of loosening event filtering accidentally.
- Consumer-noise protections become harder to reason about because professional exceptions live inside event logic.
- Future domain-specific professional signals could make the UI relevance layer large and tangled.

### Option 3: Split Intelligence Into Two Lanes

Introduce explicit lanes:

```text
Candidate Pool
  |
  v
Personal Dashboard Match
  |
  v
Noise / Professional Relevance Guards
  |
  +--> Event Intelligence Lane
  |
  +--> Professional Intelligence Lane
  |
  v
Unified Inclusion Decision
  |
  v
Rendering
```

Event Intelligence would classify:

- rollout
- redesign
- regulation
- fraud
- withdrawal
- launch
- deployment
- border implementation
- biometric rollout
- document issuance events
- banknote circulation events

Professional Intelligence would classify:

- vendor partnerships
- supplier announcements
- material innovations
- secure document manufacturing
- personalization technology
- enrollment platforms
- identity infrastructure
- production capacity
- R&D
- market expansion
- security printing technology

Pros:

- Clearer architecture.
- Better diagnostics: "rejected because no event" differs from "rejected because not professional".
- Less need for surgical rescues inside event logic.
- Easier to keep consumer noise guards strict.
- Better fit for vendor/source coverage and Tier 1 monitoring.
- Domain-specific professional rules can evolve separately from event rules.

Cons:

- Requires careful migration.
- Rendering may need to represent both lanes cleanly.
- More diagnostics surface area.
- Need to avoid duplicate cards or confusing badges when an article matches both lanes.
- Requires a unified inclusion decision so lanes do not become competing mini-pipelines.

## E. Impact Analysis

### Would diagnostics become easier?

Yes.

Current diagnostics can say an article failed `ui_relevance`, but the real question is whether it failed because:

- no event signal existed,
- no professional signal existed,
- consumer noise was present,
- signal taxonomy lacked a relevant professional category,
- or the article truly was not useful.

With two lanes, diagnostics can report:

- event lane: passed/rejected and why
- professional lane: passed/rejected and why
- final inclusion: passed if one valid lane passed after noise guards

### Would future filters become simpler?

Yes.

Future filters could ask for a lane explicitly:

- "show event intelligence only"
- "show professional/vendor intelligence"
- "show both"

Even without exposing this in UI, internal logic would be easier to reason about.

### Would Banknotes benefit?

Yes.

Banknotes also has both concepts:

Event Intelligence:

- issuance
- withdrawal
- redesign
- polymer transition
- counterfeit warning
- central bank policy

Professional Intelligence:

- Crane, G+D, Louisenthal, SICPA, KURZ, SURYS, or CCL Secure technology updates
- substrate innovation
- security feature development
- production capacity
- vendor partnerships
- cash cycle infrastructure

The current event model catches central bank/public events more naturally than vendor/technology intelligence.

### Would Identity Documents benefit?

Yes, strongly.

Identity Documents is where the distinction is clearest:

Event Intelligence:

- government rollout
- border implementation
- passport fraud
- regulation
- issuance policy

Professional Intelligence:

- Veridos, Thales, IDEMIA, HID, Bundesdruckerei, IN Groupe, Entrust, Emptech, Covestro, Semlex, Mühlbauer, Iris Corporation
- secure ID document materials
- personalization and enrollment systems
- DTC features
- document manufacturing capabilities

The professional lane would reduce false negatives without weakening passport noise protection.

### Would Shared Security benefit?

Yes.

Shared Security often includes vendor/technology/professional articles:

- holography
- OVDs
- micro optics
- security inks
- secure document materials
- anti-counterfeit technology

Many are not "events" but are useful vendor/security intelligence.

### Would Digital Identity benefit?

Yes, but carefully.

Digital Identity has many noisy categories, such as generic authentication, crypto, consumer identity apps, and opinion pieces. A professional lane could help classify vendor/platform/infrastructure intelligence separately from policy/deployment events, but it would need strong noise protections.

## F. Migration Strategy

No behavior should change in the first migration steps.

### Phase 1: Design and Diagnostics Only

- Add no new filtering behavior.
- Add diagnostics that report whether an article would be classified as:
  - event intelligence
  - professional intelligence
  - both
  - neither
- Keep current pass/fail authoritative.

### Phase 2: Extract Current UI Relevance as Event Lane

- Rename conceptually in diagnostics first:
  - current `isUiRelevantIntelligenceArticle()` -> "event intelligence candidate"
- Do not rename public functions yet if risky.
- Keep behavior unchanged.

### Phase 3: Add Professional Lane Diagnostics

- Add `assessProfessionalIntelligenceArticle(article)` diagnostics-only.
- Domain-specific sub-assessments:
  - Banknotes professional
  - Identity professional
  - Shared Security professional
  - Digital Identity professional
- Record positive evidence and noise evidence.
- Do not use it for inclusion yet.

### Phase 4: Compare Current Rescues Against Professional Lane

- Check whether professional Identity rescue articles are also professional-lane positives.
- Check whether noisy survivors remain rejected.
- Compare false negatives from debug helpers.

### Phase 5: Unified Inclusion Model Behind Feature Flag

Introduce a feature flag for controlled comparison:

```text
include if:
  Personal Dashboard match
  and noise guards pass
  and (
    Event Intelligence lane passes
    or Professional Intelligence lane passes
  )
```

Default off.

### Phase 6: Rendering and Badges

If the model proves useful:

- keep existing cards,
- add diagnostics-only lane labels first,
- later consider subtle badges such as "Event" or "Professional" only if useful.

### Phase 7: Remove Surgical Rescues

Once the professional lane is authoritative and tested, remove narrow one-off rescues that are only compensating for event-lane limitations.

## G. Recommendation

Preferred architecture: Option 3, split intelligence into two lanes.

The current architecture is doing good work, but the concepts are overloaded. UI relevance is event-shaped, while the platform also needs professional/vendor/source intelligence. Trying to make one gate handle both will keep creating small exception patches.

The recommended v3 model is:

```text
Candidate Pool
  -> Personal Dashboard / selected filters
  -> Noise and professional relevance guards
  -> Event Intelligence assessment
  -> Professional Intelligence assessment
  -> Unified inclusion decision
  -> Sorting / grouping / pagination
  -> Rendering
```

Key principles:

- Keep passport and consumer-noise protection strict.
- Do not reduce thresholds broadly.
- Do not make professional intelligence a loophole for travel advice or crime stories.
- Keep event intelligence as a first-class lane because it is highly valuable.
- Add professional intelligence as a separate first-class lane because vendor/source intelligence is also valuable.
- Make diagnostics explain which lane accepted or rejected an article.

The smallest safe immediate next step is diagnostics-only:

1. Add an Event Intelligence assessment wrapper around current UI relevance.
2. Add a diagnostics-only Professional Intelligence assessment.
3. Export per-lane pass/fail and examples.
4. Do not change inclusion until the diagnostics prove the model.

## Validation Notes

- This document proposes architecture only.
- No application code was modified.
- No filtering behavior, scoring, thresholds, keyword lists, Personal Dashboard logic, bridge logic, rendering, diagnostics, backend behavior, cache behavior, or pipeline execution was changed.
