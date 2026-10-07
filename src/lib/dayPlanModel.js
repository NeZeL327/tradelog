export const DAY_PLAN_STATUSES = ["draft", "ready", "active", "closed"];

export const DAY_PLAN_STATUS_LABELS = {
  draft: { pl: "Szkic", en: "Draft" },
  ready: { pl: "Gotowy", en: "Ready" },
  active: { pl: "W trakcie", en: "In progress" },
  closed: { pl: "Zamknięty", en: "Closed" },
};

export const MOOD_OPTIONS = [
  { id: "calm", pl: "Spokojny", en: "Calm" },
  { id: "focused", pl: "Skupiony", en: "Focused" },
  { id: "tired", pl: "Zmęczony", en: "Tired" },
];

export const CHECKLIST_STAGES = [
  { id: "plan", pl: "Plan", en: "Plan" },
  { id: "trade", pl: "Handel", en: "Trade" },
  { id: "review", pl: "Przegląd", en: "Review" },
];

export const DEFAULT_CHECKLIST = [
  { key: "calendar", stage: "plan", pl: "Sprawdziłem kalendarz i newsy", en: "I checked the calendar and news" },
  { key: "levels", stage: "plan", pl: "Wyznaczyłem poziomy", en: "I marked my levels" },
  { key: "risk", stage: "plan", pl: "Znam maksymalne ryzyko", en: "I know my max risk" },
  { key: "setup", stage: "trade", pl: "Setup jest potwierdzony", en: "Setup is confirmed" },
  { key: "focus", stage: "trade", pl: "Jestem skupiony i trzymam się planu", en: "I am focused and sticking to the plan" },
  { key: "journal", stage: "review", pl: "Uzupełniłem notatki z sesji", en: "I filled in session notes" },
];

export const PROCESS_GOALS = [
  { id: "stick_to_plan", pl: "Trzymać się planu", en: "Stick to the plan" },
  { id: "one_setup", pl: "Tylko jeden setup", en: "Only one setup" },
  { id: "no_revenge", pl: "Bez revenge tradingu", en: "No revenge trading" },
  { id: "journal", pl: "Notować każdą decyzję", en: "Journal every decision" },
];

export const FOCUS_SCORE_OPTIONS = [
  { id: 0, pl: "0 — Słabo", en: "0 — Poor", hintPl: "Dziś obserwacja, bez transakcji", hintEn: "Observe only — no trades" },
  { id: 1, pl: "1 — Średnio", en: "1 — Average", hintPl: "Ostrożnie, tylko najlepsze setupy", hintEn: "Cautious — best setups only" },
  { id: 2, pl: "2 — Dobrze", en: "2 — Good", hintPl: "Gotowy do procesu", hintEn: "Ready for process" },
];

export const TRADE_MODE_OPTIONS = [
  {
    id: "off",
    pl: "OFF",
    en: "OFF",
    descPl: "Nie handluję",
    descEn: "No trading",
  },
  {
    id: "mid",
    pl: "MID",
    en: "MID",
    descPl: "Tylko setupy A+",
    descEn: "A+ setups only",
  },
  {
    id: "on",
    pl: "ON",
    en: "ON",
    descPl: "Pełna egzekucja",
    descEn: "Full execution",
  },
];

export const FOCUS_PRINCIPLE = {
  id: "accept_risk_process",
  pl: "Akceptuję ryzyko i skupiam się na procesie.",
  en: "I accept risk and focus on process.",
};

export const MOTIVATION_ITEMS = [
  {
    id: "business",
    pl: "Trading to biznes, nie szybki dochód.",
    en: "Trading is a business, not quick income.",
  },
  {
    id: "calc_loss",
    pl: "Najpierw kalkuluję możliwą stratę.",
    en: "I first calculate possible loss.",
  },
  {
    id: "accept_loss",
    pl: "Akceptuję stratę.",
    en: "I accept loss.",
  },
  {
    id: "patience",
    pl: "Jestem cierpliwy przy zyskownych transakcjach i szybki przy stratnych.",
    en: "Patient with winners, quick with losers.",
  },
  {
    id: "control_decisions",
    pl: "Kontroluję swoje decyzje, a nie rynek.",
    en: "I control my decisions, not the market.",
  },
];

