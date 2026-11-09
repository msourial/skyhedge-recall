# skyhedge-recall
SkyHedge Recall: a rain forecaster that remembers which forecast was right (Walrus Memory + Tatum Sui RPC)

The agent compares NOAA daily precipitation with GFS (NOAA), ECMWF IFS, DWD ICON,
and ECCC GEM forecasts served by Open-Meteo. Historical windows are **backfill**.
Only complete Monday–Sunday observation weeks and complete model weeks are used.
Upcoming forecasts cover the run date and the next six local dates.

```text
NOAA + Open-Meteo -> complete windows -> source scores -> credibility
                                                         |
                       Walrus remember -> recall ---------+
                                                         v
                                  residual probabilities -> snapshot -> API
Tatum Sui RPC ---------------------------------------------> snapshot
```

Credibility is normalized `1 / (MAE + 1 mm)`. Without history it is uniform.
Each model's trigger probability uses observed-minus-forecast backfill residuals
and Laplace smoothing `(hits + 1) / (samples + 2)`. The blend also includes an
equal-weight comparison. Scores use available model weeks; tied lowest errors
count as wins. Historical model runs are stitched forecasts, rather than a
fixed lead-time evaluation. Residual probabilities are empirical estimates,
not calibrated guarantees.

Walrus Memory stores tagged readable records with machine-readable payloads in
`skyhedge-recall:forecaster` and `skyhedge-recall:profile:demo`. The demo profile
and deterministic pick journal are labelled as such. Recalled weights must match
the city, training-data hash, training window, and all available sources before
they replace local weights. The ledger persists accepted jobs before waiting,
so a timeout resumes polling rather than resubmitting the write. A changed
payload under an existing id fails instead of silently overwriting history.

Tatum reads Sui mainnet checkpoints, chain identifier, account contents and owner,
balances, and recent account transactions. Calls are serialized, spaced at least
half a second apart, retried on rate limits, and cached for one minute. Missing
credentials leave chain state explicitly uncaptured.

Copy `.env.example` to `.env.local` for optional credentials. `TATUM_API_KEY`
enables chain reads; `MEMWAL_PRIVATE_KEY` and `MEMWAL_ACCOUNT_ID` enable authenticated
memory access. `MEMWAL_AGENT_ID` is an optional delegate public key;
`MEMWAL_SERVER_URL` defaults to `https://relayer.memory.walrus.xyz`. Secrets stay
server-side and outside git.

```sh
npm ci
npm run agent:dry
npm test
npm run typecheck
npm run lint
npm run build
npm run dev
npm run recall -- "Which forecast source was most accurate for New York rain?"
```

`npm run agent` defaults to dry-run when memory keys are missing. With keys,
remote writes additionally require explicit operator authorization and
`npm run agent -- --allow-mainnet-writes`. They are not needed to run the app.
`npm run recall` only reads. `npm start` serves a production build.
The snapshot is generated from real upstream requests and includes their URLs,
timestamps, complete weekly totals, scores, proposed or written memories,
recalled records, and chain status. Refresh it with the agent; do not edit its
numbers manually. A failed city is recorded in `errors` and omitted gracefully.
The current page is intentionally only a default shell; `/api/forecast?city=nyc`
serves the saved forecast and `/api/chain` reads live Tatum state when configured.

Verify remote records with `npm run recall`, the
[Walrus Memory dashboard](https://memory.walrus.xyz), and the account object at
`https://suiscan.xyz/mainnet/object/<MEMWAL_ACCOUNT_ID>`.
The local dry-run ledger remains empty because no remote jobs were created.
