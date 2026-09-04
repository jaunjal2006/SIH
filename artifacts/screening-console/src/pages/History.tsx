import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import {
  ArrowRight, ChevronDown, FileText, Filter, Plus, Search,
} from 'lucide-react';
import {
  DocumentType, RiskLevel,
  useListScreenings,
} from '@workspace/api-client-react';
import type { Screening } from '@workspace/api-client-react';
import { QueryState } from '@/components/shared';
import { cx, fmtDate, mask, riskClass, titleCase } from '@/lib/utils';

export default function History() {
  const [search, setSearch] = useState('');
  const [risk,   setRisk]   = useState('');
  const [type,   setType]   = useState('');

  const params = useMemo(() => ({
    search:       search || undefined,
    risk:         (risk || undefined) as typeof RiskLevel[keyof typeof RiskLevel] | undefined,
    documentType: (type || undefined) as typeof DocumentType[keyof typeof DocumentType] | undefined,
    limit: 100,
  }), [search, risk, type]);

  const q = useListScreenings(params);
  const rows = (q.data ?? []) as Screening[];

  return (
    <QueryState loading={q.isLoading} error={q.isError} empty={!rows.length} retry={q.refetch}>
      {/* Heading */}
      <div className="page-heading fade-up">
        <div>
          <div className="page-eyebrow">Register · Screening history</div>
          <h1>Every case, traceable.</h1>
          <p>Search the screening register by ID, document number, or risk level.</p>
        </div>
        <Link href="/screening/new" className="btn btn-primary">
          <Plus size={14} /> New screening
        </Link>
      </div>

      {/* Table card */}
      <div className="card card-pad fade-up delay-1">
        {/* Filters */}
        <div className="filter-bar">
          <div className="search-input-wrap">
            <Search size={15} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search screening ID or document number…"
            />
          </div>

          <div className="filter-select-wrap">
            <Filter size={13} />
            <select value={risk} onChange={e => setRisk(e.target.value)}>
              <option value="">All risk levels</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
            <ChevronDown size={12} />
          </div>

          <div className="filter-select-wrap">
            <FileText size={13} />
            <select value={type} onChange={e => setType(e.target.value)}>
              <option value="">All document types</option>
              {Object.values(DocumentType).map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <ChevronDown size={12} />
          </div>

          <span className="filter-count">{rows.length} records</span>
        </div>

        {/* Table */}
        {rows.length === 0 ? (
          <div className="table-empty">No records match the current filters.</div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Screening ID</th>
                  <th>Document</th>
                  <th>Nationality</th>
                  <th>Risk score</th>
                  <th>Status</th>
                  <th>Recommendation</th>
                  <th>Created</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
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
                      <span className={cx('badge', `badge-${row.status.toLowerCase()}`)}>
                        {row.status}
                      </span>
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--text-secondary)', maxWidth: 200 }}>
                      {titleCase(row.recommendation)}
                    </td>
                    <td className="cell-date">{fmtDate(row.createdAt)}</td>
                    <td>
                      <Link
                        href={`/screening/${row.id}`}
                        className="row-btn"
                        aria-label={`Open ${row.screeningId}`}
                      >
                        <ArrowRight size={14} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </QueryState>
  );
}
