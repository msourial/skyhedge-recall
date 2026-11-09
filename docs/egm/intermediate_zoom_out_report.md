# Intermediate Zoom Out report

Scope: full SPEC, README, blog, prior reports, agent pipeline, scoring, credibility, memory, view model, page and snapshot. Fresh-context reviewer read the zoom-out persona and standard. Persona is read-only; parent saved its findings.

Verdict: one remaining Major. Architecture remains small. Earlier transport fallback, revision identity, comparable scoring, duplicate rejection and recall timestamps are addressed.

## IZO-1 — Major: credibility identity excludes forward-source availability

Credibility weights normalize over available upcoming sources, but their identity depended on historical training data only. A forward source disappearing changes remaining weights under the same ids, triggering the ledger's content-conflict check. Forecast journal revision hashes do not fix credibility identity.

Include the ordered available-source set in credibility context hashing and use that context for recall. Verify unchanged inputs are stable and availability changes create distinct valid records. Reuse existing hashing; no extra service or storage is needed.

## Acceptance boundary

Mainnet acceptance is explicitly pending. Snapshot is dry-run with no recalled records and uncaptured chain evidence. No remote write is authorized by a review. Backfill timing limits and worse held-out memory-on loss are disclosed; no new predictive-claim gap was found.

Review used code and saved artifacts only; no compilation, provider refetch or remote integration.
