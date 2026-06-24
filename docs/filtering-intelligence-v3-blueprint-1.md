# Filtering Intelligence v3 Blueprint 1

## 1. Overall Architecture

Filtering Intelligence v3 separates article retrieval, domain matching, noise protection, intelligence classification, and rendering into explicit stages.

The core architectural change is the split between:

- Event Intelligence
- Professional Intelligence

Both lanes feed a Unified Intelligence Decision. Neither lane should be hidden inside rescue logic.

```text
Candidate Retrieval
  |
  v
Candidate Classification
  |
  v
Personal Dashboard / User Scope
  |
  v
Noise Guards
  |
  +-----------------------------+
  |                             |
  v                             v
Event Intelligence Lane     Professional Intelligence Lane
  |                             |
  +-------------+---------------+
                |
                v
Unified Intelligence Decision
                |
                v
Ranking
                |
                v
Grouping
                |
                v
Pagination
                |
                v
Rendering
```

The pipeline should answer different questions in different places:

- Candidate Retrieval: "What articles should the frontend examine?"
- Personal Dashboard: "Does this article match the user-selected interests?"
- Noise Guards: "Is this article disqualified by known noise?"
- Event Intelligence Lane: "Is this a concrete intelligence event?"
- Professional Intelligence Lane: "Is this professional intelligence even if it is not an event?"
- Unified Intelligence Decision: "Should this article be included?"
- Ranking/Grouping/Pagination/Rendering: "How should included articles be displayed?"

## 2. Responsibilities

### Candidate Retrieval

Responsible for:

- Selecting the initial candidate article pool.
- Applying retrieval strategy, source scope, feed scope, search/date backend prefilters when appropriate.
- Returning enough candidates for downstream filters to make decisions.
- Reporting whether the pool is complete or partial.

Must not:

- Decide final inclusion.
- Apply Personal Dashboard pass/fail logic as the final authority.
- Apply event/professional intelligence classification as a hidden side effect.
- Render cards.

### Candidate Classification

Responsible for:

- Preparing reusable article facts.
- Normalizing article metadata used by later stages.
- Computing stable, explainable context such as source, topic, feed, domain, detected event type, and coarse article fingerprints.

Must not:

- Reject articles by itself.
- Tune thresholds based on selected dashboard state.
- Mutate article data.
- Replace downstream domain or intelligence lane decisions.

### Personal Dashboard

Responsible for:

- Applying the user's selected interests.
- Resolving parent/child selections.
- Evaluating domain and subinterest matches.
- Evaluating explicit bridge logic such as Identity Documents + Shared Security combinations.
- Producing a dashboard decision and dashboard score explanation.

Must not:

- Decide whether an article is an event.
- Decide whether an article is professional intelligence outside the selected interest scope.
- Apply consumer/noise rejection unless those rules are explicitly part of dashboard matching.
- Perform ranking, grouping, pagination, or rendering.

### Noise Guards

Responsible for:

- Rejecting known false-positive patterns.
- Preserving passport, travel, consumer, crime-story, social-media, celebrity, and generic market noise protection.
- Applying domain-specific hard guards before intelligence lanes.
- Producing clear rejection reasons.

Must not:

- Rescue articles.
- Lower thresholds.
- Decide that an article is an event or professional intelligence.
- Hide broad relevance rules inside unexplained helper calls.

### Event Intelligence Lane

Responsible for:

- Determining whether an article describes a concrete intelligence event.
- Classifying event type, action, impact, and signal category.
- Handling event categories such as rollout, redesign, regulation, fraud, withdrawal, launch, deployment, border implementation, biometric rollout, document issuance, or banknote circulation events.

Must not:

- Reject professional non-event articles as noise.
- Become a catch-all relevance gate.
- Contain vendor/professional rescue logic.
- Override Noise Guards.

### Professional Intelligence Lane

Responsible for:

- Determining whether an article is professional intelligence even when it is not a concrete event.
- Capturing vendor, supplier, infrastructure, R&D, production, manufacturing, technology, materials, and market-capability intelligence.
- Remaining strict and domain-aware.

Must not:

