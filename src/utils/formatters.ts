export function formatPrice(price: number, minDecimals = 2, maxDecimals = 4): string {
  if (price === undefined || price === null || isNaN(price)) return '0.00';
  if (price >= 1000) {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  }
  if (price >= 1) {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: minDecimals > 2 ? minDecimals : 4,
    }).format(price);
  }
  if (price >= 0.0001) {
    return price.toFixed(maxDecimals);
  }
  return price.toFixed(6);
}

export function formatPercent(value: number, includeSign = true): string {
  if (value === undefined || value === null || isNaN(value)) return '0.00%';
  const sign = includeSign && value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

export function formatVolume(volume: number): string {
  if (!volume || isNaN(volume)) return '$0';
  if (volume >= 1e9) {
    return `$${(volume / 1e9).toFixed(2)}B`;
  }
  if (volume >= 1e6) {
    return `$${(volume / 1e6).toFixed(2)}M`;
  }
  if (volume >= 1e3) {
    return `$${(volume / 1e3).toFixed(2)}K`;
  }
  return `$${volume.toFixed(2)}`;
}

export function formatTime(timestampSeconds: number, format: 'time' | 'date' | 'full' = 'time'): string {
  const date = new Date(timestampSeconds * 1000);
  if (format === 'time') {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (format === 'date') {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}
