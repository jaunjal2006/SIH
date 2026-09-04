import { Link } from 'wouter';
import {
  Activity, ArrowRight, Clock3, FileCheck2,
  FileText, Gauge, Plus, ShieldAlert, ShieldCheck,
} from 'lucide-react';
import { useGetDashboardSummary } from '@workspace/api-client-react';
import type { CountPoint, DashboardSummary, TrendPoint } from '@workspace/api-client-react';
import { QueryState } from '@/components/shared';
import { cx, fmtDate, fmtMs, mask, riskClass, titleCase } from '@/lib/utils';
import type { Screening } from '@workspace/api-client-react';

// ── Helpers ────────────────────────────────────────────────────────────────

function Metric({
  label, value, note, icon: Icon, accent = 'brand',
}: {
  label: string; value: string | number; note: string;
  icon: React.ElementType; accent?: 'brand' | 'green' | 'amber' | 'sky' | 'red';
}) {
  return (
    <div className="metric-card fade-up">
      <div className={`metric-icon metric-icon-${accent}`}><Icon size={17} /></div>
      <div className="metric-content">
        <div className="metric-label">{label}</div>
        <div className="metric-value">{value}</div>
        <div className="metric-note">{note}</div>
      </div>
    </div>
  );
}

function TrendChart({ data }: { data?: TrendPoint[] }) {
  const pts = data ?? [];
  const max = Math.max(...pts.map(p => p.screened), 1);
  return (
    <div className="trend-chart">
      {pts.map(p => (
        <div className="trend-col" key={p.label}>
          <div className="trend-bars">
            <div className="trend-bar-main"
              style={{ height: `${Math.max(4, (p.screened / max) * 100)}%` }}
              title={`${p.label}: ${p.screened} screened`} />
            <div className="trend-bar-alert"
              style={{ height: `${Math.max(p.suspicious ? 4 : 0, (p.suspicious / max) * 100)}%` }}
              title={`${p.label}: ${p.suspicious} suspicious`} />
          </div>
          <div className="trend-label">{p.label}</div>
        </div>
      ))}
    </div>
  );
}

function MiniBars({ data }: { data?: CountPoint[] }) {
  const safe = data ?? [];
  const max = Math.max(...safe.map(d => d.value), 1);
  return (
    <div className="mini-bars">
      {safe.map(d => (
        <div className="mini-bar-item" key={d.label}>
          <div className="mini-bar"
            style={{ height: `${Math.max(8, (d.value / max) * 100)}%` }}
            title={`${d.label}: ${d.value}`} />
          <div className="mini-bar-label">{d.label.slice(0, 4)}</div>
        </div>
      ))}
    </div>
  );
}