- Accept consumer/travel/crime/social noise.
- Override hard Noise Guards.
- Replace Event Intelligence.
- Include generic corporate fluff without domain-specific professional value.

### Unified Intelligence Decision

Responsible for:

- Combining dashboard, noise, event-lane, and professional-lane decisions.
- Producing one final inclusion decision.
- Explaining exactly which lane accepted or rejected the article.

Must not:

- Re-run scoring from scratch.
- Hide exceptions as ad hoc rescues.
- Apply rendering-specific behavior.
- Mutate article arrays.

### Ranking

Responsible for:

- Ordering included articles according to the current browsing mode.
- Preserving current date-first behavior for normal browsing.
- Preserving any explicitly chosen sort modes.

Must not:

- Include rejected articles.
- Apply extra relevance filters.
- Reclassify articles.
- Change grouping membership.

### Grouping

Responsible for:

- Grouping accepted articles by event/duplicate relationship.
- Preserving source counts and child articles.
- Promoting the right primary card according to current grouping rules.

Must not:

- Pull rejected articles back into the visible set.
- Use grouped primary selection as a hidden filter.
- Override unified intelligence inclusion.

### Pagination

Responsible for:

- Selecting the current page of already-included, already-ranked, already-grouped items.
- Reporting page, page size, total count, and item count.

Must not:

- Filter.
- Re-rank.
- Re-group.
- Fetch additional articles without an explicit candidate retrieval strategy.

### Rendering

Responsible for:

- Displaying the final render model.
- Showing badges, counts, thumbnails, grouped cards, pagination controls, empty states, and diagnostics hints.

Must not:

- Decide inclusion.
- Apply hidden filters.
- Re-run Personal Dashboard matching.
- Re-run event or professional intelligence classification.

## 3. Data Flow

### Candidate Retrieval

Input:

- Normalized filter state
- Candidate strategy
- Candidate source/provider
- Current feed/search/date/topic/tag/signal filters

Output:

- Candidate articles
- Candidate count
- Expected total
- Completeness flag
- Backend request metadata
- Cache metadata

Decision:

- Which retrieval strategy produced the candidate pool.

Diagnostics:

- Strategy
- Provider
- Source scope
- Request params
- Cache key
- Cache hit
- Candidate count
- Complete/partial status

### Candidate Classification

Input:

- Candidate articles

Output:

- Article facts
- Domain hints
- Source hints
- Normalized event hints
- Text fingerprints

Decision:

- None final. Classification produces facts only.

Diagnostics:

- Available facts
- Missing facts
- Source/type normalization warnings

### Personal Dashboard

Input:

- Candidate article
- Normalized filter state
- Selected main domains
- Selected parent/child interests
- Selected shared/security/digital interests
- Candidate classification facts

Output:

- Dashboard pass/fail
- Matched domains
- Matched interests
- Parent/child decision
- Bridge decision
- Score object

Decision:

- Whether the article matches the selected Personal Dashboard scope.

Diagnostics:

- Selected interests
- Main domains
- Primary domain
- Interest scores
- Parent/child outcome
- Bridge outcome
- Rejection category
- Rejection reason

### Noise Guards

Input:

- Dashboard-matching article
- Article facts
- Domain-specific noise rules

Output:

- Noise pass/fail
- Triggered guards
- First failing guard

Decision:

- Whether known hard-noise patterns reject the article.

Diagnostics:

- Guard names
- Guard order
- First failing guard
- Matched noise evidence
- Examples by guard

### Event Intelligence Lane

Input:

- Noise-passing article
- Article facts
- Signal text
- Normalized event hints

Output:

- Event lane pass/fail
- Event type
- Action
- Signal categories
- Confidence

Decision:

- Whether the article is event intelligence.

Diagnostics:

- Event object found/missing
- System impact
- System event
- Signal category matches
- Noise context
- False-negative hints

### Professional Intelligence Lane

Input:

- Noise-passing article
- Article facts
- Professional source/vendor/material/technology/context signals
- Dashboard selection context

Output:

- Professional lane pass/fail
- Professional category
- Professional evidence
- Confidence