/** Soft prompts — quick schema tags + optional note (not mandatory checkboxes). */
export const HORIZON_PROMPTS = {
  htf: [
    {
      id: "structure",
      pl: "Struktura zewnętrzna, efektywności i imbalance — co widzisz?",
      en: "External structure, efficiencies and imbalance — what do you see?",
      tags: ["Struktura zewnętrzna", "Imbalance", "Efficiencies", "Czysty obraz", "Niejasne"],
    },
    {
      id: "inducement",
      pl: "Ostatni inducement / significant i realny cel?",
      en: "Last inducement / significant and realistic target?",
      tags: ["Inducement", "Significant", "Cel wyznaczony", "Brak jasnego celu"],
    },
    {
      id: "asia_h4",
      pl: "Potencjał płynności Azji na H4? Czy Azja zebrała PM session?",
      en: "Asia liquidity potential on H4? Did Asia sweep PM session?",
      tags: ["Potencjał H4", "Sweep PM", "Bez sweep PM", "Obserwacja"],
    },
  ],
  mtf: [
    {
      id: "asia_target",
      pl: "Co zrobiła Azja względem ważnego celu? Kontynuacja, korekta, likwidacja płynności?",
      en: "What did Asia do vs a key target? Continuation, pullback, liquidity sweep?",
      tags: ["Kontynuacja", "Korekta", "Likwidacja płynności", "Cel nietknięty"],
    },
    {
      id: "london_type",
      pl: "Czy London jest konsolidacją czy zebrał istotną płynność? Zakres, wybicie, fałszywe wybicie?",
      en: "Is London consolidation or did it sweep key liquidity? Range, break, fakeout?",
      tags: ["Konsolidacja", "Sweep płynności", "Wybicie", "Fałszywe wybicie", "Zakres"],
    },
  ],
  ltf: [
    {
      id: "frankfurt",
      pl: "Obserwacje od Frankfurtu — w tym możliwy NOT INDUCABLE?",
      en: "Observations from Frankfurt — including possible NOT INDUCABLE?",
      tags: ["Frankfurt OK", "NOT INDUCABLE", "Czekam", "Setup buduje się"],
    },
    {
      id: "watch",
      pl: "Godziny do obserwacji i zdarzenia do końca H4? Alert na NY?",
      en: "Hours to watch and events until end of H4? NY alert?",
      tags: ["Alert NY", "Watch London", "Watch PRE-NY", "Brak alertu"],
    },
  ],
};

export const HORIZON_TITLES = {
  htf: { pl: "HTF • Struktura i bias", en: "HTF • Structure & bias", subPl: "D / H4 / H1", subEn: "D / H4 / H1" },
  mtf: { pl: "MTF • Struktura i kontekst", en: "MTF • Structure & context", subPl: "15m / 5m", subEn: "15m / 5m" },
  ltf: { pl: "LTF • Analiza sesji", en: "LTF • Session analysis", subPl: "3m / 1m", subEn: "3m / 1m" },
};

/** Default FX pairs for mapping checkboxes (per horizon / session). */
export const MAP_PAIR_OPTIONS = [
  "EURUSD",
  "GBPUSD",
  "USDJPY",
  "USDCHF",
  "USDCAD",
  "AUDUSD",
  "NZDUSD",
  "EURGBP",
  "EURJPY",
  "GBPJPY",
  "XAUUSD",
];

export const BIAS_OPTIONS = [
  { id: "long", pl: "LONG", en: "LONG" },
  { id: "short", pl: "SHORT", en: "SHORT" },
];

export const PROCESS_TRADE_CRITERIA = [
  {
    id: "plan_aligned",
    pl: "Zgodność z planem i regułami setupu",
    en: "Aligned with plan and setup rules",
  },
  { id: "full_focus", pl: "Pełne skupienie", en: "Full focus" },
  {
    id: "logical_decision",
    pl: "Logiczna decyzja bez wahania",
    en: "Logical decision without hesitation",
  },
  { id: "risk_accepted", pl: "Akceptacja ryzyka", en: "Risk accepted" },
];

export const PROCESS_BANDS = [
  { max: 50, id: "chaos", pl: "Chaos", en: "Chaos", tone: "loss" },
  { max: 75, id: "average", pl: "Średnio", en: "Average", tone: "amber" },
  { max: 100, id: "good", pl: "Dobry proces", en: "Good process", tone: "profit" },
];

export const ASIA_PD_OPTIONS = [
  { id: "bullish_good", pl: "Bullish Good PD", en: "Bullish Good PD" },
  { id: "bullish_bad", pl: "Bullish Bad PD", en: "Bullish Bad PD" },
  { id: "bearish_good", pl: "Bearish Good PD", en: "Bearish Good PD" },
  { id: "bearish_bad", pl: "Bearish Bad PD", en: "Bearish Bad PD" },
];

