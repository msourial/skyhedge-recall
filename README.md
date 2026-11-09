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
Tatum Sui RPC ─ checkpoint / account / balances / transactions │
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

## Tatum Sui RPC

The server posts JSON-RPC to `https://sui-mainnet.gateway.tatum.io` with the `x-api-key` header. Calls are serialized at at most two starts per second, retried on transient failures and cached per method/params for sixty seconds.

| Method                                  | Evidence                                     |
| --------------------------------------- | -------------------------------------------- |
| `sui_getLatestCheckpointSequenceNumber` | Latest checkpoint                            |
| `sui_getChainIdentifier`                | Chain identifier                             |
| `sui_getObject`                         | MemWal account type, contents and owner      |
| `suix_getBalance`                       | Delegate and address-owner SUI balance       |
| `suix_queryTransactionBlocks`           | Recent transactions using the account object |

Each saved read carries `via: tatum` and a fetched timestamp. Raw balances use MIST; UI converts to SUI. Missing keys leave an honest uncaptured panel. Partial failures preserve completed reads. No chain write is performed by this client.

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

## Judge verification

Run `npm run recall` to read city credibility and demo profile records. Inspect the [Walrus Memory dashboard](https://memory.walrus.xyz). Inspect the existing account at `https://suiscan.xyz/mainnet/object/<MEMWAL_ACCOUNT_ID>` and use the transaction links in the Tatum panel (`https://suiscan.xyz/mainnet/tx/<digest>`). Compare recalled tags, training hashes and weights against `data/snapshot.json` and the ledger. A dry-run snapshot is a proposed record list, not evidence of remote persistence.

## Limitations

Historical forecasts stitch the first hours of archived model runs; upcoming forecasts span seven days at varying lead times. Their errors need not match. NOAA can lag and stations differ from citywide conditions. The small sample and sharp temperature can overfit; current backfill does not establish a memory advantage. Probabilities are empirical estimates, not guarantees. The relayer sees plaintext. Recall indexing may lag or omit needed records. Profile and pick journal are labelled demos. There is no wallet connection, payment flow or cover contract; no money moves.

Remote memory transport failures preserve the fetched local forecast and record warnings. City recalls fail independently. Pricing and current demo picks include a deterministic forecast-input revision hash, so a changed forecast on the same date gets a new identity; identical inputs retain their identity. The snapshot shows the revision for its current capture rather than selecting a historical journal revision through semantic search. Conflicting duplicate credibility records are rejected rather than selected by result order.

Comparative weights and wins require common complete weeks across all configured sources. Standalone MAE, hit rate and empirical residuals retain each source’s available weeks; the scorecard separately exposes shared MAE and shared-week win counts. No shared history means uniform trust, and a lone model earns no comparative win.

Credibility context hashes include the ordered available forward-source set, because normalization changes when a source becomes unavailable. Training hashes also identify the credibility formula and temperature. These boundaries prevent reusing a historical-only identity for a different numerical trust decision.
