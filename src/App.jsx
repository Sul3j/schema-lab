import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Database,
  Plus,
  GitBranch,
  Undo2,
  Redo2,
  Sparkles,
  Upload,
  Download,
  Trash2,
  HelpCircle,
  PanelRightClose,
  PanelRightOpen,
  Code2,
  Table2,
  Pencil,
  FilePlus2,
} from 'lucide-react';
import Canvas from './components/Canvas.jsx';
import Inspector from './components/Inspector.jsx';
import SqlPanel from './components/SqlPanel.jsx';
import RelationModal, { NEW_COL } from './components/RelationModal.jsx';
import HelpModal from './components/HelpModal.jsx';
import { Button, ConfirmModal, IconButton, Label, Modal, Toast, Tooltip, inputCls, useAutoFocus } from './components/ui.jsx';
import { createSampleSchema, emptySchema } from './lib/sampleSchema.js';
import { validateSchema, slug } from './lib/sqlGenerator.js';
import { COLOR_KEYS, TABLE_WIDTH, idColumn, newColumn, normalizeColumn, tableHeight, uid } from './lib/mysql.js';

const STORAGE_KEY = 'schemalab-project-v1';

const guessFkName = (name) => {
  const n = (name || 'tabela').toLowerCase();
  const s = n.endsWith('ies') ? n.slice(0, -3) + 'y' : n.endsWith('s') && !n.endsWith('ss') ? n.slice(0, -1) : n;
  return `${s}_id`;
};

/** Ujednolica dane z pliku JSON / localStorage */
function normalizeSchema(raw) {
  const s = raw?.schema ?? raw;
  if (!s || !Array.isArray(s.tables)) throw new Error('Plik nie zawiera poprawnego projektu (brak listy tabel).');
  const tables = s.tables.map((t, i) => ({
    id: String(t.id ?? uid()),
    name: String(t.name ?? `tabela_${i + 1}`),
    x: Number.isFinite(t.x) ? t.x : 40 + (i % 4) * 320,
    y: Number.isFinite(t.y) ? t.y : 40 + Math.floor(i / 4) * 300,
    color: COLOR_KEYS.includes(t.color) ? t.color : COLOR_KEYS[i % COLOR_KEYS.length],
    columns: (Array.isArray(t.columns) ? t.columns : []).map((c) => ({ ...newColumn(), ...c, id: String(c.id ?? uid()) })),
  }));
  const colIndex = new Set(tables.flatMap((t) => t.columns.map((c) => `${t.id}:${c.id}`)));
  const relations = (Array.isArray(s.relations) ? s.relations : [])
    .filter((r) => colIndex.has(`${r.childTableId}:${r.childColId}`) && colIndex.has(`${r.parentTableId}:${r.parentColId}`))
    .map((r) => ({ type: '1:N', onDelete: 'RESTRICT', onUpdate: 'CASCADE', ...r, id: String(r.id ?? uid()) }));
  return { name: String(s.name ?? 'moja_baza'), tables, relations };
}

function loadInitial() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return normalizeSchema(JSON.parse(saved));
  } catch {
    /* uszkodzony zapis – startujemy od przykładu */
  }
  return createSampleSchema();
}

