/**
 * Email templates for Radiosonde weather briefings
 * Dashboard-style design with metrics grid
 */

import { WeatherData, Alert } from '../weather/types.ts';
import { CONFIG } from '../config.ts';
import { formatDateTime, formatDate, mbToInHg } from '../weather/utils.ts';

export interface TemplateData {
  weather: WeatherData;
  narrative: string;
  generatedAt: Date;
}

function getPressureTrendIcon(trend: string): string {
  if (trend === 'rising') return '↑';
  if (trend === 'falling') return '↓';
  return '→';
}

function getPressureTrendColor(trend: string): string {
  if (trend === 'rising') return '#22c55e';
  if (trend === 'falling') return '#ef4444';
  return '#64748b';
}

function getUVDescription(uv: number): string {
  if (uv < 3) return 'Low';
  if (uv < 6) return 'Moderate';
  if (uv < 8) return 'High';
  if (uv < 11) return 'Very High';
  return 'Extreme';
}

function formatAlertTime(date: Date | undefined): string {
  if (!date) return '';
  return date.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
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

function formatNarrative(narrative: string): string {
  // Split into paragraphs and format each
  const paragraphs = narrative.split(/\n\n+/).filter(p => p.trim());

  return paragraphs.map((p, i) => {
    // First paragraph gets special styling
    if (i === 0) {
      return `<p style="font-size: 16px; color: #1e293b; margin: 0 0 16px 0; font-weight: 500; line-height: 1.7;">${p.trim()}</p>`;
    }
    return `<p style="font-size: 15px; color: #475569; margin: 0 0 14px 0; line-height: 1.7;">${p.trim()}</p>`;
  }).join('');
}

function renderAlertCard(alert: Alert): string {
  const colors = getSeverityColor(alert.severity);
  const timeRange = alert.effective && alert.expires
    ? `${formatAlertTime(alert.effective)} → ${formatAlertTime(alert.expires)}`
    : alert.expires
      ? `Until ${formatAlertTime(alert.expires)}`
      : '';

  return `
    <div style="background: ${colors.bg}; border-left: 4px solid ${colors.border}; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
      <div style="display: flex; align-items: flex-start; gap: 12px;">
        <div style="font-size: 24px; line-height: 1;">${alert.icon}</div>
        <div style="flex: 1;">
          <div style="font-weight: 700; font-size: 15px; color: ${colors.text}; margin-bottom: 4px;">
            ${alert.type}
          </div>
          ${timeRange ? `
            <div style="font-size: 12px; color: ${colors.text}; opacity: 0.8; margin-bottom: 8px; font-family: monospace;">
              ⏱ ${timeRange}
            </div>
          ` : ''}
          <div style="font-size: 13px; color: #475569; line-height: 1.5;">
            ${alert.headline || ''}
          </div>
        </div>
      </div>
    </div>
  `;
}

export function renderHtmlEmail(data: TemplateData): string {
  const { weather, narrative, generatedAt } = data;
  const t = weather.tempest;
  const a = weather.airport;
  const alerts = weather.alerts || [];

  // Individual alert cards
  const alertsHtml = alerts.length > 0 ? `
    <div style="margin-bottom: 24px;">
      <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #dc2626; margin-bottom: 12px; font-weight: 600;">
        ⚠️ ${alerts.length} Active Alert${alerts.length > 1 ? 's' : ''}
      </div>
      ${alerts.map(a => renderAlertCard(a)).join('')}
    </div>
  ` : '';

  // Tempest Station metrics
  const tempestHtml = t ? `
    <div style="margin-bottom: 16px;">
      <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 12px; font-weight: 600;">
        📡 Personal Weather Station
      </div>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <!-- Temperature Card -->
          <td width="50%" style="padding: 6px;">
            <div style="background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); border-radius: 12px; padding: 20px; text-align: center; color: white;">
              <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.85;">Temperature</div>
              <div style="font-size: 44px; font-weight: bold; margin: 8px 0;">${Math.round(t.temperatureF)}°</div>
              <div style="font-size: 14px; opacity: 0.9;">Feels like ${Math.round(t.feelsLikeF)}°F</div>
            </div>
          </td>
          <!-- Wind Card -->
          <td width="50%" style="padding: 6px;">
            <div style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); border-radius: 12px; padding: 20px; text-align: center; color: white;">
              <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.85;">Wind</div>
              <div style="font-size: 44px; font-weight: bold; margin: 8px 0;">${t.windSpeed}<span style="font-size: 16px; font-weight: normal;"> mph</span></div>
              <div style="font-size: 14px; opacity: 0.9;">${t.windDirection} • Gusts ${t.windGust}</div>
            </div>
          </td>
        </tr>
        <tr>
          <!-- Humidity Card -->
          <td width="50%" style="padding: 6px;">
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; text-align: center;">
              <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #64748b;">Humidity</div>
              <div style="font-size: 28px; font-weight: bold; color: #1e293b; margin: 4px 0;">${t.humidity}%</div>
              <div style="font-size: 12px; color: #64748b;">Dew Point ${Math.round(t.dewPointF)}°F</div>
            </div>
          </td>
          <!-- Pressure Card -->
          <td width="50%" style="padding: 6px;">
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; text-align: center;">
              <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #64748b;">Pressure</div>
              <div style="font-size: 28px; font-weight: bold; color: #1e293b; margin: 4px 0;">
                ${mbToInHg(t.pressure)}"
                <span style="font-size: 16px; color: ${getPressureTrendColor(t.pressureTrend)};">${getPressureTrendIcon(t.pressureTrend)}</span>
              </div>
              <div style="font-size: 12px; color: #64748b;">${Math.round(t.pressure)} mb • <span style="color: ${getPressureTrendColor(t.pressureTrend)}; text-transform: capitalize;">${t.pressureTrend}</span></div>
            </div>
          </td>
        </tr>
        <tr>
          <!-- UV Index Card -->
          <td width="50%" style="padding: 6px;">
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; text-align: center;">
              <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #64748b;">UV Index</div>
              <div style="font-size: 28px; font-weight: bold; color: #1e293b; margin: 4px 0;">${t.uv}</div>
              <div style="font-size: 12px; color: #64748b;">${getUVDescription(t.uv)}</div>
            </div>
          </td>
          <td width="50%" style="padding: 6px;"></td>
        </tr>
      </table>
    </div>
  ` : '';

  // Airport observation metrics
  const airportHtml = a ? `
    <div style="margin-bottom: 24px;">
      <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 12px; font-weight: 600;">
        ✈️ ${a.stationName} <span style="font-weight: normal; opacity: 0.8;">@ ${a.observationTime}</span>
      </div>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <!-- Airport Temperature -->
          <td width="50%" style="padding: 6px;">
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; text-align: center;">
              <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #64748b;">Temperature</div>
              <div style="font-size: 28px; font-weight: bold; color: #1e293b; margin: 4px 0;">${Math.round(a.temperature)}°F</div>
              <div style="font-size: 12px; color: #64748b;">Dew Point ${Math.round(a.dewPoint)}°F</div>
            </div>
          </td>
          <!-- Airport Wind -->
          <td width="50%" style="padding: 6px;">
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; text-align: center;">
              <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #64748b;">Wind</div>
              <div style="font-size: 28px; font-weight: bold; color: #1e293b; margin: 4px 0;">${a.wind}</div>
              <div style="font-size: 12px; color: #64748b;">Visibility ${a.visibility} mi</div>
            </div>
          </td>
        </tr>
        <tr>
          <!-- Airport Weather -->
          <td width="50%" style="padding: 6px;">
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; text-align: center;">
              <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #64748b;">Conditions</div>
              <div style="font-size: 16px; font-weight: bold; color: #1e293b; margin: 4px 0;">${a.weather || 'Fair'}</div>
              <div style="font-size: 12px; color: #64748b;">${a.sky}</div>
            </div>
          </td>
          <!-- Airport Pressure -->
          <td width="50%" style="padding: 6px;">
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; text-align: center;">
              <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #64748b;">Pressure</div>
              <div style="font-size: 28px; font-weight: bold; color: #1e293b; margin: 4px 0;">${a.pressureIn}"</div>
              <div style="font-size: 12px; color: #64748b;">${Math.round(a.pressureMb)} mb</div>
            </div>
          </td>
        </tr>
        <tr>
          <!-- Precipitation Card -->
          <td colspan="2" style="padding: 6px;">
            <div style="background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%); border-radius: 12px; padding: 16px; text-align: center; color: white;">
              <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.85;">Precipitation</div>
              <div style="font-size: 32px; font-weight: bold; margin: 6px 0;">
                ${a.precipToday}" <span style="font-size: 16px; font-weight: normal; opacity: 0.85;">today</span>
                <span style="opacity: 0.6; margin: 0 8px;">|</span>
                ${a.precipYesterday}" <span style="font-size: 16px; font-weight: normal; opacity: 0.85;">yesterday</span>
              </div>
            </div>
          </td>
        </tr>
      </table>
    </div>
  ` : '';

  const metricsHtml = (t || a) ? `${tempestHtml}${airportHtml}` : '<p style="color: #64748b; text-align: center; padding: 40px;">Station data unavailable</p>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Weather Briefing</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; background: #0f172a; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto;">

    <!-- Header Card -->
    <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); border-radius: 16px 16px 0 0; padding: 24px; text-align: center; color: white;">
      <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 2px; opacity: 0.6; margin-bottom: 4px;">Radiosonde</div>
      <div style="font-size: 26px; font-weight: 600;">${CONFIG.location.name}</div>
      <div style="font-size: 14px; opacity: 0.7; margin-top: 4px;">${formatDate(generatedAt)}</div>
    </div>

    <!-- Main Content Card -->
    <div style="background: white; padding: 24px;">

      <!-- Alerts Section -->
      ${alertsHtml}

      <!-- Dashboard Metrics -->
      ${metricsHtml}

      <!-- Narrative Section -->
      <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-radius: 12px; padding: 20px; margin-top: 8px; border: 1px solid #e2e8f0;">
        <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 16px; display: flex; align-items: center;">
          <span style="display: inline-block; width: 8px; height: 8px; background: #22c55e; border-radius: 50%; margin-right: 8px;"></span>
          AI Weather Briefing
        </div>
        <div style="color: #334155;">
          ${formatNarrative(narrative)}
        </div>
      </div>

    </div>

    <!-- Footer -->
    <div style="background: #1e293b; border-radius: 0 0 16px 16px; padding: 16px 24px; text-align: center;">
      <div style="font-size: 12px; color: #94a3b8;">
        Tempest Weather Station • NWS ${CONFIG.nws.office} • Claude AI
      </div>
      <div style="font-size: 11px; color: #64748b; margin-top: 4px;">
        Generated ${generatedAt.toLocaleTimeString()}
      </div>
    </div>

  </div>
</body>
</html>`;
}

export function renderTextEmail(data: TemplateData): string {
  const { weather, narrative, generatedAt } = data;
  const t = weather.tempest;
  const a = weather.airport;
  const alerts = weather.alerts || [];

  let text = `RADIOSONDE WEATHER BRIEFING
${CONFIG.location.name} • ${formatDateTime(generatedAt)}
${'━'.repeat(50)}

`;

  if (alerts.length > 0) {
    text += `⚠️  ACTIVE ALERTS (${alerts.length})
${'─'.repeat(50)}
`;
    alerts.forEach(alert => {
      text += `
${alert.icon} ${alert.type.toUpperCase()}
`;
      if (alert.effective && alert.expires) {
        text += `   ⏱  ${formatAlertTime(alert.effective)} → ${formatAlertTime(alert.expires)}
`;
      } else if (alert.expires) {
        text += `   ⏱  Until ${formatAlertTime(alert.expires)}
`;
      }
      if (alert.headline) {
        text += `   ${alert.headline}
`;
      }
    });
    text += `
${'━'.repeat(50)}

`;
  }

  if (t) {
    text += `📡 PERSONAL WEATHER STATION
${'─'.repeat(50)}

   🌡️  Temperature    ${Math.round(t.temperatureF)}°F (feels like ${Math.round(t.feelsLikeF)}°F)
   💨  Wind           ${t.windDirection} at ${t.windSpeed} mph, gusts ${t.windGust} mph
   💧  Humidity       ${t.humidity}% • Dew Point ${Math.round(t.dewPointF)}°F
   📊  Pressure       ${mbToInHg(t.pressure)}" (${Math.round(t.pressure)} mb) ${t.pressureTrend}
   ☀️  UV Index       ${t.uv} (${getUVDescription(t.uv)})

`;
  }

  if (a) {
    text += `✈️  ${a.stationName.toUpperCase()} @ ${a.observationTime}
${'─'.repeat(50)}

   🌡️  Temperature    ${Math.round(a.temperature)}°F • Dew Point ${Math.round(a.dewPoint)}°F
   💨  Wind           ${a.wind}
   👁️  Visibility     ${a.visibility} mi
   ☁️  Conditions     ${a.weather || 'Fair'} • ${a.sky}
   📊  Pressure       ${a.pressureIn}" (${Math.round(a.pressureMb)} mb)
   🌧️  Precipitation  ${a.precipToday}" today, ${a.precipYesterday}" yesterday

${'━'.repeat(50)}

`;
  }

  text += `AI BRIEFING
${'─'.repeat(50)}

${narrative}

${'━'.repeat(50)}
Tempest Weather Station • NWS ${CONFIG.nws.office} • Claude AI
Generated ${generatedAt.toLocaleTimeString()}
`;

  return text;
}
