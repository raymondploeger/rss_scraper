# Filtering Intelligence v3 Evidence Builder Blueprint 1

## 1. Purpose

The Evidence Builder exists to collect reusable article evidence once, before the Event Intelligence Lane and Professional Intelligence Lane make their decisions.

Today, multiple helpers inspect similar article text for overlapping concepts:

- domain objects
- document types
- vendor names
- technology terms
- security features
- event/action words
- noise patterns
- source authority hints

Without an Evidence Builder, each lane is tempted to repeat its own text parsing. That makes behavior harder to debug, creates inconsistent interpretations, and increases the chance that future fixes become scattered across several helper functions.

The Evidence Builder should solve this by producing a shared, immutable evidence object for each article.

It should answer:

> What evidence exists in this article?

It should not answer:

> Should this article be included?

That decision belongs downstream.

## 2. Position in the v3 Pipeline

```text
Candidate Retrieval
  ↓
Article Intelligence Context
  ↓
Evidence Builder
  ↓
Event Intelligence Lane
  ↓
Professional Intelligence Lane
  ↓
Unified Intelligence Decision
  ↓
Rendering
```

Expanded view:

```text
Candidate Retrieval
  -> retrieves articles

Article Intelligence Context
  -> normalizes stable article facts

Evidence Builder
  -> extracts reusable evidence

Event Intelligence Lane
  -> decides whether evidence describes an event

Professional Intelligence Lane
  -> decides whether evidence describes professional intelligence

Unified Intelligence Decision
  -> combines dashboard, noise, event, and professional lane decisions

Rendering
  -> displays final render model
```

The Evidence Builder sits after article facts are normalized and before lane-specific decisions.

## 3. Responsibilities

The Evidence Builder should collect evidence groups in a reusable and explainable structure.

### Domain Objects

Examples:

- banknote
- banknotes
- currency
- passport
- identity document
- ID card
- residence permit
- visa
- digital identity
- biometric system
- secure document

Responsibility:

- Identify the main object classes mentioned in article text.
- Preserve where evidence appeared, such as title, source, metadata, or body.

### Document Types

Examples:

- passport
- national ID
- identity card
- residence permit
- driver's license
- visa
- electronic passport
- digital travel credential
- banknote
- polymer banknote

Responsibility:

- Extract document-specific terms and variants.
- Support Personal Dashboard, Event Lane, and Professional Lane without duplicating object detection.

### Banknote Objects

Examples:

- banknote
- note
- currency
- legal tender
- polymer note
- security thread
- denomination
- circulation
- central bank issuance

Responsibility:

- Identify banknote-specific object evidence.
- Distinguish official/circulation context from collector/auction/social noise where possible.

### Identity Document Objects

Examples:

- identity document
- ID card
- national ID
- biometric ID
- passport
- travel document
- residence permit
- visa
- eID
- DTC

Responsibility:

- Identify Identity Documents object evidence.
- Capture precise object type and broader identity-document category.

### Shared Security Techniques

Examples:

- holography
- hologram
- OVD
- DOVID
- optically variable
- micro optics
- microlens
- security inks
- UV ink
- fluorescent ink
- intaglio
- security thread
- watermark

Responsibility:

- Detect technique evidence.
- Preserve selected technique match candidates for downstream lanes.
- Avoid deciding whether a technique is sufficient by itself.

### Digital Identity Objects

Examples:

- digital ID
- identity wallet
- eID
- mobile ID
- identity verification
- KYC
- biometric enrollment
- authentication
- liveness
- credential platform

Responsibility:

- Identify digital identity and biometric object evidence.
- Keep digital identity evidence separate from physical document evidence.

### Vendors

Examples:

- Veridos
- Thales
- IDEMIA
- HID
- Entrust
- Bundesdruckerei
- IN Groupe
- Semlex
- Mühlbauer
- Iris Corporation
- Crane Currency
- Giesecke+Devrient
- Louisenthal
- De La Rue
- SICPA
- KURZ
- SURYS
- IQ Structures
- CCL Secure

Responsibility:

- Detect professional source/vendor evidence.
- Keep vendor evidence as evidence, not as automatic inclusion.
- Support vendor aliases and source-domain hints in later phases.

### Authorities

Examples:

- central bank
- ministry
- government
- interior ministry
- passport office
- border authority
- immigration authority
- civil registry
- monetary authority
- issuing authority

Responsibility:

- Identify official authority context.
- Preserve whether authority evidence appears in title, source, tags, or body.

### Countries

Examples:

- country names
- central bank names
- national authority names
- ISO/country metadata when available

Responsibility:

- Extract geographic and jurisdiction context.
- Support grouping, duplicate detection, and event understanding.

### Materials

Examples:

