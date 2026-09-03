import { useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Link, Route, Router as WouterRouter, Switch, useLocation, useParams } from 'wouter';
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowRight, BarChart3, Bell, Check, CheckCircle2,
  ChevronDown, ClipboardCheck, Clock3, Database, Download, FileCheck2, FilePlus2, FileText,
  Filter, Gauge, History, LayoutDashboard, Loader2, LockKeyhole, Menu, MoreHorizontal, Pencil,
  Plus, RefreshCw, Search, Settings2, ShieldCheck, ShieldAlert, SlidersHorizontal, Trash2,
  UploadCloud, UserRoundCheck, X, XCircle,
} from 'lucide-react';
import {
  DocumentType, DemoCaseInputScenario, GetAnalyticsRange, MockRecordInputStatus, ResultStatus,
  RiskLevel, ScreeningStatus,
  getGetAnalyticsQueryKey, getGetDashboardSummaryQueryKey, getGetRulesQueryKey,
  getGetScreeningQueryKey, getListMockRecordsQueryKey, getListScreeningsQueryKey,
  useCreateMockRecord, useCreateScreening, useDeleteMockRecord, useGetAnalytics,
  useGetDashboardSummary, useGetRules, useGetScreening, useListMockRecords, useListScreenings,
  useLoadDemoCase, useUpdateMockRecord, useUpdateRules,
} from '@workspace/api-client-react';
import type {
  Analytics, CountPoint, DashboardSummary, MockRecord, Screening, ScreeningDetail,
  ScreeningRules, ScreeningRulesInput, TrendPoint,
} from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import NotFound from '@/pages/not-found';
import './index.css';

const queryClient = new QueryClient();
const navItems = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/history', label: 'Screening history', icon: History },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/settings', label: 'Prototype settings', icon: Settings2 },
];

function cx(...parts: Array<string | false | undefined>) { return parts.filter(Boolean).join(' '); }
function fmtMs(ms?: number) { return ms == null ? '—' : `${(ms / 1000).toFixed(1)}s`; }
function fmtDate(value?: string) { return value ? new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'; }
function mask(value?: string) { return value ? `${value.slice(0, 3)} ··· ${value.slice(-3)}` : '—'; }
function pct(value?: number) { return value == null ? '—' : `${value.toFixed(1)}%`; }
function titleCase(value?: string) { return value ? value.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()) : '—'; }

function StatusBadge({ value, tone }: { value?: string; tone?: 'low' | 'medium' | 'high' | 'clear' | 'review' | 'alert' | 'neutral' }) {
  const key = tone ?? (value === RiskLevel.LOW || value === ScreeningStatus.CLEAR || value === ResultStatus.PASS || value === ResultStatus.MATCH ? 'low' : value === RiskLevel.MEDIUM || value === ScreeningStatus.REVIEW || value === ResultStatus.WARNING ? 'medium' : value === RiskLevel.HIGH || value === RiskLevel.CRITICAL || value === ScreeningStatus.ALERT || value === ResultStatus.SUSPICIOUS || value === ResultStatus.MISMATCH ? 'high' : 'neutral');
  return <span className={`status-badge status-${key}`} data-testid={`status-badge-${String(value).toLowerCase().replace(/\s/g, '-')}`}>{titleCase(value)}</span>;
}

