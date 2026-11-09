// ─────────────────────────────────────────────────────────────
//  Wiedza o MySQL: typy danych, flagi kolumn, opcje kluczy obcych
// ─────────────────────────────────────────────────────────────

export const uid = () => Math.random().toString(36).slice(2, 10);

/** Grupy typów wyświetlane w liście rozwijanej */
export const TYPE_GROUPS = [
  { group: 'Liczby całkowite', types: ['TINYINT', 'SMALLINT', 'MEDIUMINT', 'INT', 'BIGINT'] },
  { group: 'Liczby z częścią ułamkową', types: ['DECIMAL', 'FLOAT', 'DOUBLE'] },
  { group: 'Tekst', types: ['CHAR', 'VARCHAR', 'TEXT', 'MEDIUMTEXT', 'LONGTEXT', 'ENUM'] },
  { group: 'Data i czas', types: ['DATE', 'DATETIME', 'TIMESTAMP', 'TIME', 'YEAR'] },
  { group: 'Inne', types: ['BOOLEAN', 'JSON', 'BLOB'] },
];

/**
 * cat:    int | decimal | float | string | text | date | bool | json | blob
 * param:  jeśli typ przyjmuje parametr w nawiasie – jego opis
 */
export const TYPE_INFO = {
  TINYINT: { cat: 'int', desc: 'Mała liczba całkowita: −128…127 (UNSIGNED: 0…255).' },
  SMALLINT: { cat: 'int', desc: 'Liczba całkowita: −32 768…32 767 (UNSIGNED: 0…65 535).' },
  MEDIUMINT: { cat: 'int', desc: 'Liczba całkowita: ok. ±8 milionów (UNSIGNED: 0…16 777 215).' },
  INT: { cat: 'int', desc: 'Liczba całkowita: ok. ±2,1 mld (UNSIGNED: 0…4,29 mld). Najczęstszy typ dla kluczy (id).' },
  BIGINT: { cat: 'int', desc: 'Bardzo duża liczba całkowita (8 bajtów). Dla ogromnych tabel.' },
  DECIMAL: {
    cat: 'decimal',
    param: { label: 'Precyzja', placeholder: '10,2', hint: 'M,D – M cyfr łącznie, D po przecinku. 10,2 → 12345678.90' },
    defaultParam: '10,2',
    desc: 'Dokładna liczba dziesiętna. Używaj dla pieniędzy (ceny, kwoty)!',
  },
  FLOAT: { cat: 'float', desc: 'Liczba zmiennoprzecinkowa (przybliżona, 4 bajty). Nie używaj do pieniędzy.' },
  DOUBLE: { cat: 'float', desc: 'Liczba zmiennoprzecinkowa podwójnej precyzji (przybliżona, 8 bajtów).' },
  CHAR: {
    cat: 'string',
    param: { label: 'Długość', placeholder: '2', hint: 'Stała liczba znaków (1–255).' },
    defaultParam: '2',
    required: true,
    desc: 'Tekst o STAŁEJ długości, np. kod kraju „PL”.',
  },
  VARCHAR: {
    cat: 'string',
    param: { label: 'Długość', placeholder: '255', hint: 'Maksymalna liczba znaków.' },
    defaultParam: '255',
    required: true,
    desc: 'Tekst o zmiennej długości (do podanego limitu). Imiona, e-maile, tytuły.',
  },
  TEXT: { cat: 'text', desc: 'Długi tekst (do 65 535 bajtów). Opisy, komentarze.' },
  MEDIUMTEXT: { cat: 'text', desc: 'Bardzo długi tekst (do 16 MB).' },
  LONGTEXT: { cat: 'text', desc: 'Ogromny tekst (do 4 GB).' },
  ENUM: {
    cat: 'string',
    param: { label: 'Wartości', placeholder: "'nowe','wyslane'", hint: "Lista dozwolonych wartości w apostrofach, oddzielona przecinkami." },
    defaultParam: "'a','b'",
    required: true,
    desc: 'Jedna wartość z zamkniętej listy, np. status zamówienia.',
  },
  DATE: { cat: 'date', desc: 'Data: RRRR-MM-DD, np. 2024-09-01.' },
  DATETIME: { cat: 'date', desc: 'Data i godzina: RRRR-MM-DD GG:MM:SS.' },
  TIMESTAMP: { cat: 'date', desc: 'Znacznik czasu (UTC, zakres 1970–2038). Często z DEFAULT CURRENT_TIMESTAMP.' },
  TIME: { cat: 'date', desc: 'Sama godzina: GG:MM:SS.' },
  YEAR: { cat: 'date', desc: 'Rok: 1901–2155.' },
  BOOLEAN: { cat: 'bool', desc: 'Prawda/fałsz. W MySQL to alias TINYINT(1): 1 = TRUE, 0 = FALSE.' },
  JSON: { cat: 'json', desc: 'Dokument JSON (MySQL 5.7+).' },
  BLOB: { cat: 'blob', desc: 'Dane binarne (np. plik). Zwykle lepiej trzymać ścieżkę do pliku.' },
};

