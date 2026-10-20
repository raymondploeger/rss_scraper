# RSS Scraper V3 UX implementation status

## Completed locally and on `main`

- The dashboard has separate hash-addressable workspaces: Feed, Profiles, Sources, and Admin.
- Feed retains the existing article stream, filters, saved articles, and profile summary.
- Profiles retains local profile creation, update, import, and per-profile JSON export.
- Sources has the existing source-management actions plus active/attention status filters.
- Admin has a source-health overview, personal noise-feedback review, and links into Sources.
- Feed-only content and source-refresh controls are not shown outside their relevant workspace.

## Intentionally not treated as security

The Sources and Admin screens remain client-side navigation only. They do not grant or deny access. The existing backend currently exposes its routes without authentication, so this application must not be presented as an access-controlled internal platform until the Entra phase is complete.

## Entra implementation prerequisites

IN Groupe is the intended owner of the multitenant Entra app registration. Before authentication can be implemented and tested, IT must provide or complete:

1. The IN Groupe app registration client ID and agreed production redirect/logout URLs.
2. A credential strategy (preferably a certificate) and secure deployment storage.
3. Multitenant organisational-account configuration, without personal Microsoft accounts.
4. Tenant-wide admin consent and Enterprise Application provisioning in both IN Groupe and Keesing tenants.
5. Explicit `User` and `Administrator` app-role assignments through tenant-local security groups.
6. Confirmation of conditional-access and MFA expectations.

## Remaining implementation after prerequisites

1. Add server-side OIDC authorization-code login/logout and secure session handling.
2. Allow only the approved IN Groupe and Keesing tenant IDs; validate tokens server-side.
3. Require authentication for static application access, SSE, images, and API routes.
4. Enforce User/Administrator permissions in Express middleware on every route.
5. Add account-backed profiles, favorites, read state, preferences, and noise feedback with an opt-in browser-data import.
6. Add authorization, session, account-migration, and regression tests before a secured release.
