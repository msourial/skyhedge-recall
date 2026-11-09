# Critic report

Scope: full SPEC FeatureRange; DetailedRange N/A. Fresh-context reviewer read design, structural and style personas and the feature-spec standard, plus implementation, README, blog, earlier reports and snapshot. Personas are read-only; parent saved the returned findings. Verdict: changes required; no Blocker.

## CR-1 — Major: alternatives and operational risks

SPEC omits the standard's alternatives section and consolidated risks. Evaluate equal versus learned weighting, local-only versus recalled evidence and stitched versus matched-lead forecasts. Cover small samples, missing-source comparisons, remote failure, ambiguous recall, plaintext and pending live evidence. Reuse actual mitigations; no extra infrastructure is required.

## CR-2 — Major: incomparable historical samples and solo wins

`fetch.ts` constructs source-specific populations. `scoring.ts` and `credibility.ts` can compare MAE on disjoint weeks and count a lone model as closest. Current captured data has complete coverage, so its numbers are not invalidated. Use common complete weeks for comparative trust and wins, preserve source-specific residuals separately, fall back to uniform without comparable history and test disjoint, uneven and solo cases.

## CR-3 — Major: conflicting recalled records

`recalledWeights`, profile selection and `applyRecall` previously chose the first duplicate. Search ordering could change consumed weights or profile values. Deduplicate identical records, reject conflicts and unexpected current-context sources, validate profile values and require one unambiguous record per consumed profile type. Test order independence and local fallback.

## CR-4 — Major: live acceptance boundary

SPEC did not distinguish implemented local behavior from pending mainnet acceptance. Mark persistence, recalled current numerical inputs and Tatum evidence pending; define verification through completed ledger jobs, matching recalled training hashes/weights and timestamped account/transaction reads. Keep explicit authorization and do not write merely to close a review finding.

## Evidence

Snapshot supports the blog's New York probability and loss statements. Backfill is labelled, held-out predictions exclude future observations, missing values do not become zero, and worse memory-on results are disclosed. Source weights and profile recall are wired into the product but remote execution is not demonstrated. Earlier transport fallback, revision identity and recall-timestamp fixes appeared present. Tables provide chart alternatives, city tabs expose selection and keyboard focus is styled. No substantive additional accessibility finding.

This reviewer inspected code and artifacts without compiling, refetching providers or invoking live integration.
