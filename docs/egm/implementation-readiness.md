# Implementation readiness

Source: docs/SPEC.md. Scope: data agent, memory and chain adapters, default Next.js shell, API reads, and unit tests. No remote writes are authorized in this chunk.

The main risk is incomplete upstream observations or model forecasts. Only complete local Monday–Sunday windows will be scored. Missing stations and model windows must be reported, never filled with invented values. Upcoming means the run date through the following six local calendar dates.

Flow: NOAA observations + Open-Meteo historical forecasts → complete backfill windows → scores → inverse-MAE credibility → empirical residual probabilities. Memory records preserve structured values in tagged readable text. Recalled credibility replaces local credibility only when valid for the current city and training window. Dry runs keep local credibility and report proposed records.

Use small strict TypeScript modules. Persist a non-secret ledger after each job transition. Bound retries and job polling; retry recall for index lag. Tatum requests are serialized, cached, and spaced at least half a second apart. Missing credentials produce an explicit uncaptured chain state.

Validation: injected fetch and sleep tests cover calendar boundaries, scoring, probability smoothing, memory round trips, idempotency, retries, and RPC behavior. Run the real dry agent, tests, typecheck, lint, and production build without credentials. Preserve existing project documents and leave all changes uncommitted.

Alternatives: reanalysis is unsuitable as a scored forecast. Fabricated fallback observations are unsuitable. Remote memory writes are deferred until separately authorized; this chunk validates the adapter without sending writes.
