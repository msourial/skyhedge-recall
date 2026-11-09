# Comprehension report

Scope: full `docs/SPEC.md`; DetailedRange: N/A. Non-interactive, fresh-context reviewer. The reviewer read the comprehension persona and SPEC alone, and returned this report for the parent to save because its persona is read-only.

## What this proposes

SkyHedge Recall fetches observed rainfall and forecasts, compares source errors over complete historical weeks, and estimates upcoming rainfall-trigger probabilities. It records evidence and a demo journal in Walrus, uses recalled credibility when available, and supplies a snapshot for a UI with source performance, memories and Tatum chain evidence.

## How the existing system works, per this document

The document describes intended scripts, modules, routes and artifacts, but does not distinguish implemented behavior from planned behavior. It identifies installed dependencies without explaining the implementation baseline.

## Findings

1. **Major — Forecast timing:** Explain that stitched historical runs do not match upcoming weekly lead times; performance is backfill rather than a true advance weekly trial.
2. **Major — Missing values:** Define source-specific model exclusion, observation-week exclusion, unavailable upcoming sources and city failure behavior. Clarify whether models compete on identical weeks.
3. **Major — Recall contract:** Define raw numerical JSON payloads and validation for current city, complete source set, training hash, duplicates, malformed values and conflicting records.
4. **Major — Dry-run stages:** State whether dry-run recalls remotely, performs Tatum reads and shows local proposals when no credentials exist.
5. **Major — Memory effects:** Distinguish recalled weights, locally fetched residuals and supporting or journal records; avoid implying every recalled sentence changes arithmetic.
6. **Major — Demo lifecycle:** Define pick timing, held-out scoring, settlement notes, pricing adjustments and plan context. Mark historical demo entries as backfill.
7. **Major — Identity prerequisites:** Explain existing account object, owner, authorized delegate key and owner balance lookup; provide a setup reference.
8. **Nit — Score conventions:** Define tied wins and hit rate pooled across thresholds.
9. **Nit — Service references:** Add direct MemWal and Tatum references.
10. **Nit — Baseline:** Distinguish current implementation and pending live evidence from the original build target.

No architectural section was impossible to paraphrase. No Blocker was found. The main gaps concern timing, missing data, recalled numerical inputs and demo lifecycle.
