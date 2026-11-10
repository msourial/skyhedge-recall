# SkyHedge Recall

**The rain forecaster that remembers who was right.** SkyHedge compares NOAA observations with GFS (NOAA), ECMWF IFS, DWD ICON and ECCC GEM rainfall forecasts served by Open-Meteo. Walrus Memory supplies source credibility and demo profile preferences. Tatum supplies read-only Sui mainnet evidence.

The product shows memory-off (equal source weights) beside memory-on, including trigger probabilities, percentage-point changes and illustrative fair units for rain cover. The rain gauge, source scorecard and backfill tables let a reader trace the decision. Memory changing a forecast does not prove it improves accuracy: the current snapshot's walk-forward losses are worse for memory-on. No money moves and there is no contract.

## Architecture

```text
NOAA observed mm ─┐
                 ├─ complete backfill weeks ─ scores ─ exponential credibility
Open-Meteo mm ────┘                                      │
                                                        v
                          per-id ledger ─ Walrus remember ─ recall validation
                                                             │
Upcoming model mm ─ residual probabilities ─ equal / recalled weights
                                                             │
Demo profile memory ─ recalled city / trigger / recommendation │
Tatum Sui GraphQL ─ checkpoint / account / balances / transactions │
                                                             v
                                               data/snapshot.json
                                                       │
                                      view model ─ server UI / JSON APIs
```

`scripts/agent.ts` orchestrates `src/lib/agent/{fetch,score,memories,recall,chain,snapshot}.ts`. Pure scoring, blending, memory formatting and view-model modules have unit tests. TypeScript is strict. The app needs no secrets: it reads the saved snapshot. `/api/forecast?city=nyc` serves captured city data. `/api/chain` reads Tatum live when configured, otherwise serves the saved chain section.

## What learning means

Only complete Monday–Sunday NOAA weeks enter the last ten backfill weeks. A model week with missing rainfall is excluded for that source. Upcoming means the run date through the next six local calendar dates.

Credibility is `w_s ∝ exp(-(MAE_s - MAE_min) / τ)`, with exported `CREDIBILITY_TAU_MM = 2`. Weights normalize to one. Without shared history they are uniform. Tied lowest errors each count as a win; hit rate measures threshold agreement across the configured rungs.

Each source's empirical trigger probability uses observed-minus-forecast residuals in mm and Laplace smoothing `(hits + 1) / (n + 2)`. Memory-off averages these same probabilities equally; memory-on uses credibility weights. Thus the comparison isolates weighting, rather than changing the error model too. A fair illustration for 100 units of cover is `ceil(100 × p)`, labelled illustrative.

Walk-forward evaluation begins at the third backfill week. Each held-out week uses only earlier weeks for both residuals and weights. The snapshot records training week ids, probabilities, observed outcomes, Brier losses and weights. Lower Brier loss is better. These are **backfill** results, not a seven-day lead forecast trial.

## Walrus Memory

Records contain stable tags, a human-readable sentence and a `data=` JSON payload with unrounded values. Display sentences round rainfall to one decimal mm and weights to whole percentages.

| Type                    | Purpose                                          | Namespace                      |
| ----------------------- | ------------------------------------------------ | ------------------------------ |
| `source.forecast`       | Latest historical model rain                     | `skyhedge-recall:forecaster`   |
| `observed.total`        | Complete NOAA weekly total                       | forecaster                     |
| `source.score`          | Source accuracy evidence                         | forecaster                     |
| `source.credibility`    | One city/source weight plus training hash        | forecaster                     |
| `settlement.note`       | Observed result and NYC weekly source comparison | forecaster                     |
| `pricing.adjustment`    | Equal vs weighted trigger estimate               | forecaster                     |
| `profile.home_city`     | Demo city selection                              | `skyhedge-recall:profile:demo` |
| `profile.risk_appetite` | Demo weekly trigger preference                   | profile:demo                   |
| `profile.plan`          | Demo Central Park wedding recommendation context | profile:demo                   |
| `pick.logged`           | Deterministic demo prediction journal            | profile:demo                   |
| `pick.scored`           | Held-out demo prediction and outcome             | profile:demo                   |

