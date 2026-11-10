# SkyHedge Recall — build spec (Total Recall hackathon, Walrus x Tatum)

Deadline: Nov 10 2026 17:00 UTC. Tight scope. No Move contract, no betting, no x402, no wallet connect.

## 1. Forecaster agent (TypeScript, `src/lib/**` + `scripts/agent.ts`, run with `tsx`)

Cities (config in `src/lib/cities.ts`):

- New York – Central Park, NOAA GHCN-D station `USW00094728`, lat 40.7789, lon -73.9692, tz America/New_York (primary)
- Chicago – O'Hare `USW00094846` (41.9950, -87.9336, America/Chicago)
- Seattle – Sea-Tac `USW00024233` (47.4444, -122.3139, America/Los_Angeles)
  (If a station returns no data, drop it gracefully.)

Data (free, no key, verified working Nov 9 2026):

- Observed: NOAA NCEI Access Data Service
  `https://www.ncei.noaa.gov/access/services/data/v1?dataset=daily-summaries&stations=USW00094728&startDate=2026-09-01&endDate=2026-11-08&dataTypes=PRCP&units=metric&format=json`
  → `[{"DATE":"2026-09-01","STATION":"USW00094728","PRCP":"9.9"},...]` (mm, string). NOAA lags a few days; only score windows where all 7 days are present.
- Forecast sources: Open-Meteo Historical Forecast API (archived model runs, stitched first hours of each run):
  `https://historical-forecast-api.open-meteo.com/v1/forecast?latitude=..&longitude=..&start_date=..&end_date=..&daily=precipitation_sum&timezone=America/New_York&models=gfs_seamless,ecmwf_ifs025,icon_seamless,gem_seamless`
  → `daily.precipitation_sum_gfs_seamless` etc (mm, may contain null). Sources: NOAA GFS, ECMWF IFS, DWD ICON, ECCC GEM (all served via Open-Meteo). Label them honestly: "GFS (NOAA) via Open-Meteo historical forecast".
- Optional extra reference: Open-Meteo archive (ERA5 reanalysis) `https://archive-api.open-meteo.com/v1/archive?...&daily=precipitation_sum` — may be used as a cross-check only, not scored as forecast.
- Forward forecast for the upcoming window: Open-Meteo forecast API `https://api.open-meteo.com/v1/forecast?...&daily=precipitation_sum&models=...&forecast_days=7` per model.

Windows: weekly windows Mon–Sun (local), the last ~10 complete weeks with full NOAA data = "backfill". Upcoming window = next 7 days from run date.
Trigger thresholds (rain cover rungs): weekly total >= 10 mm, >= 25 mm, >= 50 mm.

Scoring (`src/lib/scoring.ts`, pure, unit tested):

- Per source per window: abs error mm; per threshold hit/miss (forecast>=t vs observed>=t agree).
- Per city per source: MAE, n, hit rate, count of windows where source was best (lowest abs error) — "beat others N of last M weeks".
- Credibility weights (`src/lib/credibility.ts`): w_s ∝ exp(-(MAE_s - MAE_min)/τ), τ = 2 mm; normalise to 1; document formula. Uniform weights when no history.
- Fair probability of trigger (`src/lib/blend.ts`): for each source, convert its forecast total f into P(observed>=t) using an empirical error distribution of that source in that city (observed - forecast residuals from backfill; P = fraction of residuals r with f + r >= t; with Laplace smoothing (k+1)/(n+2)). Blend = Σ w_s P_s. Also compute naive (equal-weight) probability so the UI shows how memory changed it (delta).
- Explanation line: e.g. "Trusting ECMWF IFS 41% in New York: it beat the other 3 sources in 5 of the last 10 weeks (MAE 3.2 mm)." — generated from real numbers only.

## 2. Walrus Memory (mainnet, `@mysten-incubation/memwal` MemWal client)

