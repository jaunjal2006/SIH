import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import {
  AlertTriangle, ArrowRight, Database, Loader2,
  ShieldCheck, SlidersHorizontal, UploadCloud, X,
} from 'lucide-react';
import {
  DocumentType, DemoCaseInputScenario,
  getGetDashboardSummaryQueryKey, getListScreeningsQueryKey,
  useCreateScreening, useLoadDemoCase,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { cx } from '@/lib/utils';

export default function NewScreening() {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();

  const [docType, setDocType]       = useState<string>(DocumentType.Passport);
  const [docNumber, setDocNumber]   = useState('');
  const [nationality, setNationality] = useState('');
  const [fileName, setFileName]     = useState('');
  const [person, setPerson]         = useState(true);
  const [scenario, setScenario]     = useState('valid');
  const [notice, setNotice]         = useState('');

  const create = useCreateScreening();
  const demo   = useLoadDemoCase();

  const run = () => {
    create.mutate(
      {
        data: {
          documentType: docType as typeof DocumentType[keyof typeof DocumentType],
          documentNumber:   docNumber   || undefined,
          nationality:      nationality || undefined,
          fileName:         fileName    || undefined,
          personImageProvided: person,
          scenario: scenario as 'valid' | 'expired' | 'tampered' | 'mismatch' | 'blacklisted',
        },
      },
      {
        onSuccess: (detail) => {
          qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          qc.invalidateQueries({ queryKey: getListScreeningsQueryKey() });
          setLocation(`/screening/${detail.id}`);
        },
        onError: () => setNotice('Screening could not be completed. Check the API connection.'),
      },
    );
  };

  const loadDemo = () => {
    demo.mutate(
      { data: { scenario: scenario as typeof DemoCaseInputScenario[keyof typeof DemoCaseInputScenario] } },
      {
        onSuccess: (detail) => {
          setDocNumber(detail.documentNumber);
          setNationality(detail.nationality);
          setFileName(detail.fileName);
          setNotice('Demo case loaded — review inputs, then run the screening.');
        },
        onError: () => setNotice('Demo case unavailable right now.'),
      },
    );
  };

  return (
    <div>
      {/* Heading */}
      <div className="page-heading fade-up">
        <div>
          <div className="page-eyebrow">Intake · New case</div>
          <h1>Start a screening.</h1>
          <p>
            Provide the synthetic document context below. The processor returns an
            inspectable report, not an automated decision.
          </p>
        </div>
        <div className="case-ready-badge">
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} />
          Ready for input
        </div>
      </div>

      {/* Workflow rail */}
      <div className="workflow-rail">
        <div className="workflow-step wf-active">
          <div className="workflow-step-num">01</div>
          <span>Document context</span>
        </div>
        <div className="workflow-line" />
        <div className="workflow-step">
          <div className="workflow-step-num">02</div>
          <span>Processing</span>
        </div>
        <div className="workflow-line" />
        <div className="workflow-step">
          <div className="workflow-step-num">03</div>
          <span>Review report</span>
        </div>
      </div>

      {/* Grid */}
      <div className="intake-grid">

        {/* Main form */}
        <div className="card card-pad">
          <div className="card-head">
            <div>
              <div className="card-kicker">Synthetic input</div>
              <h2>Document context</h2>
            </div>
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
              All fields optional
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 8 }}>
            {/* Document type */}
            <div className="field">
              <label className="field-label">Document type</label>
              <select value={docType} onChange={e => setDocType(e.target.value)}>
                {Object.values(DocumentType).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            {/* Number + Nationality */}
            <div className="field-2col">
              <div className="field">
                <label className="field-label">Document number</label>
                <input
                  value={docNumber}
                  onChange={e => setDocNumber(e.target.value)}
                  placeholder="e.g. P10293847"
                />
              </div>
              <div className="field">
                <label className="field-label">Nationality (ISO-3)</label>
                <input
                  value={nationality}
                  onChange={e => setNationality(e.target.value)}
                  placeholder="e.g. IND"
                />
              </div>
            </div>

            {/* File upload */}
            <div className="field">
              <label className="field-label">Document image / file</label>
              <div className="upload-zone">
                <UploadCloud size={22} />
                <span style={{ fontSize: 12 }}>{fileName || 'Drop a synthetic document here'}</span>
                <small>PNG, JPG or PDF · prototype only</small>
                <input
                  type="file"
                  accept=".png,.jpg,.jpeg,.pdf"
                  onChange={e => setFileName(e.target.files?.[0]?.name ?? '')}
                />
              </div>
            </div>

            {/* Person image toggle */}
            <div className="toggle-row">
              <div className="toggle-row-label">
                <strong>Person image available</strong>
                <small>Include a synthetic face image for comparison</small>
              </div>
              <button
                type="button"
                className={cx('toggle', person && 'on')}
                onClick={() => setPerson(v => !v)}
                aria-label="Toggle person image"
              >
                <div className="toggle-thumb" />
              </button>
            </div>
          </div>

          <div className="form-actions">
            <Link href="/" className="btn btn-secondary">
              <X size={14} /> Cancel
            </Link>
            <button className="btn btn-primary" onClick={run} disabled={create.isPending}>
              {create.isPending
                ? <><Loader2 size={14} className="spin" /> Processing…</>
                : <><ShieldCheck size={14} /> Run screening <ArrowRight size={14} /></>
              }
            </button>
          </div>
        </div>

        {/* Demo shortcut card */}
        <div className="card card-pad">
          <div className="card-head">
            <div>
              <div className="card-kicker">Shortcuts</div>
              <h2>Load a demo case</h2>
            </div>
            <SlidersHorizontal size={17} style={{ color: 'var(--text-tertiary)' }} />
          </div>

          <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '14px 0 18px' }}>
            Use a pre-configured synthetic scenario to exercise a specific review signal.
            The demo fills the form — you still trigger the run manually.
          </p>

          <div className="field" style={{ marginBottom: 14 }}>
            <label className="field-label">Scenario</label>
            <select value={scenario} onChange={e => setScenario(e.target.value)}>
              <option value="valid">Valid document</option>
              <option value="expired">Expired document</option>
              <option value="tampered">Tampering findings</option>
              <option value="mismatch">Face mismatch</option>
              <option value="blacklisted">Blacklisted record</option>
            </select>
          </div>

          <button
            className="btn btn-secondary btn-full"
            onClick={loadDemo}
            disabled={demo.isPending}
          >
            {demo.isPending
              ? <><Loader2 size={14} className="spin" /> Loading…</>
              : <><Database size={14} /> Load scenario</>
            }
          </button>

          <div className="demo-hint-box">
            <AlertTriangle size={14} />
            <span>
              Demo cases are synthetic fixtures — they never represent a real person or document.
            </span>
          </div>
        </div>
      </div>

      {/* Inline alert */}
      {notice && (
        <div className="inline-alert" style={{ maxWidth: 1050, marginTop: 14 }}>
          <AlertTriangle size={14} />
          <span>{notice}</span>
          <button onClick={() => setNotice('')} aria-label="Dismiss"><X size={13} /></button>
        </div>
      )}
    </div>
  );
}
