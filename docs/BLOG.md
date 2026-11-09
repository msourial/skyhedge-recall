# A rain forecaster with a record of who was right

A weather forecast is often presented as one authoritative number. SkyHedge Recall starts from a different question: when several forecast sources disagree, which ones have earned our trust here? Its answer is visible in the product. The page shows an equal-weight forecast beside a memory-weighted forecast, explains the source preference, and exposes the observations behind it.

The application is a rain forecaster, not a payment product. It illustrates weekly rain-cover triggers and fair units without moving money or creating a contract. The demo profile describes an outdoor wedding in Central Park. That scenario gives the agent a reason to remember both weather evidence and a preference: which city and rainfall trigger matter to this plan?

## Evidence before explanation

The agent fetches daily precipitation observations from NOAA and model forecasts from Open-Meteo. The sources are GFS, ECMWF IFS, DWD ICON and ECCC GEM. Complete local calendar weeks become backfill windows; missing NOAA days keep a week out of scoring. Model gaps remain missing rather than becoming zero rainfall. The upcoming forecast uses the run date and the following local dates.

The saved snapshot contains 3 cities, with 10 backfill weeks for New York. These are real fetched values, not demonstration results typed into a page. The snapshot also retains request URLs, timestamps, model totals, observations, scores and the records the agent proposes to remember. A reader can trace a statement back through the data instead of trusting its phrasing.

Historical forecasts need careful interpretation. Open-Meteo's historical forecast series stitches archived runs. It is not the same experiment as forecasting an entire upcoming week in advance. SkyHedge labels these historical windows backfill throughout the product. That distinction limits the claims we can make about future performance.

## Memory becomes a decision input

Walrus Memory stores readable tagged sentences alongside structured JSON. A settlement note states what NOAA observed, which source was closest, and how another forecast differed. A credibility memory combines a source's weight with the training-data hash that produced it. Raw rainfall and weights stay unrounded in the payload; the sentence rounds them for a person reading a memory card.

The snapshot's New York explanation is: “Trusting DWD ICON 37% in New York: it was closest (including ties) in 5 of the last 10 backfill weeks (MAE 8.4 mm vs 9.2–10.4 mm for the others).” This describes the saved backfill, including tied wins. It is evidence for a trust decision within this sample, not a claim that this source is always best.

Credibility uses an exponential penalty for mean absolute error. A source that is farther from the best MAE loses weight according to a documented temperature measured in millimetres. Without shared history, weights are uniform. Each model's rainfall forecast is then combined with its past observed-minus-forecast residuals to estimate whether a weekly trigger will be reached. Laplace smoothing avoids absolute certainty from a small sample.

Memory-off uses equal weights over those same source probabilities. Memory-on changes only the weights. In the saved New York upcoming estimate, the weekly trigger probability moves from 54.2% to 56.5%, a change of +2.4 percentage points. These estimates are derived using backfill residuals. The UI also converts each probability into illustrative fair units, rounding up for the configured cover amount. No money moves.

## Remembered, recalled, or local?

Writing a record is not enough to claim recall. In live mode, the agent waits for accepted memory jobs and then queries Walrus. Recalled weights must match the city, training window, training hash and available sources. A stale or incomplete set does not silently replace the local calculation. The UI labels the actual mode.

The current snapshot is dry-run. It contains 39 proposed memories, not a claim of persisted mainnet records. Its weights are labelled computed-local, not yet recalled. Live persistence and recall will need verification after an authorized run: <MEMORY COUNT AFTER MAINNET RUN>, <RECALLED RECORD COUNT AFTER MAINNET RUN>, and <ACCOUNT OBJECT AND TRANSACTION LINKS AFTER MAINNET RUN>.

The write path uses a local per-id ledger. It persists an accepted job id before waiting, resumes pending jobs after interruption and skips completed records. Content hashes catch accidental reuse of an id with different text. Retries use bounded exponential backoff. Recall also waits for indexing lag, since a completed storage job does not mean a search query can already find every record.

## Preferences are memories too

The forecaster namespace holds weather evidence. A separate demo-profile namespace holds the Central Park plan, home city and weekly rainfall preference, plus a deterministic pick journal. Live mode recalls profile records before the view model chooses the default city and highlighted trigger. Dry-run uses the same local records with an explicit local label.

That makes memory useful beyond an audit trail. It changes which city a visitor first sees, which rung is emphasized, the recommendation sentence and the source weights behind the probabilities. An explicit city tab still overrides the profile default. The demo is clearly labelled and does not imply any real customer history.

## Learning can expose a worse decision

The walk-forward chart predicts each eligible backfill week using only earlier weeks. Both weights and residual distributions exclude the held-out week. It records the observed trigger and Brier loss for memory-on and memory-off, so later evidence cannot leak into that week's prediction.

For New York, the mean backfill Brier loss in this snapshot is 0.153 for memory-on and 0.107 for equal weighting. Lower is better. Memory-on is worse here. The other captured cities also show higher average loss with memory-on. A system that remembers can still overreact to a small sample; the chart makes that failure visible. A longer lead-time-matched evaluation would be needed before claiming predictive improvement.

## Chain evidence through Tatum

Tatum supplies read-only Sui RPC evidence: checkpoint, chain identifier, MemWal account type and owner, balances and recent account transaction digests. The client serializes calls, limits request starts, caches repeated reads and retries transient failures. The snapshot stores when each read happened and identifies Tatum as its source. Explorer links let a judge inspect captured objects and transactions.

Without credentials, the panel says evidence has not been captured and explains how to capture it. The app still builds and renders from the public snapshot. Secrets remain server-side, and remote memory writes require an explicit command flag. The relayer sees plaintext, so this demo stores no private customer information.

SkyHedge's contribution is a checkable connection between a past observation, a remembered source judgment and today's forecast. That connection is useful even when the evaluation says the judgment needs work.