Decision:

- Whether the article is professional intelligence.

Diagnostics:

- Professional object evidence
- Vendor evidence
- Government/source evidence
- Technology/material evidence
- Manufacturing/infrastructure evidence
- Corporate-noise checks
- False-positive and false-negative hints

### Unified Intelligence Decision

Input:

- Dashboard result
- Noise result
- Event lane result
- Professional lane result

Output:

- Final inclusion decision
- Accepted lane or lanes
- Final rejection reason

Decision:

- Whether the article proceeds to ranking/grouping/rendering.

Diagnostics:

- Dashboard pass/fail
- Noise pass/fail
- Event pass/fail
- Professional pass/fail
- Final reason
- Lane combination

### Ranking

Input:

- Included articles
- Sort mode

Output:

- Ordered articles

Decision:

- Display order.

Diagnostics:

- Sort mode
- Sort key
- Before/after count
- Top ranked items

### Grouping

Input:

- Ordered included articles

Output:

- Grouped cards
- Child articles
- Source counts

Decision:

- Group membership and primary article.

Diagnostics:

- Group key
- Group size
- Primary article
- Child article count
- Duplicate reason

### Pagination

Input:

- Grouped or flat render items
- Page
- Page size

Output:

- Current page items
- Total pages

Decision:

- Which already-included items are displayed on this page.

Diagnostics:

- Page
- Page size
- Source count
- Paginated count

### Rendering

Input:

- Render model
- Render dispatch
- Paginated items

Output:

- DOM update

Decision:

- Which renderer displays the final model.

Diagnostics:

- Renderer
- Render mode
- Rendered count
- Empty state
- Pending/loading state

## 4. Event Intelligence Lane

### Purpose

The Event Intelligence Lane identifies articles that describe concrete, time-bound, operational, regulatory, security, or product events.

### Responsibilities

- Detect events and actions.
- Map events to signal categories.
- Explain event relevance.
- Preserve the existing strength of current UI/event relevance.

### Typical Article Types

- Government rolls out new ID card.
- Central bank issues new banknote.
- Passport redesign launches.
- Border biometric checks deployed.
- EES/ETIAS implementation changes.
- Fraud network discovered.
- Counterfeit warning issued.
- Banknote withdrawn from circulation.
- New security feature added.

### Typical Signals

- rollout
- launch
- issued
- introduced
- deployed
- implemented
- regulation
- mandate
- fraud
- counterfeit
- withdrawal
- redesign
- border control
- biometric checks
- document issuance
- system upgrade

### Typical False Positives

- Travel advice articles containing passport terms.
- Airport queue stories without system-level intelligence.
- Crime stories where a passport is incidental.
- Generic market/economic articles.
- Consumer guides.
- Celebrity/travel/lifestyle content.

### Typical False Negatives

- Professional vendor articles without event wording.
- Supplier announcements without rollout/deployment wording.
- Material innovation articles not framed as security-feature events.
- R&D and production-capacity announcements.
- Product capability articles with no explicit launch or deployment phrase.

### Future Extensibility

The lane can grow by adding explicit event categories rather than broadening generic relevance:

- production event
- vendor contract event
- certification event
- pilot event
- capability release event

Each new event type should remain explainable and noise-aware.

## 5. Professional Intelligence Lane

### Purpose

The Professional Intelligence Lane identifies articles that are valuable because they describe professional, vendor, supplier, technology, infrastructure, or capability intelligence, even when they are not concrete events.

### Responsibilities

- Detect professional domain relevance.
- Recognize vendor/source/material/technology intelligence.
- Keep strict consumer-noise protection.
- Provide explainable evidence separate from event evidence.

### Typical Article Types

- Vendor partnerships.
- Secure document material announcements.
- Identity infrastructure articles.
- Personalization technology.
- Enrollment platform updates.
- Security printing technology articles.
- Production capacity or facility capability.
- R&D announcements.
- Supplier/manufacturer articles.
- Market expansion tied to professional domain evidence.

### Typical Signals

Identity Documents:

