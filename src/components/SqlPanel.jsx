import { useMemo, useState } from 'react';
import { Check, Copy, Download, ChevronRight, CheckCircle2 } from 'lucide-react';
import { generateSQL, slug } from '../lib/sqlGenerator.js';
import { ALL_TYPES } from '../lib/mysql.js';
import { Button, Tooltip } from './ui.jsx';
import { IssueIcon } from './Inspector.jsx';

const KEYWORDS = new Set(
  'CREATE DATABASE TABLE IF NOT EXISTS USE PRIMARY KEY UNIQUE FOREIGN REFERENCES CONSTRAINT ALTER ADD ON DELETE UPDATE CASCADE RESTRICT SET NULL NO ACTION DEFAULT AUTO_INCREMENT UNSIGNED ENGINE CHARSET CHARACTER COLLATE DROP FOREIGN_KEY_CHECKS INDEX'.split(' ')
);
const LITERALS = new Set(['CURRENT_TIMESTAMP', 'TRUE', 'FALSE', 'NOW', 'INNODB']);
const TYPES = new Set(ALL_TYPES);

/** Prosty tokenizer do kolorowania składni SQL */
function highlight(sql) {
  const re = /(--[^\n]*)|('(?:[^'\\]|\\.|'')*')|(`(?:[^`]|``)*`)|(\b\d+(?:\.\d+)?\b)|(\b[A-Za-z_][A-Za-z0-9_]*\b)/g;
  const out = [];
  let last = 0;
  let m;
  let k = 0;
  while ((m = re.exec(sql))) {
    if (m.index > last) out.push(sql.slice(last, m.index));
    const [tok] = m;
    let cls = null;
    if (m[1]) cls = 'text-slate-500 italic';
    else if (m[2]) cls = 'text-emerald-300';
    else if (m[3]) cls = 'text-sky-300';
    else if (m[4]) cls = 'text-orange-300';
    else {
      const up = tok.toUpperCase();
      if (TYPES.has(up)) cls = 'text-amber-300';
      else if (KEYWORDS.has(up)) cls = 'text-violet-300 font-medium';
      else if (LITERALS.has(up)) cls = 'text-orange-300';
    }
    out.push(cls ? <span key={k++} className={cls}>{tok}</span> : tok);
    last = m.index + tok.length;
  }
  out.push(sql.slice(last));
  return out;
}

const OPTIONS = [
  { key: 'createDatabase', label: 'CREATE DATABASE', tip: 'Dodaje na początku utworzenie bazy danych i polecenie USE.' },
  { key: 'dropTables', label: 'DROP TABLE IF EXISTS', tip: 'Usuwa stare tabele przed utworzeniem nowych – przydatne przy wielokrotnym uruchamianiu skryptu.' },
  { key: 'comments', label: 'Komentarze', tip: 'Dodaje do skryptu komentarze objaśniające (-- …).' },
];

export default function SqlPanel({ schema, issues, onSelectIssue, notify }) {
  const [opts, setOpts] = useState({ createDatabase: true, dropTables: false, comments: true });
  const [copied, setCopied] = useState(false);
  const sql = useMemo(() => generateSQL(schema, opts), [schema, opts]);
  const highlighted = useMemo(() => highlight(sql), [sql]);
  const errors = issues.filter((i) => i.level === 'error').length;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(sql);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = sql;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
    notify('Skopiowano SQL do schowka');
    setTimeout(() => setCopied(false), 1600);
  };

  const download = () => {
    const blob = new Blob([sql], { type: 'text/sql;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${slug(schema.name) || 'schemat'}.sql`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-3 border-b border-slate-100 p-4">
        <div className="flex gap-2">
          <Button variant="primary" icon={copied ? Check : Copy} onClick={copy} className="flex-1">
            {copied ? 'Skopiowano!' : 'Kopiuj SQL'}
          </Button>
          <Button icon={Download} onClick={download}>
            .sql
          </Button>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {OPTIONS.map((o) => (
            <Tooltip key={o.key} content={o.tip} width={240}>
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-600 select-none">
                <input
                  type="checkbox"
                  checked={opts[o.key]}
                  onChange={(e) => setOpts((p) => ({ ...p, [o.key]: e.target.checked }))}
                  className="h-3.5 w-3.5 rounded accent-indigo-600"
                />
                {o.label}
              </label>
            </Tooltip>
          ))}
        </div>
      </div>

      <div className="border-b border-slate-100 px-4 py-3">
        {issues.length === 0 ? (
          <div className="flex items-center gap-2 text-xs font-medium text-emerald-700">
            <CheckCircle2 size={15} /> Brak problemów – skrypt jest gotowy do uruchomienia w MySQL.
          </div>
        ) : (
          <>
            <div className="mb-2 text-xs font-semibold text-slate-500">
              {errors > 0 ? `Do poprawienia: ${errors} błąd(y)` : 'Wskazówki'} · {issues.length} łącznie
            </div>
            <div className="thin-scroll max-h-44 space-y-1 overflow-y-auto pr-1">
              {issues.map((i, n) => (
                <button
                  key={n}
                  onClick={() => onSelectIssue(i)}
                  className="group flex w-full gap-2 rounded-lg px-2 py-1.5 text-left text-xs leading-relaxed text-slate-600 hover:bg-slate-50"
                >
                  <IssueIcon level={i.level} size={14} />
                  <span className="flex-1">{i.message}</span>
                  {i.tableId && <ChevronRight size={14} className="mt-0.5 shrink-0 text-slate-300 group-hover:text-indigo-500" />}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="relative min-h-0 flex-1 bg-slate-900">
        <pre className="code-scroll absolute inset-0 overflow-auto p-4 font-mono text-[12px] leading-[1.65] text-slate-200">{highlighted}</pre>
      </div>
    </div>
  );
}
