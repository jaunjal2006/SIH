import { useState } from 'react';
import {
  Check, Database, Loader2, Pencil, Plus,
  SlidersHorizontal, Trash2, X,
} from 'lucide-react';
import {
  MockRecordInputStatus,
  getGetRulesQueryKey, getListMockRecordsQueryKey,
  useCreateMockRecord, useDeleteMockRecord, useGetRules,
  useListMockRecords, useUpdateMockRecord, useUpdateRules,
} from '@workspace/api-client-react';
import type { MockRecord, ScreeningRules, ScreeningRulesInput } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { QueryState } from '@/components/shared';
import { cx, mask, titleCase } from '@/lib/utils';

// ── types ──────────────────────────────────────────────────────────────────

type RecordForm = {
  documentNumber: string; name: string; nationality: string;
  status: typeof MockRecordInputStatus[keyof typeof MockRecordInputStatus];
  expiry: string; notes: string;
};

const EMPTY_RECORD: RecordForm = {
  documentNumber: '', name: '', nationality: '',
  status: MockRecordInputStatus.VALID, expiry: '', notes: '',
};

// ── page ───────────────────────────────────────────────────────────────────

export default function Settings() {
  const qc = useQueryClient();

  const rulesQ   = useGetRules();
  const recordsQ = useListMockRecords();

  const updateRules  = useUpdateRules();
  const createRecord = useCreateMockRecord();
  const updateRecord = useUpdateMockRecord();
  const deleteRecord = useDeleteMockRecord();

  // local rules edits (null = use server value)
  const [rulesEdits, setRulesEdits] = useState<ScreeningRules | null>(null);
  const [recordForm, setRecordForm] = useState<RecordForm>(EMPTY_RECORD);
  const [editing,    setEditing]    = useState<number | null>(null);
  const [notice,     setNotice]     = useState('');
  const [noticeKind, setNoticeKind] = useState<'success' | 'error'>('success');

  const liveRules = rulesEdits ?? (rulesQ.data as ScreeningRules | undefined);

  const saveRules = () => {
    if (!liveRules) return;
    updateRules.mutate(
      { data: liveRules as ScreeningRulesInput },
      {
        onSuccess: () => {
          setRulesEdits(liveRules);
          setNoticeKind('success');
          setNotice('Screening rules saved.');
          qc.invalidateQueries({ queryKey: getGetRulesQueryKey() });
        },
        onError: () => { setNoticeKind('error'); setNotice('Failed to save rules.'); },
      },
    );
  };

  const saveRecord = () => {
    const done = () => {
      setRecordForm(EMPTY_RECORD);
      setEditing(null);
      setNoticeKind('success');
      setNotice(editing ? 'Record updated.' : 'Record created.');
      qc.invalidateQueries({ queryKey: getListMockRecordsQueryKey() });
    };
    if (editing) {
      updateRecord.mutate({ id: editing, data: recordForm }, { onSuccess: done });
    } else {
      createRecord.mutate({ data: recordForm }, { onSuccess: done });
    }
  };

  const startEdit = (r: MockRecord) => {
    setEditing(r.id);
    setRecordForm({
      documentNumber: r.documentNumber, name: r.name,
      nationality: r.nationality,
      status: r.status as typeof MockRecordInputStatus[keyof typeof MockRecordInputStatus],
      expiry: r.expiry, notes: r.notes,
    });
  };

  const confirmDelete = (r: MockRecord) => {
    if (!window.confirm(`Delete record for ${r.name}?`)) return;
    deleteRecord.mutate(
      { id: r.id },
      { onSuccess: () => qc.invalidateQueries({ queryKey: getListMockRecordsQueryKey() }) },
    );
  };

  return (
    <QueryState
      loading={rulesQ.isLoading || recordsQ.isLoading}
      error={rulesQ.isError || recordsQ.isError}
      retry={() => { rulesQ.refetch(); recordsQ.refetch(); }}
    >
      {/* Heading */}
      <div className="page-heading fade-up">
        <div>
          <div className="page-eyebrow">Control plane · Settings</div>
          <h1>Tune the prototype.</h1>
          <p>Edit screening rules and maintain the demo verification database.</p>
        </div>
        <div className="case-ready-badge">
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--amber)', display: 'inline-block' }} />
          Changes apply immediately
        </div>
      </div>

      {/* Top grid: rules + record form */}
      <div className="settings-grid">

        {/* ── Screening rules ── */}
        <div className="card card-pad fade-up delay-1">
          <div className="card-head">
            <div>
              <div className="card-kicker">Ruleset</div>
              <h2>Screening rules</h2>
            </div>
            <SlidersHorizontal size={16} style={{ color: 'var(--text-tertiary)' }} />
          </div>

          {liveRules && (
            <div className="form-grid">
              <div className="field">
                <label className="field-label">Passport number format (regex)</label>
                <input
                  value={rulesEdits?.passportNumberFormat ?? liveRules.passportNumberFormat}
                  onChange={e => setRulesEdits({ ...liveRules, passportNumberFormat: e.target.value })}
                />
              </div>

              <div className="field-3col">
                <div className="field">
                  <label className="field-label">Min validity days</label>
                  <input type="number"
                    value={rulesEdits?.minValidityDays ?? liveRules.minValidityDays}
                    onChange={e => setRulesEdits({ ...liveRules, minValidityDays: Number(e.target.value) })}
                  />
                </div>
                <div className="field">
                  <label className="field-label">Max validity years</label>
                  <input type="number"
                    value={rulesEdits?.maxValidityYears ?? liveRules.maxValidityYears}
                    onChange={e => setRulesEdits({ ...liveRules, maxValidityYears: Number(e.target.value) })}
                  />
                </div>
                <div className="field">
                  <label className="field-label">Visa validity days</label>
                  <input type="number"
                    value={rulesEdits?.visaValidityDays ?? liveRules.visaValidityDays ?? 180}
                    onChange={e => setRulesEdits({ ...liveRules, visaValidityDays: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="threshold-section">
                <div className="threshold-label">Risk score thresholds</div>
                <div className="field-3col">
                  {(['lowMax', 'mediumMax', 'highMax'] as const).map(key => (
                    <div className="field" key={key}>
                      <label className="field-label">{titleCase(key)}</label>
                      <input type="number"
                        value={rulesEdits?.riskThresholds[key] ?? liveRules.riskThresholds[key]}
                        onChange={e => setRulesEdits({
                          ...liveRules,
                          riskThresholds: { ...liveRules.riskThresholds, [key]: Number(e.target.value) },
                        })}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="field">
                <label className="field-label">Required fields (comma-separated)</label>
                <input
                  value={(rulesEdits?.requiredFields ?? liveRules.requiredFields).join(', ')}
                  onChange={e => setRulesEdits({
                    ...liveRules,
                    requiredFields: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
                  })}
                />
              </div>

              <button
                className="btn btn-primary"
                style={{ alignSelf: 'flex-start' }}
                onClick={saveRules}
                disabled={updateRules.isPending}
              >
                {updateRules.isPending
                  ? <><Loader2 size={14} className="spin" /> Saving…</>
                  : <><Check size={14} /> Save rules</>
                }
              </button>
            </div>
          )}
        </div>

        {/* ── Mock record form ── */}
        <div className="card card-pad fade-up delay-1">
          <div className="card-head">
            <div>
              <div className="card-kicker">Demo database</div>
              <h2>{editing ? 'Edit record' : 'Add mock record'}</h2>
            </div>
            <Database size={16} style={{ color: 'var(--text-tertiary)' }} />
          </div>

          <div className="form-grid">
            <div className="field">
              <label className="field-label">Document number</label>
              <input value={recordForm.documentNumber}
                onChange={e => setRecordForm({ ...recordForm, documentNumber: e.target.value })} />
            </div>
            <div className="field">
              <label className="field-label">Name</label>
              <input value={recordForm.name}
                onChange={e => setRecordForm({ ...recordForm, name: e.target.value })} />
            </div>
            <div className="field-2col">
              <div className="field">
                <label className="field-label">Nationality (ISO-3)</label>
                <input value={recordForm.nationality}
                  onChange={e => setRecordForm({ ...recordForm, nationality: e.target.value })} />
              </div>
              <div className="field">
                <label className="field-label">Expiry date</label>
                <input type="date" value={recordForm.expiry}
                  onChange={e => setRecordForm({ ...recordForm, expiry: e.target.value })} />
              </div>
            </div>
            <div className="field">
              <label className="field-label">Record status</label>
              <select
                value={recordForm.status}
                onChange={e => setRecordForm({
                  ...recordForm,
                  status: e.target.value as typeof MockRecordInputStatus[keyof typeof MockRecordInputStatus],
                })}
              >
                {Object.values(MockRecordInputStatus).map(s => (
                  <option key={s} value={s}>{titleCase(s)}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="field-label">Notes</label>
              <textarea rows={3} value={recordForm.notes}
                onChange={e => setRecordForm({ ...recordForm, notes: e.target.value })} />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" onClick={() => { setRecordForm(EMPTY_RECORD); setEditing(null); }}>
                {editing ? <><X size={13} /> Cancel</> : 'Clear'}
              </button>
              <button
                className="btn btn-primary"
                onClick={saveRecord}
                disabled={createRecord.isPending || updateRecord.isPending}
              >
                {editing ? <><Pencil size={13} /> Update</> : <><Plus size={13} /> Create record</>}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Notice */}
      {notice && (
        <div
          className={noticeKind === 'success' ? 'save-notice' : 'inline-alert'}
          style={{ marginBottom: 14 }}
        >
          {noticeKind === 'success' ? <Check size={14} /> : <X size={14} />}
          <span>{notice}</span>
          <button onClick={() => setNotice('')} aria-label="Dismiss"><X size={13} /></button>
        </div>
      )}

      {/* Mock records table */}
      <div className="card card-pad fade-up delay-2">
        <div className="card-head">
          <div>
            <div className="card-kicker">Synthetic fixtures</div>
            <h2>Demo database records</h2>
          </div>
          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
            {recordsQ.data?.length ?? 0} records
          </span>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Document #</th><th>Name</th><th>Nationality</th>
                <th>Status</th><th>Expiry</th><th>Notes</th><th />
              </tr>
            </thead>
            <tbody>
              {((recordsQ.data ?? []) as MockRecord[]).map(r => (
                <tr key={r.id}>
                  <td className="cell-mono">{mask(r.documentNumber)}</td>
                  <td>{r.name}</td>
                  <td>{r.nationality}</td>
                  <td>
                    <span className={cx(
                      'badge',
                      r.status === 'VALID'       ? 'badge-valid'
                      : r.status === 'BLACKLISTED' ? 'badge-blacklisted'
                      : r.status === 'SUSPENDED'   ? 'badge-suspended'
                      : 'badge-expired',
                    )}>{r.status}</span>
                  </td>
                  <td className="cell-date">{r.expiry}</td>
                  <td className="notes-cell">{r.notes || '—'}</td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="row-action-btn"
                        onClick={() => startEdit(r)}
                        aria-label={`Edit ${r.name}`}
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        className="row-action-btn danger"
                        onClick={() => confirmDelete(r)}
                        aria-label={`Delete ${r.name}`}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </QueryState>
  );
}
