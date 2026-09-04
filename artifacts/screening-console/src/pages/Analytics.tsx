import { useState } from 'react';
import {
  Activity, AlertTriangle, ArrowDownRight, BarChart3,
  CheckCircle2, Clock3, ShieldAlert, UserRoundCheck,
} from 'lucide-react';
import {
  GetAnalyticsRange, useGetAnalytics,
} from '@workspace/api-client-react';
import type { Analytics, TrendPoint } from '@workspace/api-client-react';
import { QueryState } from '@/components/shared';
import { fmtMs, pct, titleCase } from '@/lib/utils';

// ── helpers ────────────────────────────────────────────────────────────────

function Metric({
  label, value, note, icon: Icon, accent = 'brand',
}: {
  label: string; value: string | number; note: string;
  icon: React.ElementType; accent?: 'brand' | 'green' | 'amber' | 'sky';
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
  const pts  = data ?? [];
  const max  = Math.max(...pts.map(p => p.screened), 1);
  return (
    <div className="trend-chart">
      {pts.map(p => (
        <div className="trend-col" key={p.label}>
          <div className="trend-bars">
            <div className="trend-bar-main"
              style={{ height: `${Math.max(4, (p.screened / max) * 100)}%` }} />
            <div className="trend-bar-alert"
              style={{ height: `${Math.max(p.suspicious ? 4 : 0, (p.suspicious / max) * 100)}%` }} />
          </div>
          <div className="trend-label">{p.label}</div>
        </div>
      ))}
    </div>
  );
}

// ── page ───────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [range, setRange] = useState<string>('7d');

  const q = useGetAnalytics({
    range: range as typeof GetAnalyticsRange[keyof typeof GetAnalyticsRange],
  });
  const d = q.data as Analytics | undefined;

  return (
    <QueryState loading={q.isLoading} error={q.isError} retry={q.refetch}>
      {/* Heading */}
      <div className="page-heading fade-up">
        <div>
          <div className="page-eyebrow">Analysis · Pattern review</div>
          <h1>See the shape of risk.</h1>
          <p>Aggregate signals across the register. Choose a window, then inspect what moved.</p>
        </div>

        <div className="range-picker">
          <span>Window</span>
          <select value={range} onChange={e => setRange(e.target.value)}>
            <option value="today">Today</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </select>
        </div>
      </div>

      {/* Metrics */}
      <div className="metrics-grid" style={{ marginBottom: 14 }}>
        <Metric label="Total screened"     value={d?.totalScreened ?? '—'}    note={d?.range ?? range}    icon={Activity}      accent="brand" />
        <Metric label="Valid percentage"   value={pct(d?.validPercentage)}     note="Risk score ≤ 20"      icon={CheckCircle2}  accent="green" />
        <Metric label="Suspicious"         value={pct(d?.suspiciousPercentage)} note="Risk score > 20"     icon={AlertTriangle} accent="amber" />
        <Metric label="Avg processing"     value={fmtMs(d?.averageProcessingTimeMs)} note="Per screening"  icon={Clock3}        accent="sky"   />
      </div>

      {/* Charts */}
      <div className="analytics-grid">
        {/* Trend */}
        <div className="card card-pad fade-up delay-1">
          <div className="card-head">
            <div>
              <div className="card-kicker">Volume & signal</div>
              <h2>Daily screening trend</h2>
            </div>
            <div className="chart-legend">
              <span className="legend-dot legend-brand" /> screened
              <span className="legend-dot legend-amber" style={{ marginLeft: 8 }} /> suspicious
            </div>
          </div>
          <TrendChart data={d?.dailyTrend} />
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Distribution */}
          <div className="card card-pad fade-up delay-1">
            <div className="card-head">
              <div>
                <div className="card-kicker">Risk posture</div>
                <h2>Distribution</h2>
              </div>
              <BarChart3 size={16} style={{ color: 'var(--text-tertiary)' }} />
            </div>
            <div className="distribution-list">
              {(d?.riskDistribution ?? []).map(item => {
                const pctVal = d?.totalScreened ? (item.value / d.totalScreened) * 100 : 0;
                return (
                  <div className="distribution-row" key={item.label}>
                    <div className="distribution-meta">
                      <span>{titleCase(item.label)}</span>
                      <b>{item.value}</b>
                    </div>
                    <div className="distribution-track">
                      <div className="distribution-fill" style={{ width: `${pctVal}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Focused signals */}
          <div className="card card-pad fade-up delay-2" style={{ flex: 1 }}>
            <div className="card-head">
              <div>
                <div className="card-kicker">Focused signals</div>
                <h2>What needs a closer look</h2>
              </div>
            </div>
            <div className="signal-pair">
              <div className="signal-item">
                <div className="signal-icon signal-icon-warn"><ShieldAlert size={16} /></div>
                <span>Tampering findings</span>
                <span className="signal-val">{d?.tamperingFindings ?? '—'}</span>
              </div>
              <div className="signal-item">
                <div className="signal-icon signal-icon-danger"><UserRoundCheck size={16} /></div>
                <span>Face mismatches</span>
                <span className="signal-val">{d?.faceMismatches ?? '—'}</span>
              </div>
            </div>
            <div className="signal-note">
              <ArrowDownRight size={13} />
              Counts are signals for authorised reviewers, not adjudications.
            </div>
          </div>
        </div>
      </div>
    </QueryState>
  );
}