- Env: MEMWAL_PRIVATE_KEY, MEMWAL_ACCOUNT_ID, MEMWAL_AGENT_ID (delegate public key, informational), MEMWAL_SERVER_URL (default https://relayer.memory.walrus.xyz).
- Namespace: `skyhedge-recall:forecaster` (global) and `skyhedge-recall:profile:demo` (sample profile/pick journal).
- Memory types (structured, each memory is one human-readable sentence + a tag prefix like `[source.forecast] [nyc] [2026-W44]` and a stable id `sr:<type>:<city>:<window>:<source>`): `source.forecast`, `observed.total`, `source.score`, `source.credibility`, `settlement.note`, `pricing.adjustment`, `profile.home_city`, `profile.risk_appetite`, `profile.plan`, `pick.logged`, `pick.scored`. Aim 30-50 memories total. Sample profile (clearly labelled demo profile): "Demo profile: plans an outdoor wedding in Central Park, wants rain cover on >= 25 mm weekly windows." Picks must be derived deterministically (e.g. pick = the blended prediction at the time) — no fake user history; label as "demo pick journal".
- Idempotency: keep a local ledger `data/memory-ledger.json` (committed; contains ids, text hash, job_id, status, blob_id if returned — no secrets) and skip ids already done. Retry with exponential backoff + jitter on 429/5xx/network (max 5). After writes, `waitForRememberJob` (with timeout), then recall with retries to tolerate index lag.
- Recall: `recall({query, limit})` per city ("Which forecast source was most accurate for New York rain?") etc. Recall results are parsed back (by tag prefix) into structured data; the credibility used for the live blend comes FROM RECALLED memories when available (mode "recalled"), else from local computation (mode "computed-local") — UI shows which.
- Dry-run mode (default when keys missing, or `--dry-run`): prints every memory it would write, writes nothing remote.
- Read installed SDK .d.ts in node_modules for exact method signatures; do not guess.

## 3. Tatum Sui RPC (mainnet) `src/lib/tatum.ts`

- Endpoint `https://sui-mainnet.gateway.tatum.io` JSON-RPC POST with header `x-api-key: $TATUM_API_KEY` (server-side only). Check docs.tatum.io/reference/rpc-sui if needed.
- Calls (few, cached, rate-limited to <=2 req/s client-side, retry on 429): `sui_getLatestCheckpointSequenceNumber`, `sui_getChainIdentifier`, `suix_getBalance` for delegate address (derive Sui address from MEMWAL_PRIVATE_KEY via @mysten/sui Ed25519Keypair, or from MEMWAL_AGENT_ID public key) and for the MemWalAccount owner, `sui_getObject` (showOwner, showType, showContent) for MEMWAL_ACCOUNT_ID, `suix_queryTransactionBlocks` filtered by `InputObject: MEMWAL_ACCOUNT_ID` (limit 5, descending) to show recent memory-account txs.
- Results go into the snapshot with fetchedAt timestamps and `via: "tatum"`. If no key, chain panel says "Not captured yet (run agent with TATUM_API_KEY)" — never fake.
- Next.js API route `/api/chain` does a live Tatum read when TATUM_API_KEY is set (cache 60s), else returns the snapshot section.

## 4. Snapshot

`scripts/agent.ts` writes `data/snapshot.json` (committed): generatedAt, cities, windows, observed totals, per-source forecasts, scores, weights, blended probabilities (naive vs memory-weighted), explanation lines, memories (written list + recalled list with mode), chain status. Commands: `npm run agent` (full: fetch → score → remember → recall → tatum → snapshot), `npm run agent:dry` (no remote writes).
API route `/api/forecast?city=nyc` returns from snapshot (and recomputes nothing secret).

## 5. Web app (Next.js App Router, TS, Vercel-ready, reads snapshot only; no secrets needed)

SkyHedge look: graphite background (#15181C-ish), glacier blue (#9CC9E3-ish accents), slicker yellow #F2C230 for primary highlights; fonts Inter (body), Barlow Condensed (headings/numbers), IBM Plex Mono (data) via next/font/google. Rain-gauge motif. No glow, no confetti.
Page: city switcher (tabs); hero card: upcoming window, trigger rungs (10/25/50 mm) each with memory-weighted fair probability vs naive probability and explanation line; "What I remember" panel (recalled memories, tag, namespace, recalled-at, mode badge, how each changed the output); source scorecard table (MAE, hit rate, wins/weeks, weight bar); backfill windows table (observed vs each source); Tatum chain-status panel (checkpoint, chain id, account object type/owner, balances, recent tx digests linking to suiscan.xyz mainnet). Footer: data sources with links, "historical windows are backfill", how memory works.
Responsive. Accessible.

## 6. Docs

README.md: what, architecture diagram (ascii), how Walrus Memory + Tatum are used, env vars, commands, how to verify memories (recall script `npm run recall`, dashboard memory.walrus.xyz, Sui explorer for account object). docs/BLOG.md blog draft.

## 7. Current implementation contract and review clarifications

The repository now implements the pipeline and server UI described above. The saved snapshot is a real-data dry run. Live Walrus persistence/recall and Tatum evidence remain pending an authorized configured run; proposed memories are not remote-write evidence. The latest user build request supersedes the earlier UI shell and credibility requirements in this original spec.

### Data inclusion and timing

NOAA must have every day of a backfill week. A model with a missing daily value loses that source-week only; other models remain scored. Standalone MAE and hit rates use each source's available weeks, so samples can differ; comparative MAE for trust uses common complete weeks. Wins compare all configured sources on common complete weeks and award tied minima to every tied source. Hit rate pools agreement over all trigger rungs. Upcoming sources with any missing day are excluded and remaining weights normalize. No forward sources or no complete observation weeks omits that city with an error.

Historical model data stitches early hours of archived runs. It does not establish advance weekly prediction skill. Forward windows contain varying lead times out to a week, so residual transport from backfill is an assumption. Small samples and sharp weights can make memory-on worse; the UI reports held-out loss honestly.

### Exact memory input contract

A tagged sentence ends in `| data={...}`. Numerical source credibility is read from JSON, never extracted from display rounding. Records must have supported type tags and matching stable ids. Credibility requires the current city, context window, training-data hash and a complete set of available sources with finite nonnegative weights summing to one. Conflicting duplicates are rejected; identical duplicates may be collapsed. Missing, stale or malformed sets retain local weights. Only accepted weights change blending; residuals remain computed from the current fetched backfill. Settlement, source-score and journal records provide supporting evidence rather than independently changing arithmetic.

Dry-run fetches real weather, computes scores, generates local proposed memories and writes the snapshot. It does not remember or recall remotely. Tatum can still perform read-only capture if its key is configured. Without keys the UI shows local memory cards and an uncaptured chain state. Remote errors preserve local weather and report the failed memory stage. Individual city recall failures do not stop other city recalls.

### Demo lifecycle and identity

`profile.plan` supplies the labelled Central Park scenario. `profile.home_city` and `profile.risk_appetite` select the default city and highlighted rainfall rung; a city query overrides the default. Complete valid recalled profile records drive these choices in live mode; otherwise local demo records do. `pick.logged` records the current deterministic upcoming estimate, with a forecast-input revision hash in its id. `pricing.adjustment` records equal-versus-weighted estimates for that same revision. `pick.scored` records the latest held-out backfill prediction and its observed outcome, using only earlier weeks. A `settlement.note` records NOAA observation and the closest available model, with NYC notes for each backfill week.

The existing MemWal account is a Sui object controlled by its owner. Memory access requires an authorized delegate signing key for that account. `MEMWAL_ACCOUNT_ID` identifies the object; `MEMWAL_AGENT_ID` is the delegate public key, not the account owner. This agent does not create an account or grant delegation. Configure those through the [Walrus Memory dashboard](https://memory.walrus.xyz) before an explicitly authorized write run. Tatum obtains the address owner from the account object's owner field and derives the delegate address from the configured key. Shared or object-owned accounts can lack an address-owner balance.

References: installed `@mysten-incubation/memwal` SDK `.d.ts` and README, [Walrus Memory dashboard](https://memory.walrus.xyz), and [Tatum Sui RPC reference](https://docs.tatum.io/reference/rpc-sui). Recalled cards show recall timestamps and distinguish applied inputs from reference records.

### Alternatives and operational risks

Equal weighting avoids fitting a small sample and is retained as memory-off; exponential credibility offers a legible stronger preference but can overfit. Local-only evidence is simpler and remains the fallback; Walrus recall supplies durable externally inspectable input provenance but depends on relayer availability and indexing. Stitched historical forecasts are accessible with these APIs; a lead-time-matched archive would provide a fairer forward evaluation but is not captured by this implementation. No performance advantage is claimed.

For comparative trust and wins, require common complete weeks across every configured source in the scoring input. A source's standalone MAE, hit rate and residuals retain its available observations. `comparisonMae` and `comparisonWeeks` identify the shared scoring population, with uniform trust when it is empty. A lone model earns no comparative wins. This conservative policy may leave trust uniform when one configured source is missing; the UI exposes shared-week counts. Duplicate identical recall records collapse; conflicting records or unexpected current-context source records prevent applying the set. Profile values must be valid and unambiguous.

Operational mitigations are bounded retries and index-lag waits, per-id durable polling, forecast-revision identities, local fallback and independent city recall warnings. Plaintext relayer visibility limits suitable data; this demo stores no private customer records. Explicit authorization plus the command flag gates writes. Live acceptance remains pending until completed ledger entries, current recalled weights/profile inputs and timestamped Tatum object/balance/transaction evidence are captured and reviewed.

Credibility context identity includes the sorted available forward-source set as well as the training hash. A source disappearing or returning therefore produces a different normalized-set identity. The training hash identifies the scoring/credibility policy and temperature along with historical samples. Recall validates the exact current context rather than selecting an older normalization.
