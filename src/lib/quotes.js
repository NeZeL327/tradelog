const DAILY = {
  pl: [
    "Małe, konsekwentne decyzje tworzą wielkie wyniki.",
    "Dyscyplina pokonuje talent.",
    "Proces jest ważniejszy niż pojedynczy wynik.",
    "Nie kontrolujesz rynku. Kontrolujesz swoje decyzje.",
    "Każda transakcja jest informacją.",
    "Najważniejszy trade to następny trade.",
    "Rynek nagradza cierpliwość, nie pośpiech.",
    "Planuj trade. Traduj plan.",
  ],
  en: [
    "Small, consistent decisions create great results.",
    "Discipline beats talent.",
    "Process matters more than a single outcome.",
    "You don’t control the market. You control your decisions.",
    "Every trade is information.",
    "The most important trade is the next one.",
    "The market rewards patience, not haste.",
    "Plan the trade. Trade the plan.",
  ],
};

const CONTEXT = {
  winStreak: {
    pl: "Seria zwycięstw nie jest powodem do zwiększania ryzyka.",
    en: "A winning streak is not a reason to increase risk.",
  },
  lossStreak: {
    pl: "Strata jest informacją. Nie jest wyrokiem.",
    en: "A loss is information. It is not a verdict.",
  },
  profitDay: {
    pl: "Dobry proces prowadzi do dobrych wyników.",
    en: "A good process leads to good results.",
  },
  lossDay: {
    pl: "Nie oceniaj strategii po jednej transakcji.",
    en: "Don’t judge a strategy by a single trade.",
  },
};

function dayIndex(length) {
  const now = new Date();
  const key = `${now.getFullYear()}${now.getMonth()}${now.getDate()}`;
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash + key.charCodeAt(i) * (i + 1)) % 997;
  return hash % Math.max(length, 1);
}

export function pickDailyQuote(language = "pl") {
  const list = DAILY[language] || DAILY.pl;
  return list[dayIndex(list.length)];
}

export function pickContextualQuote(language = "pl", stats = {}) {
  const lang = language === "en" ? "en" : "pl";
  const streak = Number(stats.activeStreakCount) || 0;
  const todayPl = Number(stats.todayPL);
  const todayCount = Number(stats.todayTradeCount) || 0;

  if (stats.activeStreakType === "Win" && streak >= 3) return CONTEXT.winStreak[lang];
  if (stats.activeStreakType === "Loss" && streak >= 3) return CONTEXT.lossStreak[lang];
  if (todayCount > 0 && Number.isFinite(todayPl) && todayPl > 0) return CONTEXT.profitDay[lang];
  if (todayCount > 0 && Number.isFinite(todayPl) && todayPl < 0) return CONTEXT.lossDay[lang];
  return pickDailyQuote(lang);
}
