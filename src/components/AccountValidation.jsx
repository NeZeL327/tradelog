export const validateAccount = (formData) => {
  const errors = {};

  if (!formData.name?.trim()) {
    errors.name = "Nazwa konta jest wymagana";
  }

  if (!formData.initial_balance) {
    errors.initial_balance = "Kapitał początkowy jest wymagany";
  } else if (isNaN(parseFloat(formData.initial_balance)) || parseFloat(formData.initial_balance) <= 0) {
    errors.initial_balance = "Kapitał musi być liczbą dodatnią";
  }

  if (!formData.account_type) {
    errors.account_type = "Typ konta jest wymagany";
  }

  if (formData.account_number && !/^\d+$/.test(formData.account_number)) {
    errors.account_number = "Numer konta musi zawierać tylko cyfry";
  }

  if (formData.max_risk_per_trade) {
    const risk = parseFloat(formData.max_risk_per_trade);
    if (isNaN(risk) || risk < 0 || risk > 100) {
      errors.max_risk_per_trade = "Ryzyko musi być liczbą od 0 do 100";
    }
  }

  if (formData.max_daily_loss) {
    const loss = parseFloat(formData.max_daily_loss);
    if (isNaN(loss) || loss < 0 || loss > 100) {
      errors.max_daily_loss = "Strata musi być liczbą od 0 do 100";
    }
  }

  if (formData.currency && !/^[A-Z]{3}$/.test(formData.currency.toUpperCase())) {
    errors.currency = "Waluta musi być kodem 3-znakowym (np. USD)";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};