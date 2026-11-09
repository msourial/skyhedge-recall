# SkyHedge Recall — consolidated EGM review

Review mode: uninterrupted, adapted to finished code. Target: `docs/SPEC.md`, full FeatureRange; no implementation-plan boundary was present. The final readiness stage checked the finished implementation directly. Reports live in `docs/egm/` as required by AGENTS. User requested no interactive gates, fixes without questions, and no mainnet writes in this run.

The root used `egm:egm-review` and read its Codex integration instructions. Five fresh-context Goldfish agents ran sequentially with `fork_turns: none`: initial zoom-out/inventive review, comprehension, design/structural/style critique, intermediate zoom-out, and implementation-readiness/codebase/style review. Reviewers read the specified bundled personas and standards. Comprehension read SPEC alone. Other stages received local implementation and documentation context; no external URL content was supplied. Combined persona assignments were used within each stage. Read-only personas returned reports for the parent to save. Fresh conversation context does not prove exclusion of host project instructions.

## Result

Final readiness review found no Blocker or Major. Its two Nits were fixed and covered by targeted checks. The captured product remains explicitly local/dry-run: remote persistence, live recalled inputs and Tatum chain capture are pending acceptance. No remote writes, deployment, push, merge or commit occurred.

## Traceability and fixes

| Finding                                                                                  | Priority           | Resolution                                                                                                                                     | Evidence                                                         |
| ---------------------------------------------------------------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| ZO-1: remote failure aborted snapshot                                                    | Major              | Preserve weather on write failure; recall each city independently; report warnings and profile errors                                          | `agent.ts`, `agent/recall.ts`, failed-service regression         |
| ZO-2: same-day journal identity collision                                                | Major              | Hash upcoming inputs into pricing/pick revision ids                                                                                            | `agent/memories.ts`, changed-forward-input regression            |
| ZO-3 / CR-4: live evidence absent                                                        | Pending acceptance | Disclose dry-run, retain uncaptured chain and blog placeholders; no remote claims                                                              | Snapshot, README, BLOG, SPEC                                     |
| ZO-4: actual recalled record visibility                                                  | Nit                | Show recalled records alongside local proposals, recall timestamp and applied/reference effects                                                | `view-model.ts`, `page.tsx`                                      |
| Comprehension 1–6: timing, inclusion, recall contract, modes, effects and demo lifecycle | Major              | Add explicit current implementation contract, shared scoring policy, direct versus supporting effects, dry-run semantics and journal lifecycle | SPEC section 7, README                                           |
| Comprehension 7–10: identity, score conventions, links and baseline                      | Major / Nit        | Explain account/delegate prerequisites, tied wins, threshold pooling and pending baseline                                                      | SPEC section 7, README                                           |
| CR-1: alternatives and risks                                                             | Major              | Document equal weighting, local-only memory and matched-lead archive alternatives plus actual operational mitigations                          | SPEC alternatives and risks                                      |
| CR-2: disjoint sample trust / solo wins                                                  | Major              | Common complete weeks drive comparative MAE and wins; source-specific errors/residuals remain visible; uniform without common history          | `scoring.ts`, `credibility.ts`, disjoint/uneven/solo regressions |
| CR-3: recall ambiguity                                                                   | Major              | Collapse exact duplicates, reject conflicting source/profile records and unexpected sources; validate profile city/rung                        | `memory.ts`, duplicate tests, profile tests                      |
| IZO-1: credibility identity omitted source availability                                  | Major              | Hash sorted available forward sources into credibility context; training hash identifies scoring policy and temperature                        | `agent/memories.ts`, `agent/fetch.ts`, availability regression   |
| IR-1: obsolete readiness algorithm note                                                  | Nit                | Mark prior artifact historical and superseded                                                                                                  | `implementation-readiness.md`                                    |
| IR-2: stale-context card attribution                                                     | Nit                | Require exact current context and preserve distinct local/recalled content variants                                                            | `view-model.ts`, stale-context attribution regression            |

## Verification

- Real `npm run agent:dry` completed: three cities, ten complete backfill weeks each, eight held-out predictions each, 39 proposed records, no city errors. Values and provider URLs are saved in `data/snapshot.json`; this is not remote persistence evidence.
- `npm run format`, lint, typecheck, tests and production build pass with application credentials unset. Final suite: 46 tests across six files.
- Production HTTP smoke checks passed for the default demo city and both alternate city query tabs. `/api/forecast?city=nyc` returned the saved timeline; `/api/chain` returned the honest uncaptured state.
- Repository scan, excluding dependencies, build output, git metadata and generated TypeScript cache, found no prohibited paid-cover stem. `git diff --check` is clean. Example environment placeholders are empty; no `.env.local` exists.
- Direct atomic-JSON regression verifies snapshots can be consumed without a formatter repair step.

The reviewers inspected code and saved artifacts. The parent ran the commands above. No browser screenshot, manual keyboard session or remote integration trial was performed. Responsive rules, semantic tables, chart-data alternatives and focus states are implemented, but visual interaction across devices remains unverified.

## Numerical limits and pending acceptance

Backfill uses stitched historical forecasts rather than matched seven-day lead forecasts. The sample is small. In this snapshot memory-on has worse mean held-out Brier loss than equal weighting in all cities; UI and blog disclose this. Changed probabilities demonstrate a memory effect, not predictive superiority.

A future explicitly authorized configured run must produce completed ledger jobs, recalled current-context credibility and demo profile records, and timestamped Tatum checkpoint/account/balance/transaction reads. Judges can verify through the recall command, Walrus dashboard and Sui explorer links. Until then live acceptance remains pending. No fabricated values replace it.
