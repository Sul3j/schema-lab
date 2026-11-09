import { useEffect, useMemo, useState } from 'react';
import { GitBranch, Trash2, Wand2, AlertCircle, ArrowRight, KeyRound, Link2, Table2 } from 'lucide-react';
import { Modal, Button, Label, inputCls, Tooltip, TipBody } from './ui.jsx';
import { FK_ACTIONS, formatType, TABLE_COLORS, isNumericType } from '../lib/mysql.js';
import { fkName } from '../lib/sqlGenerator.js';

export const NEW_COL = '__new__';

const guessFkName = (parentName) => {
  const n = (parentName || 'tabela').toLowerCase();
  const singular = n.endsWith('ies') ? n.slice(0, -3) + 'y' : n.endsWith('s') && !n.endsWith('ss') ? n.slice(0, -1) : n;
  return `${singular}_id`;
};

const TYPES = [
  {
    value: '1:N',
    label: 'Jeden do wielu',
    short: '1 : N',
    desc: 'Najczęstsza relacja. Jeden klient → wiele zamówień. Klucz obcy jest po stronie „wielu”.',
  },
  {
    value: '1:1',
    label: 'Jeden do jednego',
    short: '1 : 1',
    desc: 'Np. użytkownik → profil. Klucz obcy dostaje dodatkowo UNIQUE.',
  },
  {
    value: 'N:M',
    label: 'Wiele do wielu',
    short: 'N : M',
    desc: 'Np. studenci ↔ kursy. W SQL realizuje się ją przez tabelę łączącą z dwoma kluczami obcymi.',
  },
];

function pickRefCol(table) {
  if (!table) return '';
  return (table.columns.find((c) => c.pk) ?? table.columns.find((c) => c.uq) ?? table.columns[0])?.id ?? '';
}

function initialForm(initial, schema) {
  const t0 = schema.tables[0];
  const t1 = schema.tables[1] ?? t0;
  if (initial?.id) return { ...initial, newColName: '' };
  const childTableId = initial?.childTableId ?? t1?.id ?? '';
  const parentTableId =
    initial?.parentTableId ?? schema.tables.find((t) => t.id !== childTableId)?.id ?? childTableId;
  const parent = schema.tables.find((t) => t.id === parentTableId);
  return {
    type: '1:N',
    childTableId,
    childColId: initial?.childColId ?? NEW_COL,
    newColName: guessFkName(parent?.name),
    parentTableId,
    parentColId: initial?.parentColId ?? pickRefCol(parent),
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
    tableA: t0?.id ?? '',
    tableB: schema.tables.find((t) => t.id !== t0?.id)?.id ?? '',
    junctionName: '',
  };
}