- polymer
- polycarbonate
- substrate
- composite substrate
- security paper
- foil
- laminate
- ink
- thread

Responsibility:

- Capture material evidence for Banknotes, Identity Documents, and Shared Security.
- Keep material detection separate from final professional or event decisions.

### Technologies

Examples:

- biometric
- NFC
- chip
- MRZ
- machine-readable
- mobile ID
- document verification
- identity verification
- enrollment platform
- personalization system
- micro optics
- DTC

Responsibility:

- Extract technology evidence.
- Support both event classification and professional technology intelligence.

### Event/Action Words

Examples:

- launched
- rolled out
- introduced
- deployed
- implemented
- issued
- unveiled
- regulation
- mandate
- withdrawn
- suspended
- redesigned
- upgraded

Responsibility:

- Capture action/event evidence.
- Provide raw event clues to Event Intelligence Lane.

### Professional Context

Examples:

- partnership
- supplier
- manufacturer
- production capacity
- R&D
- secure document production
- personalization
- enrollment
- infrastructure
- vendor announcement
- market demand tied to document/security context

Responsibility:

- Capture professional intelligence clues.
- Support non-event professional articles without conflating them with event articles.

### Noise Evidence

Examples:

- passport renewal tips
- holiday advice
- travel tips
- airport queue story
- celebrity
- influencer
- generic crime story
- lost passport
- social video
- generic market report
- product passport
- pet passport

Responsibility:

- Capture noise clues.
- Preserve severity and category.
- Let Noise Guards decide whether evidence is disqualifying.

### Source Evidence

Examples:

- official source
- vendor newsroom
- government domain
- source group
- Google Alert
- social media
- aggregator
- specialist publication

Responsibility:

- Preserve source reliability and type.
- Support diagnostics and professional confidence.

### Confidence Hints

Examples:

- title match
- source match
- body-only match
- exact phrase
- weak synonym
- conflicting evidence
- official-source boost candidate
- social-source penalty candidate

Responsibility:

- Provide interpretability.
- Avoid turning hints into final pass/fail decisions inside Evidence Builder.

## 4. What Evidence Builder Must NOT Do

The Evidence Builder must not:

- decide final inclusion
- apply Personal Dashboard filtering
- replace the Event Intelligence Lane
- replace the Professional Intelligence Lane
- render
- mutate articles
- hide thresholds
- become a dumping ground for random exceptions
- silently rescue false negatives
- reject noisy articles by itself
- rank articles
- group articles
- paginate articles
- call backend APIs
- change cache keys without an explicit cache migration plan

Evidence Builder should be boring, deterministic, and inspectable.

It should collect evidence. It should not make policy.

## 5. Input and Output

### Input

Conceptual input:

```json
{
  "articleId": "12345",
  "article": {
    "title": "Cyprus begins pilot of new biometric ID documents from Veridos",
    "description": "Government pilot for biometric identity documents...",
    "summary": "",
    "source": "Veridos",
    "topic": "Identity Documents",
    "tags": ["identity documents", "id cards"],
    "url": "https://example.com/article"
  },
  "articleIntelligenceContext": {
    "sourceDomain": "veridos.com",
    "sourceType": "vendor_newsroom",
    "feedName": "Veridos News",
    "topic": "Identity Documents",
    "normalizedText": {
      "title": "cyprus begins pilot of new biometric id documents from veridos",
      "metadata": "veridos identity documents id cards",
      "body": "government pilot for biometric identity documents"
    }
  }
}
```

### Output

Conceptual output:

```json
{
  "articleId": "12345",
  "text": {
    "title": "cyprus begins pilot of new biometric id documents from veridos",
    "metadata": "veridos identity documents id cards",
    "body": "government pilot for biometric identity documents"
  },
  "source": {
    "name": "Veridos",
    "domain": "veridos.com",
    "type": "vendor_newsroom"
  },
  "facts": {
    "topic": "Identity Documents",
    "feedName": "Veridos News",
    "publishedAt": "2026-06-01"
  },
  "evidence": {
    "domainObjects": [
      {
        "id": "identity_documents",
        "term": "identity documents",
        "locations": ["title", "body"],
        "strength": "strong"
      }
    ],
    "documentTypes": [
      {
        "id": "id_cards",
        "term": "id documents",
        "locations": ["title"],
        "strength": "strong"
      }
    ],
    "vendors": [
      {
        "id": "veridos",
        "term": "veridos",
        "locations": ["title", "source"],
        "strength": "strong"
      }
    ],
    "materials": [],
    "technologies": [
      {
        "id": "biometric",
        "term": "biometric",
        "locations": ["title", "body"],
        "strength": "strong"
      }
    ],
    "eventSignals": [
      {
        "id": "pilot",
        "term": "pilot",
        "locations": ["title", "body"],
        "strength": "medium"
      }
    ],
    "professionalSignals": [
      {
        "id": "vendor_identity_document",
        "term": "veridos + identity documents",
        "locations": ["title", "source"],
        "strength": "strong"
      }
    ],
    "noiseSignals": [],
    "confidenceHints": {
      "titleStrongMatches": 3,
      "sourceVendorMatch": true,
      "bodyOnly": false,
      "conflictingNoise": false
    }
  }
}
```