- secure identity document
- national ID
- biometric ID
- document personalization
- enrollment system
- identity infrastructure
- Veridos
- Thales
- IDEMIA
- HID
- Bundesdruckerei
- IN Groupe
- Entrust
- Semlex
- Mühlbauer
- Iris Corporation

Banknotes:

- banknote substrate
- security thread
- micro optics
- polymer substrate
- currency production
- cash cycle infrastructure
- Crane Currency
- Giesecke+Devrient
- Louisenthal
- De La Rue
- CCL Secure
- SICPA
- KURZ
- SURYS

Shared Security:

- holography
- OVD
- micro optics
- security inks
- secure document materials
- anti-counterfeit technology
- optical security features

Digital Identity:

- identity verification platform
- digital ID infrastructure
- biometric enrollment
- eID ecosystem
- identity wallet infrastructure
- KYC infrastructure

### Typical False Positives

- Generic corporate press releases.
- Generic market reports without document/security context.
- Travel technology unrelated to documents or identity.
- Consumer authentication apps without government/professional relevance.
- Promotional content with no intelligence value.
- Articles where a vendor name appears incidentally.

### Typical False Negatives

- Professional articles using unusual vendor wording.
- Technical articles that omit obvious domain terms.
- Supplier articles that mention materials but not the final document object.
- Government procurement articles without named vendors.
- Industry commentary without event language.

### Future Extensibility

Professional Intelligence should be extensible by domain:

- Banknotes professional model
- Identity Documents professional model
- Shared Security professional model
- Digital Identity professional model

Each model should expose:

- positive professional evidence
- source/vendor evidence
- domain object evidence
- noise evidence
- confidence
- examples

## 6. Unified Intelligence Decision

The Unified Intelligence Decision combines the outputs of:

- Personal Dashboard
- Noise Guards
- Event Intelligence Lane
- Professional Intelligence Lane

Conceptual rule:

```text
include article if:
  candidate is in scope
  and dashboard/filters pass
  and noise guards pass
  and (
    event lane passes
    or professional lane passes
  )
```

This is cleaner than rescue logic because each lane states what it knows. A professional article no longer needs to pretend to be an event, and event logic no longer needs vendor-specific escape hatches.

### Event YES, Professional YES

Example:

- A vendor announces a deployed national ID personalization system.

Interpretation:

- It is a concrete event.
- It is also professional domain intelligence.

Decision:

- Include.
- Diagnostics show both lanes passed.
- Rendering may show event badges and professional context.

### Event YES, Professional NO

Example:

- A government announces new passport renewal rules.

Interpretation:

- It is an event or regulation.
- It may not contain vendor/professional technology evidence.

Decision:

- Include if dashboard and noise guards pass.
- Diagnostics show Event Intelligence accepted it.

### Event NO, Professional YES

Example:

- A supplier describes secure ID document materials or enrollment infrastructure without a concrete rollout.

Interpretation:

- It is not a classic event.
- It is still professional intelligence.

Decision:

- Include if dashboard and noise guards pass.
- Diagnostics show Professional Intelligence accepted it.

### Event NO, Professional NO

Example:

- Travel tips about passport renewal.
- Celebrity story involving a passport.
- Generic market article with no document/security context.

Interpretation:

- Not an event.
- Not professional intelligence.

Decision:

- Reject.
- Diagnostics show both lanes failed and why.

### Why This Is Cleaner Than Rescue Logic

Rescue logic tends to answer:

> This failed one gate, can we patch it through?

Unified lanes answer:

> Which independent intelligence concept does this article satisfy?

That makes the system easier to debug, safer to tune, and less likely to accumulate one-off exceptions.

## 7. Diagnostics

Filtering Intelligence v3 diagnostics should eventually expose a complete article-level decision trace.

For every article, diagnostics should show:

### Candidate Retrieval Result

- retrieval strategy
- provider
- source scope
- candidate pool count
- complete or partial
- backend request metadata
- cache metadata

### Dashboard Result

- selected dashboard interests
- selected main domains
- parent/child resolution
- matched interests
- domain score
- subinterest score
- bridge result
- pass/fail
- rejection reason

### Noise Result