export default function RelationModal({ open, initial, schema, onClose, onSave, onDelete, onFixType }) {
  const [f, setF] = useState(() => initialForm(initial, schema));
  const isEdit = !!initial?.id;

  useEffect(() => {
    if (open) setF(initialForm(initial, schema));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial]);

  const set = (patch) => setF((p) => ({ ...p, ...patch }));
  const byId = useMemo(() => Object.fromEntries(schema.tables.map((t) => [t.id, t])), [schema.tables]);

  const child = byId[f.childTableId];
  const parent = byId[f.parentTableId];
  const parentCol = parent?.columns.find((c) => c.id === f.parentColId);
  const childCol = f.childColId === NEW_COL ? null : child?.columns.find((c) => c.id === f.childColId);
  const tA = byId[f.tableA];
  const tB = byId[f.tableB];
  const junctionName = f.junctionName || (tA && tB ? `${tA.name}_${tB.name}` : '');

  // ── walidacja
  const problems = [];
  let canFix = false;
  if (f.type !== 'N:M') {
    if (!child || !parent) problems.push('Wybierz obie tabele.');
    if (!parentCol) problems.push('Tabela-rodzic nie ma kolumny, do której można się odwołać.');
    if (f.childColId === NEW_COL && !f.newColName.trim()) problems.push('Podaj nazwę nowej kolumny klucza obcego.');
    if (f.childColId === NEW_COL && child?.columns.some((c) => c.name.toLowerCase() === f.newColName.trim().toLowerCase()))
      problems.push(`W tabeli „${child.name}” już istnieje kolumna „${f.newColName}” – wybierz ją z listy lub zmień nazwę.`);
    if (childCol && childCol.id === parentCol?.id) problems.push('Kolumna nie może wskazywać sama na siebie.');
    const dup = schema.relations.find((r) => r.childColId === f.childColId && r.id !== f.id);
    if (childCol && dup) problems.push(`Kolumna „${childCol.name}” ma już klucz obcy.`);
    if (childCol && parentCol && (childCol.type !== parentCol.type || (isNumericType(childCol.type) && !!childCol.un !== !!parentCol.un) || (childCol.type === 'DECIMAL' && childCol.length !== parentCol.length))) {
      problems.push(`Typy się różnią: ${formatType(childCol)} ≠ ${formatType(parentCol)}. MySQL wymaga identycznego typu (włącznie z UNSIGNED).`);
      canFix = true;
    }
    if (parentCol && !parentCol.pk && !parentCol.uq) problems.push(`„${parentCol.name}” nie jest PK ani UNIQUE – klucz obcy powinien wskazywać na kolumnę unikalną.`);
    if (childCol && (childCol.nn || childCol.pk) && (f.onDelete === 'SET NULL' || f.onUpdate === 'SET NULL'))
      problems.push(`SET NULL wymaga, aby „${childCol.name}” mogła być NULL – wyłącz w niej NN (lub wybierz inną akcję).`);
  } else {
    if (!tA || !tB) problems.push('Wybierz dwie tabele.');
    if (tA && tB && tA.id === tB.id) problems.push('Wybierz dwie różne tabele.');
    if (tA && tA.columns.filter((c) => c.pk).length !== 1) problems.push(`Tabela „${tA?.name}” musi mieć dokładnie jedną kolumnę PK.`);
    if (tB && tB.columns.filter((c) => c.pk).length !== 1) problems.push(`Tabela „${tB?.name}” musi mieć dokładnie jedną kolumnę PK.`);
    if (schema.tables.some((t) => t.name.toLowerCase() === junctionName.toLowerCase())) problems.push(`Tabela „${junctionName}” już istnieje – zmień nazwę.`);
  }
  const blocking = problems.filter((p) => !p.startsWith('SET NULL') && !p.startsWith('Typy') && !p.includes('nie jest PK'));

  const fkColLabel = f.childColId === NEW_COL ? f.newColName || '?' : childCol?.name;
  const previewSql =
    f.type !== 'N:M' && child && parent && parentCol
      ? `ALTER TABLE \`${child.name}\`\n  ADD CONSTRAINT \`${fkName(child, { name: fkColLabel })}\`\n  FOREIGN KEY (\`${fkColLabel}\`)\n  REFERENCES \`${parent.name}\` (\`${parentCol.name}\`)\n  ON DELETE ${f.onDelete}\n  ON UPDATE ${f.onUpdate};`
      : '';

  const save = () => onSave({ ...f, junctionName });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edycja relacji (klucza obcego)' : 'Nowa relacja'}
      icon={GitBranch}
      width="max-w-2xl"
      footer={
        <>
          {isEdit && (
            <Button variant="danger-ghost" icon={Trash2} className="mr-auto" onClick={() => onDelete(f.id)}>
              Usuń relację
            </Button>
          )}
          <Button onClick={onClose}>Anuluj</Button>
          <Button variant="primary" disabled={blocking.length > 0} onClick={save}>
            {isEdit ? 'Zapisz zmiany' : f.type === 'N:M' ? 'Utwórz tabelę łączącą' : 'Utwórz relację'}
          </Button>
        </>
      }
    >
      {schema.tables.length < 1 ? (
        <p className="text-sm text-slate-500">Najpierw dodaj co najmniej jedną tabelę.</p>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-2">
            {TYPES.filter((t) => !isEdit || t.value !== 'N:M').map((t) => (
              <button
                key={t.value}
                onClick={() => set({ type: t.value })}
                className={`rounded-xl border p-3 text-left transition ${
                  f.type === t.value ? 'border-indigo-400 bg-indigo-50/60 ring-3 ring-indigo-100' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className={`font-mono text-sm font-bold ${f.type === t.value ? 'text-indigo-700' : 'text-slate-700'}`}>{t.short}</div>
                <div className="text-xs font-semibold text-slate-700">{t.label}</div>
                <div className="mt-1 text-[11px] leading-snug text-slate-500">{t.desc}</div>
              </button>
            ))}
          </div>

          {f.type === 'N:M' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Tabela A</Label>
                  <TableSelect schema={schema} value={f.tableA} onChange={(v) => set({ tableA: v, junctionName: '' })} />
                </div>
                <div>
                  <Label>Tabela B</Label>
                  <TableSelect schema={schema} value={f.tableB} onChange={(v) => set({ tableB: v, junctionName: '' })} />
                </div>
              </div>
              <div>
                <Label>Nazwa tabeli łączącej</Label>
                <input className={`${inputCls} font-mono`} value={junctionName} onChange={(e) => set({ junctionName: e.target.value })} />
              </div>
              {tA && tB && (
                <div className="rounded-xl bg-slate-50 p-4 text-xs leading-relaxed text-slate-600 ring-1 ring-slate-200">
                  <div className="mb-3 flex items-center justify-center gap-2 font-mono text-[12px]">
                    <TablePill t={tA} />
                    <span className="text-slate-400">1 ── N</span>
                    <TablePill t={{ name: junctionName, color: 'slate' }} />
                    <span className="text-slate-400">N ── 1</span>
                    <TablePill t={tB} />
                  </div>
                  Relacji wiele-do-wielu <b>nie da się</b> zapisać jednym kluczem obcym. Zostanie utworzona tabela <code className="font-semibold text-slate-800">{junctionName}</code> z
                  kolumnami <code className="text-sky-700">{tA.name}_id</code> i <code className="text-sky-700">{tB.name}_id</code>. Obie razem tworzą złożony klucz główny (para nie może się
                  powtórzyć), a każda jest kluczem obcym (ON DELETE CASCADE).
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3">
                <div className="space-y-3 rounded-xl border border-sky-200 bg-sky-50/40 p-3">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-800">
                    <Link2 size={14} />
                    Tabela „dziecko” (z kluczem obcym)
                  </div>
                  <TableSelect
                    schema={schema}
                    value={f.childTableId}
                    onChange={(v) => set({ childTableId: v, childColId: NEW_COL })}
                  />
                  <div>
                    <Label
                      hint={
                        <Tooltip width={260} content={<TipBody title="FK – Foreign Key">Kolumna, która przechowuje wartość klucza głównego z innej tabeli. Dzięki niej wiersze są powiązane.</TipBody>}>
                          <span className="cursor-help rounded bg-sky-100 px-1 text-[9px] text-sky-700">FK</span>
                        </Tooltip>
                      }
                    >
                      Kolumna klucza obcego
                    </Label>
                    <select className={`${inputCls} font-mono text-[13px]`} value={f.childColId} onChange={(e) => set({ childColId: e.target.value })}>
                      {!isEdit && <option value={NEW_COL}>➕ utwórz nową kolumnę…</option>}
                      {child?.columns.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} — {formatType(c)}
                        </option>
                      ))}
                    </select>
                    {f.childColId === NEW_COL && (
                      <input
                        className={`${inputCls} mt-2 font-mono text-[13px]`}
                        value={f.newColName}
                        onChange={(e) => set({ newColName: e.target.value })}
                        placeholder="np. klient_id"
                      />
                    )}
                    {f.childColId === NEW_COL && parentCol && (
                      <p className="mt-1.5 text-[11px] text-slate-500">
                        Typ zostanie skopiowany: <code className="text-amber-700">{formatType(parentCol)}</code>
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex h-full items-center pt-10 text-slate-300">
                  <ArrowRight size={20} />
                </div>

                <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/40 p-3">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800">
                    <KeyRound size={14} />
                    Tabela „rodzic” (wskazywana)
                  </div>
                  <TableSelect
                    schema={schema}
                    value={f.parentTableId}
                    onChange={(v) => {
                      const p = byId[v];
                      set({ parentTableId: v, parentColId: pickRefCol(p), ...(f.childColId === NEW_COL ? { newColName: guessFkName(p?.name) } : {}) });
                    }}
                  />
                  <div>
                    <Label>Kolumna referencyjna</Label>
                    <select className={`${inputCls} font-mono text-[13px]`} value={f.parentColId} onChange={(e) => set({ parentColId: e.target.value })}>
                      {parent?.columns.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.pk ? '🔑 ' : c.uq ? '◆ ' : ''}
                          {c.name} — {formatType(c)}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1.5 text-[11px] text-slate-500">Zwykle klucz główny (PK) rodzica.</p>
                  </div>
                </div>
              </div>

              {child && parent && (
                <div className="rounded-xl bg-indigo-50/60 px-4 py-3 text-[13px] leading-relaxed text-indigo-900 ring-1 ring-indigo-100">
                  {f.type === '1:1' ? (
                    <>
                      Jeden wiersz w <b>{parent.name}</b> jest powiązany z <b>co najwyżej jednym</b> wierszem w <b>{child.name}</b>.
                    </>
                  ) : (
                    <>
                      Jeden wiersz w <b>{parent.name}</b> może mieć <b>wiele</b> powiązanych wierszy w <b>{child.name}</b>, a każdy wiersz w <b>{child.name}</b> wskazuje na jeden wiersz w <b>{parent.name}</b>.
                    </>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <ActionSelect label="ON DELETE" sub={`gdy usuniesz wiersz z „${parent?.name ?? 'rodzica'}”`} value={f.onDelete} onChange={(v) => set({ onDelete: v })} />
                <ActionSelect label="ON UPDATE" sub="gdy zmieni się wartość klucza rodzica" value={f.onUpdate} onChange={(v) => set({ onUpdate: v })} />
              </div>

              {previewSql && (
                <div>
                  <Label>Podgląd SQL</Label>
                  <pre className="code-scroll overflow-x-auto rounded-xl bg-slate-900 p-3 font-mono text-[11.5px] leading-relaxed text-slate-200">{previewSql}</pre>
                </div>
              )}
            </>
          )}

          {problems.length > 0 && (
            <div className="space-y-1.5 rounded-xl bg-rose-50 p-3">
              {problems.map((p) => (
                <div key={p} className="flex gap-2 text-xs leading-relaxed text-rose-800">
                  <AlertCircle size={14} className="mt-0.5 shrink-0" />
                  <span>{p}</span>
                </div>
              ))}
              {canFix && childCol && parentCol && (
                <Button size="sm" icon={Wand2} className="mt-1" onClick={() => onFixType(f.childTableId, f.childColId, parentCol)}>
                  Dopasuj typ „{childCol.name}” do {formatType(parentCol)}
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function TableSelect({ schema, value, onChange }) {
  return (
    <select className={`${inputCls} font-mono text-[13px] font-medium`} value={value} onChange={(e) => onChange(e.target.value)}>
      {schema.tables.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </select>
  );
}

function ActionSelect({ label, sub, value, onChange }) {
  const desc = FK_ACTIONS.find((a) => a.value === value)?.desc;
  return (
    <div>
      <Label>{label}</Label>
      <select className={`${inputCls} font-mono text-[13px]`} value={value} onChange={(e) => onChange(e.target.value)}>
        {FK_ACTIONS.map((a) => (
          <option key={a.value} value={a.value}>
            {a.value}
          </option>
        ))}
      </select>
      <p className="mt-1 text-[11px] text-slate-400">{sub}</p>
      <p className="mt-1 text-[11.5px] leading-snug text-slate-600">{desc}</p>
    </div>
  );
}

const TablePill = ({ t }) => (
  <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 shadow-sm ring-1 ring-slate-200">
    <Table2 size={12} style={{ color: TABLE_COLORS[t.color] }} />
    {t.name}
  </span>
);
