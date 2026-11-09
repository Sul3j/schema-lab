import { useState } from 'react';
import { GraduationCap, KeyRound, Link2, GitBranch, ShieldAlert, MousePointer2, Database } from 'lucide-react';
import { Modal, Button } from './ui.jsx';
import { FLAGS, FK_ACTIONS, TYPE_GROUPS, TYPE_INFO } from '../lib/mysql.js';

const TABS = [
  { id: 'start', label: 'Jak zacząć', icon: MousePointer2 },
  { id: 'keys', label: 'Klucze i flagi', icon: KeyRound },
  { id: 'rel', label: 'Relacje', icon: GitBranch },
  { id: 'fk', label: 'ON DELETE / UPDATE', icon: ShieldAlert },
  { id: 'types', label: 'Typy danych', icon: Database },
];

const Code = ({ children }) => <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[12px] text-slate-800">{children}</code>;

export default function HelpModal({ open, onClose }) {
  const [tab, setTab] = useState('start');
  return (
    <Modal open={open} onClose={onClose} title="Słowniczek i pomoc" icon={GraduationCap} width="max-w-3xl" footer={<Button variant="primary" onClick={onClose}>Rozumiem!</Button>}>
      <div className="-mx-1 mb-4 flex flex-wrap gap-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              tab === t.id ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-3 text-sm leading-relaxed text-slate-600">
        {tab === 'start' && (
          <>
            <ol className="list-decimal space-y-2 pl-5">
              <li>
                <b>Dodaj tabelę</b> przyciskiem <b>Nowa tabela</b>. Od razu dostanie kolumnę <Code>id</Code> jako klucz główny z autonumeracją.
              </li>
              <li>
                <b>Kliknij tabelę</b> na płótnie – w panelu po prawej dodasz kolumny, wybierzesz typy i włączysz flagi (PK, AI, NN, UQ, UN).
              </li>
              <li>
                <b>Połącz tabele.</b> Najedź na kolumnę – pojawią się niebieskie kropki. Przeciągnij kropkę z kolumny klucza obcego (np. <Code>zamowienia.klient_id</Code>) na
                klucz główny innej tabeli (<Code>klienci.id</Code>). Możesz też przeciągnąć z kolumny PK na tabelę-dziecko – aplikacja sama ustali kierunek.
              </li>
              <li>
                <b>Sprawdź zakładkę SQL</b> – na żywo zobaczysz skrypt MySQL. Lista błędów podpowie, co MySQL by odrzucił.
              </li>
              <li>
                <b>Skopiuj SQL</b> i uruchom go w phpMyAdmin, MySQL Workbench lub w konsoli <Code>mysql</Code>.
              </li>
            </ol>
            <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900 ring-1 ring-amber-200">
              Projekt zapisuje się automatycznie w przeglądarce. Aby przenieść go na inny komputer lub oddać nauczycielowi – użyj <b>Eksport JSON</b>.
            </div>
          </>
        )}

        {tab === 'keys' && (
          <>
            <div className="grid gap-2">
              {FLAGS.map((f) => (
                <div key={f.key} className="flex gap-3 rounded-xl border border-slate-200 p-3">
                  <span className={`flex h-7 w-10 shrink-0 items-center justify-center rounded-md text-[11px] font-bold ring-1 ${f.on}`}>{f.label}</span>
                  <div>
                    <div className="font-semibold text-slate-800">{f.name}</div>
                    <div className="text-[13px]">{f.desc}</div>
                    <div className="mt-1 font-mono text-[11px] text-indigo-600">{f.example}</div>
                  </div>
                </div>
              ))}
              <div className="flex gap-3 rounded-xl border border-slate-200 p-3">
                <span className="flex h-7 w-10 shrink-0 items-center justify-center rounded-md bg-sky-100 text-sky-700 ring-1 ring-sky-300">
                  <Link2 size={14} />
                </span>
                <div>
                  <div className="font-semibold text-slate-800">FK – Foreign Key (klucz obcy)</div>
                  <div className="text-[13px]">
                    Kolumna, która przechowuje wartość klucza głównego z <i>innej</i> tabeli, np. <Code>zamowienia.klient_id</Code> wskazuje na <Code>klienci.id</Code>. MySQL pilnuje, by nie
                    dało się wpisać id klienta, który nie istnieje (integralność referencyjna).
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {tab === 'rel' && (
          <div className="space-y-3">
            <RelCard title="1 : N – jeden do wielu" example="klienci (1) ──< zamowienia (N)">
              Jeden klient może złożyć wiele zamówień, ale każde zamówienie należy do jednego klienta. Klucz obcy (<Code>klient_id</Code>) umieszczamy w tabeli po stronie
              „wielu” – czyli w <Code>zamowienia</Code>.
            </RelCard>
            <RelCard title="1 : 1 – jeden do jednego" example="uzytkownicy (1) ── profile (1)">
              Każdy użytkownik ma maksymalnie jeden profil. Technicznie to relacja 1:N, w której kolumna klucza obcego ma dodatkowo <Code>UNIQUE</Code>.
            </RelCard>
            <RelCard title="N : M – wiele do wielu" example="zamowienia >── pozycje_zamowienia ──< produkty">
              Zamówienie zawiera wiele produktów, a produkt może być w wielu zamówieniach. Tworzymy <b>tabelę łączącą</b> z dwoma kluczami obcymi. Często ma też własne kolumny –
              np. <Code>ilosc</Code> i <Code>cena_jednostkowa</Code> w przykładzie sklepu.
            </RelCard>
            <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
              <div className="mb-2 font-semibold text-slate-800">Jak czytać linie na schemacie (notacja „kurzej stopki”)</div>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <Notation path="M2 10 H40 M28 10 L40 3 M28 10 L40 17 M26 3 V17" label="wiele (N)" />
                <Notation path="M2 10 H40 M30 3 V17 M35 3 V17" label="dokładnie jeden (NOT NULL)" />
                <Notation path="M2 10 H40 M37 3 V17" circle label="zero lub jeden (FK może być NULL)" />
              </div>
            </div>
          </div>
        )}

        {tab === 'fk' && (
          <>
            <p>
              Co ma się stać z wierszami w tabeli-dziecku, gdy usuniemy (<b>ON DELETE</b>) lub zmienimy klucz (<b>ON UPDATE</b>) w tabeli-rodzicu? Np. co z zamówieniami, gdy usuniemy
              klienta?
            </p>
            <div className="grid gap-2">
              {FK_ACTIONS.map((a) => (
                <div key={a.value} className="flex gap-3 rounded-xl border border-slate-200 p-3">
                  <code className="w-24 shrink-0 font-mono text-[12px] font-bold text-violet-700">{a.value}</code>
                  <span className="text-[13px]">{a.desc}</span>
                </div>
              ))}
            </div>
            <div className="rounded-xl bg-indigo-50 p-3 text-xs text-indigo-900 ring-1 ring-indigo-100">
              <b>Typowe wybory:</b> zamówienia klienta → <Code>RESTRICT</Code> (nie kasujemy historii), pozycje zamówienia → <Code>CASCADE</Code> (usuwając zamówienie, usuwamy jego pozycje),
              opcjonalny opiekun → <Code>SET NULL</Code>. Dla ON UPDATE najczęściej <Code>CASCADE</Code>.
            </div>
          </>
        )}

        {tab === 'types' && (
          <div className="space-y-4">
            {TYPE_GROUPS.map((g) => (
              <div key={g.group}>
                <div className="mb-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">{g.group}</div>
                <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                  {g.types.map((t) => (
                    <div key={t} className="flex gap-3 px-3 py-2">
                      <code className="w-28 shrink-0 font-mono text-[12px] font-semibold text-amber-700">
                        {t}
                        {TYPE_INFO[t].param ? `(${TYPE_INFO[t].defaultParam})` : ''}
                      </code>
                      <span className="text-[13px]">{TYPE_INFO[t].desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

const RelCard = ({ title, example, children }) => (
  <div className="rounded-xl border border-slate-200 p-3">
    <div className="font-semibold text-slate-800">{title}</div>
    <div className="my-1 font-mono text-[12px] text-indigo-600">{example}</div>
    <div className="text-[13px]">{children}</div>
  </div>
);

const Notation = ({ path, label, circle }) => (
  <div className="flex flex-col items-center gap-1 rounded-lg bg-white p-2 ring-1 ring-slate-200">
    <svg width="46" height="20" stroke="#6366f1" strokeWidth="1.8" fill="none">
      <path d={path} />
      {circle && <circle cx="30" cy="10" r="3.5" fill="#fff" />}
    </svg>
    <span className="text-center text-slate-600">{label}</span>
  </div>
);