function Button({ children, variant = 'primary', className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' }) {
  return <button {...props} className={cx('ui-button', `ui-button-${variant}`, className)}>{children}</button>;
}

function Card({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <section {...props} className={cx('console-card', className)}>{children}</section>;
}

function Skeleton({ className = '' }: { className?: string }) { return <div className={cx('skeleton', className)} aria-label="Loading" />; }

function QueryState({ loading, error, empty, retry, children }: { loading?: boolean; error?: boolean; empty?: boolean; retry: () => void; children: React.ReactNode }) {
  if (loading) return <div className="state-stack"><Skeleton className="h-28 w-full" /><Skeleton className="h-48 w-full" /><Skeleton className="h-48 w-full" /></div>;
  if (error) return <div className="state-card"><div className="state-icon state-icon-danger"><AlertTriangle size={19} /></div><div><h3>Service connection interrupted</h3><p>We could not retrieve this view. No screening decision has been made.</p><Button variant="secondary" onClick={retry} data-testid="button-retry-query"><RefreshCw size={15} /> Retry</Button></div></div>;
  if (empty) return <div className="state-card"><div className="state-icon"><Database size={19} /></div><div><h3>No records in this view</h3><p>Adjust the filters or begin a new synthetic screening.</p></div></div>;
  return <>{children}</>;
}

function Shell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  return <div className="app-shell">
    <aside className={cx('sidebar', mobileOpen && 'sidebar-open')}>
      <div className="brand-lockup">
        <div className="brand-mark"><span /><span /><span /></div>
        <div><strong>Screening</strong><small>CONSOLE / LAB</small></div>
      </div>
      <div className="sidebar-label">Workspace</div>
      <nav className="side-nav">{navItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={cx('nav-link', location === href && 'nav-link-active')} onClick={() => setMobileOpen(false)} data-testid={`link-nav-${label.toLowerCase().replace(/\s/g, '-')}`}><Icon size={17} /><span>{label}</span>{location === href && <i />}</Link>)}</nav>
      <div className="sidebar-rule" />
      <Link href="/screening/new" className="new-screening-link" onClick={() => setMobileOpen(false)} data-testid="link-new-screening"><FilePlus2 size={17} /><span>New screening</span><kbd>N</kbd></Link>
      <div className="sidebar-bottom">
        <div className="secure-note"><LockKeyhole size={14} /><span>Authorized workspace<br /><b>Synthetic data only</b></span></div>
        <div className="operator"><div className="avatar">AR</div><div><strong>A. Reviewer</strong><small>Research operator</small></div><MoreHorizontal size={16} /></div>
      </div>
    </aside>
    <div className="main-column">
      <header className="topbar">
        <Button variant="ghost" className="mobile-menu" onClick={() => setMobileOpen((v) => !v)} aria-label="Open navigation" data-testid="button-open-navigation"><Menu size={19} /></Button>
        <div className="breadcrumb"><span>Screening Console</span><ArrowRight size={13} /><strong>{location === '/' ? 'Overview' : titleCase(location.split('/')[1])}</strong></div>
        <div className="top-actions"><div className="system-pulse"><i /> System nominal</div><button className="icon-button" aria-label="Notifications" data-testid="button-notifications"><Bell size={18} /><b /></button><div className="top-avatar">AR</div></div>
      </header>
      <main className="page-wrap">{children}</main>
      <footer className="console-footer"><span>SCREENING CONSOLE <b>v0.8.4 · ACADEMIC PROTOTYPE</b></span><span><i /> API connected · Last sync just now</span></footer>
    </div>
  </div>;
}

function PageHeading({ eyebrow, title, detail, action }: { eyebrow: string; title: string; detail: string; action?: React.ReactNode }) {
  return <div className="page-heading console-in"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{detail}</p></div>{action}</div>;
}

function MiniBars({ data, color = 'teal' }: { data?: CountPoint[]; color?: 'teal' | 'amber' }) {
  const safe = data ?? [];
  const max = Math.max(...safe.map((item) => item.value), 1);
  return <div className="mini-bars" data-testid="chart-mini-bars">{safe.map((item) => <div className="mini-bar-item" key={item.label}><div className={cx('mini-bar', color === 'amber' && 'mini-bar-amber')} style={{ height: `${Math.max(8, item.value / max * 100)}%` }} title={`${item.label}: ${item.value}`} /><small>{item.label.slice(0, 3)}</small></div>)}</div>;
}

function TrendChart({ data }: { data?: TrendPoint[] }) {
  const points = data ?? [];
  const max = Math.max(...points.map((item) => item.screened), 1);
  return <div className="trend-chart" data-testid="chart-daily-trend">{points.map((item) => <div className="trend-column" key={item.label}><div className="trend-bars"><span style={{ height: `${Math.max(4, item.screened / max * 100)}%` }} /><span className="trend-suspicious" style={{ height: `${Math.max(item.suspicious ? 6 : 0, item.suspicious / max * 100)}%` }} /></div><small>{item.label}</small></div>)}</div>;
}

function Metric({ label, value, note, icon: Icon, accent = 'teal' }: { label: string; value: string | number; note: string; icon: typeof Activity; accent?: string }) {
  return <Card className="metric-card console-in"><div className={cx('metric-icon', `metric-${accent}`)}><Icon size={18} /></div><div className="metric-copy"><span>{label}</span><strong data-testid={`metric-${label.toLowerCase().replace(/\s/g, '-')}`}>{value}</strong><small>{note}</small></div></Card>;
}