The demo profile is a configured scenario, not a real customer or claimed user history. Live mode recalls its records and uses them to select the default city, highlight a rung and phrase the recommendation. Dry-run derives the same preferences from the local list and labels them `computed-local (not yet recalled)`.

Recalled credibility must match the city, training window, training hash and complete available source set, with finite nonnegative weights summing to one. Only then does it replace local values and earn `recalled` mode. Otherwise local computation remains visible. Remembered does not mean recalled.

`data/memory-ledger.json` stores per-id text hashes, accepted job ids, status and returned blob ids. Accepted jobs are persisted before polling. A restart resumes the same job; completed ids are skipped. A changed payload under an existing id fails explicitly. Writes use SDK idempotency keys and deduplication. Transient network errors, HTTP 429 and server errors get bounded exponential backoff plus jitter. Recall retries bounded waits for search-index lag. The installed SDK exposes `rememberBulkAsync` and `waitForRememberJobs`; this implementation keeps serial per-id jobs for simple durable recovery.

## Tatum Sui GraphQL

The server posts one GraphQL operation per request to `https://sui-mainnet.gateway.tatum.io/graphql` with `x-api-key` and body `{query, variables}`. Requests are serialized with at least 500 ms between starts, cached by query and variables for 60 seconds, and retried on HTTP 429/5xx. GraphQL errors are recorded per read; optional transaction errors leave successful evidence visible.

Each agent run fetches `https://relayer.memory.walrus.xyz/config` for the mainnet package and registry. If unavailable, the documented deployment observed on 2026-11-09 in `FALLBACK_DEPLOYMENT` is used with a visible warning. Three operations normally capture network/checkpoint/epoch, registry/package/modules, and recent registry transactions. Transactions use a checkpoint window to avoid unbounded history errors. Configured MemWal accounts add object, combined owner/delegate balances (raw MIST), and bounded account transaction reads. No chain writes occur. Every Tatum read includes its capture time; missing account credentials remain explicit.

## Setup and commands

```sh
npm ci
npm run agent:dry
npm run recall
npm run dev
npm run format
npm run lint
npm run typecheck
npm run test
npm run build
npm start
```

Copy `.env.example` to `.env.local` for optional credentials; its placeholders are empty. Keep secrets outside git.

| Variable             | Purpose                                                                    |
| -------------------- | -------------------------------------------------------------------------- |
| `TATUM_API_KEY`      | Read-only chain capture                                                    |
| `MEMWAL_PRIVATE_KEY` | Server-side delegate signing key                                           |
| `MEMWAL_ACCOUNT_ID`  | Existing MemWal account object id                                          |
| `MEMWAL_AGENT_ID`    | Optional delegate public key for address derivation                        |
| `MEMWAL_SERVER_URL`  | Optional relayer override; defaults to `https://relayer.memory.walrus.xyz` |

`npm run agent` defaults to dry-run without memory credentials. After explicitly authorizing mainnet writes and configuring an existing account/delegate, run:

```sh
npm run agent -- --allow-mainnet-writes
```

This flag is required even with keys. `agent:dry` never writes remote memory; configured Tatum credentials can still capture read-only chain evidence. Agent errors omit failed cities and are included in the snapshot. The snapshot records real API URLs and timestamps. Refresh through the script rather than manually editing numeric results.

## Live mainnet run (Nov 9, 2026)

The committed `data/snapshot.json` and `data/memory-ledger.json` come from `npm run agent -- --allow-mainnet-writes`. The snapshot was generated at 2026-11-10T00:46:32Z (6:46 PM Chicago, Nov 9).

