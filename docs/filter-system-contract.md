# Filter System Contract v1

This document fixes the intended semantics before the legacy filter engine is replaced.

## Evaluation order

1. `source_scope`: a hard boundary over tracked source groups or one selected feed.
2. `profile_policy`: the active Start Profile must match inside that boundary.
3. `interest_refinement`: manually selected interests refine the profile result.
4. `quality_noise`: low-value, consumer, navigation, duplicate, and unrelated content is rejected.
5. `ranking`: source authority and evidence strength may order survivors but may not admit rejected articles.

## Boolean semantics

- Interests within one group use `OR`.
- Interests across different groups use `AND`.
- Security-feature interests refine the selected base domain with `AND`.
- Tracked Sources always use `AND` with profiles and interests.
- A trusted or compatible source may improve ranking or evidence confidence, but may never bypass profile matching.

## Contract migration state

Version 1 runs as `shadow_contract`. It is attached to the existing normalized filter state and diagnostics, while the legacy engine remains responsible for production decisions. This makes current selections inspectable without changing results during steps 1 and 2.

Each Start Profile now also has an explicit versioned policy in `frontend/public/profile-policies.js`. Source compatibility and source authority are context signals only: they may support evidence or ranking, but they cannot create an automatic profile pass.

The first production migration slice evaluates explicit content evidence (an anchor plus a professional event) before the legacy profile matcher. That evidence may satisfy later professional guards because it is derived from article content, never merely from the selected feed or source reputation. Legacy matching remains as a fallback until all interests and quality rules have moved to the unified evaluator.

The behavior corpus in `tests/fixtures/filter-behavior-corpus.json` contains the initial positive and negative examples. These examples become executable decision tests when the unified evaluator is introduced.
