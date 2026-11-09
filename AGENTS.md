# Agent rules for skyhedge-recall

EGM artifact directory: docs/egm

- Product: SkyHedge Recall, a rain forecaster agent that remembers which forecast source was right (Walrus Memory on Sui mainnet) and reads chain state through Tatum Sui RPC.
- Banned word: never use the regulated-product term for paid cover anywhere in code, comments, docs or UI. Use cover / protection / hedge.
- NEVER invent numbers, traction, users or results. Every number shown must be computed from real API data fetched by the scripts and committed in data/snapshot.json. Historical windows are labelled "backfill".
- Never commit secrets. Secrets only via env (.env.local, gitignored). .env.example has empty placeholders.
- TypeScript strict, small pure modules, unit tests (vitest) for scoring/blending/memory formatting.
- `npm run build`, `npm run test`, `npm run lint`/`typecheck` must pass with NO env vars set.
- Do not deploy, publish, push or merge. Do not make mainnet writes unless explicitly told and env keys exist.
