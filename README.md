# SchemaLab – wizualny projektant baz danych MySQL

Aplikacja dla uczniów uczących się SQL: rysujesz tabele i relacje, a skrypt MySQL generuje się na żywo.

## Uruchomienie

Wymagany Node.js 18+.

```bash
npm install
npm run dev
```

Otwórz adres wyświetlony w terminalu (domyślnie http://localhost:5173).

Wersja produkcyjna: `npm run build` → statyczne pliki w folderze `dist/`.

## Funkcje

- Tabele jako kafelki na płótnie: przeciąganie, zoom kółkiem myszy, przesuwanie widoku.
- Kolumny z typami MySQL i flagami **PK, AI, NN, UQ, UN** (z podpowiedziami po najechaniu).
- Relacje **1:N, 1:1, N:M** (N:M tworzy automatycznie tabelę łączącą), opcje `ON DELETE` / `ON UPDATE`.
- Tworzenie klucza obcego przez przeciągnięcie kropki przy kolumnie na kolumnę innej tabeli.
- Podgląd SQL z kolorowaniem składni, kopiowanie, pobieranie `.sql`.
- Walidator podpowiadający, co MySQL by odrzucił (np. różne typy FK/PK, AI bez klucza, SET NULL na kolumnie NOT NULL).
- Cofnij / ponów (Ctrl+Z / Ctrl+Y), autozapis w przeglądarce, eksport/import JSON.
- Przykładowy schemat sklepu internetowego oraz słowniczek pojęć.

## Struktura

```
src/
  App.jsx                  – układ, stan, historia zmian, akcje
  components/Canvas.jsx    – płótno, kafelki tabel, linie relacji
  components/Inspector.jsx – edycja tabeli i kolumn
  components/SqlPanel.jsx  – podgląd SQL i lista problemów
  components/RelationModal.jsx – tworzenie/edycja relacji
  components/HelpModal.jsx – słowniczek dla ucznia
  components/ui.jsx        – przyciski, modale, tooltipy
  lib/mysql.js             – typy danych i reguły MySQL
  lib/sqlGenerator.js      – generator SQL i walidacja
  lib/sampleSchema.js      – przykładowy schemat
```
