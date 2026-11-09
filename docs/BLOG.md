# SkyHedge Recall: remembering forecast errors

Draft — the data agent is implemented; the product interface is still pending.

A forecast blend can learn from its sources' past errors. SkyHedge Recall
compares weekly rain forecasts with NOAA station observations in New York,
Chicago, and Seattle. Historical windows are backfill. GFS, ECMWF IFS, DWD ICON,
and ECCC GEM model data come from Open-Meteo's historical forecast service.
Only complete weeks are scored.

The agent computes each model's mean absolute error and gives lower-error models
more weight. Its trigger probabilities come from each model's observed historical
errors, with smoothing for small samples. The snapshot includes an equal-weight
comparison to make the effect of credibility visible.

Walrus Memory is the persistence boundary: tagged sentences carry source scores,
credibility, observations, settlement notes, and a clearly labelled demo profile
and pick journal. When authenticated memories are available, the agent parses
recalled credibility and verifies its training context before using it in the
blend. Otherwise it explicitly labels credibility as computed locally.

Tatum provides server-side Sui mainnet reads for chain context. Missing credentials
produce an uncaptured state. The initial artifact is a real-data dry-run snapshot;
it proposes memories without claiming any remote persistence or chain capture.

This approach has limits: station observations can lag, archived model data may
be incomplete, tied wins need careful interpretation, and a small residual sample
does not establish probability calibration. The snapshot exposes the inputs and
sample counts so these limits can be reviewed.
