import { Link } from 'wouter';
import {
  Activity, AlertTriangle, ArrowRight, Check,
  CheckCircle2, Download, FileText, LockKeyhole,
} from 'lucide-react';
import {
  ResultStatus,
  getGetScreeningQueryKey,
  useGetScreening,
} from '@workspace/api-client-react';
import type { ScreeningDetail } from '@workspace/api-client-react';
import { QueryState } from '@/components/shared';
import { cx, fmtDate, fmtMs, mask, pct, riskRingClass, titleCase } from '@/lib/utils';

// ── PDF export ──────────────────────────────────────────────────────────────

function escapePdf(v: string) {
  return v.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/[^\x20-\x7E]/g, ' ');
}

function downloadPdf(d: ScreeningDetail) {
  const lines = [
    'AI-Based Identity Document Screening System',
    'ACADEMIC PROTOTYPE — SYNTHETIC DATA ONLY',
    '',
    `Screening ID  : ${d.screeningId}`,
    `Processed     : ${fmtDate(d.createdAt)}`,
    `Document      : ${d.documentType} / ${d.documentNumber}`,
    `Nationality   : ${d.nationality}`,
    `Risk          : ${d.riskScore}/100 (${d.riskLevel})`,
    `Recommendation: ${d.recommendation}`,
    '',
    `OCR confidence   : ${pct(d.ocrConfidence)}`,
    `Validation       : ${d.validationStatus}`,
    `Tampering        : ${d.tamperingStatus}`,
    `Face verification: ${d.face.result} (${pct(d.face.similarity)} similarity)`,
    '',
    'Risk factors:',
    ...d.riskFactors.map(f => `  +${f.points}  ${f.label}  [${f.category}]`),
    '',
    'Prototype disclaimer:',
    d.prototypeDisclaimer,
  ];
  const content = [
    'BT', '/F1 11 Tf', '50 760 Td',
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
  objects.forEach((obj, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach(o => { pdf += `${String(o).padStart(10, '0')} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const url = URL.createObjectURL(new Blob([pdf], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url; a.download = `${d.screeningId}-report.pdf`; a.click();
  URL.revokeObjectURL(url);
}

// ── Component ───────────────────────────────────────────────────────────────

export default function Report({ id }: { id: number }) {
  const q = useGetScreening(id, { query: { queryKey: getGetScreeningQueryKey(id) } });
  const d = q.data as ScreeningDetail | undefined;

  return (
    <QueryState loading={q.isLoading} error={q.isError} retry={q.refetch}>
      {d && (
        <div>
          {/* Heading */}
          <div className="page-heading fade-up">
            <div>
              <div className="page-eyebrow">{`Report · ${d.screeningId}`}</div>
              <h1>Inspect the evidence.</h1>
              <p>{`${d.fileName} · processed ${fmtDate(d.createdAt)}`}</p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" onClick={() => window.print()}>
                <FileText size={14} /> Print
              </button>
              <button className="btn btn-secondary" onClick={() => downloadPdf(d)}>
                <Download size={14} /> Download
              </button>
            </div>
          </div>

          {/* Hero band */}
          <div className={cx('report-hero', 'fade-up')}>
            <div>
              <div className="report-hero-kicker">Screening result</div>
              <span className="report-hero-id">{d.screeningId}</span>
              <div className="report-hero-meta">
                {d.documentType} · {mask(d.documentNumber)} · {d.nationality}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div className={cx('risk-ring-hero', riskRingClass(d.riskScore))}>
                <strong>{d.riskScore}</strong>
                <small>/ 100</small>
              </div>
              <div className="risk-label-wrap">
                <span>Risk level</span>
                <span className={cx('badge', `badge-${d.riskLevel.toLowerCase()}`)}>{d.riskLevel}</span>
                <p className="risk-recommendation">{titleCase(d.recommendation)}</p>
              </div>
            </div>

            <div className="report-disclaimer">
              <AlertTriangle size={14} />
              <span>{d.prototypeDisclaimer}</span>
            </div>
          </div>

          {/* 4-card grid */}
          <div className="report-grid" style={{ marginBottom: 14 }}>

            {/* 01 OCR */}
            <div className="card card-pad fade-up delay-1">
              <div className="card-head">
                <div>
                  <div className="card-kicker">01 · OCR extraction</div>
                  <h2>Extracted fields</h2>
                </div>
                <span className={cx('badge', `badge-${d.ocrStatus.toLowerCase()}`)}>{d.ocrStatus}</span>
              </div>
              <div className="ocr-confidence">
                <span>OCR confidence</span>
                <b>{pct(d.ocrConfidence)}</b>
              </div>
              <div className="field-grid">
                {d.extractedFields.map((f, i) => (
                  <div className="field-cell" key={`${f.label}-${i}`}>
                    <div className="field-cell-key">{f.label}</div>
                    <div className="field-cell-val">{f.value || 'Not found'}</div>
                    <span className="field-cell-conf">{pct(f.confidence)} · {f.source}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 02 Validation */}
            <div className="card card-pad fade-up delay-1">
              <div className="card-head">
                <div>
                  <div className="card-kicker">02 · Validation</div>
                  <h2>Rule checks</h2>
                </div>
                <span className={cx('badge', `badge-${d.validationStatus.toLowerCase().replace(/ /g, '-')}`)}>
                  {d.validationStatus}
                </span>
              </div>
              <div className="check-list">
                {d.validationChecks.map((c, i) => (
                  <div className="check-row" key={`${c.label}-${i}`}>
                    <div className={cx(
                      'check-icon',
                      c.status === ResultStatus.PASS ? 'check-pass'
                        : c.status === ResultStatus.WARNING ? 'check-warn'
                        : 'check-fail',
                    )}>
                      {c.status === ResultStatus.PASS ? <Check size={13} /> : <AlertTriangle size={13} />}
                    </div>
                    <div className="check-content">
                      <strong>{c.label}</strong>
                      <small>{c.detail}</small>
                    </div>
                    <span className={cx('badge', `badge-${c.status.toLowerCase().replace(/ /g, '-')}`)}>{c.status}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 03 Tampering */}
            <div className="card card-pad fade-up delay-2">
              <div className="card-head">
                <div>
                  <div className="card-kicker">03 · Integrity</div>
                  <h2>Tampering analysis</h2>
                </div>
                <span className={cx('badge', `badge-${d.tamperingStatus.toLowerCase()}`)}>{d.tamperingStatus}</span>
              </div>
              {d.tamperingFindings.some(f => f.status === 'SUSPICIOUS') ? (
                <div>
                  {d.tamperingFindings.map((f, i) => (
                    <div className="finding-row" key={`${f.region}-${i}`}>
                      <div className="finding-icon"><AlertTriangle size={14} /></div>
                      <div className="finding-content">
                        <strong>{f.type} <small>· {f.region}</small></strong>
                        <p>{f.explanation}</p>
                        <span>Confidence {pct(f.confidence)}</span>
                      </div>
                      <span className={cx('badge', `badge-${f.status.toLowerCase()}`)}>{f.status}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="finding-pass">
                  <CheckCircle2 size={16} />
                  <span>No tampering findings for this document.</span>
                </div>
              )}
            </div>

            {/* 04 Face */}
            <div className="card card-pad fade-up delay-2">
              <div className="card-head">
                <div>
                  <div className="card-kicker">04 · Face comparison</div>
                  <h2>Identity similarity</h2>
                </div>
                <span className={cx('badge', `badge-${d.face.result.toLowerCase().replace(/ /g, '-')}`)}>
                  {d.face.result}
                </span>
              </div>
              <div className="face-summary">
                <div className="face-score">
                  <strong>{pct(d.face.similarity)}</strong>
                  <span>Similarity</span>
                </div>
                <div className="face-bars">
                  {[
                    { label: 'Document face', on: d.face.documentFaceDetected },
                    { label: 'Person image',  on: d.face.personFaceDetected },
                  ].map(row => (
                    <div className="face-bar-row" key={row.label}>
                      <span>{row.label}</span>
                      <div className="face-bar-track">
                        <div className="face-bar-fill" style={{ width: row.on ? '100%' : '0%' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="face-note">{d.face.note}</div>
            </div>
          </div>

          {/* Lower: risk factors + metadata */}
          <div className="report-lower">

            {/* Risk factors */}
            <div className="card card-pad fade-up delay-3">
              <div className="card-head">
                <div>
                  <div className="card-kicker">Explainability</div>
                  <h2>Risk factors</h2>
                </div>
                <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--brand)' }}>
                  Total {d.riskScore} pts
                </span>
              </div>
              <div className="risk-factors">
                {d.riskFactors.map((f, i) => (
                  <div className="factor-row" key={`${f.label}-${i}`}>
                    <span className={cx('factor-tag', `factor-${f.category.toLowerCase()}`)}>
                      {f.category.slice(0, 3)}
                    </span>
                    <span style={{ flex: 1 }}>{f.label}</span>
                    <span className="factor-score">+{f.points}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Metadata */}
            <div className="card card-pad fade-up delay-3">
              <div className="card-head">
                <div>
                  <div className="card-kicker">Processing metadata</div>
                  <h2>Trace details</h2>
                </div>
                <Activity size={16} style={{ color: 'var(--text-tertiary)' }} />
              </div>
              <div className="meta-grid">
                {Object.entries(d.metadata).map(([k, v]) => (
                  <div className="meta-cell" key={k}>
                    <div className="meta-key">{titleCase(k)}</div>
                    <div className="meta-val">{v}</div>
                  </div>
                ))}
                <div className="meta-cell">
                  <div className="meta-key">Processing time</div>
                  <div className="meta-val">{fmtMs(d.processingTimeMs)}</div>
                </div>
                <div className="meta-cell">
                  <div className="meta-key">Recommendation</div>
                  <div className="meta-val">{titleCase(d.recommendation)}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer strip */}
          <div className="notice-strip" style={{ marginTop: 14 }}>
            <div className="notice-strip-content">
              <LockKeyhole size={14} />
              <span>
                This report is a prototype aid for authorised review. Do not use it as a sole basis for action.
              </span>
            </div>
            <Link href="/history" className="text-link">
              Back to history <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      )}
    </QueryState>
  );
}
