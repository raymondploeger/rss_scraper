# Filter System Contract v1

This document fixes the intended semantics before the legacy filter engine is replaced.

## Evaluation order

1. `source_scope`: a hard boundary over tracked source groups or one selected feed.
2. `profile_policy`: the active Start Profile must match inside that boundary.
3. `interest_refinement`: manually selected interests refine the profile result.
4. `quality_noise`: hard false positives and source fallback records are rejected. Domain quality and duplicate handling continue in their existing downstream stages.
5. `ranking`: source authority and evidence strength may order survivors but may not admit rejected articles.

## Boolean semantics

- Interests within one group use `OR`.
- Interests across different groups use `AND`.
- Security-feature interests refine the selected base domain with `AND`.
- Tracked Sources always use `AND` with profiles and interests.
- A trusted or compatible source may improve ranking or evidence confidence, but may never bypass profile matching.

## Contract migration state

Version 1 now runs the source/profile/interest selection decision as `unified_selection_production`. Source scope is applied first, the profile matcher supplies the profile-policy result, and `unified-filter-evaluator.js` owns the final boolean combination. Core quality checks use one shared assessment in the selection and advanced-filter paths. Domain-specific professional guards and duplicate grouping remain downstream.

Each Start Profile now also has an explicit versioned policy in `frontend/public/profile-policies.js`. Source compatibility and source authority are context signals only: they may support evidence or ranking, but they cannot create an automatic profile pass.

The first production migration slice evaluates explicit content evidence (an anchor plus a professional event) before the legacy profile matcher. That evidence may satisfy later professional guards because it is derived from article content, never merely from the selected feed or source reputation. Legacy matching remains as a fallback until all interests and quality rules have moved to the unified evaluator.

Start Profile interests form the profile's base policy and are not treated as manual refinements. Interests added after choosing a Start Profile remain separate refinements: matches within one interest group use `OR`, while every selected group must pass using `AND`. Adding a refinement no longer clears the active Start Profile, and the combined selection persists across a reload.

`profile-mode-policy.js` records the legacy general scoring modes separately from Identity Document Authority strictness. The Authority has a user-selectable Focused, Balanced, or Research mode. Other profiles retain their existing Balanced scoring default; because the interface provides no control for it, the feed and article explanation do not display a mode badge for those profiles.

The behavior corpus in `tests/fixtures/filter-behavior-corpus.json` contains executable positive and negative decision tests for source scope, profile policy, interest refinement, and the combined outcome.

Article explanations separate match evidence from source context. When the explicit profile policy supplies content anchors and developments, the receipt shows those terms; selected interest refinements are shown by name. The article's source is identified as context, not presented as a reason that can bypass the profile policy.

The former `getProfileSourceFilteringAssessment` compatibility layer has been removed. Every branch returned `applies: false`, so it did not participate in the selection decision. Active source scoping and domain-specific professional guards remain in place; the remaining legacy profile matcher is still a fallback pending broader regression coverage.

The unused selected-source Border Control assessment and its private term lists have also been removed. The obsolete article-level source-affinity lookup, GOV.UK alias, and Identity Document Authority guard alias had no call sites. Feed-level source affinity and the active Border Control and identity-document quality checks remain intact.

## Profile-policy route diagnostics

Set `localStorage.debugFilterPerformance = "1"` in the browser to enable optional filter diagnostics. `window.getLatestFilterPerformanceDiagnostics().profilePolicyRouteSummary` then counts, per active Start Profile, the articles assessed by the explicit policy, a hard guard, a professional guard, or the remaining legacy fallback. The fallback reason counts identify the branches that still decide results. These are decision-path counts before later quality checks, sorting, grouping, and pagination; they are **not** visible-article counts. Assessment counts may also be lower than candidate counts when an article is excluded before profile evaluation. The diagnostic flag does not change filter decisions.

Run `npm run audit:profile-policy-routes` against a local app (override `APP_URL` if needed) to measure all seven profiles in `Vendors` and `All`. The audit fails if a profile has no route measurements or the wrong heading, but does not freeze ingestion-dependent counts. On 24 September 2026, the local `All` sample recorded fallback passes for Researcher (97), Security Printer (51), Identity Verification (30), Border Control (27), Passport Authority (21), and Central Bank (15). Vendors had no fallback decisions. The shared-security-only decision, used by Security Printer, has since moved into `shared-security-profile-policy.js`; its technique and professional-noise evidence functions remain unchanged. The route audit now asserts that Security Printer no longer reaches the legacy fallback. Migrate other profile branches one at a time, using the reported fallback reasons and the existing profile/source regression matrix to preserve accepted and rejected cases.

The digital-identity domain's final decision now lives in `digital-identity-profile-policy.js`. For Identity Verification, accepted articles therefore no longer pass through the legacy fallback. The route audit asserts this narrower migration boundary while the profile/source and interest audits protect visible results.

The two shared dominant-domain checks now use `profile-domain-scope-policy.js`. They reject articles with no recognized domain or with a domain outside the selected profile, while preserving the existing identity-document and banknote technique bridges. The route audit asserts that these two rejection reasons no longer come from the legacy fallback. Other upstream professional guards and domain-specific quality rules remain where they are.

## Regression matrix

Run `npm run audit:profile-source-combinations` to test all seven Start Profiles against every tracked-source group. It verifies that a profile narrows (or preserves) its source scope and that `All` never returns fewer matches than any individual source group. Where complete result sets are visible, it also checks article-title inclusion.

Run `npm run audit:profile-mode-source-matrix` to test Identity Document Authority's Focused, Balanced, and Research modes against every source group plus IRCC and AAMVA as individual feeds. For each scope, result sets must expand monotonically (`Focused ⊆ Balanced ⊆ Research`) and remain within the source-only result set. The same `All` superset rule applies to every mode. Counts are intentionally not hard-coded because ingestion changes them over time.

Run `npm run audit:profile-selected-feeds` for five representative individual-feed intersections spanning Central Bank, Identity Document Authority, Identity Verification, and Border Control. The `npm run test:filter-contract` corpus covers the policy's positive and negative content examples independently of live ingestion.

Central Bank relevance has an additional safeguard: a narrow coin-only and navigation-title rejection runs before the explicit content-policy early pass. Its broader professional banknote assessment remains in the legacy fallback path, because moving that full assessment ahead of the explicit pass would incorrectly reject official Bank of Canada articles. The explicit Central Bank matcher reads article title and body text rather than topic/tags and no longer treats the generic `new` term as an event. Run `npm run audit:central-bank-vendor-relevance` to confirm that collector coins and navigation pages are absent while representative physical-banknote stories remain.

Identity Week (`identityweek.net`) remains available to other profiles. Within Central Bank only, category pages and articles without physical-banknote terms in their own content are rejected before any source-derived banknote score can pass them. This removes unrelated identity, airport, and cybersecurity stories without excluding a future Identity Week article that actually discusses banknotes.