export const ALL_TYPES = Object.keys(TYPE_INFO);

export const typeCat = (type) => TYPE_INFO[type]?.cat ?? 'other';
export const isIntegerType = (type) => typeCat(type) === 'int';
export const isNumericType = (type) => ['int', 'decimal', 'float'].includes(typeCat(type));
export const hasParam = (type) => Boolean(TYPE_INFO[type]?.param);
export const isLobType = (type) => ['text', 'blob', 'json'].includes(typeCat(type));

/** Tekstowa reprezentacja typu, np. INT UNSIGNED, VARCHAR(255) */
export function formatType(col, { withUnsigned = true } = {}) {
  let t = col.type;
  if (hasParam(col.type) && String(col.length ?? '').trim()) t += `(${String(col.length).trim()})`;
  if (withUnsigned && col.un && isNumericType(col.type)) t += ' UNSIGNED';
  return t;
}

/** Krótki zapis typu do kafelka na płótnie */
export function shortType(col) {
  let t = col.type.toLowerCase();
  if (hasParam(col.type) && String(col.length ?? '').trim()) {
    const p = String(col.length).trim();
    t += col.type === 'ENUM' ? '(…)' : `(${p})`;
  }
  return t;
}

/** Opisy flag – używane w podpowiedziach (tooltipach) */
export const FLAGS = [
  {
    key: 'pk',
    label: 'PK',
    name: 'Primary Key – klucz główny',
    desc: 'Jednoznacznie identyfikuje każdy wiersz tabeli. Wartości muszą być unikalne i nie mogą być NULL (PK zawsze oznacza też NOT NULL). Każda tabela powinna mieć klucz główny.',
    example: 'np. klienci.id',
    on: 'bg-amber-100 text-amber-800 ring-amber-300',
  },
  {
    key: 'ai',
    label: 'AI',
    name: 'Auto Increment – autonumeracja',
    desc: 'MySQL sam nadaje kolejne numery (1, 2, 3…) przy dodawaniu wiersza – nie musisz podawać wartości w INSERT. Tylko dla liczb całkowitych, max. jedna kolumna w tabeli i musi być kluczem (zwykle PK).',
    example: 'id INT AUTO_INCREMENT',
    on: 'bg-violet-100 text-violet-800 ring-violet-300',
  },
  {
    key: 'nn',
    label: 'NN',
    name: 'Not Null – wartość wymagana',
    desc: 'Kolumna nie może być pusta (NULL). Próba wstawienia wiersza bez tej wartości zakończy się błędem.',
    example: 'np. email, nazwisko',
    on: 'bg-rose-100 text-rose-800 ring-rose-300',
  },
  {
    key: 'uq',
    label: 'UQ',
    name: 'Unique – wartość unikalna',
    desc: 'Dwa wiersze nie mogą mieć tej samej wartości w tej kolumnie (ale NULL może wystąpić wiele razy). Tworzy indeks UNIQUE.',
    example: 'np. email, PESEL, login',
    on: 'bg-sky-100 text-sky-800 ring-sky-300',
  },
  {
    key: 'un',
    label: 'UN',
    name: 'Unsigned – bez znaku',
    desc: 'Tylko liczby ≥ 0. Zakres dodatni jest dwa razy większy. Uwaga: kolumna klucza obcego musi mieć to samo UNSIGNED co kolumna, do której się odwołuje!',
    example: 'np. id, cena, ilość',
    on: 'bg-emerald-100 text-emerald-800 ring-emerald-300',
  },
];