function RecentTable({ rows }: { rows: Screening[] }) {
  if (!rows.length) return (
    <div className="table-empty">No screenings yet — run your first case.</div>
  );
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th>Screening ID</th><th>Document</th><th>Nationality</th>
            <th>Risk score</th><th>Status</th><th>Created</th><th />
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.id}>
              <td>
                <Link href={`/screening/${row.id}`} className="cell-link">{row.screeningId}</Link>
                <small>{row.documentType}</small>
              </td>
              <td className="cell-mono">{mask(row.documentNumber)}</td>
              <td>{row.nationality}</td>
              <td>
                <div className="score-pill">
                  <div className={`score-indicator ${riskClass(row.riskScore)}`} />
                  {row.riskScore}<small>/ 100</small>
                </div>
              </td>
              <td>
                <span className={cx('badge', `badge-${row.status.toLowerCase()}`)}>{row.status}</span>
              </td>
              <td className="cell-date">{fmtDate(row.createdAt)}</td>
              <td>
                <Link href={`/screening/${row.id}`} className="row-btn" aria-label={`Open ${row.screeningId}`}>
                  <ArrowRight size={15} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function Overview() {
  const q = useGetDashboardSummary();
  const d = q.data as DashboardSummary | undefined;

  return (
    <QueryState loading={q.isLoading} error={q.isError} retry={q.refetch}>
      {/* Heading */}
      <div className="page-heading fade-up">
        <div>
          <div className="page-eyebrow">Operations overview · Today</div>
          <h1>Keep the signal clear.</h1>
          <p>Identity-document screening at a glance. Every result is explainable and reviewable.</p>
        </div>
        <Link href="/screening/new" className="btn btn-primary">
          <Plus size={15} /> Start a screening <kbd>N</kbd>
        </Link>
      </div>

      {/* Metric cards */}
      <div className="metrics-grid">
        <Metric label="Documents screened" value={d?.documentsScreenedToday ?? '—'}
          note="All-time total" icon={FileCheck2} accent="brand" />
        <Metric label="Verified" value={d?.verifiedDocuments ?? '—'}
          note="Risk score ≤ 20" icon={ShieldCheck} accent="green" />
        <Metric label="Needs attention" value={d?.suspiciousDocuments ?? '—'}
          note="Risk score > 20" icon={ShieldAlert} accent="amber" />
        <Metric label="Avg processing" value={fmtMs(d?.averageProcessingTimeMs)}
          note="End-to-end latency" icon={Clock3} accent="sky" />
      </div>

      {/* Charts row */}
      <div className="overview-grid" style={{ marginBottom: 14 }}>
        {/* Trend */}
        <div className="card card-pad">
          <div className="card-head">
            <div>
              <div className="card-kicker">Throughput</div>
              <h2>Screening activity</h2>
            </div>
            <div className="chart-legend">
              <span className="legend-dot legend-brand" /> screened
              <span className="legend-dot legend-amber" style={{ marginLeft: 8 }} /> suspicious
            </div>
          </div>
          <TrendChart data={d?.dailyTrend} />
        </div>

        {/* Risk ring */}
        <div className="card card-pad">
          <div className="card-head">
            <div>
              <div className="card-kicker">Risk posture</div>
              <h2>Distribution</h2>
            </div>
            <Gauge size={17} style={{ color: 'var(--text-tertiary)' }} />
          </div>
          <div className="risk-ring-wrap">
            <div className="risk-ring-inner">
              <strong>{d?.documentsScreenedToday ?? '—'}</strong>
              <small>screened</small>
            </div>
          </div>
          <div className="risk-legend">
            {(d?.riskDistribution ?? []).map(item => (
              <div className="risk-legend-row" key={item.label}>
                <div className={`risk-dot risk-dot-${item.label.toLowerCase()}`} />
                <span>{titleCase(item.label)}</span>
                <b>{item.value}</b>
              </div>
            ))}
          </div>
        </div>

        {/* Doc type mix */}
        <div className="card card-pad">
          <div className="card-head">
            <div>
              <div className="card-kicker">Document mix</div>
              <h2>By type</h2>
            </div>
            <FileText size={17} style={{ color: 'var(--text-tertiary)' }} />
          </div>
          <MiniBars data={d?.documentTypeDistribution} />
        </div>
      </div>

      {/* Recent screenings */}
      <div className="card card-pad" style={{ marginBottom: 14 }}>
        <div className="card-head">
          <div>
            <div className="card-kicker">Live register</div>
            <h2>Recent screenings</h2>
          </div>
          <Link href="/history" className="text-link">
            View all <ArrowRight size={13} />
          </Link>
        </div>
        <RecentTable rows={(d?.recentScreenings ?? []).slice(0, 5) as Screening[]} />
      </div>

      {/* Notice strip */}
      <div className="notice-strip">
        <div className="notice-strip-content">
          <Activity size={15} />
          <span>
            <b>Prototype boundary:</b> Results are synthetic and support authorised review only.
            Risk signals are not automated decisions.
          </span>
        </div>
        <Link href="/settings" className="text-link">Review rules <ArrowRight size={13} /></Link>
      </div>
    </QueryState>
  );
}
