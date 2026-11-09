import { newColumn, uid, idColumn } from './mysql.js';

const col = (name, type, length = '', flags = '', def = '') => {
  const f = flags.split(/\s+/);
  return newColumn({
    name,
    type,
    length,
    pk: f.includes('pk'),
    ai: f.includes('ai'),
    nn: f.includes('nn') || f.includes('pk'),
    uq: f.includes('uq'),
    un: f.includes('un'),
    def,
  });
};

const table = (name, x, y, color, columns) => ({ id: uid(), name, x, y, color, columns });

/** Przykładowy schemat: prosty sklep internetowy */
export function createSampleSchema() {
  const kategorie = table('kategorie', 40, 60, 'amber', [
    idColumn(),
    col('nazwa', 'VARCHAR', '100', 'nn uq'),
    col('opis', 'TEXT'),
  ]);

  const produkty = table('produkty', 400, 40, 'emerald', [
    idColumn(),
    col('kategoria_id', 'INT', '', 'nn un'),
    col('nazwa', 'VARCHAR', '150', 'nn'),
    col('cena', 'DECIMAL', '10,2', 'nn'),
    col('stan_magazynowy', 'INT', '', 'nn un', '0'),
    col('utworzono', 'TIMESTAMP', '', 'nn', 'CURRENT_TIMESTAMP'),
  ]);

  const pozycje = table('pozycje_zamowienia', 780, 250, 'violet', [
    col('zamowienie_id', 'INT', '', 'pk un'),
    col('produkt_id', 'INT', '', 'pk un'),
    col('ilosc', 'INT', '', 'nn un', '1'),
    col('cena_jednostkowa', 'DECIMAL', '10,2', 'nn'),
  ]);

  const zamowienia = table('zamowienia', 400, 360, 'sky', [
    idColumn(),
    col('klient_id', 'INT', '', 'nn un'),
    col('data_zamowienia', 'DATETIME', '', 'nn', 'CURRENT_TIMESTAMP'),
    col('status', 'ENUM', "'nowe','oplacone','wyslane','anulowane'", 'nn', 'nowe'),
    col('zaplacono', 'BOOLEAN', '', 'nn', 'FALSE'),
  ]);

  const klienci = table('klienci', 40, 340, 'indigo', [
    idColumn(),
    col('imie', 'VARCHAR', '50', 'nn'),
    col('nazwisko', 'VARCHAR', '80', 'nn'),
    col('email', 'VARCHAR', '255', 'nn uq'),
    col('telefon', 'VARCHAR', '20'),
    col('data_rejestracji', 'DATETIME', '', 'nn', 'CURRENT_TIMESTAMP'),
  ]);

  const c = (t, name) => t.columns.find((x) => x.name === name).id;
  const rel = (child, childCol, parent, parentCol, onDelete = 'RESTRICT', onUpdate = 'CASCADE') => ({
    id: uid(),
    type: '1:N',
    childTableId: child.id,
    childColId: c(child, childCol),
    parentTableId: parent.id,
    parentColId: c(parent, parentCol),
    onDelete,
    onUpdate,
  });

  return {
    name: 'sklep_internetowy',
    tables: [kategorie, produkty, klienci, zamowienia, pozycje],
    relations: [
      rel(produkty, 'kategoria_id', kategorie, 'id'),
      rel(zamowienia, 'klient_id', klienci, 'id'),
      rel(pozycje, 'zamowienie_id', zamowienia, 'id', 'CASCADE'),
      rel(pozycje, 'produkt_id', produkty, 'id'),
    ],
  };
}

export const emptySchema = () => ({ name: 'moja_baza', tables: [], relations: [] });
