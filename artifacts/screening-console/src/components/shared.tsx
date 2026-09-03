import * as React from 'react';
import { AlertTriangle, CheckCircle2, Database, RefreshCw, X } from 'lucide-react';
import { Link } from 'wouter';
import { ArrowRight } from 'lucide-react';
import type { CountPoint, Screening, TrendPoint } from '@workspace/api-client-react';
import { ResultStatus, RiskLevel, ScreeningStatus } from '@workspace/api-client-react';
import { cx, fmtDate, fmtMs, mask, pct, riskClass, titleCase } from '@/lib/utils';

// ─────────────────────────────────────────────────────────
// Primitive helpers
// ─────────────────────────────────────────────────────────

export function Button({
  children,
  variant = 'primary',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
}) {
  return (
    <button {...props} className={cx(`btn btn-${variant}`, className)}>
      {children}
    </button>
  );
}

export function Card({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props} className={cx('card card-pad', className)}>
      {children}
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={cx('skeleton', className)} aria-hidden="true" />;
}

// ─────────────────────────────────────────────────────────
// Query state wrapper
// ─────────────────────────────────────────────────────────

export function QueryState({
  loading,
  error,
  empty,
  retry,
  children,
}: {
  loading?: boolean;
  error?: boolean;
  empty?: boolean;
  retry: () => void;
  children: React.ReactNode;
}) {
  if (loading) {
    return (
      <div className="state-stack">
        <Skeleton className="h-28" />
        <Skeleton className="h-52" />
        <Skeleton className="h-52" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="state-card">
        <div className="state-icon state-icon-danger">
          <AlertTriangle size={18} />
        </div>
        <div>
          <h3>Service connection interrupted</h3>
          <p>Could not retrieve this view. No screening decision has been made.</p>
          <Button variant="secondary" onClick={retry}>
            <RefreshCw size={14} /> Retry
          </Button>
        </div>
      </div>
    );
  }
  if (empty) {
    return (
      <div className="state-card">
        <div className="state-icon">
          <Database size={18} />
        </div>
        <div>
          <h3>No records in this view</h3>
          <p>Adjust the filters or begin a new synthetic screening.</p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

// ─────────────────────────────────────────────────────────
// Status badge
// ─────────────────────────────────────────────────────────

const BADGE_CLASS: Record<string, string> = {
  [RiskLevel.LOW]: 'badge-low',
  [RiskLevel.MEDIUM]: 'badge-medium',
  [RiskLevel.HIGH]: 'badge-high',
  [RiskLevel.CRITICAL]: 'badge-red',
  [ScreeningStatus.CLEAR]: 'badge-clear',
  [ScreeningStatus.REVIEW]: 'badge-review',
  [ScreeningStatus.ALERT]: 'badge-alert',
  [ResultStatus.PASS]: 'badge-pass',
  [ResultStatus.MATCH]: 'badge-match',
  [ResultStatus.WARNING]: 'badge-warning',
  [ResultStatus.SUSPICIOUS]: 'badge-suspicious',
  [ResultStatus.MISMATCH]: 'badge-mismatch',
  [ResultStatus.INSUFFICIENT_QUALITY]: 'badge-insufficient-quality',
  VALID: 'badge-valid',
  EXPIRED: 'badge-expired',
  BLACKLISTED: 'badge-blacklisted',
  SUSPENDED: 'badge-suspended',
  NOT_FOUND: 'badge-not-found',
};

export function StatusBadge({ value, tone }: { value?: string; tone?: string }) {
  const cls = tone ? `badge-${tone}` : (BADGE_CLASS[value ?? ''] ?? 'badge-neutral');
  return (
    <span className={cx('badge', cls)}>
      {titleCase(value)}
    </span>
  );
}

// ─────────────────────────────────────────────────────────
// Page heading
// ─────────────────────────────────────────────────────────

export function PageHeading({
  eyebrow,
  title,
  detail,
  action,
}: {
  eyebrow: string;
  title: string;
  detail: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading fade-up">
      <div>
        <div className="page-eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{detail}</p>
      </div>
      {action}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Charts
// ─────────────────────────────────────────────────────────

export function TrendChart({ data }: { data?: TrendPoint[] }) {
  const points = data ?? [];
  const max = Math.max(...points.map((p) => p.screened), 1);
  return (
    <div className="trend-chart">
      {points.map((p) => (
        <div className="trend-col" key={p.label}>
          <div className="trend-bars">
            <div
              className="trend-bar-main"
              style={{ height: `${Math.max(4, (p.screened / max) * 100)}%` }}
              title={`${p.label}: ${p.screened} screened`}
            />
            <div
              className="trend-bar-alert"
              style={{ height: `${Math.max(p.suspicious ? 4 : 0, (p.suspicious / max) * 100)}%` }}
              title={`${p.label}: ${p.suspicious} suspicious`}
            />
          </div>
          <div className="trend-label">{p.label}</div>
        </div>
      ))}
    </div>
  );
}

export function MiniBars({ data }: { data?: CountPoint[] }) {
  const safe = data ?? [];
  const max = Math.max(...safe.map((d) => d.value), 1);
  return (
    <div className="mini-bars">
      {safe.map((d) => (
        <div className="mini-bar-item" key={d.label}>
          <div
            className="mini-bar"
            style={{ height: `${Math.max(8, (d.value / max) * 100)}%` }}
            title={`${d.label}: ${d.value}`}
          />
          <div className="mini-bar-label">{d.label.slice(0, 4)}</div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Metric card
// ─────────────────────────────────────────────────────────

export function Metric({
  label,
  value,
  note,
  icon: Icon,
  accent = 'brand',
}: {
  label: string;
  value: string | number;
  note: string;
  icon: React.ElementType;
  accent?: 'brand' | 'green' | 'amber' | 'sky' | 'red';
}) {
  return (
    <div className="metric-card fade-up">
      <div className={`metric-icon metric-icon-${accent}`}>
        <Icon size={17} />
      </div>
      <div className="metric-content">
        <div className="metric-label">{label}</div>
        <div className="metric-value">{value}</div>
        <div className="metric-note">{note}</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Screening table (shared by Overview + History)
// ─────────────────────────────────────────────────────────

export function ScreeningTable({
  rows,
}: {
  rows: Screening[];
}) {
  if (!rows.length) {
    return <div className="table-empty">No screening records match the current view.</div>;
  }
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th>Screening ID</th>
            <th>Document</th>
            <th>Nationality</th>
            <th>Risk score</th>
            <th>Status</th>
            <th>Created</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <Link href={`/screening/${row.id}`} className="cell-link">
                  {row.screeningId}
                </Link>
                <small>{row.documentType}</small>
              </td>
              <td className="cell-mono">{mask(row.documentNumber)}</td>
              <td>{row.nationality}</td>
              <td>
                <div className="score-pill">
                  <div className={`score-indicator ${riskClass(row.riskScore)}`} />
                  {row.riskScore}
                  <small>/ 100</small>
                </div>
              </td>
              <td>
                <StatusBadge value={row.status} />
              </td>
              <td className="cell-date">{fmtDate(row.createdAt)}</td>
              <td>
                <Link
                  href={`/screening/${row.id}`}
                  className="row-btn"
                  aria-label={`Open ${row.screeningId}`}
                >
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

// ─────────────────────────────────────────────────────────
// Notice strip / inline alert
// ─────────────────────────────────────────────────────────

export function NoticeStrip({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="notice-strip">
      <div className="notice-strip-content">
        <AlertTriangle size={15} />
        <span>{children}</span>
      </div>
      {action}
    </div>
  );
}

export function InlineAlert({
  children,
  onDismiss,
}: {
  children: React.ReactNode;
  onDismiss: () => void;
}) {
  return (
    <div className="inline-alert">
      <AlertTriangle size={15} />
      <span>{children}</span>
      <button onClick={onDismiss} aria-label="Dismiss">
        <X size={14} />
      </button>
    </div>
  );
}

export function SaveNotice({
  children,
  onDismiss,
}: {
  children: React.ReactNode;
  onDismiss: () => void;
}) {
  return (
    <div className="save-notice">
      <CheckCircle2 size={15} />
      <span>{children}</span>
      <button onClick={onDismiss} aria-label="Dismiss">
        <X size={14} />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// PDF download helper
// ─────────────────────────────────────────────────────────

function escapePdf(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[^\x20-\x7E]/g, ' ');
}

import type { ScreeningDetail } from '@workspace/api-client-react';

export function downloadPdf(detail: ScreeningDetail) {
  const lines = [
    'AI-Based Identity Document Screening System',
    'ACADEMIC PROTOTYPE — SYNTHETIC DATA ONLY',
    '',
    `Screening ID : ${detail.screeningId}`,
    `Processed    : ${fmtDate(detail.createdAt)}`,
    `Document     : ${detail.documentType} / ${detail.documentNumber}`,
    `Nationality  : ${detail.nationality}`,
    `Risk         : ${detail.riskScore}/100 (${detail.riskLevel})`,
    `Recommendation: ${detail.recommendation}`,
    '',
    `OCR confidence   : ${pct(detail.ocrConfidence)}`,
    `Validation       : ${detail.validationStatus}`,
    `Tampering        : ${detail.tamperingStatus}`,
    `Face verification: ${detail.face.result} (${pct(detail.face.similarity)} similarity)`,
    '',
    'Risk factors:',
    ...detail.riskFactors.map(
      (f) => `  +${f.points}  ${f.label}  [${f.category}]`,
    ),
    '',
    'Prototype disclaimer:',
    detail.prototypeDisclaimer,
  ];

  const content = [
    'BT',
    '/F1 11 Tf',
    '50 760 Td',
    ...lines.flatMap((line, i) => [
      i === 0 ? `/F1 13 Tf (${escapePdf(line)}) Tj` : `0 -16 Td /F1 11 Tf (${escapePdf(line)}) Tj`,
    ]),
    'ET',
  ].join('\n');

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  objects.forEach((obj, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((o) => {
    pdf += `${String(o).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;

  const url = URL.createObjectURL(new Blob([pdf], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${detail.screeningId}-report.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