export const HTF_CHECK_ITEMS = [
  { id: "ext_structure", pl: "Zaznacz strukturę zewnętrzną", en: "Mark external structure" },
  {
    id: "efficiencies",
    pl: "Zaznacz wszystkie efektywności i imbalance",
    en: "Mark all efficiencies and imbalances",
  },
  {
    id: "inducement",
    pl: "Znajdź ostatni inducement lub możliwy poziom significant",
    en: "Find last inducement or significant level",
  },
  { id: "real_target", pl: "Określ realny cel", en: "Define a realistic target" },
  {
    id: "h4_asia_liq",
    pl: "Sprawdź potencjał zebrania płynności Azji z jednej strony świecy H4",
    en: "Check H4 liquidity sweep potential from Asia candle side",
  },
  {
    id: "asia_pm",
    pl: "Zaznacz, czy Azja zebrała PM session",
    en: "Mark whether Asia swept PM session",
  },
];

export const MTF_CHECK_ITEMS = [
  { id: "ext_structure", pl: "Zaznacz strukturę zewnętrzną", en: "Mark external structure" },
  {
    id: "efficiencies",
    pl: "Zaznacz wszystkie efektywności i imbalance",
    en: "Mark all efficiencies and imbalances",
  },
  {
    id: "asia_htf_target",
    pl: "Sprawdź, czy Azja zebrała ważny cel",
    en: "Check whether Asia swept a key target",
  },
  {
    id: "pair2_analysis",
    pl: "Przejdź do drugiej pary i wykonaj tę samą analizę",
    en: "Move to the second pair and repeat the analysis",
  },
  {
    id: "ny_structure",
    pl: "Przy NY zaznacz strukturę zewnętrzną oraz efektywności / imbalance",
    en: "For NY, mark external structure and efficiencies / imbalance",
  },
];

export const LTF_CHECK_ITEMS = [
  {
    id: "frankfurt_obs",
    pl: "Po Frankfurcie zaznacz najważniejsze obserwacje",
    en: "After Frankfurt, mark key observations",
  },
  {
    id: "not_inducable",
    pl: "Możliwy NOT INDUCABLE",
    en: "Possible NOT INDUCABLE",
  },
  {
    id: "watch_hours",
    pl: "Zaznacz godziny do obserwacji",
    en: "Mark hours to watch",
  },
  {
    id: "events_log",
    pl: "Od Frankfurtu do końca H4 zapisuj istotne zdarzenia",
    en: "From Frankfurt to end of H4, log key events",
  },
];

export const SESSION_CONTEXT_TIPS = [
  {
    id: "asia_consol",
    pl: "Jeśli Azja jest konsolidacją, handel może przypadać na London albo PRE-NY / NY.",
    en: "If Asia is consolidation, trading may fall on London or PRE-NY / NY.",
  },
  {
    id: "asia_targets",
    pl: "Jeśli Azja osiągnie istotne cele HTF / MTF, London nie jest sesją do handlu — obserwuj PRE-NY / NY.",
    en: "If Asia hits key HTF / MTF targets, London is not a trade session — watch PRE-NY / NY.",
  },
  {
    id: "asia_goal",
    pl: "Celem Azji jest najpierw zebranie wszystkich inducementów PM Session NY.",
    en: "Asia's goal is first to sweep all PM Session NY inducements.",
  },
  {
    id: "inducement_break",
    pl: "Jeśli rynek przebije poprzedni inducement, często następuje odbicie do kontynuacji zgodnej z trendem.",
    en: "If price breaks the prior inducement, a trend-continuation bounce often follows.",
  },
  {
    id: "mon_fri",
    pl: "W poniedziałek i piątek sprawdź, co zrobiły dwa poprzednie dni.",
    en: "On Monday and Friday, review what the previous two days did.",
  },
  {
    id: "tue_thu",
    pl: "Wt–Czw: jeśli poniedziałek był akumulacją, wtorek może wyznaczyć High / Low tygodnia; Śr–Czw analizuj względem tych poziomów.",
    en: "Tue–Thu: if Monday was accumulation, Tuesday may set the weekly High / Low; Wed–Thu analyse relative to those levels.",
  },
  {
    id: "schedule",
    pl: "Harmonogram: Pn–Pt · London 08:00–11:00 · New York 13:00–15:00 · przegląd transakcji w sobotę.",
    en: "Schedule: Mon–Fri · London 08:00–11:00 · New York 13:00–15:00 · trade review on Saturday.",
  },
];

/** Tips shown after the user picks a trading session. */
export const SESSION_TIP_IDS = {
  asia: ["asia_goal", "asia_consol", "inducement_break", "mon_fri", "schedule"],
  london: ["asia_consol", "asia_targets", "asia_goal", "inducement_break", "schedule"],
  ny: ["asia_targets", "inducement_break", "tue_thu", "schedule"],
};