### Design Notes

The output should be immutable.

Evidence should preserve:

- term
- canonical id
- location
- strength
- confidence hint

The output should not preserve full article objects in diagnostics exports by default.

## 6. How Event Lane Uses Evidence

The Event Intelligence Lane should read Evidence Builder output and ask:

> Does the evidence describe a concrete event?

Examples:

```text
eventSignals: rollout + documentTypes: national_id
  -> event lane can classify "national ID rollout"

eventSignals: regulation + domainObjects: identity_documents
  -> event lane can classify "Identity Documents regulation"

eventSignals: withdrawn + banknoteObjects: banknote
  -> event lane can classify "banknote withdrawal"
```

The Event Lane should use:

- event/action words
- domain objects
- document types
- banknote objects
- digital identity objects
- normalized event hints
- authority evidence
- noise evidence
- confidence hints

The Event Lane should produce:

```json
{
  "lane": "event_intelligence",
  "passed": true,
  "eventType": "identity_document_pilot",
  "signalCategories": ["rollout", "biometric"],
  "confidence": "medium",
  "usedEvidence": ["eventSignals.pilot", "documentTypes.id_cards", "technologies.biometric"],
  "rejectionReason": ""
}
```

The Event Lane should not repeat raw text parsing. It should consume evidence.

## 7. How Professional Lane Uses Evidence

The Professional Intelligence Lane should read Evidence Builder output and ask:

> Does the evidence describe professional intelligence, even if it is not a concrete event?

Examples:

```text
vendors: covestro + materials: polycarbonate + documentTypes: id_cards
  -> professional lane can classify "secure ID document materials"

vendors: crane_currency + technologies: micro_optics + banknoteObjects: banknote
  -> professional lane can classify "banknote security technology"

professionalSignals: enrollment_platform + authorities: government
  -> professional lane can classify "identity infrastructure"
```

The Professional Lane should use:

- vendors
- authorities
- professional context
- materials
- technologies
- domain objects
- document types
- source evidence
- noise evidence
- confidence hints

The Professional Lane should produce:

```json
{
  "lane": "professional_intelligence",
  "passed": true,
  "professionalCategory": "identity_document_materials",
  "confidence": "high",
  "usedEvidence": ["vendors.covestro", "materials.polycarbonate", "documentTypes.id_cards"],
  "noiseConflicts": [],
  "rejectionReason": ""
}
```

The Professional Lane should not accept an article just because a vendor is mentioned. It should require meaningful domain context and should respect Noise Guards.

## 8. Diagnostics

Evidence Builder diagnostics should expose what was found, what was missing, what conflicted, and which lane used which evidence.

### Matched Evidence

Diagnostics should show:

- matched domain objects
- matched document types
- matched vendors
- matched authorities
- matched materials
- matched technologies
- matched event signals
- matched professional signals
- matched noise signals
- matched source evidence

### Missing Evidence

Diagnostics should show why a lane could not use the article:

- no domain object
- no document type
- no event/action signal
- no professional context
- no authority/vendor/source support
- body-only weak match

### Conflicting Evidence

Diagnostics should surface conflicts:

- strong professional evidence but hard travel noise
- strong event words but no domain object
- vendor match but no document/security context
- Identity object plus celebrity/lifestyle noise
- banknote object plus generic macroeconomic context

### Confidence Hints

Diagnostics should expose:

- title strong match count
- source/vendor match
- official authority match
- body-only evidence
- weak synonym only
- conflicting noise present
- exact phrase vs partial phrase

### Lane Evidence Usage

Each lane should report which evidence entries it used:

```json
{
  "eventLane": {
    "usedEvidence": ["eventSignals.rollout", "documentTypes.national_id"]
  },
  "professionalLane": {
    "usedEvidence": ["vendors.veridos", "technologies.biometric", "documentTypes.id_cards"]
  }
}
```

This makes future audits much easier because every decision can be traced back to evidence rather than re-parsed text.

## 9. Migration Strategy

### Phase 1: Diagnostics Only

Add Evidence Builder in diagnostics-only mode.

Requirements:

- Do not change filtering.
- Do not change scoring.
- Do not change thresholds.
- Do not change rendering.
- Do not make lane decisions depend on evidence yet.

Output:

- Evidence object per traced article when diagnostics are enabled.
- Compact summary in diagnostics export.

