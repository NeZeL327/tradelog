// Panel konta prop: szacunek z zapisanych, zamkniętych transakcji. Tylko odczyt — nic nie zapisuje.
// Limity z pól konta: max_daily_loss_percent i max_account_loss (% kapitału początkowego),
// profit_target (kwota). Drawdown liczony statycznie od initial_balance (jak dotąd w aplikacji).
import { dayKeyOf, tradeDayKey } from "@/lib/calendarAggregates";
import { getTradeRealizedPL, isClosedTrade } from "@/lib/utils";

const num = (value) => {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : null;
};
const positive = (value) => {
  const n = num(value);
  return n != null && n > 0 ? n : null;
};
const round2 = (n) => Math.round(n * 100) / 100;

/** Poziom zużycia limitu: < 70% ok, 70–90% ostrzeżenie, > 90% krytyczny. null = brak danych. */
export function limitTone(used) {
  if (used == null || !Number.isFinite(used)) return null;
  if (used > 0.9) return "danger";
  if (used > 0.7) return "warn";
  return "ok";
}

/** Data z pola Firestore (Timestamp, {seconds}, ISO, ms) albo null. */
export function toDateValue(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (typeof value.seconds === "number") return new Date(value.seconds * 1000);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Wynik zamkniętych transakcji konta wg dnia (YYYY-MM-DD → P&L), dni rosnąco. */
export function dailyResults(trades) {
  const map = new Map();
  for (const trade of trades || []) {
    const key = tradeDayKey(trade?.date);
    if (!key) continue;
    map.set(key, (map.get(key) || 0) + (getTradeRealizedPL(trade) ?? 0));
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, pl]) => ({ key, pl: round2(pl) }));
}

/**
 * Stan konta prop. account: dokument konta; trades: wszystkie transakcje (filtrowane tu po account.id).
 * Zwraca null w polach, których nie da się policzyć (brak limitu, brak kapitału, brak transakcji).
 */
export function computePropStatus(account, trades, { today = new Date() } = {}) {
  const accountId = String(account?.id ?? "");
  const own = (trades || []).filter((trade) => String(trade?.account_id) === accountId && isClosedTrade(trade));
  const initial = positive(account?.initial_balance);
  const days = dailyResults(own);
  const netPL = round2(days.reduce((sum, day) => sum + day.pl, 0));
  const equity = initial != null ? round2(initial + netPL) : null;

  // Krzywa kapitału po dniach (od kapitału początkowego).
  let running = initial ?? 0;
  const curve = initial != null
    ? [{ key: "start", equity: initial }, ...days.map((day) => ({ key: day.key, equity: round2((running += day.pl)) }))]
    : [];

  const dailyPct = positive(account?.max_daily_loss_percent);
  let daily = null;
  if (initial != null && dailyPct != null) {
    const limit = round2((initial * dailyPct) / 100);
    const todayKey = dayKeyOf(today);
    const todayPl = days.find((day) => day.key === todayKey)?.pl ?? 0;
    const worst = days.reduce((min, day) => (min == null || day.pl < min.pl ? day : min), null);
    const worstLoss = worst && worst.pl < 0 ? -worst.pl : 0;
    daily = {
      limit,
      todayLoss: round2(Math.max(0, -todayPl)),
      todayUsed: Math.max(0, -todayPl) / limit,
      worstDay: worst && worst.pl < 0 ? worst : null,
      worstUsed: worstLoss / limit,
    };
  }

  const totalPct = positive(account?.max_account_loss);
  let total = null;
  if (initial != null && totalPct != null) {
    const limit = round2((initial * totalPct) / 100);
    const floor = round2(initial - limit);
    const lost = Math.max(0, initial - equity);
    const remaining = round2(equity - floor);
    total = {
      limit,
      floor,
      remaining,
      // Pozostały bufor jako % kapitału początkowego (względem limitu wychodziłoby > 100% przy zysku).
      remainingPct: round2((remaining / initial) * 100),
      used: lost / limit,
    };
  }

  const targetAmount = positive(account?.profit_target);
  const target = targetAmount != null
    ? {
      target: targetAmount,
      progress: Math.max(0, netPL) / targetAmount,
      remaining: round2(Math.max(0, targetAmount - netPL)),
    }
    : null;

  const best = days.reduce((max, day) => (max == null || day.pl > max.pl ? day : max), null);
  const consistency = {
    bestDay: best && best.pl > 0 ? best : null,
    // Udział najlepszego dnia w całym zysku; tylko gdy konto jest na plusie.
    share: best && best.pl > 0 && netPL > 0 ? best.pl / netPL : null,
  };

  const changes = [account?.updatedAt, account?.createdAt, ...own.flatMap((trade) => [trade?.updatedAt, trade?.createdAt])]
    .map(toDateValue)
    .filter(Boolean);
  const lastChange = changes.length ? new Date(Math.max(...changes.map((date) => date.getTime()))) : null;

  return {
    initial,
    netPL,
    equity,
    tradingDays: days.length,
    daily,
    total,
    target,
    consistency,
    curve,
    lastChange,
    hasLimits: Boolean(daily || total || target),
  };
}

/**
 * Czy planowane ryzyko transakcji zmieści się w pozostałym dziennym limicie konta (szacunek, tylko odczyt).
 * status: wynik computePropStatus; riskAmount: kwota ryzyka transakcji. null = brak danych do oceny.
 */
export function dailyLimitFit(status, riskAmount) {
  const risk = Number(riskAmount);
  if (!status?.daily || !(risk > 0)) return null;
  const left = Math.max(0, status.daily.limit - status.daily.todayLoss);
  return {
    riskPctOfAccount: status.initial ? round2((risk / status.initial) * 100) : null,
    left: round2(left),
    fits: risk <= left + 1e-9,
    usedAfter: (status.daily.todayLoss + risk) / status.daily.limit,
  };
}