export function tipsForSession(sessionId, language = "pl") {
  const ids = SESSION_TIP_IDS[sessionId] || SESSION_TIP_IDS.london;
  return ids
    .map((id) => SESSION_CONTEXT_TIPS.find((tip) => tip.id === id))
    .filter(Boolean)
    .map((tip) => (language === "en" ? tip.en : tip.pl));
}

export const MAPPING_STEPS = [
  { id: "htf", pl: "HTF COP / POI", en: "HTF COP / POI", subPl: "D / H4 / H1", subEn: "D / H4 / H1" },
  { id: "mtf", pl: "MTF POI / COP", en: "MTF POI / COP", subPl: "15m / 5m", subEn: "15m / 5m" },
  { id: "ltf", pl: "LTF Session", en: "LTF Session", subPl: "3m / 1m", subEn: "3m / 1m" },
];

/** Editable vocabularies for tagged notes (user can add / rename / delete). */
export const DEFAULT_DAY_PLAN_TAGS = {
  mapping: [
    "Bias LONG",
    "Bias SHORT",
    "POI",
    "COP",
    "Liquidity sweep",
    "Inducement",
    "Imbalance",
    "Konsolidacja",
    "Kontynuacja",
    "Korekta",
    "Alert NY",
    "Obserwacja",
    "Niejasne",
  ],
  pre_session: [
    "News risk",
    "Trend day",
    "Range day",
    "High impact",
    "Unikaj FOMO",
    "Tylko A+",
    "Watchlist",
    "Asia first",
  ],
  session: [
    "Proces OK",
    "Deviation",
    "FOMO",
    "Patience",
    "Setup A+",
    "Mistake",
    "Emotion",
  ],
  post: [
    "Dyscyplina",
    "Proces OK",
    "Revenge",
    "Overtrade",
    "Journal done",
    "Lekcja",
    "Trzymałem plan",
  ],
  parameters: ["Max 1R", "1 setup", "No revenge", "Hard stop", "Tylko A+"],
};

/** Prompt answered if tagged and/or noted — schema progress without forcing text. */
export function isTaggedNoteFilled(text, tags) {
  if (Array.isArray(tags) && tags.length > 0) return true;
  return !!String(text || "").trim();
}

export function horizonPromptProgress(block, horizon) {
  const prompts = HORIZON_PROMPTS[horizon] || [];
  const total = prompts.length;
  const done = prompts.filter((p) =>
    isTaggedNoteFilled(block?.prompts?.[p.id], block?.prompt_tags?.[p.id])
  ).length;
  return { done, total, ratio: total ? done / total : 0 };
}

export function emptyTagLists() {
  return {
    mapping: [...DEFAULT_DAY_PLAN_TAGS.mapping],
    pre_session: [...DEFAULT_DAY_PLAN_TAGS.pre_session],
    session: [...DEFAULT_DAY_PLAN_TAGS.session],
    post: [...DEFAULT_DAY_PLAN_TAGS.post],
    parameters: [...DEFAULT_DAY_PLAN_TAGS.parameters],
  };
}

function emptyPreSessionTags() {
  return {
    market_context: [],
    scenario_levels: [],
    watchlist: [],
    avoid_today: [],
  };
}

function boolMap(items) {
  return Object.fromEntries((items || []).map((item) => [item.id, false]));
}

