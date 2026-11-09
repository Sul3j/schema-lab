import { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowRight,
  Plus,
  Trash2,
  X,
  Table2,
  Link2,
  KeyRound,
  Info,
  AlertTriangle,
  AlertCircle,
  Lightbulb,
  ChevronRight,
  Columns3,
  GitBranch,
} from 'lucide-react';
import {
  FLAGS,
  TYPE_GROUPS,
  TYPE_INFO,
  TABLE_COLORS,
  COLOR_KEYS,
  flagDisabledReason,
  hasParam,
  formatType,
} from '../lib/mysql.js';
import { Button, IconButton, Tooltip, TipBody, inputCls, inputBase, Label } from './ui.jsx';

export const IssueIcon = ({ level, size = 15 }) =>
  level === 'error' ? (
    <AlertCircle size={size} className="shrink-0 text-rose-500" />
  ) : level === 'warning' ? (
    <AlertTriangle size={size} className="shrink-0 text-amber-500" />
  ) : (
    <Lightbulb size={size} className="shrink-0 text-sky-500" />
  );

function FlagToggle({ flag, col, onToggle }) {
  const reason = flagDisabledReason(flag.key, col);
  const on = !!col[flag.key];
  const disabled = !!reason && !(flag.key === 'nn' && col.pk);
  const forced = flag.key === 'nn' && col.pk;
  return (
    <Tooltip
      content={
        <TipBody title={`${flag.label} – ${flag.name}`} example={flag.example}>
          {flag.desc}
          {reason && <div className="mt-1.5 text-amber-300">⚠ {reason}</div>}
        </TipBody>
      }
      width={280}
    >
      <button
        type="button"
        disabled={disabled || forced}
        onClick={() => onToggle(flag.key, !on)}
        className={`h-7 min-w-9 rounded-md px-1.5 text-[11px] font-bold tracking-wide ring-1 transition ${
          on ? flag.on : 'bg-white text-slate-400 ring-slate-200 hover:text-slate-700 hover:ring-slate-300'
        } ${disabled ? 'cursor-not-allowed opacity-35' : ''} ${forced ? 'cursor-not-allowed opacity-70' : ''}`}
      >
        {flag.label}
      </button>
    </Tooltip>
  );
}

