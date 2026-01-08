/**
 * Email templates for Radiosonde alert updates
 * Compact design for hourly updates during active warnings
 */

import { WeatherData, Alert } from '../weather/types.ts';
import { CONFIG } from '../config.ts';
import { StateChanges } from '../lib/state.ts';

export interface AlertTemplateData {
  weather: WeatherData;
  narrative: string;
  changes: StateChanges;
  generatedAt: Date;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  });
}

function getSeverityColor(severity: string): { bg: string; border: string; text: string } {
  switch (severity) {
    case 'high':
      return { bg: '#fef2f2', border: '#dc2626', text: '#991b1b' };
    case 'moderate':
      return { bg: '#fffbeb', border: '#f59e0b', text: '#92400e' };
    default:
      return { bg: '#f0fdf4', border: '#22c55e', text: '#166534' };
  }
}

function renderCompactAlert(alert: Alert): string {
  const colors = getSeverityColor(alert.severity);
  return `
    <div style="background: ${colors.bg}; border-left: 3px solid ${colors.border}; padding: 8px 12px; margin-bottom: 8px; border-radius: 4px;">
      <span style="font-weight: 600; color: ${colors.text};">${alert.icon} ${alert.type}</span>
    </div>
  `;
}

function renderChangesList(changes: StateChanges): string {
  const allChanges = [
    ...changes.alertChanges,
    ...changes.conditionChanges,
    ...changes.forecastChanges
  ];

  if (allChanges.length === 0) {
    return '<p style="color: #64748b; font-size: 13px; margin: 0;">No significant changes since last update.</p>';
  }

  return `
    <ul style="margin: 0; padding-left: 20px; color: #334155; font-size: 13px;">
      ${allChanges.map(c => `<li style="margin-bottom: 4px;">${c}</li>`).join('')}
    </ul>
  `;
}

export function renderAlertUpdateHtml(data: AlertTemplateData): string {
  const { weather, narrative, changes, generatedAt } = data;
  const t = weather.tempest;
  const a = weather.airport;
  const alerts = weather.alerts || [];

  const alertsHtml = alerts.map(alert => renderCompactAlert(alert)).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Weather Alert Update</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.5; color: #1e293b; background: #f8fafc; margin: 0; padding: 16px;">
  <div style="max-width: 500px; margin: 0 auto;">

    <!-- Header -->
    <div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); border-radius: 12px 12px 0 0; padding: 16px; text-align: center; color: white;">
      <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 2px; opacity: 0.8;">Alert Update</div>
      <div style="font-size: 18px; font-weight: 600; margin-top: 4px;">${CONFIG.location.name}</div>
      <div style="font-size: 13px; opacity: 0.9; margin-top: 2px;">${formatTime(generatedAt)}</div>
    </div>

    <!-- Main Content -->
    <div style="background: white; padding: 16px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0; border-top: none;">

      <!-- Active Alerts -->
      <div style="margin-bottom: 16px;">
        ${alertsHtml}
      </div>

      <!-- Current Conditions (compact) -->
      <div style="background: #f8fafc; border-radius: 8px; padding: 12px; margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
          ${t ? `
            <div>
              <span style="font-size: 24px; font-weight: bold;">${Math.round(t.temperatureF)}°F</span>
              <span style="color: #64748b; font-size: 13px; margin-left: 4px;">feels ${Math.round(t.feelsLikeF)}°</span>
            </div>
            <div style="color: #64748b; font-size: 13px;">
              ${t.windDirection} ${t.windSpeed} mph, gusts ${t.windGust}
            </div>
          ` : ''}
        </div>
        ${a ? `
          <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b;">
            KBUF @ ${a.observationTime}: ${a.weather || 'Fair'} • Vis ${a.visibility} mi • Precip ${a.precipToday}"
          </div>
        ` : ''}
      </div>

      <!-- Changes -->
      ${changes.hasChanges ? `
        <div style="margin-bottom: 16px;">
          <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 8px; font-weight: 600;">
            What's Changed
          </div>
          ${renderChangesList(changes)}
        </div>
      ` : ''}

      <!-- Narrative -->
      <div style="background: #fef3c7; border-radius: 8px; padding: 12px; border: 1px solid #fcd34d;">
        <div style="font-size: 14px; color: #92400e; line-height: 1.6;">
          ${narrative.split('\n\n').map(p => `<p style="margin: 0 0 8px 0;">${p.trim()}</p>`).join('')}
        </div>
      </div>

    </div>

    <!-- Footer -->
    <div style="text-align: center; padding: 12px; font-size: 11px; color: #94a3b8;">
      Radiosonde Alert Update • ${formatTime(generatedAt)}
    </div>

  </div>
</body>
</html>`;
}

export function renderAlertUpdateText(data: AlertTemplateData): string {
  const { weather, narrative, changes, generatedAt } = data;
  const t = weather.tempest;
  const a = weather.airport;
  const alerts = weather.alerts || [];

  let text = `RADIOSONDE ALERT UPDATE
${CONFIG.location.name} • ${formatTime(generatedAt)}
${'━'.repeat(40)}

`;

  if (alerts.length > 0) {
    text += `ACTIVE ALERTS:\n`;
    alerts.forEach(alert => {
      text += `  ${alert.icon} ${alert.type}\n`;
    });
    text += `\n`;
  }

  if (t) {
    text += `CURRENT: ${Math.round(t.temperatureF)}°F (feels ${Math.round(t.feelsLikeF)}°)\n`;
    text += `WIND: ${t.windDirection} ${t.windSpeed} mph, gusts ${t.windGust}\n`;
  }

  if (a) {
    text += `KBUF @ ${a.observationTime}: ${a.weather || 'Fair'}\n`;
    text += `Visibility: ${a.visibility} mi • Precip: ${a.precipToday}"\n`;
  }

  text += `\n${'─'.repeat(40)}\n`;

  if (changes.hasChanges) {
    text += `\nCHANGES:\n`;
    [...changes.alertChanges, ...changes.conditionChanges, ...changes.forecastChanges]
      .forEach(c => { text += `• ${c}\n`; });
  }

  text += `\n${'─'.repeat(40)}\n\n`;
  text += narrative;
  text += `\n\n${'━'.repeat(40)}\n`;
  text += `Radiosonde Alert Update • ${formatTime(generatedAt)}\n`;

  return text;
}
