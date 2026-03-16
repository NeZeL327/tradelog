/**
 * Logger – w produkcji nie wypisuje danych (unikamy wycieku PII i szczegółów błędów).
 * Tylko w development można włączyć verbose.
 */
const isDev = import.meta.env.DEV;

export const logger = {
  log: (...args) => {
    if (isDev) {
      console.log(...args);
    }
  },
  warn: (...args) => {
    if (isDev) {
      console.warn(...args);
    }
  },
  error: (message, error = null) => {
    if (isDev && error) {
      console.error(message, error);
    } else if (isDev) {
      console.error(message);
    }
  },
};