function ColumnEditor({ col, index, count, isFk, onChange, onDelete, onMove }) {
  const info = TYPE_INFO[col.type];
  return (
    <div className="group rounded-xl border border-slate-200 bg-white p-2.5 transition hover:border-slate-300 hover:shadow-sm">
      <div className="flex items-center gap-1.5">
        <div className="flex flex-col">
          <button disabled={index === 0} onClick={() => onMove(-1)} className="rounded p-0.5 text-slate-300 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-20">
            <ArrowUp size={12} />
          </button>
          <button disabled={index === count - 1} onClick={() => onMove(1)} className="rounded p-0.5 text-slate-300 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-20">
            <ArrowDown size={12} />
          </button>
        </div>
        <div className="relative min-w-0 flex-1">
          {(col.pk || isFk) && (
            <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2">
              {col.pk ? <KeyRound size={13} className="text-amber-500" /> : <Link2 size={13} className="text-sky-500" />}
            </span>
          )}
          <input
            value={col.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="nazwa_kolumny"
            aria-label="Nazwa kolumny"
            className={`${inputCls} h-8 font-mono text-[13px] font-medium ${col.pk || isFk ? 'pl-7' : ''}`}
          />
        </div>
        <IconButton icon={Trash2} onClick={onDelete} className="h-8 w-8 shrink-0 text-slate-300 hover:bg-rose-50 hover:text-rose-600" tip="Usuń kolumnę" size={15} />
      </div>

      <div className="mt-2 flex items-center gap-1.5 pl-6">
        <select
          value={col.type}
          onChange={(e) => onChange({ type: e.target.value })}
          aria-label="Typ danych"
          className={`${inputBase} h-7 w-[124px] shrink-0 cursor-pointer px-2 font-mono text-[12px]`}
        >
          {TYPE_GROUPS.map((g) => (
            <optgroup key={g.group} label={g.group}>
              {g.types.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {hasParam(col.type) && (
          <Tooltip content={<TipBody title={info.param.label}>{info.param.hint}</TipBody>} width={240} className="min-w-0 flex-1">
            <input
              value={col.length}
              onChange={(e) => onChange({ length: e.target.value })}
              placeholder={info.param.placeholder}
              aria-label={info.param.label}
              className={`${inputCls} h-7 px-2 font-mono text-[12px] ${info.required && !String(col.length).trim() ? 'border-rose-300 bg-rose-50' : ''}`}
            />
          </Tooltip>
        )}
        {!hasParam(col.type) && <span className="flex-1" />}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1 pl-6">
        {FLAGS.map((f) => (
          <FlagToggle key={f.key} flag={f} col={col} onToggle={(k, v) => onChange({ [k]: v })} />
        ))}
        <Tooltip
          width={280}
          content={
            <TipBody title={col.type} example={formatType(col)}>
              {info?.desc}
              {info?.param && <div className="mt-1.5 text-indigo-200">{info.param.hint}</div>}
            </TipBody>
          }
        >
          <span className="ml-0.5 flex h-7 w-6 items-center justify-center text-slate-300 hover:text-indigo-500">
            <Info size={14} />
          </span>
        </Tooltip>
      </div>

      <div className="mt-2 flex gap-1.5 pl-6">
        <Tooltip
          className="min-w-0 flex-1"
          width={280}
          content={
            <TipBody title="DEFAULT – wartość domyślna" example="0 · 'nowe' · CURRENT_TIMESTAMP · NULL">
              Wartość wpisywana automatycznie, gdy INSERT nie poda tej kolumny. Tekst zostanie ujęty w apostrofy automatycznie.
            </TipBody>
          }
        >
          <input
            value={col.def ?? ''}
            onChange={(e) => onChange({ def: e.target.value })}
            placeholder="DEFAULT (opcjonalnie)"
            disabled={col.ai}
            className={`${inputCls} h-7 px-2 font-mono text-[12px] disabled:bg-slate-50 disabled:opacity-50`}
          />
        </Tooltip>
      </div>
    </div>
  );
}

const PRESETS = [
  { label: 'id', tip: 'id INT UNSIGNED PK AI – typowy klucz główny', col: { name: 'id', type: 'INT', length: '', pk: true, ai: true, nn: true, un: true } },
  { label: 'nazwa', tip: 'nazwa VARCHAR(100) NOT NULL', col: { name: 'nazwa', type: 'VARCHAR', length: '100', nn: true } },
  { label: 'email', tip: 'email VARCHAR(255) NOT NULL UNIQUE', col: { name: 'email', type: 'VARCHAR', length: '255', nn: true, uq: true } },
  { label: 'cena', tip: 'cena DECIMAL(10,2) NOT NULL', col: { name: 'cena', type: 'DECIMAL', length: '10,2', nn: true } },
  { label: 'utworzono', tip: 'utworzono TIMESTAMP DEFAULT CURRENT_TIMESTAMP', col: { name: 'utworzono', type: 'TIMESTAMP', length: '', nn: true, def: 'CURRENT_TIMESTAMP' } },
];

export default function Inspector({ schema, table, issues, actions }) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!table) return <Overview schema={schema} issues={issues} actions={actions} />;

  const fkColIds = new Set(schema.relations.filter((r) => r.childTableId === table.id).map((r) => r.childColId));
  const byId = Object.fromEntries(schema.tables.map((t) => [t.id, t]));
  const colName = (tid, cid) => byId[tid]?.columns.find((c) => c.id === cid)?.name ?? '?';
  const outgoing = schema.relations.filter((r) => r.childTableId === table.id);
  const incoming = schema.relations.filter((r) => r.parentTableId === table.id && r.childTableId !== table.id);
  const tableIssues = issues.filter((i) => i.tableId === table.id);

  return (
    <div className="space-y-5 p-4">
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-full" style={{ background: TABLE_COLORS[table.color] }} />
        <h3 className="flex-1 text-sm font-semibold text-slate-900">Edycja tabeli</h3>
        <IconButton icon={X} onClick={() => actions.selectTable(null)} tip="Zamknij edycję (Esc)" />
      </div>

      <div>
        <Label>Nazwa tabeli</Label>
        <input
          value={table.name}
          onChange={(e) => actions.updateTable(table.id, { name: e.target.value })}
          className={`${inputCls} font-mono font-medium`}
          placeholder="np. klienci"
        />
        <div className="mt-2.5 flex items-center gap-1.5">
          {COLOR_KEYS.map((k) => (
            <button
              key={k}
              onClick={() => actions.updateTable(table.id, { color: k })}
              className={`h-5 w-5 rounded-full transition ${table.color === k ? 'ring-2 ring-offset-2' : 'hover:scale-110'}`}
              style={{ background: TABLE_COLORS[k], '--tw-ring-color': TABLE_COLORS[k] }}
              aria-label={k}
            />
          ))}
        </div>
      </div>

      {tableIssues.length > 0 && (
        <div className="space-y-1.5">
          {tableIssues.map((i, n) => (
            <div
              key={n}
              className={`flex gap-2 rounded-lg px-3 py-2 text-xs leading-relaxed ${
                i.level === 'error' ? 'bg-rose-50 text-rose-800' : i.level === 'warning' ? 'bg-amber-50 text-amber-800' : 'bg-sky-50 text-sky-800'
              }`}
            >
              <IssueIcon level={i.level} size={14} />
              <span>{i.message}</span>
            </div>
          ))}
        </div>
      )}

      <div>
        <div className="mb-2 flex items-center gap-2">
          <Columns3 size={15} className="text-slate-400" />
          <h4 className="flex-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">Kolumny ({table.columns.length})</h4>
          <Tooltip
            width={300}
            content={
              <div className="space-y-1.5">
                {FLAGS.map((f) => (
                  <div key={f.key}>
                    <b className="text-white">{f.label}</b> <span className="text-slate-300">– {f.name}</span>
                  </div>
                ))}
                <div className="pt-1 text-slate-400">Najedź na przycisk flagi, by zobaczyć pełne wyjaśnienie.</div>
              </div>
            }
          >
            <span className="flex cursor-help items-center gap-1 text-[11px] text-slate-400 hover:text-indigo-600">
              <Info size={12} /> Co oznaczają skróty?
            </span>
          </Tooltip>
        </div>

        <div className="space-y-2">
          {table.columns.map((c, i) => (
            <ColumnEditor
              key={c.id}
              col={c}
              index={i}
              count={table.columns.length}
              isFk={fkColIds.has(c.id)}
              onChange={(patch) => actions.updateColumn(table.id, c.id, patch)}
              onDelete={() => actions.deleteColumn(table.id, c.id)}
              onMove={(dir) => actions.moveColumn(table.id, c.id, dir)}
            />
          ))}
        </div>

        <Button variant="secondary" icon={Plus} className="mt-2 w-full border-dashed" onClick={() => actions.addColumn(table.id)}>
          Dodaj kolumnę
        </Button>
        <div className="mt-2 flex flex-wrap items-center gap-1">
          <span className="mr-1 text-[11px] text-slate-400">Szybko:</span>
          {PRESETS.map((p) => (
            <Tooltip key={p.label} content={p.tip} width={240}>
              <button
                onClick={() => actions.addColumn(table.id, p.col)}
                className="rounded-md bg-slate-100 px-2 py-1 font-mono text-[11px] text-slate-600 hover:bg-indigo-50 hover:text-indigo-700"
              >
                + {p.label}
              </button>
            </Tooltip>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center gap-2">
          <GitBranch size={15} className="text-slate-400" />
          <h4 className="flex-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">Relacje</h4>
        </div>
        {outgoing.length + incoming.length === 0 && (
          <p className="mb-2 text-xs text-slate-400">Ta tabela nie ma jeszcze relacji z innymi tabelami.</p>
        )}
        <div className="space-y-1.5">
          {outgoing.map((r) => (
            <RelationRow key={r.id} onClick={() => actions.editRelation(r.id)} badge="FK" badgeCls="bg-sky-100 text-sky-700" tip="Ta tabela zawiera klucz obcy (jest „dzieckiem”).">
              <span className="text-slate-800">{colName(r.childTableId, r.childColId)}</span>
              <ArrowRight size={12} className="text-slate-400" />
              <span>
                {byId[r.parentTableId]?.name}.{colName(r.parentTableId, r.parentColId)}
              </span>
              <span className="ml-auto text-[10px] text-slate-400">{r.type}</span>
            </RelationRow>
          ))}
          {incoming.map((r) => (
            <RelationRow key={r.id} onClick={() => actions.editRelation(r.id)} badge="REF" badgeCls="bg-amber-100 text-amber-700" tip="Inna tabela odwołuje się do tej tabeli (ta jest „rodzicem”).">
              <span>
                {byId[r.childTableId]?.name}.{colName(r.childTableId, r.childColId)}
              </span>
              <ArrowRight size={12} className="text-slate-400" />
              <span className="text-slate-800">{colName(r.parentTableId, r.parentColId)}</span>
              <span className="ml-auto text-[10px] text-slate-400">{r.type}</span>
            </RelationRow>
          ))}
        </div>
        <Button size="sm" variant="ghost" icon={Link2} className="mt-1.5 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700" onClick={() => actions.addRelation({ childTableId: table.id })}>
          Dodaj klucz obcy
        </Button>
      </div>

      <div className="border-t border-slate-100 pt-4">
        {confirmDelete ? (
          <div className="rounded-xl bg-rose-50 p-3">
            <p className="mb-2.5 text-xs text-rose-800">
              Usunąć tabelę <b>{table.name}</b>
              {outgoing.length + incoming.length > 0 && <> razem z {outgoing.length + incoming.length} relacją/ami</>}? Tej operacji nie można cofnąć.
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="danger" icon={Trash2} onClick={() => actions.deleteTable(table.id)}>
                Tak, usuń
              </Button>
              <Button size="sm" onClick={() => setConfirmDelete(false)}>
                Anuluj
              </Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="danger-ghost" icon={Trash2} onClick={() => setConfirmDelete(true)}>
            Usuń tabelę
          </Button>
        )}
      </div>
    </div>
  );
}

const RelationRow = ({ children, onClick, badge, badgeCls, tip }) => (
  <button onClick={onClick} className="flex w-full items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-left font-mono text-[11.5px] text-slate-500 transition hover:border-indigo-300 hover:bg-indigo-50/40">
    <Tooltip content={tip} width={220}>
      <span className={`rounded px-1 py-px font-sans text-[9px] font-bold ${badgeCls}`}>{badge}</span>
    </Tooltip>
    {children}
  </button>
);

function Overview({ schema, issues, actions }) {
  const errors = issues.filter((i) => i.level === 'error').length;
  const warnings = issues.filter((i) => i.level === 'warning').length;
  const colCount = schema.tables.reduce((s, t) => s + t.columns.length, 0);
  return (
    <div className="space-y-5 p-4">
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Tabele" value={schema.tables.length} />
        <Stat label="Kolumny" value={colCount} />
        <Stat label="Relacje" value={schema.relations.length} />
      </div>

      <div
        className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs ${
          errors ? 'bg-rose-50 text-rose-800' : warnings ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'
        }`}
      >
        {errors ? <AlertCircle size={15} /> : warnings ? <AlertTriangle size={15} /> : <KeyRound size={15} />}
        {errors
          ? `${errors} błąd(y) – MySQL nie wykona skryptu. Szczegóły w zakładce SQL.`
          : warnings
            ? `${warnings} ostrzeżenie(a) – skrypt zadziała, ale warto poprawić.`
            : 'Schemat wygląda poprawnie. Skrypt SQL jest gotowy!'}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Tabele w projekcie</h4>
          <Button size="sm" variant="ghost" icon={Plus} className="text-indigo-600 hover:bg-indigo-50" onClick={actions.addTable}>
            Nowa
          </Button>
        </div>
        {schema.tables.length === 0 && <p className="text-xs text-slate-400">Brak tabel. Dodaj pierwszą!</p>}
        <div className="space-y-1.5">
          {schema.tables.map((t) => {
            const n = issues.filter((i) => i.tableId === t.id && i.level !== 'info');
            return (
              <button
                key={t.id}
                onClick={() => actions.selectTable(t.id, true)}
                className="group flex w-full items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left transition hover:border-indigo-300 hover:shadow-sm"
              >
                <Table2 size={15} style={{ color: TABLE_COLORS[t.color] }} />
                <span className="flex-1 truncate font-mono text-[13px] font-medium text-slate-800">{t.name}</span>
                {n.length > 0 && <IssueIcon level={n[0].level} size={14} />}
                <span className="text-[11px] text-slate-400">{t.columns.length} kol.</span>
                <ChevronRight size={14} className="text-slate-300 group-hover:text-indigo-500" />
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 p-4 text-xs leading-relaxed text-slate-600 ring-1 ring-indigo-100">
        <div className="mb-1.5 flex items-center gap-1.5 font-semibold text-indigo-900">
          <Lightbulb size={14} /> Wskazówka
        </div>
        Kliknij tabelę na płótnie, aby edytować jej kolumny. Klucz obcy utworzysz, przeciągając <b>kropkę</b> przy kolumnie FK na kolumnę PK innej tabeli albo przyciskiem
        <b> Relacja</b> na górnym pasku.
      </div>
    </div>
  );
}

const Stat = ({ label, value }) => (
  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
    <div className="text-xl font-semibold text-slate-900 tabular-nums">{value}</div>
    <div className="text-[11px] text-slate-500">{label}</div>
  </div>
);
