import Link from 'next/link';
import snapshotJson from '../../data/snapshot.json';
import type { LearningWeek } from '../lib/agent/score';
import { sourceNames, sources } from '../lib/cities';
import type { Snapshot } from '../lib/snapshot';
import { percent, viewModel } from '../lib/view-model';
const snapshot = snapshotJson as unknown as Snapshot;
const mm = (value: number | undefined) => (value === undefined ? '—' : value.toFixed(1));
const colors = ['#F2C230', '#9CC9E3', '#C5B3DE', '#91C5AE'];
function LearningChart({ rows, weights = false }: { rows: LearningWeek[]; weights?: boolean }) {
  if (!rows.length) return <p>No complete held-out backfill weeks yet.</p>;
  const values = weights
    ? sources.map((source) => rows.map((row) => row.weights[source] ?? 0))
    : [rows.map((row) => row.brierOn), rows.map((row) => row.brierOff)];
  return (
    <>
      <svg
        viewBox="0 0 640 210"
        role="img"
        aria-label={
          weights
            ? 'Source weights over backfill weeks, from zero to one'
            : 'Weekly Brier loss, zero is best, one is worst'
        }
      >
        {[0, 0.5, 1].map((value) => (
          <g key={value}>
            <line x1="36" x2="620" y1={170 - value * 140} y2={170 - value * 140} stroke="#39414B" />
            <text x="0" y={174 - value * 140}>
              {value}
            </text>
          </g>
        ))}
        {values.map((series, index) => (
          <polyline
            key={index}
            fill="none"
            stroke={colors[index]}
            strokeWidth="3"
            points={series
              .map(
                (value, i) =>
                  `${36 + (i * 584) / Math.max(1, rows.length - 1)},${170 - value * 140}`,
              )
              .join(' ')}
          />
        ))}
        <text x="36" y="202">
          {rows[0].week}
        </text>
        <text x="510" y="202">
          {rows.at(-1)!.week}
        </text>
      </svg>
      <div className="legend">
        {(weights ? sources.map((source) => sourceNames[source]) : ['Memory-on', 'Memory-off']).map(
          (label, index) => (
            <span key={label} style={{ color: colors[index] }}>
              {label}
            </span>
          ),
        )}
      </div>
    </>
  );
}
function ChainPanel() {
  const chain = snapshot.chain;
  const reads = chain.reads ?? {};
  const account = reads.account?.value as
    { data?: { objectId?: string; type?: string; owner?: unknown } } | undefined;
  const transactions = reads.transactions?.value as { data?: { digest: string }[] } | undefined;
  return (
    <section>
      <div className="eyebrow">TATUM / SUI MAINNET</div>
      <h2>Chain evidence</h2>
      <p>
        {chain.status} · {chain.fetchedAt ?? 'No capture timestamp'}
      </p>
      {chain.message && (
        <p>
          {chain.message}. Set server-side credentials in .env.local and run the agent to capture
          read-only chain evidence.
        </p>
      )}
      <dl>
        <dt>Checkpoint</dt>
        <dd>{String(reads.checkpoint?.value ?? 'Not captured')}</dd>
        <dt>Chain identifier</dt>
        <dd>{String(reads.chainIdentifier?.value ?? 'Not captured')}</dd>
        <dt>MemWal account type</dt>
        <dd>{account?.data?.type ?? 'Not captured'}</dd>
        <dt>Account owner</dt>
        <dd>{account?.data?.owner ? JSON.stringify(account.data.owner) : 'Not captured'}</dd>
        {['delegateBalance', 'ownerBalance'].map((name) => {
          const balance = reads[name]?.value as { totalBalance?: string } | undefined;
          return (
            <div key={name}>
              <dt>{name === 'delegateBalance' ? 'Delegate' : 'Owner'} SUI balance</dt>
              <dd>
                {balance?.totalBalance
                  ? `${Number(balance.totalBalance) / 1e9} SUI`
                  : 'Not captured'}
              </dd>
            </div>
          );
        })}
      </dl>
      {account?.data?.objectId && (
        <a href={`https://suiscan.xyz/mainnet/object/${account.data.objectId}`}>
          Inspect account object
        </a>
      )}
      {transactions?.data?.length ? (
        <ul>
          {transactions.data.map((tx) => (
            <li key={tx.digest}>
              <a href={`https://suiscan.xyz/mainnet/tx/${tx.digest}`}>{tx.digest}</a>
            </li>
          ))}
        </ul>
      ) : (
        <p>No recent transaction digests captured.</p>
      )}
    </section>
  );
}
/** Render captured forecast evidence; rainfall is mm and probability displays are percentages. */
export default async function Home({ searchParams }: { searchParams: Promise<{ city?: string }> }) {
  const { city: requested } = await searchParams;
  const model = viewModel(snapshot, requested);
  if (!model)
    return (
      <main>
        <h1>SkyHedge Recall</h1>
        <p>No complete forecast data. Run npm run agent:dry.</p>
      </main>
    );
  const { city } = model;
  const gaugeMax = Math.max(50, model.blendedMm, ...Object.values(city.upcoming.forecasts));
  return (
    <main>
      <header>
        <Link href="/" className="brand">
          SKYHEDGE <span>RECALL</span>
        </Link>
        <span className="tag">WALRUS MEMORY × TATUM</span>
      </header>
      <div className="intro">
        <div className="eyebrow">WEATHER / EVIDENCE / MEMORY</div>
        <h1>SkyHedge Recall — the rain forecaster that remembers who was right</h1>
        <p>
          Same forecasts. A different trust decision. Compare an amnesiac equal-weight forecast with
          one shaped by source accuracy.
        </p>
      </div>
      <nav aria-label="City forecasts" className="tabs">
        {snapshot.cities.map((entry) => (
          <Link
            key={entry.city.id}
            href={`?city=${entry.city.id}`}
            aria-current={entry.city.id === city.city.id ? 'page' : undefined}
          >
            {entry.city.name}
          </Link>
        ))}
      </nav>
      <section className="hero">
        <div>
          <div className="eyebrow">UPCOMING WINDOW · {city.city.timezone}</div>
          <h2>{city.city.name}</h2>
          <p className="mono">
            {city.upcoming.window.start} → {city.upcoming.window.end}
          </p>
          <span className="tag">{model.mode}</span>
          <div className="big">
            {mm(model.blendedMm)}
            <small> mm</small>
          </div>
          <p>Memory-on blended weekly rain</p>
          <div className="forecasts">
            {sources.map((source) => (
              <div key={source}>
                <span>{sourceNames[source]}</span>
                <strong>{mm(city.upcoming.forecasts[source])} mm</strong>
              </div>
            ))}
          </div>
        </div>
        <div
          className="gauge"
          role="img"
          aria-label={`Blended forecast ${mm(model.blendedMm)} mm; trigger rungs 10, 25 and 50 mm`}
        >
          <div className="water" style={{ height: `${(model.blendedMm / gaugeMax) * 100}%` }} />
          {[10, 25, 50].map((rung) => (
            <div key={rung} className="rung" style={{ bottom: `${(rung / gaugeMax) * 100}%` }}>
              <span>{rung} mm</span>
            </div>
          ))}
        </div>
        <div className="triggers">
          <h3>Weekly trigger ladder</h3>
          <p>100 units of cover · illustrative · no money moves · no contract</p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Rain</th>
                  <th>Memory-off</th>
                  <th>Memory-on</th>
                  <th>Δ pts</th>
                  <th>Fair units off → on</th>
                </tr>
              </thead>
              <tbody>
                {model.rungs.map((row) => (
                  <tr
                    key={row.threshold}
                    className={row.threshold === model.rung ? 'selected' : ''}
                  >
                    <th>≥{row.threshold} mm</th>
                    <td>{percent(row.naive)}</td>
                    <td>{percent(row.weighted)}</td>
                    <td>
                      {row.delta === null
                        ? '—'
                        : `${row.delta >= 0 ? '+' : ''}${(row.delta * 100).toFixed(1)}`}
                    </td>
                    <td>
                      {row.offPrice ?? '—'} → {row.onPrice ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="caption">
            Fair units = ceil(100 × probability). Memory-off uses equal source weights.
          </p>
        </div>
        <div className="explanation">
          <h3>Why this forecast?</h3>
          <p>{city.explanations[0]}</p>
          <p className="accent">{model.changed}</p>
          <p>
            <span className="tag">DEMO PROFILE · {model.profileMode}</span>
          </p>
          <p>{model.recommendation}</p>
        </div>
      </section>
      <section>
        <div className="eyebrow">WALRUS MEMORY / PRODUCT EFFECT</div>
        <h2>What I remember</h2>
        <p>
          Local records are shown honestly until matching records have been recalled from Walrus.
          Current credibility: {model.mode}.
        </p>
        <div className="memories">
          {model.memories.map((memory) => (
            <article key={`${memory.id}:${memory.text}`}>
              <div className="tag">{memory.type}</div>
              <span className="badge">{memory.recalled ? 'recalled' : 'computed-local'}</span>
              <p className="namespace">{memory.namespace}</p>
              {memory.recalledAt && <p className="caption">Recalled {memory.recalledAt}</p>}
              <p>{memory.sentence}</p>
              <p className="caption">{memory.changed}</p>
            </article>
          ))}
        </div>
      </section>
      <section>
        <div className="eyebrow">HELD-OUT BACKFILL / ≥25 MM</div>
        <h2>How it learned</h2>
        {model.learningSummary && (
          <p className="accent">
            Mean backfill Brier loss: memory-on {model.learningSummary.on.toFixed(3)} · memory-off{' '}
            {model.learningSummary.off.toFixed(3)}.{' '}
            {model.learningSummary.on > model.learningSummary.off
              ? 'Memory-on performed worse in this sample.'
              : model.learningSummary.on < model.learningSummary.off
                ? 'Memory-on performed better in this sample.'
                : 'Both performed equally in this sample.'}
          </p>
        )}
        <p>
          Each week uses only earlier weeks for weights and residuals. Brier loss: lower is better.
          These backfill results test stitched historical forecasts, not seven-day lead forecasts.
        </p>
        <div className="charts">
          <div>
            <h3>Brier loss over time</h3>
            <LearningChart rows={city.learning} />
          </div>
          <div>
            <h3>Trust weights over time</h3>
            <LearningChart rows={city.learning} weights />
          </div>
        </div>
        <details>
          <summary>Accessible weekly chart data</summary>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Backfill week</th>
                  <th>On probability</th>
                  <th>Off probability</th>
                  <th>Observed trigger</th>
                  <th>On Brier</th>
                  <th>Off Brier</th>
                  {sources.map((source) => (
                    <th key={source}>{sourceNames[source]} weight</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {city.learning.map((row) => (
                  <tr key={row.week}>
                    <th>{row.week}</th>
                    <td>{percent(row.memoryOn)}</td>
                    <td>{percent(row.memoryOff)}</td>
                    <td>{row.observed ? 'Yes' : 'No'}</td>
                    <td>{row.brierOn.toFixed(3)}</td>
                    <td>{row.brierOff.toFixed(3)}</td>
                    {sources.map((source) => (
                      <td key={source}>{percent(row.weights[source] ?? null)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>
      <section>
        <h2>Source scorecard</h2>
        <p>
          MAE in mm. Hit rate across all trigger rungs. Trust weights and wins use only weeks shared
          by all configured sources. Tied closest forecasts each count as a win. Source MAE and hit
          rate use each source’s available weeks.
        </p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Source</th>
                <th>MAE</th>
                <th>Shared MAE</th>
                <th>Hit rate</th>
                <th>Wins / weeks</th>
                <th>Memory-on weight</th>
              </tr>
            </thead>
            <tbody>
              {city.scores.map((score) => (
                <tr key={score.source}>
                  <th>{sourceNames[score.source]}</th>
                  <td>{mm(score.mae)} mm</td>
                  <td>
                    {score.comparisonMae === null
                      ? 'No shared history'
                      : `${mm(score.comparisonMae)} mm`}
                  </td>
                  <td>{percent(score.hitRate)}</td>
                  <td>
                    {score.wins} / {score.comparisonWeeks.length}
                  </td>
                  <td>
                    <meter
                      min="0"
                      max="1"
                      value={city.weights[score.source] ?? 0}
                      aria-label={`${sourceNames[score.source]} credibility`}
                    />
                    {percent(city.weights[score.source] ?? 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section>
        <h2>Backfill evidence</h2>
        <div className="table-scroll">
          <table>
            <caption>Complete NOAA observation weeks; rainfall totals in mm</caption>
            <thead>
              <tr>
                <th>Backfill week</th>
                <th>Dates</th>
                <th>NOAA observed</th>
                {sources.map((source) => (
                  <th key={source}>{sourceNames[source]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {city.windows.map((row) => (
                <tr key={row.window.id}>
                  <th>{row.window.id}</th>
                  <td>
                    {row.window.start} → {row.window.end}
                  </td>
                  <td>{mm(row.observed)}</td>
                  {sources.map((source) => (
                    <td key={source}>{mm(row.forecasts[source])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <ChainPanel />
      <footer>
        <h3>Evidence, not certainty</h3>
        <p>
          Historical windows are backfill. Probabilities are empirical estimates, not guarantees.
        </p>
        <p>
          Fetched {city.fetchedAt}. Snapshot generated {snapshot.generatedAt}.
        </p>
        <p>
          <a href={city.provenance.observed}>NOAA observations</a> ·{' '}
          <a href={city.provenance.historical}>Open-Meteo historical forecasts</a> ·{' '}
          <a href={city.provenance.forward}>Forward forecasts</a> ·{' '}
          <a href="https://memory.walrus.xyz">Walrus Memory dashboard</a> ·{' '}
          <a href="https://docs.tatum.io/reference/rpc-sui">Tatum Sui RPC</a>
        </p>
        <p>
          Credibility uses exp(−(MAE − minimum MAE) / 2 mm). Small samples, stitched historical
          model runs, and forecast lead times limit what this comparison proves.
        </p>
        {snapshot.errors.map((error) => (
          <p key={error.city}>
            {error.city}: {error.message}
          </p>
        ))}
        {city.warnings.map((warning) => (
          <p key={warning}>{warning}</p>
        ))}
      </footer>
    </main>
  );
}
