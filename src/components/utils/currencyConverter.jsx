// Approximate exchange rates to USD (for demo purposes)
// In production, you'd fetch live rates from an API
const RATES_TO_USD = {
  USD: 1,
  EUR: 1.08,
  GBP: 1.27,
  ILS: 0.27,
  JPY: 0.0067,
  CAD: 0.74,
  AUD: 0.65,
  CHF: 1.13,
  CNY: 0.14,
  INR: 0.012,
  MXN: 0.058,
  BRL: 0.20,
  KRW: 0.00075,
  SGD: 0.74,
  HKD: 0.13,
  NOK: 0.091,
  SEK: 0.095,
  DKK: 0.14,
  NZD: 0.60,
  ZAR: 0.053,
  RUB: 0.011,
  TRY: 0.031,
  PLN: 0.25,
  THB: 0.028,
  MYR: 0.21,
  PHP: 0.018,
  IDR: 0.000063,
  VND: 0.00004,
  AED: 0.27,
  SAR: 0.27,
  TWD: 0.031,
  CZK: 0.043,
  HUF: 0.0027,
  RON: 0.22,
  BGN: 0.55,
  HRK: 0.14,
  UAH: 0.027,
  EGP: 0.032,
  PKR: 0.0036,
  BDT: 0.0091,
  NGN: 0.00065,
  KES: 0.0065,
  GHS: 0.065,
  TZS: 0.00039,
  UGX: 0.00027,
  MAD: 0.099,
  DZD: 0.0074,
  TND: 0.32,
  LYD: 0.21,
  JOD: 1.41,
  LBP: 0.000011,
  KWD: 3.25,
  QAR: 0.27,
  BHD: 2.65,
  OMR: 2.60,
  COP: 0.00025,
  CLP: 0.0011,
  PEN: 0.27,
  ARS: 0.0011,
  VEF: 0.0001,
};

export function convertToUSD(amount, fromCurrency) {
  const rate = RATES_TO_USD[fromCurrency] || RATES_TO_USD[fromCurrency?.toUpperCase()] || 1;
  return amount * rate;
}

export function convertFromUSD(amountUSD, toCurrency) {
  const rate = RATES_TO_USD[toCurrency] || RATES_TO_USD[toCurrency?.toUpperCase()] || 1;
  return amountUSD / rate;
}

export function convertCurrency(amount, fromCurrency, toCurrency) {
  const usdAmount = convertToUSD(amount, fromCurrency);
  return convertFromUSD(usdAmount, toCurrency);
}

export function getPrimaryCurrency(expenses) {
  const currencyCount = {};
  expenses.forEach(exp => {
    const curr = exp.currency || 'USD';
    currencyCount[curr] = (currencyCount[curr] || 0) + 1;
  });
  
  let maxCurrency = 'USD';
  let maxCount = 0;
  Object.entries(currencyCount).forEach(([curr, count]) => {
    if (count > maxCount) {
      maxCount = count;
      maxCurrency = curr;
    }
  });
  
  return maxCurrency;
}

export function getTotalInCurrency(expenses, targetCurrency) {
  return expenses.reduce((total, exp) => {
    const converted = convertCurrency(exp.amount || 0, exp.currency || 'USD', targetCurrency);
    return total + converted;
  }, 0);
}

export function formatCurrency(amount, currency) {
  return `${amount.toFixed(2)} ${currency}`;
}