function Overview() {
  const dashboard = useGetDashboardSummary();
  const summary = dashboard.data as DashboardSummary | undefined;
  return <QueryState loading={dashboard.isLoading} error={dashboard.isError} retry={dashboard.refetch}>
    <PageHeading eyebrow="Operations overview · Today" title="Keep the signal clear." detail="Synthetic identity-document screening at a glance. Every result stays explainable and reviewable." action={<Link href="/screening/new" className="ui-button ui-button-primary" data-testid="link-start-screening"><Plus size={16} /> Start a screening <kbd>N</kbd></Link>} />
    <div className="metrics-grid">
      <Metric label="Documents screened" value={summary?.documentsScreenedToday ?? '—'} note="Today, UTC" icon={FileCheck2} />
      <Metric label="Verified documents" value={summary?.verifiedDocuments ?? '—'} note="Passed validation" icon={ShieldCheck} accent="green" />
      <Metric label="Needs attention" value={summary?.suspiciousDocuments ?? '—'} note="Review or alert" icon={ShieldAlert} accent="amber" />
      <Metric label="Average processing" value={fmtMs(summary?.averageProcessingTimeMs)} note="End-to-end latency" icon={Clock3} accent="blue" />
    </div>
    <div className="overview-grid">
      <Card className="chart-card"><div className="card-head"><div><span className="section-kicker">Throughput</span><h2>Screening activity</h2></div><span className="legend"><i className="legend-teal" /> screened <i className="legend-amber" /> suspicious</span></div><TrendChart data={summary?.dailyTrend} /></Card>
      <Card className="risk-card"><div className="card-head"><div><span className="section-kicker">Risk posture</span><h2>Current distribution</h2></div><Gauge size={18} className="muted-icon" /></div><div className="risk-ring"><div><strong>{summary?.documentsScreenedToday ?? '—'}</strong><small>screened</small></div></div><div className="risk-legend">{(summary?.riskDistribution ?? []).map((item) => <div key={item.label}><i className={`dot dot-${item.label.toLowerCase()}`} /><span>{titleCase(item.label)}</span><b>{item.value}</b></div>)}</div></Card>
      <Card className="type-card"><div className="card-head"><div><span className="section-kicker">Document mix</span><h2>By document type</h2></div><FileText size={18} className="muted-icon" /></div><MiniBars data={summary?.documentTypeDistribution} color="amber" /></Card>
    </div>
    <Card className="recent-card"><div className="card-head"><div><span className="section-kicker">Live register</span><h2>Recent screenings</h2></div><Link href="/history" className="text-link" data-testid="link-view-history">View full history <ArrowRight size={14} /></Link></div><ScreeningTable rows={(summary?.recentScreenings ?? []).slice(0, 5)} compact /></Card>
    <div className="notice-strip"><div><Activity size={17} /><span><b>Prototype boundary:</b> Results are synthetic and support authorized review only. Risk signals are not automated decisions.</span></div><Link href="/settings" className="text-link" data-testid="link-review-rules">Review rules <ArrowRight size={14} /></Link></div>
  </QueryState>;
}

function ScreeningTable({ rows, compact = false }: { rows: Screening[]; compact?: boolean }) {
  if (!rows.length) return <div className="table-empty">No screening records match the current view.</div>;
  return <div className="table-scroll"><table className="data-table"><thead><tr><th>Screening ID</th><th>Document</th><th>Nationality</th><th>Risk score</th><th>Status</th><th>Created</th><th /></tr></thead><tbody>{rows.map((row) => <tr key={row.id} data-testid={`row-screening-${row.id}`}><td><Link href={`/screening/${row.id}`} className="mono-link" data-testid={`link-screening-${row.id}`}>{row.screeningId}</Link><small>{row.documentType}</small></td><td className="mono">{mask(row.documentNumber)}</td><td>{row.nationality}</td><td><div className="score-cell"><span className={cx('score-dot', row.riskScore > 70 ? 'score-high' : row.riskScore > 35 ? 'score-medium' : 'score-low')} />{row.riskScore}<small>/ 100</small></div></td><td><StatusBadge value={row.status} /></td><td className="date-cell">{fmtDate(row.createdAt)}</td><td><Link href={`/screening/${row.id}`} className="row-arrow" aria-label={`Open ${row.screeningId}`} data-testid={`link-open-screening-${row.id}`}><ArrowRight size={16} /></Link></td></tr>)}</tbody></table></div>;
}

