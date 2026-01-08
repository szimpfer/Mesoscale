/**
 * Weather utility functions
 */

export function celsiusToFahrenheit(c: number): number {
  return Math.round((c * 9/5 + 32) * 10) / 10;
}

export function degreesToCardinal(degrees: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                      'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index];
}

export function mmToInches(mm: number): number {
  return Math.round(mm / 25.4 * 100) / 100;
}

export function mpsToMph(mps: number): number {
  return Math.round(mps * 2.237);
}

export function mbToInHg(mb: number): number {
  return Math.round(mb / 33.8639 * 100) / 100;
}

export function formatDate(date: Date = new Date()): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

export function formatTime(date: Date = new Date()): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short'
  });
}

export function formatDateTime(date: Date = new Date()): string {
  return `${formatDate(date)} at ${formatTime(date)}`;
}
