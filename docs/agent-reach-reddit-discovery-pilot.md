# Reddit discovery pilot

## Purpose and boundary

Reddit is an early-signal source, not an editorial source. A Reddit result can
create a review candidate, but can never create an article in an intelligence
profile or the main feed by itself.

The pilot uses Agent Reach through OpenCLI with a logged-in browser session.
The integration must not copy, export, or persist browser cookies.

## Tested behaviour

- The OpenCLI browser bridge and Reddit search work with a temporary session.
- A broad query such as `security printing` returns substantial unrelated
  material (especially 3D-printing and general cyber-security).
- Even a narrow phrase such as `"banknote security feature"` can return hobby
  content and a self-published prototype. It is a lead, not evidence.

## Candidate queries

Run at most once per day, with `--sort new`, `--time month`, and a limit of 10.

### Industry terms

- `"banknote security feature"`
- `"secure document" authentication`
- `"passport" "security feature"`
- `"identity document" authentication`
- `"currency" hologram`

### Supplier and industry names

- `"De La Rue"`
- `"Giesecke+Devrient"`
- `"Crane Currency"`
- `"SICPA"`
- `"Oberthur Fiduciaire"`
- `"Koenig & Bauer"`
- `"Muehlbauer"`
- `"OFS" banknote`

## Review gate

A candidate is eligible for the review list only when all of the following
are true:

1. Its title or body includes one specific domain anchor: `banknote`,
   `currency`, `passport`, `identity document`, `secure document`,
   `security feature`, `hologram`, `polymer`, `biometric`, or a named supplier.
2. It also contains an event anchor: launch, contract, tender, deployment,
   product, technology, counterfeiting, breach, recall, regulation, or award.
3. It is not principally a collector post, personal travel/visa question,
   legal-advice question, generic 3D-printing post, or an unsupported claim.
4. A reviewer can identify an independent primary or reputable reporting
   source. That source, rather than the Reddit post, is what may later be
   added to the normal scraper.

## Handling rules

- Store only the post title, URL, subreddit, timestamp, query and the external
  evidence link selected by the reviewer.
- Do not ingest comment threads, vote, subscribe, save, post or message.
- Deduplicate by Reddit URL and by the canonical external evidence URL.
- Keep rejected candidates for 30 days for tuning; keep approved candidates
  only as an audit trail for their linked source.
- Show candidates in a separate `Early signals — review required` list. Never
  merge that list with Saved articles or the main intelligence feed.

## Next implementation step

Add a local, on-demand collector that applies this policy and writes only to
the separate review list. Run it manually for an initial two-week pilot before
considering a scheduler or any production deployment.