export default function App() {
  const [schema, setSchemaRaw] = useState(loadInitial);
  const schemaRef = useRef(schema);
  const hist = useRef({ past: [], future: [], lastKey: null, lastTime: 0 });

  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 });
  const [fitSignal, setFitSignal] = useState(1);
  const [selectedId, setSelectedId] = useState(null);
  const [tab, setTab] = useState('table');
  const [panelOpen, setPanelOpen] = useState(true);
  const [relModal, setRelModal] = useState(null); // { initial }
  const [newTableOpen, setNewTableOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [toast, setToast] = useState(null);
  const fileRef = useRef(null);
  const canvasWrapRef = useRef(null);

  // ── stan + historia (cofnij / ponów)
  const update = useCallback((fn, key = null) => {
    const prev = schemaRef.current;
    const next = fn(prev);
    if (next === prev) return;
    const h = hist.current;
    const now = Date.now();
    if (!(key && key === h.lastKey && now - h.lastTime < 1000)) {
      h.past.push(prev);
      if (h.past.length > 150) h.past.shift();
    }
    h.future = [];
    h.lastKey = key;
    h.lastTime = now;
    schemaRef.current = next;
    setSchemaRaw(next);
  }, []);

  const undo = useCallback(() => {
    const h = hist.current;
    if (!h.past.length) return;
    h.future.push(schemaRef.current);
    const prev = h.past.pop();
    h.lastKey = null;
    schemaRef.current = prev;
    setSchemaRaw(prev);
  }, []);

  const redo = useCallback(() => {
    const h = hist.current;
    if (!h.future.length) return;
    h.past.push(schemaRef.current);
    const next = h.future.pop();
    h.lastKey = null;
    schemaRef.current = next;
    setSchemaRaw(next);
  }, []);

  // autozapis
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(schema));
    } catch {
      /* brak miejsca / tryb prywatny */
    }
  }, [schema]);

  const notify = useCallback((text) => {
    const id = Date.now();
    setToast({ id, text });
    setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 2200);
  }, []);

  const issues = useMemo(() => validateSchema(schema), [schema]);
  const errorCount = issues.filter((i) => i.level === 'error').length;
  const selectedTable = schema.tables.find((t) => t.id === selectedId) ?? null;

  // ── akcje na schemacie
  const actions = useMemo(() => {
    const mapTable = (s, tid, fn) => ({ ...s, tables: s.tables.map((t) => (t.id === tid ? fn(t) : t)) });

    const updateColumn = (tid, cid, patch) =>
      update((s) => {
        let changed = null;
        let next = mapTable(s, tid, (t) => ({
          ...t,
          columns: t.columns.map((c) => (c.id === cid ? (changed = normalizeColumn(c, patch)) : c)),
        }));
        // zmiana typu klucza głównego → zaktualizuj typ powiązanych kluczy obcych
        if (changed && ('type' in patch || 'length' in patch || 'un' in patch)) {
          for (const r of s.relations.filter((r) => r.parentColId === cid)) {
            next = mapTable(next, r.childTableId, (t) => ({
              ...t,
              columns: t.columns.map((c) =>
                c.id === r.childColId ? normalizeColumn(c, { type: changed.type, length: changed.length, un: changed.un }) : c
              ),
            }));
          }
        }
        return next;
      }, `col:${cid}:${Object.keys(patch).join(',')}`);

    return {
      selectTable: (id, center = false) => {
        setSelectedId(id);
        if (id) setTab('table');
        if (id && center) {
          const t = schemaRef.current.tables.find((x) => x.id === id);
          const r = canvasWrapRef.current?.getBoundingClientRect();
          if (t && r) setView((v) => ({ ...v, x: r.width / 2 - (t.x + TABLE_WIDTH / 2) * v.zoom, y: r.height / 2 - (t.y + tableHeight(t) / 2) * v.zoom }));
        }
      },
      addTable: () => setNewTableOpen(true),
      updateTable: (tid, patch) => update((s) => mapTable(s, tid, (t) => ({ ...t, ...patch })), `table:${tid}:${Object.keys(patch).join(',')}`),
      moveTable: (tid, x, y) =>
        update((s) => {
          const t = s.tables.find((t) => t.id === tid);
          if (!t || (t.x === x && t.y === y)) return s;
          return mapTable(s, tid, (t) => ({ ...t, x, y }));
        }, `move:${tid}`),
      deleteTable: (tid) => {
        update((s) => ({
          ...s,
          tables: s.tables.filter((t) => t.id !== tid),
          relations: s.relations.filter((r) => r.childTableId !== tid && r.parentTableId !== tid),
        }));
        setSelectedId(null);
        notify('Usunięto tabelę');
      },
      addColumn: (tid, preset) =>
        update((s) =>
          mapTable(s, tid, (t) => {
            const names = new Set(t.columns.map((c) => c.name));
            let name = preset?.name ?? `kolumna_${t.columns.length + 1}`;
            let i = 2;
            const base = name;
            while (names.has(name)) name = `${base}_${i++}`;
            return { ...t, columns: [...t.columns, newColumn({ ...preset, name })] };
          })
        ),
      updateColumn,
      deleteColumn: (tid, cid) =>
        update((s) => ({
          ...mapTable(s, tid, (t) => ({ ...t, columns: t.columns.filter((c) => c.id !== cid) })),
          relations: s.relations.filter((r) => r.childColId !== cid && r.parentColId !== cid),
        })),
      moveColumn: (tid, cid, dir) =>
        update((s) =>
          mapTable(s, tid, (t) => {
            const i = t.columns.findIndex((c) => c.id === cid);
            const j = i + dir;
            if (j < 0 || j >= t.columns.length) return t;
            const cols = [...t.columns];
            [cols[i], cols[j]] = [cols[j], cols[i]];
            return { ...t, columns: cols };
          })
        ),
      addRelation: (initial = {}) => setRelModal({ initial }),
      editRelation: (rid) => {
        const r = schemaRef.current.relations.find((x) => x.id === rid);
        if (r) setRelModal({ initial: { ...r } });
      },
    };
  }, [update, notify]);

  const createTable = (name, withId) => {
    const r = canvasWrapRef.current?.getBoundingClientRect() ?? { width: 800, height: 600 };
    const n = schemaRef.current.tables.length;
    const x = Math.round(((r.width / 2 - view.x) / view.zoom - TABLE_WIDTH / 2 + (n % 5) * 24) / 10) * 10;
    const y = Math.round(((r.height / 2 - view.y) / view.zoom - 80 + (n % 5) * 24) / 10) * 10;
    const t = {
      id: uid(),
      name,
      x,
      y,
      color: COLOR_KEYS[n % (COLOR_KEYS.length - 1)],
      columns: withId ? [idColumn()] : [],
    };
    update((s) => ({ ...s, tables: [...s.tables, t] }));
    setSelectedId(t.id);
    setTab('table');
    setPanelOpen(true);
    notify(`Dodano tabelę „${name}”`);
  };

  const saveRelation = (f) => {
    let selectAfter = null;
    update((s) => {
      const find = (id) => s.tables.find((t) => t.id === id);
      if (f.type === 'N:M') {
        const A = find(f.tableA);
        const B = find(f.tableB);
        const pa = A.columns.find((c) => c.pk);
        const pb = B.columns.find((c) => c.pk);
        const mk = (T, pc) => newColumn({ name: guessFkName(T.name), type: pc.type, length: pc.length, un: pc.un, pk: true, nn: true });
        const ca = mk(A, pa);
        const cb = mk(B, pb);
        if (ca.name === cb.name) cb.name = `${cb.name}_2`;
        const jt = {
          id: uid(),
          name: f.junctionName,
          x: Math.round((A.x + B.x) / 20) * 10,
          y: Math.round((Math.max(A.y + tableHeight(A), B.y + tableHeight(B)) + 60) / 10) * 10,
          color: 'slate',
          columns: [ca, cb],
        };
        selectAfter = jt.id;
        const rel = (cc, P, pc) => ({ id: uid(), type: '1:N', childTableId: jt.id, childColId: cc.id, parentTableId: P.id, parentColId: pc.id, onDelete: 'CASCADE', onUpdate: 'CASCADE' });
        return { ...s, tables: [...s.tables, jt], relations: [...s.relations, rel(ca, A, pa), rel(cb, B, pb)] };
      }

      let tables = s.tables;
      let childColId = f.childColId;
      if (childColId === NEW_COL) {
        const pc = find(f.parentTableId).columns.find((c) => c.id === f.parentColId);
        const setNull = f.onDelete === 'SET NULL' || f.onUpdate === 'SET NULL';
        const nc = newColumn({ name: f.newColName.trim(), type: pc.type, length: pc.length, un: pc.un, nn: !setNull, uq: f.type === '1:1' });
        childColId = nc.id;
        tables = tables.map((t) => (t.id === f.childTableId ? { ...t, columns: [...t.columns, nc] } : t));
      } else if (f.type === '1:1') {
        tables = tables.map((t) =>
          t.id === f.childTableId ? { ...t, columns: t.columns.map((c) => (c.id === childColId && !c.pk ? { ...c, uq: true } : c)) } : t
        );
      }
      const rel = {
        id: f.id ?? uid(),
        type: f.type,
        childTableId: f.childTableId,
        childColId,
        parentTableId: f.parentTableId,
        parentColId: f.parentColId,
        onDelete: f.onDelete,
        onUpdate: f.onUpdate,
      };
      const relations = f.id ? s.relations.map((r) => (r.id === f.id ? rel : r)) : [...s.relations, rel];
      return { ...s, tables, relations };
    });
    setRelModal(null);
    if (selectAfter) {
      setSelectedId(selectAfter);
      setTab('table');
    }
    notify(f.id ? 'Zapisano relację' : f.type === 'N:M' ? 'Utworzono tabelę łączącą' : 'Utworzono klucz obcy');
  };

  const deleteRelation = (rid) => {
    update((s) => ({ ...s, relations: s.relations.filter((r) => r.id !== rid) }));
    setRelModal(null);
    notify('Usunięto relację');
  };

  const onConnect = (from, to) => {
    const s = schemaRef.current;
    const col = (ref) => s.tables.find((t) => t.id === ref.tableId)?.columns.find((c) => c.id === ref.colId);
    const a = col(from);
    if (!a) return;
    // Upuszczono na tabelę (nie na kolumnę) → utwórz nową kolumnę FK w tej tabeli
    if (!to.colId) {
      if (to.tableId === from.tableId) return;
      setRelModal({ initial: { childTableId: to.tableId, childColId: NEW_COL, parentTableId: from.tableId, parentColId: from.colId } });
      return;
    }
    const b = col(to);
    if (!b) return;
    // Kierunek: dziecko (FK) → rodzic (PK/UQ)
    const bIsKey = b.pk || b.uq;
    const aIsKey = a.pk || a.uq;
    const [child, parent] = !bIsKey && aIsKey ? [to, from] : [from, to];
    const existing = s.relations.find((r) => r.childColId === child.colId);
    if (existing) {
      setRelModal({ initial: { ...existing, parentTableId: parent.tableId, parentColId: parent.colId } });
      return;
    }
    setRelModal({ initial: { childTableId: child.tableId, childColId: child.colId, parentTableId: parent.tableId, parentColId: parent.colId } });
  };

  const replaceSchema = (next, msg) => {
    update(() => next);
    setSelectedId(null);
    setFitSignal((n) => n + 1);
    if (msg) notify(msg);
  };

  const exportJson = () => {
    const data = { app: 'SchemaLab', version: 1, exportedAt: new Date().toISOString(), schema };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${slug(schema.name) || 'projekt'}.schemalab.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    notify('Wyeksportowano projekt do pliku JSON');
  };

  const importJson = async (file) => {
    try {
      const next = normalizeSchema(JSON.parse(await file.text()));
      replaceSchema(next, `Zaimportowano „${next.name}” (${next.tables.length} tabel)`);
    } catch (e) {
      notify(`Błąd importu: ${e.message}`);
    }
  };

  // skróty klawiszowe
  useEffect(() => {
    const onKey = (e) => {
      const inField = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
      const modalOpen = relModal || newTableOpen || helpOpen || confirm;
      if ((e.ctrlKey || e.metaKey) && !inField && !modalOpen) {
        const k = e.key.toLowerCase();
        if (k === 'z' && !e.shiftKey) {
          e.preventDefault();
          undo();
        } else if (k === 'y' || (k === 'z' && e.shiftKey)) {
          e.preventDefault();
          redo();
        }
      }
      if (e.key === 'Escape' && !modalOpen && !inField) setSelectedId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, relModal, newTableOpen, helpOpen, confirm]);

  const h = hist.current;

  return (
    <div className="flex h-full flex-col">
      {/* ─── Górny pasek ─── */}
      <header className="z-20 flex h-14 shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <div className="flex items-center gap-2.5 pr-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/30">
            <Database size={18} />
          </div>
          <div className="hidden leading-tight sm:block">
            <div className="text-sm font-bold text-slate-900">SchemaLab</div>
            <div className="text-[10.5px] font-medium text-slate-400">Projektant baz MySQL</div>
          </div>
        </div>

        <div className="mx-1 h-7 w-px bg-slate-200" />

        <Tooltip content="Nazwa projektu – zostanie użyta jako nazwa bazy danych w CREATE DATABASE." width={240} side="bottom">
          <label className="group flex items-center gap-1.5 rounded-lg px-2 py-1 hover:bg-slate-50">
            <input
              value={schema.name}
              onChange={(e) => update((s) => ({ ...s, name: e.target.value }), 'project-name')}
              className="w-40 bg-transparent font-mono text-sm font-medium text-slate-700 outline-none focus:text-indigo-700"
              spellCheck={false}
            />
            <Pencil size={12} className="text-slate-300 group-hover:text-slate-500" />
          </label>
        </Tooltip>

        <div className="mx-1 h-7 w-px bg-slate-200" />

        <Button variant="primary" icon={Plus} onClick={() => setNewTableOpen(true)}>
          Nowa tabela
        </Button>
        <Tooltip content="Dodaj relację (klucz obcy) między tabelami: 1:N, 1:1 lub N:M." width={220} side="bottom">
          <Button icon={GitBranch} onClick={() => actions.addRelation(selectedId ? { childTableId: selectedId } : {})} disabled={schema.tables.length < 1}>
            Relacja
          </Button>
        </Tooltip>

        <div className="mx-1 h-7 w-px bg-slate-200" />
        <IconButton icon={Undo2} onClick={undo} disabled={!h.past.length} tip="Cofnij (Ctrl+Z)" />
        <IconButton icon={Redo2} onClick={redo} disabled={!h.future.length} tip="Ponów (Ctrl+Y)" />

        <div className="flex-1" />

        <Tooltip content="Wczytaj przykładowy schemat sklepu internetowego (kategorie, produkty, klienci, zamówienia)." width={240} side="bottom">
          <Button
            variant="ghost"
            icon={Sparkles}
            onClick={() =>
              setConfirm({
                title: 'Wczytać przykładowy schemat?',
                icon: Sparkles,
                message: 'Obecny projekt zostanie zastąpiony przykładem „sklep internetowy”. Zmianę możesz cofnąć (Ctrl+Z). Jeśli chcesz zachować projekt – najpierw go wyeksportuj.',
                confirmLabel: 'Wczytaj przykład',
                onConfirm: () => replaceSchema(createSampleSchema(), 'Wczytano przykład'),
              })
            }
          >
            <span className="hidden lg:inline">Przykład</span>
          </Button>
        </Tooltip>
        <IconButton
          icon={FilePlus2}
          tip="Nowy, pusty projekt"
          onClick={() =>
            setConfirm({
              title: 'Utworzyć pusty projekt?',
              icon: FilePlus2,
              danger: true,
              message: 'Wszystkie tabele i relacje zostaną usunięte. Możesz to cofnąć (Ctrl+Z).',
              confirmLabel: 'Wyczyść',
              onConfirm: () => replaceSchema(emptySchema(), 'Utworzono pusty projekt'),
            })
          }
        />
        <IconButton icon={Upload} tip="Importuj projekt z pliku JSON" onClick={() => fileRef.current?.click()} />
        <IconButton icon={Download} tip="Eksportuj projekt do pliku JSON" onClick={exportJson} />
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) importJson(file);
            e.target.value = '';
          }}
        />
        <div className="mx-1 h-7 w-px bg-slate-200" />
        <Button variant="ghost" icon={HelpCircle} onClick={() => setHelpOpen(true)}>
          <span className="hidden lg:inline">Pomoc</span>
        </Button>
        <IconButton icon={panelOpen ? PanelRightClose : PanelRightOpen} tip={panelOpen ? 'Ukryj panel' : 'Pokaż panel'} onClick={() => setPanelOpen((p) => !p)} />
      </header>

      <div className="flex min-h-0 flex-1">
        {/* ─── Płótno ─── */}
        <main ref={canvasWrapRef} className="relative min-w-0 flex-1">
          <Canvas
            schema={schema}
            view={view}
            setView={setView}
            selectedTableId={selectedId}
            onSelectTable={(id) => actions.selectTable(id)}
            onMoveTable={actions.moveTable}
            onEditRelation={actions.editRelation}
            onConnect={onConnect}
            onAddTable={() => setNewTableOpen(true)}
            onLoadSample={() => replaceSchema(createSampleSchema(), 'Wczytano przykład')}
            fitSignal={fitSignal}
          />
        </main>

        {/* ─── Panel boczny ─── */}
        {panelOpen && (
          <aside className="flex w-[440px] shrink-0 flex-col border-l border-slate-200 bg-slate-50/70">
            <div className="flex gap-1 border-b border-slate-200 bg-white p-1.5">
              <TabBtn active={tab === 'table'} onClick={() => setTab('table')} icon={Table2}>
                {selectedTable ? selectedTable.name || 'Tabela' : 'Projekt'}
              </TabBtn>
              <TabBtn active={tab === 'sql'} onClick={() => setTab('sql')} icon={Code2}>
                Kod SQL
                {errorCount > 0 && <span className="rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">{errorCount}</span>}
              </TabBtn>
            </div>
            <div className={`min-h-0 flex-1 ${tab === 'sql' ? '' : 'thin-scroll overflow-y-auto'}`}>
              {tab === 'table' ? (
                <Inspector key={selectedTable?.id ?? 'overview'} schema={schema} table={selectedTable} issues={issues} actions={actions} />
              ) : (
                <SqlPanel
                  schema={schema}
                  issues={issues}
                  notify={notify}
                  onSelectIssue={(i) => {
                    if (i.relationId) actions.editRelation(i.relationId);
                    else if (i.tableId) actions.selectTable(i.tableId, true);
                  }}
                />
              )}
            </div>
          </aside>
        )}
      </div>

      <NewTableModal open={newTableOpen} onClose={() => setNewTableOpen(false)} existing={schema.tables.map((t) => t.name.toLowerCase())} onCreate={createTable} />

      <RelationModal
        open={!!relModal}
        initial={relModal?.initial}
        schema={schema}
        onClose={() => setRelModal(null)}
        onSave={saveRelation}
        onDelete={deleteRelation}
        onFixType={(tid, cid, pc) => actions.updateColumn(tid, cid, { type: pc.type, length: pc.length, un: pc.un })}
      />

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
      <ConfirmModal confirm={confirm} onClose={() => setConfirm(null)} />
      <Toast toast={toast} />
    </div>
  );
}

