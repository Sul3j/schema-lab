import { formatType, hasParam, isIntegerType, isLobType, isNumericType, TYPE_INFO, RESERVED, typeCat } from './mysql.js';

const q = (name) => '`' + String(name ?? '').replace(/`/g, '``') + '`';

const slug = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L')
    .replace(/[^A-Za-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();

const SQL_LITERALS = new Set([
  'NULL',
  'TRUE',
  'FALSE',
  'CURRENT_TIMESTAMP',
  'CURRENT_TIMESTAMP()',
  'NOW()',
  'CURRENT_DATE',
  'CURRENT_TIME',
]);

export function formatDefault(raw, col) {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const up = s.toUpperCase();
  if (SQL_LITERALS.has(up)) return up;
  if (/^-?\d+(\.\d+)?$/.test(s) && (isNumericType(col.type) || typeCat(col.type) === 'bool' || col.type === 'YEAR')) return s;
  if (/^'.*'$/s.test(s)) return s;
  if (/^\(.*\)$/s.test(s)) return s; // wyrażenie, np. (UUID())
  return `'${s.replace(/'/g, "''")}'`;
}

function columnDefinition(col) {
  const parts = [q(col.name), formatType(col)];
  if (col.pk || col.nn) parts.push('NOT NULL');
  else parts.push('NULL');
  const def = formatDefault(col.def, col);
  if (def !== null) parts.push(`DEFAULT ${def}`);
  if (col.ai) parts.push('AUTO_INCREMENT');
  return parts.join(' ');
}

const truncate = (s, n = 64) => (s.length > n ? s.slice(0, n) : s);

export const fkName = (child, col) => truncate(`fk_${slug(child.name)}_${slug(col.name)}`);

/**
 * Generuje skrypt MySQL dla całego schematu.
 */
export function generateSQL(schema, opts = {}) {
  const { createDatabase = true, dropTables = false, comments = true } = opts;
  const tables = schema.tables;
  const byId = Object.fromEntries(tables.map((t) => [t.id, t]));
  const out = [];
  const dbName = slug(schema.name) || 'moja_baza';

  if (comments) {
    out.push('-- ==================================================');
    out.push(`--  Projekt: ${schema.name || 'bez nazwy'}`);
    out.push('--  Wygenerowano w SchemaLab (dialekt MySQL 8)');
    out.push(`--  Tabele: ${tables.length}, relacje: ${schema.relations.length}`);
    out.push('-- ==================================================');
    out.push('');
  }

  if (createDatabase) {
    out.push(`CREATE DATABASE IF NOT EXISTS ${q(dbName)}`);
    out.push('  DEFAULT CHARACTER SET utf8mb4');
    out.push('  COLLATE utf8mb4_polish_ci;');
    out.push(`USE ${q(dbName)};`);
    out.push('');
  }

  if (dropTables && tables.length) {
    if (comments) out.push('-- Usunięcie starych tabel (wyłączamy na chwilę sprawdzanie kluczy obcych)');
    out.push('SET FOREIGN_KEY_CHECKS = 0;');
    for (const t of [...tables].reverse()) out.push(`DROP TABLE IF EXISTS ${q(t.name)};`);
    out.push('SET FOREIGN_KEY_CHECKS = 1;');
    out.push('');
  }

  for (const t of tables) {
    const lines = t.columns.map((c) => '  ' + columnDefinition(c));
    const pkCols = t.columns.filter((c) => c.pk);
    if (pkCols.length) lines.push(`  PRIMARY KEY (${pkCols.map((c) => q(c.name)).join(', ')})`);

    const singlePk = pkCols.length === 1 ? pkCols[0].id : null;
    const uniqueCols = new Set(t.columns.filter((c) => c.uq && c.id !== singlePk).map((c) => c.id));
    // relacja 1:1 wymaga UNIQUE na kolumnie FK
    for (const r of schema.relations) {
      if (r.type === '1:1' && r.childTableId === t.id && r.childColId !== singlePk) uniqueCols.add(r.childColId);
    }
    for (const cid of uniqueCols) {
      const c = t.columns.find((x) => x.id === cid);
      if (c) lines.push(`  UNIQUE KEY ${q(truncate(`uq_${slug(t.name)}_${slug(c.name)}`))} (${q(c.name)})`);
    }

    if (comments) {
      out.push(`-- Tabela: ${t.name}`);
    }
    out.push(`CREATE TABLE ${q(t.name)} (`);
    out.push(lines.join(',\n'));
    out.push(') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_polish_ci;');
    out.push('');
  }

  const rels = schema.relations.filter((r) => byId[r.childTableId] && byId[r.parentTableId]);
  if (rels.length) {
    if (comments) {
      out.push('-- --------------------------------------------------');
      out.push('--  Klucze obce (FOREIGN KEY)');
      out.push('--  Dodajemy je na końcu przez ALTER TABLE, dzięki czemu');
      out.push('--  kolejność tworzenia tabel nie ma znaczenia.');
      out.push('-- --------------------------------------------------');
    }
    for (const r of rels) {
      const child = byId[r.childTableId];
      const parent = byId[r.parentTableId];
      const cc = child.columns.find((c) => c.id === r.childColId);
      const pc = parent.columns.find((c) => c.id === r.parentColId);
      if (!cc || !pc) continue;
      if (comments) out.push(`-- ${child.name}.${cc.name} → ${parent.name}.${pc.name}  (${r.type === '1:1' ? 'jeden do jednego' : 'jeden do wielu'})`);
      out.push(`ALTER TABLE ${q(child.name)}`);
      out.push(`  ADD CONSTRAINT ${q(fkName(child, cc))}`);
      out.push(`  FOREIGN KEY (${q(cc.name)})`);
      out.push(`  REFERENCES ${q(parent.name)} (${q(pc.name)})`);
      out.push(`  ON DELETE ${r.onDelete || 'RESTRICT'}`);
      out.push(`  ON UPDATE ${r.onUpdate || 'RESTRICT'};`);
      out.push('');
    }
  }

  return out.join('\n').trimEnd() + '\n';
}

// ─────────────────────────────────────────────────────────────
//  Walidacja – błędy i wskazówki dla ucznia
// ─────────────────────────────────────────────────────────────

const sameTypeSignature = (a, b) => {
  const norm = (c) => {
    // VARCHAR długość musi się zgadzać tylko „rozsądnie” – MySQL wymaga tego samego charsetu, a długość może się różnić.
    const len = ['DECIMAL'].includes(c.type) ? String(c.length).replace(/\s/g, '') : '';
    return `${c.type === 'BOOLEAN' ? 'TINYINT' : c.type}|${len}|${isNumericType(c.type) ? !!c.un : ''}`;
  };
  return norm(a) === norm(b);
};

export function validateSchema(schema) {
  const issues = [];
  const add = (level, message, tableId = null, extra = {}) => issues.push({ level, message, tableId, ...extra });
  const tableNames = new Map();

  for (const t of schema.tables) {
    const tn = t.name.trim();
    if (!tn) add('error', 'Tabela bez nazwy.', t.id);
    const low = tn.toLowerCase();
    if (tableNames.has(low)) add('error', `Dwie tabele mają tę samą nazwę „${tn}”.`, t.id);
    tableNames.set(low, t.id);
    if (tn && RESERVED.has(tn.toUpperCase()))
      add('info', `„${tn}” to słowo zarezerwowane MySQL. Zadziała w \`backtickach\`, ale lepiej wybrać inną nazwę (np. „${tn}s” lub „${tn}_tab”).`, t.id);
    if (tn && /[^A-Za-z0-9_]/.test(tn))
      add('warning', `Nazwa tabeli „${tn}” zawiera spacje, polskie znaki lub symbole. Zalecane: litery a–z, cyfry i _ (np. „${slug(tn)}”).`, t.id);

    if (!t.columns.length) {
      add('error', `Tabela „${tn}” nie ma żadnej kolumny – MySQL wymaga co najmniej jednej.`, t.id);
      continue;
    }

    const pk = t.columns.filter((c) => c.pk);
    if (!pk.length) add('warning', `Tabela „${tn}” nie ma klucza głównego (PK). Dodaj np. kolumnę id INT PK AI.`, t.id);

    const colNames = new Set();
    const ai = t.columns.filter((c) => c.ai);
    if (ai.length > 1) add('error', `„${tn}”: tylko jedna kolumna może mieć AUTO_INCREMENT.`, t.id);

    for (const c of t.columns) {
      const cn = c.name.trim();
      const where = `${tn}.${cn || '?'}`;
      if (!cn) add('error', `„${tn}”: kolumna bez nazwy.`, t.id);
      if (colNames.has(cn.toLowerCase())) add('error', `„${tn}”: powtórzona nazwa kolumny „${cn}”.`, t.id);
      colNames.add(cn.toLowerCase());
      if (cn && RESERVED.has(cn.toUpperCase())) add('info', `${where}: „${cn}” to słowo zarezerwowane MySQL – lepiej go unikać.`, t.id);
      if (cn && /[^A-Za-z0-9_]/.test(cn)) add('warning', `${where}: nazwa zawiera spacje/polskie znaki – zalecane „${slug(cn)}”.`, t.id);

      const info = TYPE_INFO[c.type];
      if (info?.required && !String(c.length ?? '').trim()) add('error', `${where}: typ ${c.type} wymaga parametru (np. ${c.type}(${info.defaultParam})).`, t.id);
      if (c.type === 'VARCHAR' && Number(c.length) > 16383) add('warning', `${where}: VARCHAR(${c.length}) jest bardzo długi – rozważ TEXT.`, t.id);
      if (c.un && ['decimal', 'float'].includes(typeCat(c.type)))
        add('info', `${where}: UNSIGNED dla ${c.type} jest przestarzałe od MySQL 8.0.17 – zamiast tego możesz użyć CHECK (${cn} >= 0).`, t.id);
      if (c.ai && !isIntegerType(c.type)) add('error', `${where}: AUTO_INCREMENT wymaga typu całkowitego.`, t.id);
      if (c.ai && !c.pk && !c.uq) add('error', `${where}: kolumna AUTO_INCREMENT musi być kluczem (zaznacz PK lub UQ).`, t.id);
      if (c.ai && pk.length > 1 && c.pk && pk[0].id !== c.id)
        add('warning', `${where}: w złożonym PK kolumna AUTO_INCREMENT powinna być pierwsza.`, t.id);
      if (isLobType(c.type) && (c.pk || c.uq))
        add('error', `${where}: kolumna ${c.type} nie może być PK/UNIQUE bez długości prefiksu. Użyj VARCHAR.`, t.id);
      if (isLobType(c.type) && String(c.def ?? '').trim() && !/^\(.*\)$/.test(String(c.def).trim()))
        add('warning', `${where}: ${c.type} nie może mieć zwykłej wartości DEFAULT (tylko wyrażenie w nawiasach, MySQL 8.0.13+).`, t.id);
      if (c.ai && String(c.def ?? '').trim()) add('error', `${where}: kolumna AUTO_INCREMENT nie może mieć wartości DEFAULT.`, t.id);
      if ((c.pk || c.nn) && String(c.def ?? '').trim().toUpperCase() === 'NULL')
        add('error', `${where}: kolumna NOT NULL nie może mieć DEFAULT NULL.`, t.id);
      if (['FLOAT', 'DOUBLE'].includes(c.type) && /cena|kwota|price|saldo|koszt|wartosc|amount/i.test(cn))
        add('info', `${where}: dla kwot pieniężnych lepszy jest DECIMAL(10,2) – FLOAT zaokrągla.`, t.id);
      if (hasParam(c.type) && c.type === 'DECIMAL' && c.length && !/^\s*\d+\s*(,\s*\d+\s*)?$/.test(c.length))
        add('error', `${where}: niepoprawna precyzja DECIMAL – wpisz np. 10,2.`, t.id);
    }
  }

  const byId = Object.fromEntries(schema.tables.map((t) => [t.id, t]));
  for (const r of schema.relations) {
    const child = byId[r.childTableId];
    const parent = byId[r.parentTableId];
    const cc = child?.columns.find((c) => c.id === r.childColId);
    const pc = parent?.columns.find((c) => c.id === r.parentColId);
    if (!cc || !pc) continue;
    const label = `FK ${child.name}.${cc.name} → ${parent.name}.${pc.name}`;
    const relExtra = { relationId: r.id };
    if (!sameTypeSignature(cc, pc))
      add('error', `${label}: typy kolumn się różnią (${formatType(cc)} vs ${formatType(pc)}). MySQL odrzuci klucz obcy – typ i UNSIGNED muszą być identyczne.`, child.id, relExtra);
    const pkCols = parent.columns.filter((c) => c.pk);
    const referencesUnique = (pc.pk && pkCols.length === 1) || pc.uq;
    if (!referencesUnique)
      add('error', `${label}: klucz obcy powinien wskazywać na PK lub kolumnę UNIQUE w tabeli „${parent.name}”.`, child.id, relExtra);
    if ((r.onDelete === 'SET NULL' || r.onUpdate === 'SET NULL') && (cc.nn || cc.pk))
      add('error', `${label}: SET NULL wymaga, aby kolumna „${cc.name}” mogła przyjmować NULL (wyłącz NN).`, child.id, relExtra);
    if (r.type === '1:1' && !cc.uq && !(cc.pk && child.columns.filter((c) => c.pk).length === 1))
      add('info', `${label}: relacja 1:1 – do kolumny FK zostanie dodany UNIQUE.`, child.id, relExtra);
  }

  const order = { error: 0, warning: 1, info: 2 };
  return issues.sort((a, b) => order[a.level] - order[b.level]);
}

export { slug };
