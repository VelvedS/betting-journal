// Format currency: $1,234.50, -$500
export function formatCurrency(value: number): string {
  const prefix = value >= 0 ? '' : '-';
  const absVal = Math.abs(value);
  return prefix + '$' + absVal.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

// Format currency with +/- prefix: +$478, -$95
export function formatPL(value: number): string {
  if (value === 0) return '$0';
  const prefix = value > 0 ? '+' : '-';
  const absVal = Math.abs(value);
  return prefix + '$' + absVal.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

// Format percentage: 50.0%, 66.7%
export function formatPercent(value: number, showPlus: boolean = false): string {
  const prefix = showPlus && value > 0 ? '+' : '';
  return prefix + value.toFixed(1) + '%';
}

// Format compact currency for profile: $2.4K, $450
export function formatCompactCurrency(value: number): string {
  const prefix = value >= 0 ? '' : '-';
  const absVal = Math.abs(value);
  if (absVal >= 1000) {
    return prefix + '$' + (absVal / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return prefix + '$' + absVal.toFixed(0);
}

// Format whole number (for wins/losses)
export function formatWholeNumber(value: number): string {
  return Math.round(value).toString();
}