const TabBtn = ({ active, onClick, icon: Icon, children }) => (
  <button
    onClick={onClick}
    className={`flex flex-1 items-center justify-center gap-2 truncate rounded-lg px-3 py-2 text-[13px] font-medium transition ${
      active ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
    }`}
  >
    <Icon size={15} className="shrink-0" />
    <span className="truncate">{children}</span>
  </button>
);

function NewTableModal({ open, onClose, onCreate, existing }) {
  const [name, setName] = useState('');
  const [withId, setWithId] = useState(true);
  const ref = useAutoFocus(open);

  useEffect(() => {
    if (open) setName(`tabela_${existing.length + 1}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const trimmed = name.trim();
  const error = !trimmed ? 'Podaj nazwę tabeli.' : existing.includes(trimmed.toLowerCase()) ? 'Tabela o tej nazwie już istnieje.' : null;
  const suggestion = trimmed && /[^A-Za-z0-9_]/.test(trimmed) ? slug(trimmed) : null;

  const submit = (e) => {
    e?.preventDefault();
    if (error) return;
    onCreate(trimmed, withId);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nowa tabela"
      icon={Table2}
      width="max-w-md"
      footer={
        <>
          <Button onClick={onClose}>Anuluj</Button>
          <Button variant="primary" icon={Plus} disabled={!!error} onClick={submit}>
            Utwórz tabelę
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label>Nazwa tabeli</Label>
          <input ref={ref} value={name} onChange={(e) => setName(e.target.value)} className={`${inputCls} font-mono`} placeholder="np. klienci" />
          {error && trimmed && <p className="mt-1.5 text-xs text-rose-600">{error}</p>}
          {suggestion && (
            <p className="mt-1.5 text-xs text-amber-700">
              Unikaj spacji i polskich znaków. Propozycja:{' '}
              <button type="button" onClick={() => setName(suggestion)} className="font-mono font-semibold underline">
                {suggestion}
              </button>
            </p>
          )}
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            Dobre praktyki: małe litery, słowa oddzielone podkreślnikiem, zwykle liczba mnoga – np. <code className="text-slate-700">klienci</code>,{' '}
            <code className="text-slate-700">pozycje_zamowienia</code>.
          </p>
        </div>
        <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200 p-3 hover:bg-slate-50">
          <input type="checkbox" checked={withId} onChange={(e) => setWithId(e.target.checked)} className="mt-0.5 h-4 w-4 accent-indigo-600" />
          <span className="text-sm">
            <span className="font-medium text-slate-800">
              Dodaj kolumnę <code className="font-mono">id</code>
            </span>
            <span className="block text-xs text-slate-500">INT UNSIGNED · PK · AUTO_INCREMENT – klasyczny klucz główny</span>
          </span>
        </label>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}
