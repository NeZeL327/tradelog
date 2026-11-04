# Strona „Dzień” v2

Nowa strona pod trasą `/Day` (ikona „Dzień” w lewym pasku i wyszukiwarka prowadzą już do niej).
Stara strona zostaje pod `/DayPlan` (link „Poprzednia wersja strony” na dole nowej) — do usunięcia po akceptacji.
Wzorzec: `docs/design-reference/makieta-dzien.html`.

## Co jest zrobione
- **Etap 1** — nagłówek (Mój dzień / Dziennik dni, data ‹ ›, konto zsynchronizowane z nagłówkiem aplikacji),
  pasek „Dziś” (status rynku na żywo, wynik $/R, transakcje/limit, dyscyplina, „Następny krok”, „Tryb w pracy”),
  oś dnia 00–24 w czasie polskim z sesjami, kill zone, linią „teraz” (co 30 s) i kropkami transakcji.
- **Etap 2** — stepper Plan → Handel → Import → Przegląd → Zamknij dzień, zapis automatyczny (0,8 s), zasady AUTO.
- **Etap 3** — prawy panel: pierścień dyscypliny i grupy, mapa ciepła 12 tyg., seria, średnia 30 dni,
  6 odznak liczonych z danych (toast + animacja przy zdobyciu), limity konta (stop dzienny, daily loss z `max_daily_loss_percent` konta, 1R), „Twój plan”.
- **Etap 4** — newsy na osi (romby, przerywana linia, czerwony status 30 min przed / 15 min po). Na razie **ręczne dodawanie w Planie** (plan awaryjny).
- **Etap 5** — karta dnia po zamknięciu (PNG przez `html-to-image`, „Kopiuj podsumowanie”), Tryb w pracy (pełny ekran, Esc zamyka).
- **Etap 6** — Dziennik dni: podsumowanie miesiąca, kalendarz z kolumną tygodnia, filtry, karty dni z krzywą i statystykami, rozwijana tabela.

Sesje (godz. PL): Azja 01:00–09:00 · Londyn 09:00–17:30 (kill zone 08:00–11:00) · NY AM 14:30–17:00 (kill zone 13:00–16:00) · NY PM 19:30–22:00 (power hour 21:00–22:00); można wybrać kilka, są gotowe zestawy.
Godziny sesji, kolory, kill zone i zestawy: `src/lib/daySessions.js` (okna w strefie giełdy/NY, przeliczane na czas polski dla daty — zmiana czasu działa sama).
Logika: `src/lib/dayFlow.js` (+ testy `dayFlow.test.mjs`). Widoki: `src/components/dayv2/*`, strona `src/pages/Day.jsx`.

## Nowe pola w bazie (wszystkie opcjonalne, istniejące pola bez zmian)

`users/{uid}/day_plans/{accountId}_{YYYY-MM-DD}`:

| pole | typ | znaczenie |
|---|---|---|
| `flow_phase` | number 0–3 | aktywny krok |
| `sessions` | string[] (`asia`, `london`, `nyam`, `nypm`) | wybrane sesje dnia (kilka naraz); stare dni z `mapping_session` czytane jako lista 1-elementowa (`ny` → `nyam`) |
| `mood_v2` | `{ level: 0–4, note: string }` | nastrój (0 = bardzo źle) |
| `limits` | `{ daily_stop_percent: number }` | stop dzienny % |
| `bias_levels` | `{ [para]: { bias: "long"\|"short"\|"neutral"\|null, levels: string } }` | bias i poziomy |
| `plan_sentence` | string | plan w jednym zdaniu |
| `rules_manual` | `{ prep: { htf_bias, liquidity, poi, calendar, head: bool }, screens: bool }` | ręczne zasady |
| `news_manual` | `[{ time: "HH:MM", cur, name, impact: "high"\|"med" }]` | newsy dnia |
| `promise` | `{ tomorrow_rule: string, acknowledged: bool, kept_yesterday: bool\|null }` | obietnica |
| `plan_adherence` | number 1–5 | trzymanie się planu |
| `day_tags` | string[] | tagi dnia |
| `import_done_at` | ISO string | import zrobiony / „dziś nie było transakcji” |
| `discipline_day` | `{ score, prep, trade, review, total }` | wynik dnia za dyscyplinę (zapisywany przy każdym zapisie) |
| `closed_at` | ISO string | moment zamknięcia |

Używane istniejące pola: `status` (`active` / `closed`), `mapping_session` (wypełniane pierwszą wybraną sesją, `nyam`/`nypm` → `ny`, żeby stara strona działała), `parameters.trade_limit`, `parameters.max_risk_percent`,
`session_notes`, `post_session.went_well`, `post_session.improve_next`.

`users/{uid}/trades/{id}` — nowe opcjonalne pole `discipline_rating` (1–5). Setup = istniejące `strategy_id`.
Zapis przez istniejące `updateTrade`.

`users/{uid}` — nowe opcjonalne pole `bias_pairs: string[]` (lista par w „Bias i poziomy”).

## Newsy — automatyczne źródło (do decyzji)
1. **Kalendarz ForexFactory (JSON tygodnia, `nfs.faireconomy.media`)** przez nową Firebase Function z cache (np. 1 h w Firestore) — omija CORS. Darmowe, pole `impact` High/Medium, waluta.
2. **Kalendarz Investing / FXStreet** — brak oficjalnego darmowego API, scraping niestabilny — odradzam.
3. **Plan awaryjny (jest już zrobiony)** — ręczne dodanie newsów w kroku Plan.
Filtrowanie walut po parach z biasu: do dodania razem z opcją 1.

## Do usunięcia po akceptacji (nie usunięte)
- `src/pages/DayPlan.jsx`, `src/components/DayPlanGuidedFlow.jsx`, `src/components/DayPlanTaggedNote.jsx`,
  `src/components/day/DayResultSummary.jsx` (+ `src/lib/daySummary.js` i test, jeśli nigdzie indziej nieużywane)
- wpis `DayPlan` w `src/pages.config.js` i link „Poprzednia wersja strony” w `src/pages/Day.jsx`
- przed usunięciem sprawdzić inne odwołania do `createPageUrl("DayPlan")` (np. pasek rytmu sesji).