/** Czy daną flagę można włączyć dla tego typu – zwraca powód blokady lub null */
export function flagDisabledReason(flagKey, col) {
  if (flagKey === 'ai' && !isIntegerType(col.type)) return 'AUTO_INCREMENT działa tylko dla typów całkowitych (INT, BIGINT…).';
  if (flagKey === 'un' && !isNumericType(col.type)) return 'UNSIGNED dotyczy tylko typów liczbowych.';
  if (flagKey === 'nn' && col.pk) return 'Klucz główny jest zawsze NOT NULL.';
  return null;
}

/** Zastosuj reguły spójności po zmianie kolumny */
export function normalizeColumn(prev, patch) {
  const c = { ...prev, ...patch };
  if (patch.type && patch.type !== prev.type && !('length' in patch)) {
    c.length = TYPE_INFO[patch.type]?.defaultParam ?? '';
  }
  if (!isIntegerType(c.type)) c.ai = false;
  if (!isNumericType(c.type)) c.un = false;
  if (c.pk) c.nn = true;
  return c;
}

export const newColumn = (overrides = {}) => ({
  id: uid(),
  name: '',
  type: 'VARCHAR',
  length: '255',
  pk: false,
  ai: false,
  nn: false,
  uq: false,
  un: false,
  def: '',
  ...overrides,
});

export const idColumn = () =>
  newColumn({ name: 'id', type: 'INT', length: '', pk: true, ai: true, nn: true, un: true });

export const FK_ACTIONS = [
  { value: 'RESTRICT', desc: 'Zablokuj operację na rodzicu, jeśli istnieją powiązane wiersze. (Domyślne zachowanie MySQL.)' },
  { value: 'CASCADE', desc: 'Wykonaj to samo na wierszach powiązanych – usuń je / zaktualizuj ich klucz.' },
  { value: 'SET NULL', desc: 'Wpisz NULL w kolumnie klucza obcego. Kolumna FK nie może mieć NOT NULL!' },
  { value: 'NO ACTION', desc: 'W MySQL (InnoDB) działa identycznie jak RESTRICT.' },
];

export const TABLE_COLORS = {
  indigo: '#6366f1',
  emerald: '#10b981',
  amber: '#f59e0b',
  rose: '#f43f5e',
  sky: '#0ea5e9',
  violet: '#8b5cf6',
  teal: '#14b8a6',
  orange: '#f97316',
  slate: '#64748b',
};

export const COLOR_KEYS = Object.keys(TABLE_COLORS);

/** Najczęściej mylone słowa zarezerwowane MySQL */
export const RESERVED = new Set(
  'ADD ALL ALTER AND AS ASC BETWEEN BY CALL CASE CHANGE CHECK COLUMN CONDITION CONSTRAINT CREATE CROSS DATABASE DEFAULT DELETE DESC DESCRIBE DISTINCT DROP ELSE EXISTS EXPLAIN FALSE FOR FOREIGN FROM FULLTEXT GROUP GROUPS HAVING IF IN INDEX INNER INSERT INTERVAL INTO IS JOIN KEY KEYS KILL LEFT LIKE LIMIT LOCK MATCH NOT NULL ON OPTION OR ORDER OUTER PRIMARY RANGE RANK READ REFERENCES RENAME REPLACE RIGHT ROW ROWS SELECT SET SHOW TABLE THEN TO TRUE UNION UNIQUE UPDATE USAGE USE USING VALUES WHEN WHERE WITH WRITE'.split(' ')
);

export const TABLE_WIDTH = 264;
export const HEADER_HEIGHT = 44;
export const ROW_HEIGHT = 30;
export const TABLE_PADDING_BOTTOM = 6;

export const tableHeight = (t) => HEADER_HEIGHT + Math.max(1, t.columns.length) * ROW_HEIGHT + TABLE_PADDING_BOTTOM;
