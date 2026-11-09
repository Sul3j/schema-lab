import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KeyRound, Link2, Maximize, Minus, Plus, Pencil, Table2, Sparkles, MousePointer2, X, Lightbulb } from 'lucide-react';
import { HEADER_HEIGHT, ROW_HEIGHT, TABLE_WIDTH, TABLE_COLORS, shortType, tableHeight, formatType } from '../lib/mysql.js';
import { Button, Tooltip, TipBody } from './ui.jsx';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const SVG_OFFSET = 5000;
const STUB = 16;

function rowCenterY(table, colId) {
  const idx = table.columns.findIndex((c) => c.id === colId);
  return table.y + HEADER_HEIGHT + Math.max(0, idx) * ROW_HEIGHT + ROW_HEIGHT / 2;
}

/** Oblicza geometrię linii relacji (od dziecka/FK do rodzica/PK) */
function relationGeometry(child, childColId, parent, parentColId) {
  const cy = rowCenterY(child, childColId);
  const py = rowCenterY(parent, parentColId);
  let sx, sd, ex, ed;
  if (child.id !== parent.id && child.x + TABLE_WIDTH + 40 <= parent.x) {
    sx = child.x + TABLE_WIDTH; sd = 1; ex = parent.x; ed = -1;
  } else if (child.id !== parent.id && parent.x + TABLE_WIDTH + 40 <= child.x) {
    sx = child.x; sd = -1; ex = parent.x + TABLE_WIDTH; ed = 1;
  } else {
    sx = child.x + TABLE_WIDTH; sd = 1; ex = parent.x + TABLE_WIDTH; ed = 1;
  }
  const a = { x: sx + sd * STUB, y: cy };
  const b = { x: ex + ed * STUB, y: py };
  let c1, c2;
  if (sd === ed) {
    const cx = Math.max(a.x, b.x) + 60;
    c1 = { x: cx, y: cy };
    c2 = { x: cx, y: py };
  } else {
    const off = Math.max(30, Math.abs(b.x - a.x) / 2);
    c1 = { x: a.x + sd * off, y: cy };
    c2 = { x: b.x + ed * off, y: py };
  }
  const d = `M ${sx} ${cy} L ${a.x} ${a.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${b.x} ${b.y} L ${ex} ${py}`;
  return { d, sx, sd, cy, ex, ed, py, mid: bezierPoint(a, c1, c2, b, 0.5) };
}

function bezierPoint(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
}

function RelationLine({ rel, geo, active, childCol, parentCol, child, parent, onHover, onClick }) {
  const color = active ? '#6366f1' : '#94a3b8';
  const w = active ? 2.25 : 1.6;
  const { sx, sd, cy, ex, ed, py } = geo;
  const many = rel.type !== '1:1';
  const optionalParent = !childCol.nn && !childCol.pk;

  return (
    <g onPointerEnter={() => onHover(rel.id)} onPointerLeave={() => onHover(null)}>
      <path d={geo.d} fill="none" stroke="transparent" strokeWidth={16} style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
        onPointerDown={(e) => e.stopPropagation()} onClick={() => onClick(rel.id)} />
      <path d={geo.d} fill="none" stroke={color} strokeWidth={w} style={{ pointerEvents: 'none' }} strokeLinecap="round" />

      {/* Strona dziecka (FK): kurza stopka = „wiele” */}
      {many ? (
        <g stroke={color} strokeWidth={w} fill="none" style={{ pointerEvents: 'none' }}>
          <path d={`M ${sx + sd * 14} ${cy} L ${sx} ${cy - 7} M ${sx + sd * 14} ${cy} L ${sx} ${cy + 7}`} />
          <path d={`M ${sx + sd * 17} ${cy - 6} L ${sx + sd * 17} ${cy + 6}`} />
        </g>
      ) : (
        <path d={`M ${sx + sd * 9} ${cy - 6} L ${sx + sd * 9} ${cy + 6}`} stroke={color} strokeWidth={w} style={{ pointerEvents: 'none' }} />
      )}

      {/* Strona rodzica (PK): „jeden” (|| = dokładnie jeden, o| = zero lub jeden) */}
      <g stroke={color} strokeWidth={w} style={{ pointerEvents: 'none' }}>
        <path d={`M ${ex + ed * 7} ${py - 6} L ${ex + ed * 7} ${py + 6}`} />
        {optionalParent ? (
          <circle cx={ex + ed * 14} cy={py} r={3.5} fill="#fff" />
        ) : (
          <path d={`M ${ex + ed * 12} ${py - 6} L ${ex + ed * 12} ${py + 6}`} />
        )}
      </g>

      <text x={sx + sd * 26} y={cy - 7} textAnchor="middle" fontSize={11} fontWeight={700} fill={color} style={{ pointerEvents: 'none' }}>
        {many ? 'N' : '1'}
      </text>
      <text x={ex + ed * 26} y={py - 7} textAnchor="middle" fontSize={11} fontWeight={700} fill={color} style={{ pointerEvents: 'none' }}>
        1
      </text>

      {active && (
        <foreignObject x={geo.mid.x - 120} y={geo.mid.y - 34} width={240} height={30} style={{ pointerEvents: 'none', overflow: 'visible' }}>
          <div className="flex justify-center">
            <div className="rounded-md bg-indigo-600 px-2 py-1 font-mono text-[10.5px] whitespace-nowrap text-white shadow-md">
              {child.name}.{childCol.name} → {parent.name}.{parentCol.name}
            </div>
          </div>
        </foreignObject>
      )}
    </g>
  );
}