### Phase 2: Mirror Current Helper Outputs

Use Evidence Builder to mirror outputs from existing helpers without replacing them.

Examples:

- current signal text
- current ID document signal matches
- current banknote signal matches
- current noise evidence
- current vendor/source evidence where available

Goal:

- Prove that Evidence Builder can represent existing behavior.

### Phase 3: Compare Old Helper Results Against Evidence Builder

Add parity checks:

- old helper says ID object matched, Evidence Builder should show matching ID object evidence.
- old helper says signal category matched, Evidence Builder should show the terms that caused it.
- old helper says noise detected, Evidence Builder should show noise evidence.

No behavior changes.

### Phase 4: Feature Flag

Introduce a feature flag for lane diagnostics to consume Evidence Builder output.

Default:

- off

When enabled:

- Event Lane and Professional Lane can read evidence builder output in parallel.
- Current production helper decisions remain authoritative.

### Phase 5: Gradual Lane Adoption

Adopt Evidence Builder one lane at a time.

Suggested order:

1. Event Lane diagnostics consume evidence.
2. Professional Lane diagnostics consume evidence.
3. Event Lane parity mode uses evidence but compares against old UI relevance.
4. Professional Lane produces proposed decisions.
5. Unified Intelligence Decision compares current inclusion vs evidence-backed lane inclusion.

### Phase 6: Production Adoption

Only after diagnostics prove parity and quality:

- Event Lane can use Evidence Builder output.
- Professional Lane can use Evidence Builder output.
- Unified Intelligence Decision can use lane outputs.
- Old duplicated parsing helpers can be retired gradually.

## 10. Risks

### Duplicated Old Logic

Risk:

- Evidence Builder mirrors current helpers but becomes another copy of the same logic.

Mitigation:

- Start diagnostics-only.
- Use parity checks.
- Retire old duplicated parsing only after evidence-backed lanes prove stable.

### Evidence Too Broad

Risk:

- Evidence Builder records weak or incidental terms as strong evidence.

Mitigation:

- Preserve evidence strength and location.
- Keep final decisions in lanes.
- Require domain object plus context combinations downstream.

### Evidence Too Strict

Risk:

- Evidence Builder misses useful evidence and starves both lanes.

Mitigation:

- In early phases, Evidence Builder should collect evidence generously but label confidence carefully.
- Lanes decide strictness.

### Hidden Behavior Changes

Risk:

- Introducing Evidence Builder accidentally changes pass/fail logic.

Mitigation:

- Diagnostics-only first.
- No production code path should use Evidence Builder for inclusion until feature-flagged.
- Compare old and new results by article ID.

### Performance

Risk:

- Re-parsing text for every article can be expensive.

Mitigation:

- Build evidence once per article per data revision.
- Cache immutable evidence by article ID and article revision.
- Avoid storing full article objects in diagnostic exports.

### Cache Invalidation

Risk:

- Evidence cache becomes stale when articles, filters, or helper vocabularies change.

Mitigation:

- Key evidence cache by article revision and evidence builder version.
- Keep filter state out of evidence cache where possible.
- Recompute lane decisions separately because selected filters can change.

### Overfitting to Vendors

Risk:

- Vendor names become automatic inclusion shortcuts.

Mitigation:

- Vendor evidence should be one signal, not a decision.
- Professional Lane should require vendor evidence plus domain object or professional context.
- Noise Guards still run before lane acceptance.

### Dumping Ground Risk

Risk:

- Evidence Builder becomes a place to add random exceptions.

Mitigation:

- Evidence Builder only extracts evidence.
- Exceptions belong in documented lane rules or Noise Guards.
- Every evidence group should have a named purpose and diagnostics.

## 11. Recommendation

The smallest safe first implementation step after this document is:

### Add Evidence Builder Diagnostics Only

Create a diagnostics-only helper conceptually named:

```text
buildArticleEvidence(article, articleIntelligenceContext)
```

Initial scope:

- read existing normalized text
- collect domain objects
- collect document types
- collect vendors
- collect event/action words
- collect professional context words
- collect noise evidence
- collect source evidence
- expose confidence hints

Strict constraints:

- Do not use evidence for filtering.
- Do not change visible results.
- Do not alter existing helper outputs.
- Do not alter thresholds or keyword lists.
- Do not alter cache behavior except for a diagnostics-only in-memory evidence store when diagnostics are enabled.

Initial diagnostics should answer:

- What evidence did this article contain?
- Which evidence would Event Lane use?
- Which evidence would Professional Lane use?
- What evidence was missing?
- What conflicting noise was present?

This step gives the project the missing foundation without changing behavior. Once evidence is observable and comparable, Event Intelligence and Professional Intelligence can evolve without duplicating text parsing or hiding future decisions inside rescue logic.