- noise guard enabled/disabled
- triggered guards
- first failing guard
- matched noise terms
- pass/fail
- rejection reason

### Event Lane Result

- event pass/fail
- normalized event type
- action
- signal category
- system impact evidence
- system event evidence
- intent evidence
- event confidence
- rejection reason

### Professional Lane Result

- professional pass/fail
- professional category
- vendor/source evidence
- domain object evidence
- technology/material/infrastructure evidence
- professional confidence
- corporate/noise evidence
- rejection reason

### Unified Decision

- final inclusion decision
- accepted lane or lanes
- rejected stage
- final reason
- confidence summary

### Final Render Decision

- ranked position
- group key
- group primary/child status
- page
- renderer
- visible/hidden

Diagnostics should make it possible to answer:

- Was the article retrieved?
- Did dashboard matching accept it?
- Did noise guards reject it?
- Did Event Intelligence accept it?
- Did Professional Intelligence accept it?
- Why did the final decision include or reject it?
- If rendered, why did it appear where it did?

## 8. Migration Roadmap

### Phase 1: Diagnostics Only

Goal:

- Introduce v3 diagnostic vocabulary without behavior changes.

Work:

- Add conceptual diagnostics fields:
  - eventLane
  - professionalLane
  - unifiedIntelligenceDecision
- Keep current filtering authoritative.
- Map current UI relevance diagnostics into event-lane terminology.

Validation:

- Counts unchanged.
- Visible results unchanged.
- Existing diagnostics still present.

### Phase 2: Event Lane Extraction

Goal:

- Extract current UI relevance behavior into a named Event Intelligence Lane.

Work:

- Wrap current `isUiRelevantIntelligenceArticle()` behavior as event-lane assessment.
- Preserve exact pass/fail.
- Rename only diagnostics first if code renaming is risky.

Validation:

- Event lane output matches current UI relevance output.
- No article movement.

### Phase 3: Professional Lane Diagnostics

Goal:

- Add Professional Intelligence Lane diagnostics without inclusion behavior.

Work:

- Build domain-specific professional assessments:
  - Banknotes
  - Identity Documents
  - Shared Security
  - Digital Identity
- Record evidence and confidence.
- Compare professional-lane positives against current rescues and rejected false-negative candidates.

Validation:

- No article movement.
- Professional positives are inspectable.
- Consumer/travel/crime/social noise remains identifiable.

### Phase 4: Parallel Comparison

Goal:

- Compare current production inclusion against proposed unified lane inclusion.

Work:

- Diagnostics report:
  - currentIncluded
  - v3WouldInclude
  - eventLaneOnly
  - professionalLaneOnly
  - bothLanes
  - neitherLane
- Add example lists for deltas.

Validation:

- No behavior changes.
- Delta list is small, explainable, and high quality.

### Phase 5: Feature Flag

Goal:

- Allow controlled execution of unified v3 inclusion.

Feature flag:

- Disabled by default.
- Runs v3 inclusion only when explicitly enabled.

Work:

- Use Unified Intelligence Decision behind flag.
- Keep existing pipeline available as fallback.
- Compare counts and article IDs.

Validation:

- No default behavior change.
- Flagged behavior is measurable.
- Noise protection remains stable.

### Phase 6: Production Migration

Goal:

- Make Unified Intelligence Decision authoritative after validation.

Work:

- Enable v3 inclusion by default.
- Preserve diagnostics.
- Keep rollback switch temporarily.
- Remove or demote rescue-specific code only after parity and quality are proven.

Validation:

- False positives do not increase materially.
- Professional false negatives decrease.
- Event intelligence remains clean.
- Banknotes, Identity Documents, Shared Security, and Digital Identity all benefit or remain stable.

## Closing Principle

Filtering Intelligence v3 should not be looser. It should be clearer.

The aim is not to let more articles through by weakening guards. The aim is to ask the right questions in the right stages:

- Is it in scope?
- Is it noise?
- Is it an event?
- Is it professional intelligence?
- Which answer justifies final inclusion?

That separation is the path to fewer false negatives without inviting back the consumer passport noise that the current guard successfully removed.
