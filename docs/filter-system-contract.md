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

Version 1 now runs the source/profile/interest selection decision as `unified_selection_production`. Source scope is applied first, the profile matcher supplies the profile-policy result, and `unified-filter-evaluator.js` owns the final boolean combination for these three stages. Quality/noise guards still run downstream and are the next migration boundary.

Each Start Profile now also has an explicit versioned policy in `frontend/public/profile-policies.js`. Source compatibility and source authority are context signals only: they may support evidence or ranking, but they cannot create an automatic profile pass.

The first production migration slice evaluates explicit content evidence (an anchor plus a professional event) before the legacy profile matcher. That evidence may satisfy later professional guards because it is derived from article content, never merely from the selected feed or source reputation. Legacy matching remains as a fallback until all interests and quality rules have moved to the unified evaluator.

Start Profile interests form the profile's base policy and are not treated as manual refinements. Interests added after choosing a Start Profile remain separate refinements: matches within one interest group use `OR`, while every selected group must pass using `AND`. Adding a refinement no longer clears the active Start Profile, and the combined selection persists across a reload.

The behavior corpus in `tests/fixtures/filter-behavior-corpus.json` contains executable positive and negative decision tests for source scope, profile policy, interest refinement, and the combined outcome.