function TableNode({ table, selected, related, fkColIds, connecting, connectTarget, connectSource, onHeaderDown, onHandleDown, onHover }) {
  const color = TABLE_COLORS[table.color] ?? TABLE_COLORS.indigo;
  return (
    <div
      data-table-node={table.id}
      onPointerDown={(e) => onHeaderDown(e, table)}
      onPointerEnter={() => onHover(table.id)}
      onPointerLeave={() => onHover(null)}
      className={`absolute rounded-xl bg-white transition-shadow select-none ${
        connectTarget?.tableId === table.id && !connectTarget?.colId
          ? 'shadow-xl ring-2 ring-sky-400'
          : selected
          ? 'shadow-xl ring-2 ring-indigo-500'
          : related
            ? 'shadow-lg ring-1 ring-indigo-300'
            : 'shadow-md ring-1 ring-slate-200 hover:shadow-lg hover:ring-slate-300'
      }`}
      style={{ left: table.x, top: table.y, width: TABLE_WIDTH, height: tableHeight(table) }}
    >
      <div
        className="group/h flex cursor-grab items-center gap-2 rounded-t-xl border-b border-slate-100 px-3 active:cursor-grabbing"
        style={{ height: HEADER_HEIGHT, boxShadow: `inset 0 3px 0 ${color}`, background: `linear-gradient(to bottom, ${color}14, transparent)` }}
      >
        <Table2 size={15} style={{ color }} className="shrink-0" />
        <span className="flex-1 truncate text-[13.5px] font-semibold text-slate-800">{table.name || <i className="text-slate-400">bez nazwy</i>}</span>
        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">{table.columns.length}</span>
        <Pencil size={13} className="text-slate-300 opacity-0 transition group-hover/h:opacity-100" />
      </div>

      {table.columns.length === 0 && (
        <div className="flex items-center px-3 text-xs text-slate-400 italic" style={{ height: ROW_HEIGHT }}>
          Brak kolumn – dodaj je w panelu →
        </div>
      )}

      {table.columns.map((c) => {
        const isFk = fkColIds.has(c.id);
        const isTarget = connectTarget?.colId === c.id && connectTarget?.tableId === table.id;
        const isSource = connectSource?.colId === c.id && connectSource?.tableId === table.id;
        return (
          <div
            key={c.id}
            data-col-id={c.id}
            data-table-id={table.id}
            className={`group/col relative flex items-center gap-2 px-3 text-[12.5px] ${
              isTarget ? 'bg-indigo-100' : isSource ? 'bg-indigo-50' : connecting ? 'hover:bg-indigo-50' : 'hover:bg-slate-50'
            }`}
            style={{ height: ROW_HEIGHT }}
          >
            <span className="flex w-4 shrink-0 justify-center">
              {c.pk ? (
                <KeyRound size={13} className="text-amber-500" />
              ) : isFk ? (
                <Link2 size={13} className="text-sky-500" />
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
              )}
            </span>
            <Tooltip
              width={240}
              content={
                <TipBody title={`${c.name}`} example={formatType(c) + (c.pk ? ' PRIMARY KEY' : '') + (c.ai ? ' AUTO_INCREMENT' : '') + (!c.pk && c.nn ? ' NOT NULL' : '') + (c.uq ? ' UNIQUE' : '')}>
                  {c.pk ? 'Klucz główny tabeli. ' : ''}
                  {isFk ? 'Klucz obcy – wskazuje na wiersz w innej tabeli. ' : ''}
                  {!c.pk && !isFk ? 'Zwykła kolumna. ' : ''}
                  {!c.nn && !c.pk ? 'Może być pusta (NULL).' : ''}
                </TipBody>
              }
              className="min-w-0 flex-1"
              delay={500}
            >
              <span className={`min-w-0 truncate ${c.pk ? 'font-semibold text-slate-900' : c.nn ? 'font-medium text-slate-700' : 'text-slate-500'}`}>
                {c.name || <i className="text-slate-300">bez nazwy</i>}
              </span>
            </Tooltip>
            <span className="flex shrink-0 items-center gap-1">
              {c.ai && <Chip className="bg-violet-50 text-violet-600">AI</Chip>}
              {c.uq && <Chip className="bg-sky-50 text-sky-600">UQ</Chip>}
              {c.nn && !c.pk && <Chip className="bg-rose-50 text-rose-500">NN</Chip>}
              <span className="max-w-[92px] truncate font-mono text-[11px] text-slate-400">{shortType(c)}</span>
            </span>

            {/* uchwyty do przeciągania relacji */}
            {['left', 'right'].map((side) => (
              <span
                key={side}
                onPointerDown={(e) => onHandleDown(e, table, c)}
                className={`absolute top-1/2 z-10 h-3 w-3 -translate-y-1/2 cursor-crosshair rounded-full border-2 border-white bg-indigo-500 shadow ring-1 ring-indigo-300 transition ${
                  side === 'left' ? '-left-1.5' : '-right-1.5'
                } ${isSource || isTarget ? 'scale-110 opacity-100' : connecting ? 'opacity-40' : 'opacity-0 group-hover/col:opacity-100'}`}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

const Chip = ({ children, className }) => (
  <span className={`rounded px-1 py-px text-[9px] leading-tight font-bold tracking-wide ${className}`}>{children}</span>
);

export default function Canvas({
  schema,
  view,
  setView,
  selectedTableId,
  onSelectTable,
  onMoveTable,
  onEditRelation,
  onConnect,
  onAddTable,
  onLoadSample,
  fitSignal,
}) {
  const rootRef = useRef(null);
  const drag = useRef(null);
  const [connect, setConnect] = useState(null);
  const [hoverRel, setHoverRel] = useState(null);
  const [hoverTable, setHoverTable] = useState(null);
  const [panning, setPanning] = useState(false);
  const [showHint, setShowHint] = useState(() => {
    try {
      return localStorage.getItem('schemalab-hint-hidden') !== '1';
    } catch {
      return true;
    }
  });

  const latest = useRef({});
  latest.current = { view, onMoveTable, onConnect, setView, onSelectTable };

  const byId = useMemo(() => Object.fromEntries(schema.tables.map((t) => [t.id, t])), [schema.tables]);
  const fkColIds = useMemo(() => new Set(schema.relations.map((r) => r.childColId)), [schema.relations]);

  const toWorld = (clientX, clientY) => {
    const r = rootRef.current.getBoundingClientRect();
    const v = latest.current.view;
    return { x: (clientX - r.left - v.x) / v.zoom, y: (clientY - r.top - v.y) / v.zoom };
  };

  // Globalne nasłuchiwanie ruchu myszy podczas przeciągania
  useEffect(() => {
    const move = (e) => {
      const d = drag.current;
      if (!d) return;
      const { view, onMoveTable, setView } = latest.current;
      const dx = e.clientX - d.sx;
      const dy = e.clientY - d.sy;
      if (d.kind === 'pan') {
        if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
        setView((v) => ({ ...v, x: d.ox + dx, y: d.oy + dy }));
      } else if (d.kind === 'table') {
        const nx = Math.round((d.ox + dx / view.zoom) / 10) * 10;
        const ny = Math.round((d.oy + dy / view.zoom) / 10) * 10;
        onMoveTable(d.id, nx, ny);
      } else if (d.kind === 'connect') {
        const p = toWorld(e.clientX, e.clientY);
        const hit = document.elementFromPoint(e.clientX, e.clientY);
        const el = hit?.closest?.('[data-col-id]');
        const node = hit?.closest?.('[data-table-node]');
        let target = el
          ? { tableId: el.dataset.tableId, colId: el.dataset.colId }
          : node && node.dataset.tableNode !== d.from.tableId
            ? { tableId: node.dataset.tableNode, colId: null }
            : null;
        if (target && target.tableId === d.from.tableId && target.colId === d.from.colId) target = null;
        d.target = target;
        setConnect((c) => (c ? { ...c, point: p, target } : c));
      }
    };
    const up = () => {
      const d = drag.current;
      drag.current = null;
      setPanning(false);
      if (!d) return;
      if (d.kind === 'pan' && !d.moved) latest.current.onSelectTable(null);
      if (d.kind === 'connect') {
        setConnect(null);
        if (d.target) latest.current.onConnect(d.from, d.target);
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, []);

  // Zoom kółkiem myszy (w stronę kursora)
  useEffect(() => {
    const el = rootRef.current;
    const onWheel = (e) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const mx = e.clientX - r.left;
      const my = e.clientY - r.top;
      setView((v) => {
        const zoom = clamp(v.zoom * Math.exp(-e.deltaY * 0.0015), 0.25, 2);
        const k = zoom / v.zoom;
        return { zoom, x: mx - (mx - v.x) * k, y: my - (my - v.y) * k };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [setView]);

  const zoomBy = (factor) => {
    const r = rootRef.current.getBoundingClientRect();
    const mx = r.width / 2;
    const my = r.height / 2;
    setView((v) => {
      const zoom = clamp(v.zoom * factor, 0.25, 2);
      const k = zoom / v.zoom;
      return { zoom, x: mx - (mx - v.x) * k, y: my - (my - v.y) * k };
    });
  };

  const fit = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    const tables = schema.tables;
    if (!tables.length) {
      setView({ x: 0, y: 0, zoom: 1 });
      return;
    }
    const minX = Math.min(...tables.map((t) => t.x));
    const minY = Math.min(...tables.map((t) => t.y));
    const maxX = Math.max(...tables.map((t) => t.x + TABLE_WIDTH));
    const maxY = Math.max(...tables.map((t) => t.y + tableHeight(t)));
    const r = el.getBoundingClientRect();
    const pad = 70;
    const zoom = clamp(Math.min((r.width - pad * 2) / (maxX - minX), (r.height - pad * 2) / (maxY - minY)), 0.3, 1.1);
    setView({
      zoom,
      x: (r.width - (maxX - minX) * zoom) / 2 - minX * zoom,
      y: (r.height - (maxY - minY) * zoom) / 2 - minY * zoom,
    });
  }, [schema.tables, setView]);

  useEffect(() => {
    if (fitSignal) requestAnimationFrame(fit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitSignal]);

  const onBackgroundDown = (e) => {
    if (e.button !== 0 && e.button !== 1) return;
    drag.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, ox: view.x, oy: view.y, moved: false };
    setPanning(true);
  };

  const onHeaderDown = (e, table) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    onSelectTable(table.id);
    drag.current = { kind: 'table', id: table.id, sx: e.clientX, sy: e.clientY, ox: table.x, oy: table.y };
  };

  const onHandleDown = (e, table, col) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const from = { tableId: table.id, colId: col.id };
    const rect = e.currentTarget.getBoundingClientRect();
    const start = toWorld(rect.left + rect.width / 2, rect.top + rect.height / 2);
    drag.current = { kind: 'connect', from, sx: e.clientX, sy: e.clientY, target: null };
    setConnect({ from, start, point: start, target: null });
  };

  const focusTable = selectedTableId || hoverTable;
  const gridSize = 24 * view.zoom;

  return (
    <div
      ref={rootRef}
      onPointerDown={onBackgroundDown}
      className={`canvas-grid relative h-full w-full touch-none overflow-hidden ${panning ? 'cursor-grabbing' : connect ? 'cursor-crosshair' : 'cursor-default'}`}
      style={{ backgroundSize: `${gridSize}px ${gridSize}px`, backgroundPosition: `${view.x}px ${view.y}px` }}
    >
      <div className="absolute top-0 left-0 origin-top-left" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}>
        <svg
          className="absolute overflow-visible"
          style={{ left: -SVG_OFFSET, top: -SVG_OFFSET, width: SVG_OFFSET * 2, height: SVG_OFFSET * 2, pointerEvents: 'none' }}
        >
          <g transform={`translate(${SVG_OFFSET}, ${SVG_OFFSET})`}>
            {schema.relations.map((r) => {
              const child = byId[r.childTableId];
              const parent = byId[r.parentTableId];
              const childCol = child?.columns.find((c) => c.id === r.childColId);
              const parentCol = parent?.columns.find((c) => c.id === r.parentColId);
              if (!childCol || !parentCol) return null;
              const geo = relationGeometry(child, r.childColId, parent, r.parentColId);
              const active = hoverRel === r.id || focusTable === child.id || focusTable === parent.id;
              return (
                <RelationLine
                  key={r.id}
                  rel={r}
                  geo={geo}
                  active={active}
                  child={child}
                  parent={parent}
                  childCol={childCol}
                  parentCol={parentCol}
                  onHover={setHoverRel}
                  onClick={onEditRelation}
                />
              );
            })}
          </g>
        </svg>

        {schema.tables.map((t) => (
          <TableNode
            key={t.id}
            table={t}
            selected={selectedTableId === t.id}
            related={
              !!focusTable &&
              focusTable !== t.id &&
              schema.relations.some(
                (r) => (r.childTableId === focusTable && r.parentTableId === t.id) || (r.parentTableId === focusTable && r.childTableId === t.id)
              )
            }
            fkColIds={fkColIds}
            connecting={!!connect}
            connectTarget={connect?.target}
            connectSource={connect?.from}
            onHeaderDown={onHeaderDown}
            onHandleDown={onHandleDown}
            onHover={setHoverTable}
          />
        ))}

        {connect && (
          <svg
            className="absolute overflow-visible"
            style={{ left: -SVG_OFFSET, top: -SVG_OFFSET, width: SVG_OFFSET * 2, height: SVG_OFFSET * 2, pointerEvents: 'none' }}
          >
            <g transform={`translate(${SVG_OFFSET}, ${SVG_OFFSET})`}>
              <path
                d={`M ${connect.start.x} ${connect.start.y} C ${(connect.start.x + connect.point.x) / 2} ${connect.start.y}, ${(connect.start.x + connect.point.x) / 2} ${connect.point.y}, ${connect.point.x} ${connect.point.y}`}
                fill="none"
                stroke="#6366f1"
                strokeWidth={2}
                strokeDasharray="6 4"
                className="animate-dash"
              />
              <circle cx={connect.point.x} cy={connect.point.y} r={4} fill="#6366f1" />
            </g>
          </svg>
        )}
      </div>

      {/* Pusty stan */}
      {schema.tables.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="pointer-events-auto max-w-sm rounded-2xl bg-white/90 p-8 text-center shadow-xl ring-1 ring-slate-200 backdrop-blur" onPointerDown={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Table2 size={24} />
            </div>
            <h3 className="mb-1 text-lg font-semibold text-slate-900">Pusty projekt</h3>
            <p className="mb-5 text-sm text-slate-500">Zacznij od dodania pierwszej tabeli albo wczytaj gotowy przykład sklepu internetowego.</p>
            <div className="flex justify-center gap-2">
              <Button variant="primary" icon={Plus} onClick={onAddTable}>
                Nowa tabela
              </Button>
              <Button icon={Sparkles} onClick={onLoadSample}>
                Przykład
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Podpowiedź obsługi */}
      {showHint && schema.tables.length > 0 && (
        <div
          className="absolute bottom-4 left-4 max-w-xs rounded-xl bg-white/95 p-4 text-xs text-slate-600 shadow-lg ring-1 ring-slate-200 backdrop-blur"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="mb-2 flex items-center gap-2 font-semibold text-slate-800">
            <Lightbulb size={14} className="text-amber-500" /> Jak to działa?
            <button
              className="ml-auto rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              onClick={() => {
                setShowHint(false);
                try {
                  localStorage.setItem('schemalab-hint-hidden', '1');
                } catch {}
              }}
              aria-label="Ukryj podpowiedź"
            >
              <X size={14} />
            </button>
          </div>
          <ul className="space-y-1.5 leading-relaxed">
            <li className="flex gap-2">
              <MousePointer2 size={13} className="mt-0.5 shrink-0 text-slate-400" />
              <span>
                <b>Przeciągnij nagłówek</b> tabeli, aby ją przesunąć. Kliknij, aby edytować.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full border-2 border-white bg-indigo-500 ring-1 ring-indigo-300" />
              <span>
                <b>Przeciągnij kropkę</b> przy kolumnie (np. <code className="text-sky-600">klient_id</code>) na kolumnę PK innej tabeli – powstanie klucz obcy.
              </span>
            </li>
            <li className="flex gap-2">
              <svg width="22" height="14" className="mt-0.5 shrink-0" stroke="#64748b" strokeWidth="1.5" fill="none">
                <path d="M1 7 H21 M1 1 L9 7 L1 13 M15 2 V12 M18 2 V12" />
              </svg>
              <span>
                Linia: <b>kurza stopka</b> = „wiele” (N), <b>kreski</b> = „jeden” (1). Kliknij linię, by ją edytować.
              </span>
            </li>
            <li className="flex gap-2 text-slate-500">
              <span className="w-[13px]" />
              <span>Kółko myszy – zoom, przeciąganie tła – przesuwanie widoku.</span>
            </li>
          </ul>
        </div>
      )}

      {/* Sterowanie zoomem */}
      <div className="absolute right-4 bottom-4 flex items-center gap-0.5 rounded-xl bg-white/95 p-1 shadow-lg ring-1 ring-slate-200 backdrop-blur" onPointerDown={(e) => e.stopPropagation()}>
        <ZoomBtn icon={Minus} tip="Oddal" onClick={() => zoomBy(1 / 1.2)} />
        <button onClick={() => setView((v) => ({ ...v, zoom: 1 }))} className="w-14 rounded-md py-1 text-center text-xs font-semibold text-slate-600 tabular-nums hover:bg-slate-100">
          {Math.round(view.zoom * 100)}%
        </button>
        <ZoomBtn icon={Plus} tip="Przybliż" onClick={() => zoomBy(1.2)} />
        <div className="mx-1 h-5 w-px bg-slate-200" />
        <ZoomBtn icon={Maximize} tip="Dopasuj widok do wszystkich tabel" onClick={fit} />
      </div>
    </div>
  );
}

const ZoomBtn = ({ icon: Icon, tip, onClick }) => (
  <Tooltip content={tip} width={170}>
    <button onClick={onClick} className="flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900">
      <Icon size={15} />
    </button>
  </Tooltip>
);
