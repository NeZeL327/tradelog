# Prompt do Claude Code — nowa strona „Dzień” (AiKeepTrade)

Wklej wszystko poniżej linii do Claude Code w folderze `tradelog-main`.
Najpierw skopiuj plik `makieta-dzien.html` do `tradelog-main/docs/design-reference/makieta-dzien.html`.

---

Przebudowujemy stronę **„Dzień”** (plan przed sesją / notatki / podsumowanie; obecnie zakładki „Dzień” i „Historia”, przyciski „Nowy plan”, „Zapisz plan”, „Oznacz jako gotowy”, „Rozpocznij sesję”, „Zamknij dzień”, „Wyczyść dzień”, karty sesji Azja/London/NY).

**Wzorzec:** `docs/design-reference/makieta-dzien.html` — otwórz w przeglądarce i odwzoruj układ, teksty i zachowanie. Dane w makiecie są przykładowe; w aplikacji używamy prawdziwych danych użytkownika. Styl jak reszta aplikacji (granatowe tło, panele „szkło”, Manrope, akcent indygo ~#6b7cf5, zysk #78d66a, strata #f2646a, ostrzeżenia #e3b341) — wzorce w `docs/design-reference/`.

## Zasady współpracy (obowiązkowe)
- Odpowiadaj po polsku, krótko i konkretnie.
- **Małe etapy.** Po każdym etapie: krótki raport (co zmienione, które pliki, jak sprawdzić) i **czekasz na moje „dalej”**.
- **STREFA CHRONIONA — nie ruszać:** istniejących pól/struktury Firestore, reguł Firestore/Storage, importu MT5 (logika parsowania i zapisu), logiki zapisu/edycji/usuwania transakcji, obliczeń P&L / R / statystyk / dyscypliny transakcji, układu tabeli w Dzienniku (JournalSimple). Możesz te dane **czytać**.
- **Nowe pola w bazie tylko za moją zgodą.** Zanim cokolwiek zapiszesz w nowym miejscu: pokaż schemat (ścieżka, pola, typy, przykład dokumentu) i czekaj na „zgoda”. Nowe pola tylko jako opcjonalne, bez zmiany istniejących. Przed migracją danych: kopia + podgląd + możliwość cofnięcia.
- Nie usuwaj starych komponentów od razu — nowy widok za flagą/nową trasą, stary usuniemy po akceptacji.
- Nie dodawaj płatnych API. Nową bibliotekę dodaj tylko po zapytaniu (podaj nazwę i rozmiar).
- Po każdym etapie: `npm run build` bez błędów + sprawdzenie w `npm run dev` (http://127.0.0.1:3000), także w szerokości telefonu (~390 px), bez poziomego przewijania.
- Commit/push robię sam — na koniec etapu podaj mi gotową komendę commit z opisem.

## Etap 0 — rozpoznanie (bez zmian w kodzie)
1. Znajdź komponent(y) obecnej strony „Dzień” i „Historia” (szukaj np. tekstu „Wybierz sesję powyżej”, „Oznacz jako gotowy”), trasę w routerze i pozycję w lewym pasku ikon.
2. Ustal, gdzie i w jakim kształcie zapisuje się dziś plan dnia (kolekcja/dokument, pola: sesja, checklista, limity, notatki, podsumowanie, status). Pokaż przykładowy dokument.
3. Sprawdź, skąd brać transakcje dnia dla wybranego konta (FundedNext 14101942 itd.) i jakie pola mają (godzina otwarcia, symbol, kierunek, R, P&L netto, prowizja, setup/strategia, tagi, ocena dyscypliny).
4. Wypisz, które elementy makiety da się zrobić **bez nowych pól** w bazie, a które wymagają nowych pól. Zaproponuj schemat nowych pól (rozszerzenie dokumentu dnia jako pola opcjonalne) — **czekaj na zgodę**.

## Etap 1 — szkielet i górny pasek „Dziś”
- Nagłówek: „Dzień” + przełącznik **Mój dzień / Dziennik dni** + data ‹ › + wybór konta (istniejący).
- **Pasek „Dziś”** (hero): data, status rynku na żywo (kill zone trwa / sesja otwarta / następna sesja za X; pulsująca kropka), trzy duże liczby: Wynik dziś ($ i R), Transakcje x / limit, Dyscyplina %, przycisk **„Następny krok”** (zmienia się zależnie od etapu dnia) i przycisk **„Tryb w pracy”**.
- **Oś dnia 00–24** (godziny polskie, `Europe/Warsaw`): paski sesji Azja 01:00–09:00, Londyn 09:00–17:30, Nowy Jork 14:30–22:00; kill zone Londyn 08:00–11:00, NY 13:00–16:00 (żółte paski); biała linia „teraz” z godziną (odświeżanie co minutę); wybrana sesja podświetlona.
- **Kropki transakcji na osi** (zielona zysk, czerwona strata) w godzinie otwarcia, tooltip „09:42 EURUSD Long +1.6R (+$786)”.
- Godziny sesji i kill zone trzymaj w jednym pliku konfiguracyjnym (łatwo zmienić, uwzględnij zmianę czasu letniego/zimowego).

## Etap 2 — przepływ dnia (stepper)
Stepper: **1 Plan → 2 Handel → 3 Import → 4 Przegląd → Zamknij dzień** (zastępuje obecne przyciski „Nowy plan / Zapisz / Oznacz jako gotowy / Rozpocznij sesję / Zamknij dzień”). Każdy krok pokazuje krótki status (np. „brakuje: 2”, „2/3 trans. · 2 notatek”, „1/2 z setupem”). Zapis automatyczny (debounce), bez przycisku „Zapisz”.

**1 Plan:** karta „Wczoraj obiecałeś” (zasada na jutro z poprzedniego zamkniętego dnia, przycisk „Pamiętam, dziś też”) · Nastrój 5 stopni (buźki SVG, nie emoji) + krótka notatka; przy „Bardzo źle”/„Źle” limit transakcji spada do 1 z etykietą „obniżony” · Limity: max transakcji, ryzyko %/trade, stop dzienny % (przyciski −/+) · Wybór sesji (karty z statusem otwarta/za chwilę/zamknięta) · **Bias i poziomy** (EURUSD/GBPUSD/XAUUSD: Long/Short/Neutral + pole poziomów — ten element zostaje dokładnie jak w makiecie, lista par z ustawień) · Zasady „przygotowanie” (checklista z paskiem postępu) · „Plan w jednym zdaniu”. Przycisk „Plan gotowy, zaczynam handel” aktywny dopiero gdy wszystko uzupełnione; obok tekst „Brakuje: …”.

**2 Handel:** trzy liczniki (transakcje/limit, wynik vs stop dzienny, czas do końca sesji z paskiem) · ostrzeżenia (limit osiągnięty, ostatni trade na minusie → 15 min przerwy) · Zasady „w trakcie” sprawdzane **automatycznie** (etykieta AUTO): limit transakcji, strata ≤ 1R, stop dzienny, handel tylko w oknie sesji, 15 min przerwy po stracie, są notatki · Notatki z godziną (Enter dodaje) + szybkie przyciski („Sweep Asia low”, „MSS na M5”, „Czekam, brak setupu”, „Telefon / przerwa”, „Za szybko, odpuszczam”).

**3 Import:** karta importu MT5 — **używa istniejącego importu, nie zmieniaj jego logiki**; tylko wywołanie/przekierowanie i pokazanie wyniku. Tabela transakcji dnia z wyborem setupu (lista z ustawień/strategii) i oceną dyscypliny 1–5 (kółko w kolorze). Jeśli setup/ocena już mają pola w transakcji — zapisuj przez istniejące funkcje edycji; jeśli nie — zapytaj.

**4 Przegląd:** kafelki (wynik netto + R + prowizje, transakcje W/L, win rate + profit factor, wynik za dyscyplinę) · Krzywa dnia (skumulowany wynik netto po każdej transakcji, oś $, godziny) · Zasady „refleksja” (AUTO: zaimportowane, setup przy każdej, wnioski zapisane; ręcznie: screeny wejść) · „Obietnica z wczoraj — dotrzymałeś? Tak/Nie” · Ocena trzymania się planu 1–5 · Tagi (zielone: „Wejście zgodne z planem”, „Czekałem na potwierdzenie”; czerwone: FOMO, Overtrading, Przesunięty SL, Za wczesne wyjście, Trade po stracie, Rozproszenie w pracy) · Wnioski: co dobrze / co poprawić / jedna zasada na jutro · „Zamknij dzień” → dzień zablokowany (można edytować przyciskiem „Zapisz zmiany”), liczy się do serii.

**Wynik za dyscyplinę dnia** = % spełnionych zasad ze wszystkich trzech grup (przygotowanie + handel + refleksja). To nowa, osobna liczba dla dnia — **nie zmieniaj istniejących obliczeń dyscypliny transakcji**.

## Etap 3 — prawy panel
- Wynik dnia za dyscyplinę (pierścień + paski grup Przygotowanie/Handel/Refleksja).
- **Postęp:** mapa ciepła 12 tygodni × Pn–Pt (kolor wg wyniku zamkniętego dnia), seria zamkniętych dni (płomień), średni wynik z 30 dni.
- **Odznaki** (6 medali SVG, zdobyte kolorowe, niezdobyte z kłódką i paskiem postępu): Seria 5 dni, Plan przed sesją (10 dni z pełnym planem), Bez overtradingu (10 dni w limicie), SL nietknięty (5 dni bez tagu „Przesunięty SL”), Snajper kill zone (20 wejść w kill zone), Dziennikarz (30 dni z wnioskami). Liczone z danych, przy zdobyciu toast + animacja.
- Limity konta: mój stop dzienny (wolne $), daily loss prop firmy (np. FundedNext 5%), wartość 1R. Parametry prop firmy z ustawień konta, jeśli są; jeśli nie — zaproponuj, gdzie je trzymać (zgoda).
- „Twój plan” — podsumowanie planu i przypięta obietnica.

## Etap 4 — newsy na osi
- Linia „Newsy” na osi dnia: romby czerwone (wysoki wpływ) i pomarańczowe (średni), tooltip „14:30 USD CPI m/m”, przerywana pionowa linia dla wysokiego wpływu.
- W pasku „Dziś”: 30 min przed i 15 min po czerwonym newsie status zmienia się na czerwony: „USD CPI m/m za 20 min · bez nowych pozycji 15 min przed i po”.
- **Źródło danych:** najpierw zaproponuj 2–3 darmowe opcje (np. publiczny feed kalendarza ekonomicznego przez Firebase Function z cache, żeby ominąć CORS) i plan awaryjny (ręczne dodanie newsów w planie). Nic nie wdrażaj bez mojej decyzji. Filtrowanie walut wg par z biasu.

## Etap 5 — Karta dnia i Tryb w pracy
- **Karta dnia** po zamknięciu dnia (w Przeglądzie): marka AiKeepTrade, data, sesja, duży wynik, R, konto, chipy (transakcje, WR, PF, seria), zasada na jutro, pierścień dyscypliny, krzywa dnia. Przyciski „Zapisz jako obraz” (PNG — zaproponuj lekką bibliotekę, np. html-to-image, i zapytaj) i „Kopiuj podsumowanie” (tekst do schowka).
- **Tryb w pracy** (pełny ekran, głównie na telefon): duży zegar do końca kill zone / sesji, pasek newsa, 4 kafelki (wynik, transakcje/limit, do stopu dziennego, dyscyplina), pole szybkiej notatki (Enter) + 4 duże przyciski szybkich notatek, ostatnie 3 notatki, „Wyjdź”. Esc zamyka. Odświeżanie co minutę.

## Etap 6 — zakładka „Dziennik dni” (zastępuje „Historię”)
- Tytuł miesiąca z ‹ ›, pasek podsumowania: netto w miesiącu (+R), dni handlowe (na plus / na minus), win rate (W/L), profit factor (prowizje), najlepszy/najgorszy dzień, średnia dyscyplina.
- **Kalendarz miesiąca** (Pn–Nd + kolumna „Tydzień”): w dniu wynik $, liczba transakcji, WR; zielone/czerwone tło; dzisiaj obrys; dni spoza miesiąca wygaszone; kolumna tygodnia z sumą. Klik dnia → przewija do karty i podświetla ją. Na telefonie tylko numer + kwota.
- Filtry: Wszystkie / Na plus / Na minus / Z błędami / Dyscyplina < 70% + przełącznik „rozwinięte/zwinięte” transakcje.
- **Karta dnia na liście:** pole z datą (dzień + miesiąc), tytuł, chipy „dziś”/„niezamknięty”, sesja, liczba transakcji, WR, nastrój; wynik $ i R; mini pierścień dyscypliny; krzywa dnia + siatka 6 statystyk (brutto, prowizje, PF, wygrane, przegrane, śr. ocena dyscypliny); rozwijana tabela transakcji (tylko odczyt); stopka z wnioskiem, zasadą na jutro i tagami; przycisk „Otwórz dzień” dla dzisiejszego.
- Statystyki licz z istniejących funkcji/obliczeń, jeśli są — nie duplikuj i nie zmieniaj logiki.

## Etap 7 — porządki
- Po mojej akceptacji: przełącz trasę na nowy widok, stary komponent przenieś do usunięcia (lista plików do usunięcia — usuwam po potwierdzeniu).
- Krótka notka w `docs/` co zostało zrobione i jakie nowe pola doszły do bazy.

Zacznij od **Etapu 0** i czekaj na „dalej”.