- **Memories written:** 38 to Walrus Memory through the managed mainnet relayer: 33 in `skyhedge-recall:forecaster` and 5 in `skyhedge-recall:profile:demo`. They cover 11 types: 12 `settlement.note`, 11 `source.credibility`, 3 each of `observed.total`, `source.forecast` and `source.score`, and 1 each of `pricing.adjustment`, `pick.logged`, `pick.scored`, `profile.home_city`, `profile.risk_appetite` and `profile.plan`.
- **Ledger:** all 38 entries are `done`, each with a relayer job ID and a Walrus blob ID.
- **Recall:** `npm run recall` returned all 38 distinct memory IDs. All three cities use `recalled` credibility, and the demo profile was recalled.
- **MemWal account:** [`0xe5e2b3bb…0488c`](https://suiscan.xyz/mainnet/object/0xe5e2b3bbe5a7233d3b1636fcf9180c4453dd4af6a7494a8022de90f138c0488c), type `0xe7c16fbe…d7f5::account::MemWalAccount`.
- **Delegate key (`MEMWAL_AGENT_ID`):** `6eeb2ec08cf03de5210cd16a54de5f1c2d57472eae66a8e35d42833744a29100`, Sui address [`0x9bed1584…758c`](https://suiscan.xyz/mainnet/account/0x9bed158448d10894e82a80ae90cd481f6f0acbefe603c1ff3d99e56e3f80758c). It is listed as `skyhedge_recall` in the account's `delegate_keys`, which Tatum read.
- **Example blob (New York W44 observed total):** `FItMK3FxcBOsf8XyYo19VJj4VtBCeFIX8XrNm9aGPu8`. Fetch the Seal-encrypted ciphertext with `curl https://aggregator.walrus-mainnet.walrus.space/v1/blobs/FItMK3FxcBOsf8XyYo19VJj4VtBCeFIX8XrNm9aGPu8`.

The relayer's server wallet pays for Walrus storage. The account's own transactions in the Tatum panel are its setup transactions (account and delegate-key registration); they are not the individual memory writes.

## Judge verification

Run `npm run recall` to read city credibility and demo profile records. Inspect the [Walrus Memory dashboard](https://memory.walrus.xyz). Inspect the existing account at `https://suiscan.xyz/mainnet/object/<MEMWAL_ACCOUNT_ID>` and use the transaction links in the Tatum panel (`https://suiscan.xyz/mainnet/tx/<digest>`). Compare recalled tags, training hashes and weights against `data/snapshot.json` and the ledger. A dry-run snapshot is a proposed record list, not evidence of remote persistence.

## Limitations

Historical forecasts stitch the first hours of archived model runs; upcoming forecasts span seven days at varying lead times. Their errors need not match. NOAA can lag and stations differ from citywide conditions. The small sample and sharp temperature can overfit; current backfill does not establish a memory advantage. Probabilities are empirical estimates, not guarantees. The relayer sees plaintext. Recall indexing may lag or omit needed records. Profile and pick journal are labelled demos. There is no wallet connection, payment flow or cover contract; no money moves.

Remote memory transport failures preserve the fetched local forecast and record warnings. City recalls fail independently. Pricing and current demo picks include a deterministic forecast-input revision hash, so a changed forecast on the same date gets a new identity; identical inputs retain their identity. The snapshot shows the revision for its current capture rather than selecting a historical journal revision through semantic search. Conflicting duplicate credibility records are rejected rather than selected by result order.

Comparative weights and wins require common complete weeks across all configured sources. Standalone MAE, hit rate and empirical residuals retain each source’s available weeks; the scorecard separately exposes shared MAE and shared-week win counts. No shared history means uniform trust, and a lone model earns no comparative win.

Credibility context hashes include the ordered available forward-source set, because normalization changes when a source becomes unavailable. Training hashes also identify the credibility formula and temperature. These boundaries prevent reusing a historical-only identity for a different numerical trust decision.