function NewScreening() {
  const [, setLocation] = useLocation();
  const [docType, setDocType] = useState<string>(DocumentType.Passport);
  const [docNumber, setDocNumber] = useState('');
  const [nationality, setNationality] = useState('');
  const [fileName, setFileName] = useState('');
  const [person, setPerson] = useState(true);
  const [scenario, setScenario] = useState<string>('valid');
  const [notice, setNotice] = useState('');
  const create = useCreateScreening();
  const demo = useLoadDemoCase();
  const qc = useQueryClient();
  const run = () => create.mutate({ data: { documentType: docType as typeof DocumentType[keyof typeof DocumentType], documentNumber: docNumber || undefined, nationality: nationality || undefined, fileName: fileName || undefined, personImageProvided: person, scenario: scenario as 'valid' | 'expired' | 'tampered' | 'mismatch' | 'blacklisted' } }, { onSuccess: (detail) => { qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() }); qc.invalidateQueries({ queryKey: getListScreeningsQueryKey() }); setLocation(`/screening/${detail.id}`); }, onError: () => setNotice('Screening could not be completed. Check the API connection and try again.') });
  const loadDemo = () => demo.mutate({ data: { scenario: scenario as typeof DemoCaseInputScenario[keyof typeof DemoCaseInputScenario] } }, { onSuccess: (detail) => { setNotice('Demo case loaded. Review the synthetic inputs, then run the screening.'); setDocNumber(detail.documentNumber); setNationality(detail.nationality); setFileName(detail.fileName); }, onError: () => setNotice('Demo case is unavailable right now.') });
  return <div className="new-page"><PageHeading eyebrow="Intake · New case" title="Start a screening." detail="Provide the synthetic document context below. The processor will return an inspectable report, not a decision." action={<div className="case-status"><i /> Ready for input</div>} />
    <div className="workflow-rail"><div className="workflow-step active"><b>01</b><span>Document context</span></div><div className="workflow-line" /><div className="workflow-step"><b>02</b><span>Processing</span></div><div className="workflow-line" /><div className="workflow-step"><b>03</b><span>Review report</span></div></div>
    <div className="intake-grid"><Card className="intake-main"><div className="card-head"><div><span className="section-kicker">Synthetic input</span><h2>Document context</h2></div><span className="required-note">All fields optional</span></div><label className="field-label">Document type<select value={docType} onChange={(e) => setDocType(e.target.value)} data-testid="select-document-type">{Object.values(DocumentType).map((type) => <option key={type} value={type}>{type}</option>)}</select></label><div className="two-fields"><label className="field-label">Document number<input value={docNumber} onChange={(e) => setDocNumber(e.target.value)} placeholder="e.g. PZ4820196" data-testid="input-document-number" /></label><label className="field-label">Nationality<input value={nationality} onChange={(e) => setNationality(e.target.value)} placeholder="e.g. Canada" data-testid="input-nationality" /></label></div><label className="field-label">Document image / file<span className="upload-zone"><UploadCloud size={22} /><span>{fileName || 'Drop a synthetic document here'}</span><small>PNG, JPG or PDF · prototype only</small><input type="file" accept=".png,.jpg,.jpeg,.pdf" onChange={(e) => setFileName(e.target.files?.[0]?.name ?? '')} data-testid="input-document-file" /></span></label><label className="toggle-row"><span><strong>Person image available</strong><small>Include a synthetic face image for comparison</small></span><button type="button" className={cx('toggle', person && 'toggle-on')} onClick={() => setPerson((v) => !v)} aria-label="Toggle person image" data-testid="button-toggle-person-image"><i /></button></label><div className="form-actions"><Button variant="secondary" onClick={() => setLocation('/')} data-testid="button-cancel-screening"><X size={15} /> Cancel</Button><Button onClick={run} disabled={create.isPending} data-testid="button-run-screening">{create.isPending ? <Loader2 size={15} className="spin" /> : <ShieldCheck size={15} />} {create.isPending ? 'Processing…' : 'Run screening'} <ArrowRight size={15} /></Button></div></Card>
      <Card className="demo-card"><div className="card-head"><div><span className="section-kicker">Shortcuts</span><h2>Load a demo case</h2></div><SlidersHorizontal size={18} className="muted-icon" /></div><p>Use a preconfigured synthetic scenario to exercise a specific review signal.</p><label className="field-label">Scenario<select value={scenario} onChange={(e) => setScenario(e.target.value)} data-testid="select-demo-scenario"><option value="valid">Valid document</option><option value="expired">Expired document</option><option value="tampered">Tampering findings</option><option value="mismatch">Face mismatch</option><option value="blacklisted">Blacklisted record</option></select></label><Button variant="secondary" onClick={loadDemo} disabled={demo.isPending} className="full-button" data-testid="button-load-demo">{demo.isPending ? <Loader2 size={15} className="spin" /> : <Database size={15} />} Load scenario</Button><div className="demo-callout"><AlertTriangle size={15} /><span>Demo cases are synthetic fixtures. They never represent a real person or document.</span></div></Card>
    </div>{notice && <div className="inline-notice" data-testid="status-screening-notice"><AlertTriangle size={15} />{notice}<button onClick={() => setNotice('')} aria-label="Dismiss notice" data-testid="button-dismiss-notice"><X size={14} /></button></div>}
  </div>;
}

function escapePdf(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/[^\x20-\x7E]/g, ' ');
}

