# Initial Zoom Out review

Scope: complete `docs/SPEC.md`; finished implementation checked against `README.md`, `docs/BLOG.md`, `AGENTS.md`, `data/snapshot.json`, `scripts/agent.ts`, `src/lib/agent/*`, scoring/blending/memory modules, `src/lib/view-model.ts`, and `src/app/page.tsx`.

Verdict: changes required. The objective and architectural boundaries are clear. The small pure modules, committed snapshot, explicit backfill labels and local-versus-recalled modes fit the product. No additional queue, database, contract or abstraction is warranted. Code searches found existing scoring, blending, formatting and atomic persistence helpers; the fixes below should reuse them.

## ZO-1 — Major / P1: memory failure prevents the documented local fallback

Affected scope: `docs/SPEC.md` section 2 (recall fallback), `scripts/agent.ts:70`, `src/lib/agent/recall.ts:19`, `src/lib/memory.ts` (`recallRecords`).

An unavailable or incomplete recalled set returns local weights, but an exhausted transport error throws out of `applyRecall`. A write or polling failure also escapes the same orchestration block. Its `finally` only destroys the client, so neither Tatum capture nor the new snapshot is saved. A remote memory outage therefore suppresses successfully fetched weather and leaves the app showing the prior snapshot, despite the stated computed-local fallback.

Concrete fix: retain per-city computed results, catch remote write/recall failures at the orchestration boundary, record explicit memory error/status evidence, attempt remaining independent reads and atomically save the snapshot. Handle city recall failures independently. Keep content-conflict errors visible rather than silently treating them as success. Add a focused failed-recall orchestration check.

Inventive resolution: Extraction separates optional memory transport availability from weather capture. Secondary liability: partial snapshots need explicit component status, and operators must distinguish a successful weather refresh from incomplete memory work.

## ZO-2 — Major / P1: repeated forecast runs collide with immutable journal ids

Affected scope: `docs/SPEC.md` section 2 (stable ids and idempotency), `src/lib/agent/memories.ts:65`, `src/lib/memory.ts` (`rememberRecords`).

Upcoming pricing and pick ids combine the local run date with a context hash derived only from historical samples. Refreshing an upcoming forecast during that same local date can change its probability while retaining the same id. The ledger correctly rejects changed text under that id, so an ordinary second live refresh can fail even though no operator reused an id incorrectly. Stable storage identity and changing forecast content have been treated as the same thing.

Concrete fix: include a deterministic digest of the upcoming forecast inputs in the pricing/pick revision identity, or explicitly preserve the first captured daily pick and describe later forecasts separately. Reuse `textHash` and the existing per-id ledger. Verify identical inputs skip and changed forward inputs create a distinct valid record. Keep the immutable-ledger conflict check.

Inventive resolution: Segmentation separates a forecast revision from its weekly target. Secondary liability: more records require a defined latest-revision selection rule and modest additional storage.

## ZO-3 — Major / P1: completed integration evidence remains absent

Affected scope: `docs/SPEC.md` sections 2–4; `data/snapshot.json` (`mode`, `memories`, `chain`); `docs/BLOG.md` (live verification placeholders).

The captured artifact is explicitly dry-run, recalled records are empty and chain evidence is not captured. This is honest presentation, but it cannot demonstrate the central finished behavior: persisted Walrus records recalled into a forecast, with Tatum mainnet evidence. Code paths and local computations establish implementation intent rather than remote integration success. Treat the mainnet demonstration as pending, not as a completed acceptance criterion.

Concrete fix: retain the honest local state and mark live acceptance pending in the delivery checklist. Only after explicit write authorization and credentials exist, run the opt-in agent, capture the real ledger/snapshot, verify recalled training hashes and weights plus account/transaction evidence, and replace blog placeholders with captured facts. Do not fabricate evidence or perform writes to resolve this review.

## ZO-4 — Nit / P2: memory panel omits the actual recall evidence boundary

Affected scope: `docs/SPEC.md` section 5 (recalled-at and effect), `src/lib/view-model.ts:53`, `src/app/page.tsx` (What I remember).

The panel iterates proposed local records and marks exact text matches, while recall results and their timestamps are stored separately. Recalled profile content can drive the recommendation without appearing in this local-record list when it differs from the current proposal. No recalled-at timestamp is rendered. Consequently the visible explanation is less auditable than the decision input.

Concrete fix: reuse the stored recall metadata to show the records actually consumed, their namespace and recalled-at time, alongside clearly separate local proposals. Derive effect descriptions from the selected inputs rather than assigning the same effect to every record of a type. No new remote call or storage layer is needed.

## Provenance and claim assessment

The snapshot retains API URLs and fetch timestamps; historical windows are marked backfill. Scoring and held-out evaluation use captured totals, and the blog explicitly admits worse memory-on loss. No predictive-improvement claim is justified or required. This review inspected the capture path and committed artifact; it did not independently re-fetch provider responses, verify remote persistence, or run a live integration. Raw daily provider responses are not committed, so completeness and original response values cannot be independently reconstructed from the artifact alone; the current spec requires totals rather than raw-response archival.

No other false compromise detected. The lead-time mismatch is an explicitly acknowledged limit of the selected data, not a reason to add speculative infrastructure or claim calibrated future accuracy.
