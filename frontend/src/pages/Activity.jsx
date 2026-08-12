import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScrollText, Download, RotateCcw, ChevronRight } from 'lucide-react';
import { api, downloadCSV } from '../api.js';
import { Card, Chip, Empty, ErrorNote, Field, PageHead, Spinner } from '../ui.jsx';
import { useLoad } from '../hooks.js';
import { fmtDate, fmtAgo, initials, ROLE, today } from '../format.js';

const ENTITIES = [['', 'Everything'], ['borrower', 'Borrowers'], ['drawdown', 'Drawdowns'], ['payment', 'Payments'],
  ['document', 'Documents'], ['user', 'Accounts & sign-ins'], ['system', 'System']];

/* action prefix → chip treatment, so a deletion never reads like a create */
const TONE = (action) => {
  if (/delete|reject|failed|reset$/.test(action)) return 'chip-bad';
  if (/create|approve|upload/.test(action)) return 'chip-good';
  if (/update|limit|rotate|password|revoke/.test(action)) return 'chip-warn';
  if (/login|logout/.test(action)) return 'chip-cyan';
  return 'chip-slate';
};

export default function Activity() {
  const nav = useNavigate();
  const [entity, setEntity] = useState('');
  const [limit, setLimit] = useState(100);
  const { data: users } = useLoad(() => api.users(), []);
  const [userId, setUserId] = useState('');

  const { data, error, loading, reload } = useLoad(() => api.audit({ entity, userId, limit }), [entity, userId, limit]);
  const rows = data?.rows || [];
  const active = entity || userId;

  const exportCSV = () => {
    downloadCSV('valuefin_activity_' + today() + '.csv',
      ['When', 'User', 'Role', 'Action', 'Entity', 'Entity id', 'Summary', 'IP'],
      rows.map((r) => [r.createdAt, r.userName, r.role, r.action, r.entity, r.entityId || '', r.summary, r.ip || '']));
  };

  const goTo = (r) => {
    if (r.entity === 'borrower' && r.entityId && !/delete/.test(r.action)) nav('/borrowers/' + r.entityId);
    else if (r.entity === 'document') nav('/documents');
    else if (r.entity === 'user') nav('/team');
  };

  return (
    <div className="space-y-5">
      <PageHead icon={ScrollText} title="Activity"
        subtitle="Append-only trail of every state change on the desk — who did it, to what, and when. Nothing here can be edited.">
        <button className="btn" onClick={exportCSV} disabled={!rows.length}><Download size={15} /> Export CSV</button>
      </PageHead>

      <Card>
        <div className="mb-4 grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Area">
            <select className="inp" value={entity} onChange={(e) => setEntity(e.target.value)}>
              {ENTITIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <Field label="By member">
            <select className="inp" value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="">Everyone</option>
              {(users || []).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
          <Field label="Show">
            <select className="inp" value={limit} onChange={(e) => setLimit(+e.target.value)}>
              {[50, 100, 250, 500].map((n) => <option key={n} value={n}>Latest {n}</option>)}
            </select>
          </Field>
          <div className="flex items-center gap-3 pb-0.5">
            {active && <button className="btn btn-xs" onClick={() => { setEntity(''); setUserId(''); }}><RotateCcw size={12} /> Clear</button>}
            {loading && <Spinner className="text-slate-500" />}
            {data && <span className="text-[11px] text-slate-500">{rows.length} of {data.total} entries</span>}
          </div>
        </div>

        {error ? <ErrorNote onRetry={reload}>{error}</ErrorNote> : !rows.length && !loading ? (
          <Empty icon={ScrollText} title="Nothing logged yet">Every create, edit, approval and deletion will show up here.</Empty>
        ) : (
          <ol className="relative space-y-1 border-l border-white/10 pl-0">
            {rows.map((r) => (
              <li key={r.id} className="relative">
                <button onClick={() => goTo(r)}
                  className="group flex w-full items-start gap-3 rounded-r-xl py-2.5 pl-5 pr-3 text-left transition hover:bg-white/[.04]">
                  <span className="absolute -left-[5px] top-[18px] h-2.5 w-2.5 rounded-full border-2 border-ink-900 bg-white/25 group-hover:bg-neon-violet" />
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/[.07] font-display text-[10px] font-bold text-slate-300">
                    {initials(r.userName)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <Chip cls={TONE(r.action)}>{r.action}</Chip>
                      <span className="text-[13px] text-slate-200">{r.summary}</span>
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-600">
                      <span>{r.userName}{r.role ? ' · ' + (ROLE[r.role]?.label || r.role) : ''}</span>
                      <span title={fmtDate(r.createdAt, true)}>{fmtAgo(r.createdAt)}</span>
                      {r.ip && <span className="font-mono">{r.ip}</span>}
                      {r.detail && <span className="font-mono opacity-70">{compact(r.detail)}</span>}
                    </span>
                  </span>
                  <ChevronRight size={14} className="mt-1 shrink-0 text-slate-700 group-hover:text-slate-400" />
                </button>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}

/* one-line rendering of the JSON detail column */
function compact(detail) {
  try {
    const flat = (o, prefix = '') => Object.entries(o).flatMap(([k, v]) =>
      v && typeof v === 'object' && !Array.isArray(v) ? flat(v, prefix + k + '.') : [prefix + k + '=' + v]);
    return flat(detail).slice(0, 4).join(' · ');
  } catch (_) { return ''; }
}