export function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function todayIso(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function shiftIsoDate(iso, days) {
  const [y, m, d] = String(iso).split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return todayIso(dt);
}

export function formatIsoDisplay(iso, locale = "pl-PL") {
  const [y, m, d] = String(iso).split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function planDocId(accountId, date) {
  return `${String(accountId)}_${String(date)}`;
}

export function defaultChecklist(language = "pl") {
  return DEFAULT_CHECKLIST.map((item) => ({
    id: createId(),
    text: language === "en" ? item.en : item.pl,
    stage: item.stage || "plan",
    done: false,
    custom: false,
  }));
}

export function checklistProgress(checklist = []) {
  const total = checklist.length;
  const done = checklist.filter((item) => item.done).length;
  const open = checklist.filter((item) => !item.done);
  return { total, done, open, ratio: total ? done / total : 0 };
}

export function groupChecklistByStage(checklist = [], language = "pl") {
  return CHECKLIST_STAGES.map((stage) => ({
    id: stage.id,
    label: language === "en" ? stage.en : stage.pl,
    items: checklist.filter((item) => (item.stage || "plan") === stage.id),
  }));
}

export function emptyFocus() {
  return {
    score: null,
    trade_mode: null,
    accept_risk_process: false,
    motivation: boolMap(MOTIVATION_ITEMS),
    completed: false,
  };
}

function emptyPairTable() {
  return {
    symbol: "",
    checks: {},
  };
}

function emptyHorizon() {
  return {
    notes: "",
    note_tags: [],
    prompts: {},
    prompt_tags: {},
    correlation_tags: [],
    /** Two side-by-side pair tables: top = pair select, bottom = done checklist */
    tables: {
      a: emptyPairTable(),
      b: emptyPairTable(),
    },
    // legacy fields kept for migration
    checks: {},
    pairs: {},
    asia_pd: "",
    pair2_notes: "",
    correlation: "",
    scenarios: "",
    formula: "",
    london_type: "",
    frankfurt_notes: "",
    not_inducable: false,
    watch_hours: "",
    events_log: "",
    ny_alert: false,
    saved: false,
  };
}

function migrateHorizonTables(src = {}) {
  const blank = emptyHorizon();
  const tables = {
    a: {
      ...blank.tables.a,
      ...(src.tables?.a || {}),
      checks: { ...blank.tables.a.checks, ...(src.tables?.a?.checks || {}) },
    },
    b: {
      ...blank.tables.b,
      ...(src.tables?.b || {}),
      checks: { ...blank.tables.b.checks, ...(src.tables?.b?.checks || {}) },
    },
  };

  // Migrate old multi-pair map → first two selected symbols
  if (!tables.a.symbol && !tables.b.symbol && src.pairs) {
    const picked = Object.entries(src.pairs)
      .filter(([, on]) => !!on)
      .map(([sym]) => sym)
      .slice(0, 2);
    if (picked[0]) tables.a.symbol = picked[0];
    if (picked[1]) tables.b.symbol = picked[1];
  }

  // Migrate old shared checklist → both tables if empty
  if (src.checks && Object.keys(src.checks).length) {
    if (!Object.keys(tables.a.checks).length) tables.a.checks = { ...src.checks };
    if (!Object.keys(tables.b.checks).length && tables.b.symbol) {
      tables.b.checks = { ...src.checks };
    }
  }

  return tables;
}

function emptySessionMapping() {
  return {
    htf: emptyHorizon(),
    mtf: emptyHorizon(),
    ltf: emptyHorizon(),
  };
}

export function emptyMapping() {
  return {
    daily_bias: null, // "long" | "short" — bias dnia
    asia: emptySessionMapping(),
    london: emptySessionMapping(),
    ny: emptySessionMapping(),
  };
}

export function horizonCheckItems(horizon) {
  if (horizon === "htf") return HTF_CHECK_ITEMS;
  if (horizon === "mtf") return MTF_CHECK_ITEMS;
  return LTF_CHECK_ITEMS;
}

export function tableCheckProgress(table, horizon) {
  const defs = horizonCheckItems(horizon);
  const total = defs.length;
  const done = defs.filter((item) => !!table?.checks?.[item.id]).length;
  return { done, total, ratio: total ? done / total : 0 };
}

export function horizonCheckProgress(block, horizon) {
  const a = tableCheckProgress(block?.tables?.a, horizon);
  const b = tableCheckProgress(block?.tables?.b, horizon);
  const total = a.total + b.total;
  const done = a.done + b.done;
  return { done, total, ratio: total ? done / total : 0, a, b };
}

export function selectedPairs(block) {
  const fromTables = [block?.tables?.a?.symbol, block?.tables?.b?.symbol].filter(Boolean);
  if (fromTables.length) return fromTables;
  return Object.entries(block?.pairs || {})
    .filter(([, on]) => !!on)
    .map(([sym]) => sym);
}

function migrateLegacyMapping(legacy) {
  if (!legacy || typeof legacy !== "object") return emptyMapping();
  if (legacy.asia || legacy.london || legacy.ny) {
    const blank = emptyMapping();
    const out = { daily_bias: legacy.daily_bias === "long" || legacy.daily_bias === "short" ? legacy.daily_bias : null };
    for (const sid of ["asia", "london", "ny"]) {
      out[sid] = emptySessionMapping();
      for (const hz of ["htf", "mtf", "ltf"]) {
        const src = legacy[sid]?.[hz] || {};
        out[sid][hz] = {
          ...blank[sid][hz],
          ...src,
          prompts: { ...blank[sid][hz].prompts, ...(src.prompts || {}) },
          prompt_tags: { ...blank[sid][hz].prompt_tags, ...(src.prompt_tags || {}) },
          note_tags: Array.isArray(src.note_tags) ? src.note_tags : [],
          correlation_tags: Array.isArray(src.correlation_tags) ? src.correlation_tags : [],
          checks: { ...blank[sid][hz].checks, ...(src.checks || {}) },
          pairs: { ...blank[sid][hz].pairs, ...(src.pairs || {}) },
          tables: migrateHorizonTables(src),
        };
      }
    }
    return out;
  }
  // Old flat htf/mtf/ltf → keep under london (primary trade session)
  const out = emptyMapping();
  for (const hz of ["htf", "mtf", "ltf"]) {
    const block = legacy[hz];
    if (!block) continue;
    out.london[hz] = {
      ...out.london[hz],
      notes: block.notes || "",
      note_tags: Array.isArray(block.note_tags) ? block.note_tags : [],
      asia_pd: block.asia_pd || "",
      pair2_notes: block.pair2_notes || "",
      correlation: block.correlation || "",
      correlation_tags: Array.isArray(block.correlation_tags) ? block.correlation_tags : [],
      scenarios: block.scenarios || "",
      formula: block.formula || "",
      london_type: block.london_type || "",
      frankfurt_notes: block.frankfurt_notes || "",
      not_inducable: !!block.not_inducable,
      watch_hours: block.watch_hours || "",
      events_log: block.events_log || "",
      ny_alert: !!block.ny_alert,
      saved: !!block.completed,
      prompts: {},
      prompt_tags: {},
      checks: { ...(block.checks || {}) },
      pairs: { ...(block.pairs || {}) },
      tables: migrateHorizonTables(block),
    };
  }
  return out;
}

export function emptyProcessCriteria() {
  return boolMap(PROCESS_TRADE_CRITERIA);
}

export function emptyDayPlan({ accountId, date, language = "pl" } = {}) {
  return {
    account_id: String(accountId || ""),
    date: String(date || todayIso()),
    status: "draft",
    template_id: null,
    template_name: "",
    phase: "focus",
    mapping_session: null, // user must pick Asia / London / NY first
    mapping_step: "htf",
    focus: emptyFocus(),
    mapping: emptyMapping(),
    tag_lists: emptyTagLists(),
    pre_session: {
      market_context: "",
      scenario_levels: "",
      watchlist: "",
      avoid_today: "",
    },
    pre_session_tags: emptyPreSessionTags(),
    checklist: defaultChecklist(language),
    parameters: {
      trade_limit: 3,
      max_risk_percent: 1,
      process_goal: "stick_to_plan",
      extra_rules: "",
      extra_rules_tags: [],
    },
    session_notes: [],
    post_session: {
      went_well: "",
      went_well_tags: [],
      improve_next: "",
      improve_next_tags: [],
      mood: "",
      discipline: null,
      process: emptyProcessCriteria(),
    },
  };
}

/** Merge older plans with current shape without wiping user data. */
export function normalizeDayPlan(plan, { accountId, date, language = "pl" } = {}) {
  const blank = emptyDayPlan({
    accountId: accountId || plan?.account_id,
    date: date || plan?.date,
    language,
  });
  if (!plan || typeof plan !== "object") return blank;

  const focusRaw = { ...(plan.focus || {}) };
  if (focusRaw.accept_risk_process == null && focusRaw.mental) {
    focusRaw.accept_risk_process = Object.values(focusRaw.mental).some(Boolean);
  }
  const focus = {
    ...blank.focus,
    ...focusRaw,
    motivation: { ...blank.focus.motivation, ...(focusRaw.motivation || {}) },
  };
  delete focus.mental;

  const mapping = migrateLegacyMapping(plan.mapping);

  return {
    ...blank,
    ...plan,
    focus,
    mapping,
    phase: plan.phase === "mapping" ? "mapping" : "focus",
    mapping_session: ["asia", "london", "ny"].includes(plan.mapping_session)
      ? plan.mapping_session
      : null,
    mapping_step: ["htf", "mtf", "ltf"].includes(plan.mapping_step) ? plan.mapping_step : "htf",
    tag_lists: {
      ...blank.tag_lists,
      ...(plan.tag_lists || {}),
      mapping: Array.isArray(plan.tag_lists?.mapping) ? plan.tag_lists.mapping : blank.tag_lists.mapping,
      pre_session: Array.isArray(plan.tag_lists?.pre_session)
        ? plan.tag_lists.pre_session
        : blank.tag_lists.pre_session,
      session: Array.isArray(plan.tag_lists?.session) ? plan.tag_lists.session : blank.tag_lists.session,
      post: Array.isArray(plan.tag_lists?.post) ? plan.tag_lists.post : blank.tag_lists.post,
      parameters: Array.isArray(plan.tag_lists?.parameters)
        ? plan.tag_lists.parameters
        : blank.tag_lists.parameters,
    },
    pre_session: { ...blank.pre_session, ...(plan.pre_session || {}) },
    pre_session_tags: { ...blank.pre_session_tags, ...(plan.pre_session_tags || {}) },
    parameters: {
      ...blank.parameters,
      ...(plan.parameters || {}),
      extra_rules_tags: Array.isArray(plan.parameters?.extra_rules_tags)
        ? plan.parameters.extra_rules_tags
        : [],
    },
    checklist: Array.isArray(plan.checklist) ? plan.checklist : blank.checklist,
    session_notes: Array.isArray(plan.session_notes)
      ? plan.session_notes.map((note) => ({
          ...note,
          tags: Array.isArray(note?.tags) ? note.tags : [],
        }))
      : [],
    post_session: {
      ...blank.post_session,
      ...(plan.post_session || {}),
      went_well_tags: Array.isArray(plan.post_session?.went_well_tags)
        ? plan.post_session.went_well_tags
        : [],
      improve_next_tags: Array.isArray(plan.post_session?.improve_next_tags)
        ? plan.post_session.improve_next_tags
        : [],
      process: (() => {
        const raw = { ...(plan.post_session?.process || {}) };
        if (raw.blueprint != null && raw.plan_aligned == null) {
          raw.plan_aligned = !!raw.blueprint;
        }
        delete raw.blueprint;
        return { ...blank.post_session.process, ...raw };
      })(),
    },
  };
}

export function isNoTradeDay(focus) {
  if (!focus) return false;
  return focus.trade_mode === "off";
}

export function isFocusReady(focus) {
  if (!focus) return false;
  return focus.score != null && focus.trade_mode != null && !!focus.accept_risk_process;
}

export function isFocusComplete(focus) {
  return !!(focus?.completed && isFocusReady(focus));
}

export function focusStatusLabel(focus, language = "pl") {
  const pl = language !== "en";
  if (!focus || focus.score == null || !focus.trade_mode) {
    return pl ? "do uzupełnienia" : "incomplete";
  }
  const mode = String(focus.trade_mode).toUpperCase();
  if (focus.completed) {
    return pl ? `gotowe ${focus.score}/2 • ${mode}` : `done ${focus.score}/2 • ${mode}`;
  }
  return pl ? `${focus.score}/2 • ${mode}` : `${focus.score}/2 • ${mode}`;
}

export function isHorizonSaved(mapping, sessionId, horizon) {
  return !!mapping?.[sessionId]?.[horizon]?.saved;
}

export function processCriteriaScore(process = {}) {
  const keys = PROCESS_TRADE_CRITERIA.map((item) => item.id);
  const total = keys.length || 1;
  const done = keys.filter((key) => !!process?.[key]).length;
  return Math.round((done / total) * 100);
}

export function processBandForScore(pct) {
  const value = Number(pct) || 0;
  return PROCESS_BANDS.find((band) => value <= band.max) || PROCESS_BANDS[PROCESS_BANDS.length - 1];
}

/** Compact next action for Session Rhythm bar + Day Plan CTA. */
export function dayPlanNextAction(plan, activeSessionId, language = "pl") {
  const pl = language !== "en";
  if (!plan) {
    return {
      label: pl ? "Utwórz plan dnia" : "Create day plan",
      view: "focus",
      session: null,
      horizon: "htf",
    };
  }
  const picked = ["asia", "london", "ny"].includes(plan.mapping_session)
    ? plan.mapping_session
    : ["asia", "london", "ny"].includes(activeSessionId)
      ? activeSessionId
      : null;
  if (!picked) {
    return {
      label: pl ? "Wybierz sesję" : "Pick session",
      view: "focus",
      session: null,
      horizon: "htf",
    };
  }
  if (!isFocusComplete(plan.focus)) {
    return {
      label: pl ? "Uzupełnij skupienie" : "Complete focus",
      view: "focus",
      session: picked,
      horizon: "htf",
    };
  }
  const sessionId = picked;
  const sessionLabel =
    sessionId === "asia" ? (pl ? "Azja" : "Asia") : sessionId === "ny" ? "NY" : "London";
  const horizons = ["htf", "mtf", "ltf"];
  const unsaved = horizons.find((hz) => !isHorizonSaved(plan.mapping, sessionId, hz));
  if (unsaved) {
    return {
      label: pl ? `Mapowanie ${sessionLabel}` : `Map ${sessionLabel}`,
      view: "mapping",
      session: sessionId,
      horizon: unsaved,
    };
  }
  return {
    label: pl ? `Aktualizuj mapowanie ${sessionLabel}` : `Update ${sessionLabel} map`,
    view: "mapping",
    session: sessionId,
    horizon: plan.mapping_step || "mtf",
  };
}

export function planToTemplatePayload(plan, name) {
  return {
    name: String(name || "Szablon").trim().slice(0, 80),
    focus: {
      score: null,
      trade_mode: plan?.focus?.trade_mode || null,
      accept_risk_process: false,
      motivation: emptyFocus().motivation,
      completed: false,
    },
    mapping: emptyMapping(),
    pre_session: {
      market_context: plan?.pre_session?.market_context || "",
      scenario_levels: plan?.pre_session?.scenario_levels || "",
      watchlist: plan?.pre_session?.watchlist || "",
      avoid_today: plan?.pre_session?.avoid_today || "",
    },
    checklist: (plan?.checklist || []).map((item) => ({
      id: createId(),
      text: String(item.text || ""),
      stage: item.stage || "plan",
      done: false,
      custom: !!item.custom,
    })),
    parameters: {
      trade_limit: Number(plan?.parameters?.trade_limit) || 0,
      max_risk_percent: Number(plan?.parameters?.max_risk_percent) || 0,
      process_goal: plan?.parameters?.process_goal || "stick_to_plan",
      extra_rules: plan?.parameters?.extra_rules || "",
    },
  };
}

export function applyTemplateToPlan(plan, template) {
  return normalizeDayPlan({
    ...plan,
    template_id: template.id || null,
    template_name: template.name || "",
    focus: {
      ...emptyFocus(),
      trade_mode: template.focus?.trade_mode || null,
    },
    mapping: emptyMapping(),
    phase: "focus",
    mapping_session: null,
    mapping_step: "htf",
    pre_session: {
      market_context: template.pre_session?.market_context || "",
      scenario_levels: template.pre_session?.scenario_levels || "",
      watchlist: template.pre_session?.watchlist || "",
      avoid_today: template.pre_session?.avoid_today || "",
    },
    checklist: (template.checklist || []).map((item) => ({
      id: createId(),
      text: String(item.text || ""),
      stage: item.stage || "plan",
      done: false,
      custom: !!item.custom,
    })),
    parameters: {
      trade_limit: Number(template.parameters?.trade_limit) || 0,
      max_risk_percent: Number(template.parameters?.max_risk_percent) || 0,
      process_goal: template.parameters?.process_goal || "stick_to_plan",
      extra_rules: template.parameters?.extra_rules || "",
    },
  });
}

export function planHasContent(plan) {
  if (!plan) return false;
  if (plan.focus?.score != null || plan.focus?.trade_mode) return true;
  if (plan.focus?.accept_risk_process) return true;
  if (Object.values(plan.focus?.motivation || {}).some(Boolean)) return true;
  const map = plan.mapping || {};
  if (map.daily_bias === "long" || map.daily_bias === "short") return true;
  for (const sid of ["asia", "london", "ny"]) {
    for (const hz of ["htf", "mtf", "ltf"]) {
      const block = map[sid]?.[hz];
      if (!block) continue;
      if (String(block.notes || "").trim()) return true;
      if ((block.note_tags || []).length) return true;
      if (Object.values(block.prompts || {}).some((v) => String(v || "").trim())) return true;
      if (Object.values(block.prompt_tags || {}).some((arr) => Array.isArray(arr) && arr.length)) return true;
      if (Object.values(block.checks || {}).some(Boolean)) return true;
      if (Object.values(block.pairs || {}).some(Boolean)) return true;
      if (block.tables?.a?.symbol || block.tables?.b?.symbol) return true;
      if (Object.values(block.tables?.a?.checks || {}).some(Boolean)) return true;
      if (Object.values(block.tables?.b?.checks || {}).some(Boolean)) return true;
      if (block.asia_pd || block.correlation || block.scenarios || block.events_log) return true;
      if (block.saved) return true;
    }
  }
  const pre = plan.pre_session || {};
  if (Object.values(pre).some((v) => String(v || "").trim())) return true;
  if ((plan.checklist || []).some((item) => item.done || item.custom)) return true;
  if ((plan.session_notes || []).length) return true;
  const post = plan.post_session || {};
  if (String(post.went_well || "").trim() || String(post.improve_next || "").trim()) return true;
  if (post.mood || post.discipline != null) return true;
  if (Object.values(post.process || {}).some(Boolean)) return true;
  const params = plan.parameters || {};
  if (String(params.extra_rules || "").trim()) return true;
  return false;
}

export function validatePlanParameters(parameters) {
  const errors = [];
  const limit = Number(parameters?.trade_limit);
  const risk = Number(parameters?.max_risk_percent);
  if (!Number.isFinite(limit) || limit < 0 || limit > 100) {
    errors.push("limit");
  }
  if (!Number.isFinite(risk) || risk < 0 || risk > 100) {
    errors.push("risk");
  }
  return errors;
}
