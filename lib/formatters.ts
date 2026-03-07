const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', CAD: 'C$', AUD: 'A$',
};

export function getCurrencySymbol(currency: string = 'USD'): string {
  return CURRENCY_SYMBOLS[currency] ?? '$';
}

// Currency formatting — respects showBalance and currency preference
export function formatCurrency(
  value: number,
  currency: string = 'USD',
  showBalance: boolean = true,
): string {
  if (!showBalance) return '••••';
  const symbol = CURRENCY_SYMBOLS[currency] ?? '$';
  const formatted = Math.abs(value).toLocaleString('en-US', { maximumFractionDigits: 0 });
  return value < 0 ? `-${symbol}${formatted}` : `${symbol}${formatted}`;
}

// Odds formatting — converts american odds to decimal or fractional
export function formatOdds(
  odds: string | number,
  format: string = 'american',
): string {
  if (!odds && odds !== 0) return '—';
  const raw = typeof odds === 'string' ? odds.trim() : String(odds);
  if (!raw || raw === '0') return '—';
  if (format === 'american') return raw;

  const american = parseFloat(raw.replace('+', ''));
  if (isNaN(american)) return raw;

  if (format === 'decimal') {
    const decimal = american > 0
      ? (american / 100) + 1
      : (100 / Math.abs(american)) + 1;
    return decimal.toFixed(2);
  }

  if (format === 'fractional') {
    const decimal = american > 0
      ? american / 100
      : 100 / Math.abs(american);
    const numerator = Math.round(decimal * 100);
    const denominator = 100;
    const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
    const divisor = gcd(numerator, denominator);
    return `${numerator / divisor}/${denominator / divisor}`;
  }

  return raw;
}

// ROI formatting — always shows sign, 0 decimals
export function formatROI(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}%`;
}

// Legacy: kept for backward compat
export function formatPL(value: number): string {
  if (value === 0) return '$0';
  const prefix = value > 0 ? '+' : '-';
  const absVal = Math.abs(value);
  return prefix + '$' + absVal.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

// Percentage: 50.0%, +66.7%
export function formatPercent(value: number, showPlus: boolean = false): string {
  const prefix = showPlus && value > 0 ? '+' : '';
  return prefix + value.toFixed(1) + '%';
}

// Compact currency for profile stats: $2.4K, $450
export function formatCompactCurrency(value: number): string {
  const prefix = value >= 0 ? '' : '-';
  const absVal = Math.abs(value);
  if (absVal >= 1000) {
    return prefix + '$' + (absVal / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return prefix + '$' + absVal.toFixed(0);
}

// Whole number (for wins/losses counts)
export function formatWholeNumber(value: number): string {
  return Math.round(value).toString();
}