function downloadPdf(detail: ScreeningDetail) {
  const lines = [
    'AI-Based Fake Identity & Document Screening System',
    'ACADEMIC PROTOTYPE — SYNTHETIC DATA ONLY',
    '',
    `Screening ID: ${detail.screeningId}`,
    `Processed: ${fmtDate(detail.createdAt)}`,
    `Document: ${detail.documentType} / ${detail.documentNumber}`,
    `Nationality: ${detail.nationality}`,
    `Risk: ${detail.riskScore}/100 (${detail.riskLevel})`,
    `Recommendation: ${detail.recommendation}`,
    '',
    `OCR confidence: ${pct(detail.ocrConfidence)}`,
    `Validation: ${detail.validationStatus}`,
    `Tampering analysis: ${detail.tamperingStatus}`,
    `Face verification: ${detail.face.result} (${pct(detail.face.similarity)} similarity)`,
    '',
    'Risk factors:',
    ...detail.riskFactors.map((factor) => `+${factor.points} ${factor.label} [${factor.category}]`),
    '',
    'Prototype disclaimer:',
    detail.prototypeDisclaimer,
  ];
  const content = [
    'BT',
    '/F1 14 Tf',
    '50 780 Td',
    ...lines.flatMap((line, index) => [
      index === 0 ? `(${escapePdf(line)}) Tj` : `0 -18 Td (${escapePdf(line)}) Tj`,
    ]),
    'ET',
  ].join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => { pdf += `${String(offset).padStart(10, '0')} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const url = URL.createObjectURL(new Blob([pdf], { type: 'application/pdf' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${detail.screeningId}-report.pdf`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function Report({ id }: { id: number }) {
  const report = useGetScreening(id, { query: { queryKey: getGetScreeningQueryKey(id) } });
  const detail = report.data as ScreeningDetail | undefined;
  const download = () => { if (detail) downloadPdf(detail); };
  return <QueryState loading={report.isLoading} error={report.isError} retry={report.refetch}>
    {detail && <div className="report-page"><PageHeading eyebrow={`Report · ${detail.screeningId}`} title="Inspect the evidence." detail={`${detail.fileName} · processed ${fmtDate(detail.createdAt)}`} action={<div className="report-actions"><Button variant="secondary" onClick={() => window.print()} data-testid="button-print-report"><FileText size={15} /> Print</Button><Button variant="secondary" onClick={download} data-testid="button-download-report"><Download size={15} /> Download</Button></div>} />
      <div className="report-hero console-in"><div className="report-id"><span className="section-kicker">Screening result</span><strong>{detail.screeningId}</strong><small>{detail.documentType} · {mask(detail.documentNumber)} · {detail.nationality}</small></div><div className="risk-score"><div className={cx('score-ring', detail.riskScore > 70 ? 'ring-high' : detail.riskScore > 35 ? 'ring-medium' : 'ring-low')}><strong>{detail.riskScore}</strong><small>/ 100</small></div><div><span>Risk level</span><StatusBadge value={detail.riskLevel} /><small className="report-recommendation">{titleCase(detail.recommendation)}</small></div></div><div className="report-disclaimer"><AlertTriangle size={16} /><span>{detail.prototypeDisclaimer}</span></div></div>
      <div className="report-grid"><Card><div className="card-head"><div><span className="section-kicker">01 · OCR extraction</span><h2>Extracted fields</h2></div><StatusBadge value={detail.ocrStatus} /></div><div className="confidence-line"><span>OCR confidence</span><b>{pct(detail.ocrConfidence)}</b></div><div className="field-list">{detail.extractedFields.map((field, index) => <div className="extracted-field" key={`${field.label}-${index}`} data-testid={`field-extracted-${index}`}><span>{field.label}</span><strong>{field.value || 'Not found'}</strong><small>{pct(field.confidence)} · {field.source}</small></div>)}</div></Card><Card><div className="card-head"><div><span className="section-kicker">02 · Validation</span><h2>Rule checks</h2></div><StatusBadge value={detail.validationStatus} /></div><div className="check-list">{detail.validationChecks.map((check, index) => <div className="check-row" key={`${check.label}-${index}`}><span className={cx('check-icon', check.status === ResultStatus.PASS ? 'check-pass' : 'check-warn')}>{check.status === ResultStatus.PASS ? <Check size={14} /> : <AlertTriangle size={14} />}</span><div><strong>{check.label}</strong><small>{check.detail}</small></div><StatusBadge value={check.status} /></div>)}</div></Card><Card className="tamper-card"><div className="card-head"><div><span className="section-kicker">03 · Integrity</span><h2>Tampering analysis</h2></div><StatusBadge value={detail.tamperingStatus} /></div>{detail.tamperingFindings.length ? <div className="finding-list">{detail.tamperingFindings.map((finding, index) => <div className="finding-row" key={`${finding.region}-${index}`}><div className="finding-mark"><AlertTriangle size={15} /></div><div><strong>{finding.type} <small>· {finding.region}</small></strong><p>{finding.explanation}</p><span>Confidence {pct(finding.confidence)}</span></div><StatusBadge value={finding.status} /></div>)}</div> : <div className="quiet-empty"><CheckCircle2 size={18} /><span>No tampering findings returned for this synthetic document.</span></div>}</Card><Card><div className="card-head"><div><span className="section-kicker">04 · Face comparison</span><h2>Identity similarity</h2></div><StatusBadge value={detail.face.result} /></div><div className="face-summary"><div className="face-score"><strong>{pct(detail.face.similarity)}</strong><span>Similarity</span></div><div className="face-bars"><div><span>Document face</span><b className={detail.face.documentFaceDetected ? 'bar-on' : ''} /></div><div><span>Person image</span><b className={detail.face.personFaceDetected ? 'bar-on' : ''} /></div></div></div><p className="small-note">{detail.face.note}</p></Card></div>
      <div className="report-lower"><Card><div className="card-head"><div><span className="section-kicker">Explainability</span><h2>Risk factors</h2></div><span className="total-points">Total {detail.riskScore} pts</span></div><div className="factor-list">{detail.riskFactors.map((factor, index) => <div className="factor-row" key={`${factor.label}-${index}`}><span className={`factor-cat factor-${factor.category.toLowerCase()}`}>{factor.category.slice(0, 3)}</span><span>{factor.label}</span><b>+{factor.points}</b></div>)}</div></Card><Card><div className="card-head"><div><span className="section-kicker">Processing metadata</span><h2>Trace details</h2></div><Activity size={17} className="muted-icon" /></div><div className="metadata-grid">{Object.entries(detail.metadata).map(([key, value]) => <div key={key}><span>{titleCase(key)}</span><strong>{value}</strong></div>)}<div><span>Processing time</span><strong>{fmtMs(detail.processingTimeMs)}</strong></div><div><span>Recommendation</span><strong>{titleCase(detail.recommendation)}</strong></div></div></Card></div>
      <div className="notice-strip"><div><LockKeyhole size={16} /><span>This report is a prototype aid for authorized review. Do not use it as a sole basis for action.</span></div><Link href="/history" className="text-link" data-testid="link-back-history">Back to history <ArrowRight size={14} /></Link></div>
    </div>}
  </QueryState>;
}

function HistoryPage() {
  const [search, setSearch] = useState('');
  const [risk, setRisk] = useState('');
  const [type, setType] = useState('');
  const params = useMemo(() => ({ search: search || undefined, risk: (risk || undefined) as RiskLevel | undefined, documentType: (type || undefined) as typeof DocumentType[keyof typeof DocumentType] | undefined, limit: 100 }), [search, risk, type]);
  const query = useListScreenings(params);
  return <QueryState loading={query.isLoading} error={query.isError} empty={!query.data?.length} retry={query.refetch}><PageHeading eyebrow="Register · Screening history" title="Every case, traceable." detail="Search the screening register by identifier, document type, or risk level." action={<Link href="/screening/new" className="ui-button ui-button-primary" data-testid="link-history-new"><Plus size={16} /> New screening</Link>} /><Card className="history-card"><div className="filter-bar"><label className="search-input"><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search screening ID or document number" data-testid="input-history-search" /></label><label className="filter-select"><Filter size={15} /><select value={risk} onChange={(e) => setRisk(e.target.value)} data-testid="select-history-risk"><option value="">All risk levels</option><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="CRITICAL">Critical</option></select><ChevronDown size={14} /></label><label className="filter-select"><FileText size={15} /><select value={type} onChange={(e) => setType(e.target.value)} data-testid="select-history-type"><option value="">All document types</option>{Object.values(DocumentType).map((item) => <option key={item} value={item}>{item}</option>)}</select><ChevronDown size={14} /></label><span className="result-count">{query.data?.length ?? 0} records</span></div><ScreeningTable rows={(query.data ?? []) as Screening[]} /></Card></QueryState>;
}

function AnalyticsPage() {
  const [range, setRange] = useState<string>('7d');
  const query = useGetAnalytics({ range: range as typeof GetAnalyticsRange[keyof typeof GetAnalyticsRange] });
  const data = query.data as Analytics | undefined;
  return <QueryState loading={query.isLoading} error={query.isError} retry={query.refetch}><PageHeading eyebrow="Analysis · Pattern review" title="See the shape of risk." detail="Aggregate signals across the synthetic register. Choose a window, then inspect what moved." action={<label className="range-picker"><span>Window</span><select value={range} onChange={(e) => setRange(e.target.value)} data-testid="select-analytics-range"><option value="today">Today</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option></select><ChevronDown size={14} /></label>} /><div className="analytics-metrics"><Metric label="Total screened" value={data?.totalScreened ?? '—'} note={data?.range ?? 'Selected range'} icon={Activity} /><Metric label="Valid percentage" value={pct(data?.validPercentage)} note="Passed validation" icon={CheckCircle2} accent="green" /><Metric label="Suspicious" value={pct(data?.suspiciousPercentage)} note="Review or alert" icon={AlertTriangle} accent="amber" /><Metric label="Average processing" value={fmtMs(data?.averageProcessingTimeMs)} note="Per screening" icon={Clock3} accent="blue" /></div><div className="analytics-grid"><Card className="chart-card analytics-trend"><div className="card-head"><div><span className="section-kicker">Volume & signal</span><h2>Daily screening trend</h2></div><span className="legend"><i className="legend-teal" /> screened <i className="legend-amber" /> suspicious</span></div><TrendChart data={data?.dailyTrend} /></Card><Card><div className="card-head"><div><span className="section-kicker">Risk posture</span><h2>Distribution</h2></div><BarChart3 size={18} className="muted-icon" /></div><div className="distribution-list">{(data?.riskDistribution ?? []).map((item) => <div className="distribution-row" key={item.label}><span>{titleCase(item.label)}</span><div><i style={{ width: `${data?.totalScreened ? item.value / data.totalScreened * 100 : 0}%` }} /><b>{item.value}</b></div></div>)}</div></Card><Card className="signal-card"><div className="card-head"><div><span className="section-kicker">Focused signals</span><h2>What needs a closer look</h2></div><SlidersHorizontal size={18} className="muted-icon" /></div><div className="signal-row"><div className="signal-icon signal-warn"><ShieldAlert size={17} /></div><span>Tampering findings</span><b>{data?.tamperingFindings ?? '—'}</b></div><div className="signal-row"><div className="signal-icon signal-danger"><UserRoundCheck size={17} /></div><span>Face mismatches</span><b>{data?.faceMismatches ?? '—'}</b></div><div className="signal-note"><ArrowDownRight size={15} /> Counts are signals for authorized reviewers, not adjudications.</div></Card></div></QueryState>;
}

const defaultRecord: { documentNumber: string; name: string; nationality: string; status: typeof MockRecordInputStatus[keyof typeof MockRecordInputStatus]; expiry: string; notes: string } = { documentNumber: '', name: '', nationality: '', status: MockRecordInputStatus.VALID, expiry: '', notes: '' };
function SettingsPage() {
  const qc = useQueryClient();
  const rulesQuery = useGetRules();
  const recordsQuery = useListMockRecords();
  const updateRules = useUpdateRules();
  const createRecord = useCreateMockRecord();
  const updateRecord = useUpdateMockRecord();
  const deleteRecord = useDeleteMockRecord();
  const [rules, setRules] = useState<ScreeningRules | null>(null);
  const [recordForm, setRecordForm] = useState<typeof defaultRecord>(defaultRecord);
  const [editing, setEditing] = useState<number | null>(null);
  const [notice, setNotice] = useState('');
  const currentRules = rules ?? rulesQuery.data as ScreeningRules | undefined;
  const saveRules = () => { if (!currentRules) return; updateRules.mutate({ data: currentRules as ScreeningRulesInput }, { onSuccess: () => { setRules(currentRules); setNotice('Prototype rules saved.'); qc.invalidateQueries({ queryKey: getGetRulesQueryKey() }); } }); };
  const saveRecord = () => { const data = { ...recordForm, status: recordForm.status as MockRecordInputStatus }; const done = () => { setRecordForm(defaultRecord); setEditing(null); setNotice(editing ? 'Mock record updated.' : 'Mock record created.'); qc.invalidateQueries({ queryKey: getListMockRecordsQueryKey() }); }; if (editing) updateRecord.mutate({ id: editing, data }, { onSuccess: done }); else createRecord.mutate({ data }, { onSuccess: done }); };
  return <QueryState loading={rulesQuery.isLoading || recordsQuery.isLoading} error={rulesQuery.isError || recordsQuery.isError} retry={() => { rulesQuery.refetch(); recordsQuery.refetch(); }}><PageHeading eyebrow="Control plane · Settings" title="Tune the prototype." detail="Edit the rules that shape synthetic checks and maintain the demo verification register." action={<div className="case-status"><i /> Changes are local to the prototype</div>} /><div className="settings-grid"><Card><div className="card-head"><div><span className="section-kicker">Ruleset</span><h2>Screening rules</h2></div><SlidersHorizontal size={18} className="muted-icon" /></div>{currentRules && <div className="rules-form"><label className="field-label">Passport number format<input value={rules?.passportNumberFormat ?? currentRules.passportNumberFormat} onChange={(e) => setRules({ ...currentRules, passportNumberFormat: e.target.value })} data-testid="input-rule-passport-format" /></label><div className="three-fields"><label className="field-label">Minimum validity days<input type="number" value={rules?.minValidityDays ?? currentRules.minValidityDays} onChange={(e) => setRules({ ...currentRules, minValidityDays: Number(e.target.value) })} data-testid="input-rule-min-days" /></label><label className="field-label">Maximum years<input type="number" value={rules?.maxValidityYears ?? currentRules.maxValidityYears} onChange={(e) => setRules({ ...currentRules, maxValidityYears: Number(e.target.value) })} data-testid="input-rule-max-years" /></label><label className="field-label">Visa validity days<input type="number" value={rules?.visaValidityDays ?? currentRules.visaValidityDays ?? 0} onChange={(e) => setRules({ ...currentRules, visaValidityDays: Number(e.target.value) })} data-testid="input-rule-visa-days" /></label></div><div className="threshold-block"><span className="field-label">Risk thresholds</span><div className="three-fields"><label className="field-label"><small>Low max</small><input type="number" value={rules?.riskThresholds.lowMax ?? currentRules.riskThresholds.lowMax} onChange={(e) => setRules({ ...currentRules, riskThresholds: { ...currentRules.riskThresholds, lowMax: Number(e.target.value) } })} data-testid="input-rule-low-max" /></label><label className="field-label"><small>Medium max</small><input type="number" value={rules?.riskThresholds.mediumMax ?? currentRules.riskThresholds.mediumMax} onChange={(e) => setRules({ ...currentRules, riskThresholds: { ...currentRules.riskThresholds, mediumMax: Number(e.target.value) } })} data-testid="input-rule-medium-max" /></label><label className="field-label"><small>High max</small><input type="number" value={rules?.riskThresholds.highMax ?? currentRules.riskThresholds.highMax} onChange={(e) => setRules({ ...currentRules, riskThresholds: { ...currentRules.riskThresholds, highMax: Number(e.target.value) } })} data-testid="input-rule-high-max" /></label></div></div><label className="field-label">Required fields<input value={(rules?.requiredFields ?? currentRules.requiredFields).join(', ')} onChange={(e) => setRules({ ...currentRules, requiredFields: e.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} data-testid="input-rule-required-fields" /></label><Button onClick={saveRules} disabled={updateRules.isPending} data-testid="button-save-rules">{updateRules.isPending ? <Loader2 size={15} className="spin" /> : <Check size={15} />} Save rules</Button></div>}</Card><Card><div className="card-head"><div><span className="section-kicker">Demo database</span><h2>{editing ? 'Edit mock record' : 'Add mock record'}</h2></div><Database size={18} className="muted-icon" /></div><div className="record-form"><label className="field-label">Document number<input value={recordForm.documentNumber} onChange={(e) => setRecordForm({ ...recordForm, documentNumber: e.target.value })} data-testid="input-record-number" /></label><label className="field-label">Name<input value={recordForm.name} onChange={(e) => setRecordForm({ ...recordForm, name: e.target.value })} data-testid="input-record-name" /></label><div className="two-fields"><label className="field-label">Nationality<input value={recordForm.nationality} onChange={(e) => setRecordForm({ ...recordForm, nationality: e.target.value })} data-testid="input-record-nationality" /></label><label className="field-label">Expiry<input type="date" value={recordForm.expiry} onChange={(e) => setRecordForm({ ...recordForm, expiry: e.target.value })} data-testid="input-record-expiry" /></label></div><label className="field-label">Record status<select value={recordForm.status} onChange={(e) => setRecordForm({ ...recordForm, status: e.target.value as typeof MockRecordInputStatus[keyof typeof MockRecordInputStatus] })} data-testid="select-record-status">{Object.values(MockRecordInputStatus).map((status) => <option key={status} value={status}>{titleCase(status)}</option>)}</select></label><label className="field-label">Notes<textarea value={recordForm.notes} onChange={(e) => setRecordForm({ ...recordForm, notes: e.target.value })} rows={3} data-testid="input-record-notes" /></label><div className="form-actions"><Button variant="secondary" onClick={() => { setRecordForm(defaultRecord); setEditing(null); }} data-testid="button-clear-record">{editing ? 'Cancel edit' : 'Clear'}</Button><Button onClick={saveRecord} disabled={createRecord.isPending || updateRecord.isPending} data-testid="button-save-record">{editing ? <Pencil size={15} /> : <Plus size={15} />} {editing ? 'Update record' : 'Create record'}</Button></div></div></Card></div><Card className="records-card"><div className="card-head"><div><span className="section-kicker">Synthetic fixtures</span><h2>Demo database records</h2></div><span className="result-count">{recordsQuery.data?.length ?? 0} records</span></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Document</th><th>Name</th><th>Nationality</th><th>Status</th><th>Expiry</th><th>Notes</th><th /></tr></thead><tbody>{(recordsQuery.data as MockRecord[] ?? []).map((record) => <tr key={record.id} data-testid={`row-record-${record.id}`}><td className="mono">{mask(record.documentNumber)}</td><td>{record.name}</td><td>{record.nationality}</td><td><StatusBadge value={record.status} tone={record.status === 'VALID' ? 'low' : record.status === 'BLACKLISTED' ? 'high' : 'medium'} /></td><td>{record.expiry}</td><td className="notes-cell">{record.notes || '—'}</td><td><div className="row-actions"><button onClick={() => { setEditing(record.id); setRecordForm({ documentNumber: record.documentNumber, name: record.name, nationality: record.nationality, status: record.status as typeof MockRecordInputStatus[keyof typeof MockRecordInputStatus], expiry: record.expiry, notes: record.notes }); }} aria-label={`Edit ${record.name}`} data-testid={`button-edit-record-${record.id}`}><Pencil size={15} /></button><button onClick={() => { if (window.confirm(`Delete ${record.name}?`)) deleteRecord.mutate({ id: record.id }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListMockRecordsQueryKey() }) }); }} aria-label={`Delete ${record.name}`} data-testid={`button-delete-record-${record.id}`}><Trash2 size={15} /></button></div></td></tr>)}</tbody></table></div></Card>{notice && <div className="inline-notice" data-testid="status-settings-notice"><CheckCircle2 size={15} />{notice}<button onClick={() => setNotice('')} aria-label="Dismiss notice" data-testid="button-dismiss-settings-notice"><X size={14} /></button></div>}</QueryState>;
}

function Router() {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}><Shell><Switch><Route path="/" component={Overview} /><Route path="/screening/new" component={NewScreening} /><Route path="/screening/:id" component={() => { const { id } = useParams<{ id: string }>(); return <Report id={Number(id)} />; }} /><Route path="/history" component={HistoryPage} /><Route path="/analytics" component={AnalyticsPage} /><Route path="/settings" component={SettingsPage} /><Route component={NotFound} /></Switch></Shell></ErrorBoundary>;
}

function App() { return <QueryClientProvider client={queryClient}><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter></QueryClientProvider>; }
export default App;