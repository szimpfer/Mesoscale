/**
 * Claude Haiku AI integration for weather narrative generation
 */

import Anthropic from '@anthropic-ai/sdk';
import { CONFIG } from '../config.ts';
import { WeatherData } from '../weather/types.ts';
import { StateChanges } from '../lib/state.ts';

const client = new Anthropic({
  apiKey: CONFIG.claude.apiKey
});

function buildPrompt(data: WeatherData): string {
  const t = data.tempest;
  const a = data.airport;
  const afd = data.afd;
  const alerts = data.alerts || [];
  const forecast = data.forecast || [];

  const today = new Date();
  const dayOfWeek = today.toLocaleDateString('en-US', { weekday: 'long' });
  const isThursday = today.getDay() === 4;

  let prompt = `You are a personal meteorologist writing a morning weather briefing email.

LOCATION: ${CONFIG.location.description}
Nearby areas of interest: ${CONFIG.location.nearbyAreas.join(', ')}

HOUSEHOLD CONTEXT (for relevant weather impacts):
- Michelle works at a school in Alden, NY (${CONFIG.family.michelle.schedule})
- Scott works in East Aurora, NY (${CONFIG.family.scott.schedule})${isThursday ? ' - TODAY IS THURSDAY (Scott commutes to East Aurora)' : ''}
- Today is ${dayOfWeek}

CURRENT CONDITIONS FROM PERSONAL WEATHER STATION:
`;

  if (t) {
    prompt += `Temperature: ${t.temperatureF}°F (feels like ${t.feelsLikeF}°F)
Wind: ${t.windDirection} at ${t.windSpeed} mph, gusting to ${t.windGust} mph
Pressure: ${t.pressure} mb and ${t.pressureTrend}
Humidity: ${t.humidity}%, dew point ${t.dewPointF}°F
`;
  } else {
    prompt += `Personal station data unavailable.
`;
  }

  // Airport observation (official NWS data)
  if (a) {
    prompt += `
BUFFALO INTL AIRPORT (${a.stationId}) @ ${a.observationTime}:
Temperature: ${a.temperature}°F, Dew Point: ${a.dewPoint}°F
Wind: ${a.wind}
Visibility: ${a.visibility} mi
Conditions: ${a.weather || 'Fair'}
Pressure: ${a.pressureIn}" (${a.pressureMb} mb)
Precipitation: ${a.precipToday}" today, ${a.precipYesterday}" yesterday
`;
  }

  if (afd) {
    prompt += `
FORECAST DISCUSSION (National Weather Service):
Synopsis: ${afd.synopsis}
${afd.nearTerm ? `Near Term: ${afd.nearTerm}` : ''}
`;
  }

  if (forecast.length > 0) {
    prompt += `
WEEK AHEAD:
`;
    forecast.forEach(f => {
      prompt += `${f.day}: ${f.icon} High ${f.high}°F, Low ${f.low}°F - ${f.shortForecast || f.condition}
`;
    });
  }

  if (alerts.length > 0) {
    prompt += `
ACTIVE ALERTS:
`;
    alerts.forEach(a => {
      prompt += `${a.icon} ${a.type}: ${a.headline}
`;
    });
  }

  prompt += `
Write a conversational weather briefing (3-4 short paragraphs, under 300 words) that:
1. Opens with current conditions in plain language
2. Explains what to expect today and tonight
3. Highlights notable weather in the next 7 days
4. Mentions any hazards or alerts (if present)
5. Uses a friendly, informative tone - like talking to a friend
6. If relevant, mention impacts for Michelle's commute to Alden or Scott's Thursday commute to East Aurora

DATA SOURCES:
- Personal station: temperature, feels like, wind, humidity, pressure
- Buffalo Intl Airport (NWS): precipitation totals, visibility, official conditions
- Do not attribute precipitation to the personal station - always use airport data for precip

Focus on practical impacts: what to wear, prepare for, or be aware of. Be concise and specific.`;

  return prompt;
}

export async function generateNarrative(data: WeatherData): Promise<string> {
  if (!CONFIG.claude.apiKey) {
    console.warn('ANTHROPIC_API_KEY not set, using fallback template');
    return generateFallbackNarrative(data);
  }

  try {
    const prompt = buildPrompt(data);

    const message = await client.messages.create({
      model: CONFIG.claude.model,
      max_tokens: 500,
      temperature: 0.7,
      messages: [{ role: 'user', content: prompt }]
    });

    const textBlock = message.content.find(block => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    return textBlock.text;
  } catch (error) {
    console.error('Claude API error, using fallback:', error);
    return generateFallbackNarrative(data);
  }
}

function generateFallbackNarrative(data: WeatherData): string {
  const t = data.tempest;
  const afd = data.afd;
  const alerts = data.alerts || [];

  let narrative = '';

  if (t) {
    narrative += `Currently ${Math.round(t.temperatureF)}°F (feels like ${Math.round(t.feelsLikeF)}°F) with ${t.windDirection} winds at ${t.windSpeed} mph. `;
    narrative += `Pressure is ${Math.round(t.pressure)} mb and ${t.pressureTrend}. `;
    narrative += `Humidity is ${t.humidity}% with a dew point of ${Math.round(t.dewPointF)}°F.\n\n`;
  }

  if (afd?.synopsis) {
    narrative += `${afd.synopsis}\n\n`;
  }

  if (afd?.nearTerm) {
    narrative += `${afd.nearTerm}\n\n`;
  }

  if (alerts.length > 0) {
    narrative += `Active alerts: `;
    narrative += alerts.map(a => `${a.icon} ${a.type}`).join(', ');
    narrative += '\n';
  }

  return narrative.trim() || 'Weather data unavailable.';
}

/**
 * Build prompt for hourly alert updates
 */
function buildAlertUpdatePrompt(data: WeatherData, changes: StateChanges): string {
  const t = data.tempest;
  const a = data.airport;
  const alerts = data.alerts || [];
  const afd = data.afd;
  const hwo = data.hwo;

  const today = new Date();
  const timeStr = today.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const dayOfWeek = today.toLocaleDateString('en-US', { weekday: 'long' });
  const isThursday = today.getDay() === 4;

  let prompt = `You are providing an hourly weather alert update for a household during active weather warnings.

TIME: ${timeStr} on ${dayOfWeek}
LOCATION: ${CONFIG.location.description}

HOUSEHOLD:
- Michelle works at a school in Alden, NY${isThursday ? '\n- Scott is at work in East Aurora, NY today' : ''}

CURRENT CONDITIONS:
`;

  if (t) {
    prompt += `- Temperature: ${Math.round(t.temperatureF)}°F (feels like ${Math.round(t.feelsLikeF)}°F)
- Wind: ${t.windDirection} at ${t.windSpeed} mph, gusts to ${t.windGust} mph
`;
  }

  if (a) {
    prompt += `- Airport (${a.observationTime}): ${a.temperature}°F, ${a.wind}, visibility ${a.visibility} mi
- Conditions: ${a.weather || 'Fair'}
- Precipitation today: ${a.precipToday}"
`;
  }

  prompt += `
ACTIVE ALERTS (${alerts.length}):
`;
  alerts.forEach(alert => {
    prompt += `- ${alert.icon} ${alert.type}: ${alert.headline}
`;
  });

  prompt += `
CHANGES SINCE LAST UPDATE:
`;
  if (changes.alertChanges.length > 0) {
    prompt += `Alert changes: ${changes.alertChanges.join('; ')}
`;
  }
  if (changes.conditionChanges.length > 0) {
    prompt += `Condition changes: ${changes.conditionChanges.join('; ')}
`;
  }
  if (changes.forecastChanges.length > 0) {
    prompt += `Forecast changes: ${changes.forecastChanges.join('; ')}
`;
  }
  if (!changes.hasChanges) {
    prompt += `No significant changes - routine hourly check during active warnings
`;
  }

  if (afd?.nearTerm) {
    prompt += `
NWS NEAR-TERM FORECAST:
${afd.nearTerm}
`;
  }

  if (hwo?.dayOne) {
    prompt += `
HAZARDOUS WEATHER OUTLOOK:
${hwo.dayOne}
`;
  }

  prompt += `
Write a brief alert update (2-3 short paragraphs, under 150 words) that:
1. Summarizes current conditions and what has changed
2. Explains what to expect in the next few hours
3. Provides practical guidance (travel impacts, timing of worst conditions, etc.)
4. If conditions are dangerous for travel to Alden or East Aurora, say so clearly

Be direct and actionable. Focus on what's changed and what matters right now.`;

  return prompt;
}

/**
 * Generate alert update narrative
 */
export async function generateAlertUpdate(data: WeatherData, changes: StateChanges): Promise<string> {
  if (!CONFIG.claude.apiKey) {
    return generateFallbackAlertUpdate(data, changes);
  }

  try {
    const prompt = buildAlertUpdatePrompt(data, changes);

    const message = await client.messages.create({
      model: CONFIG.claude.model,
      max_tokens: 300,
      temperature: 0.6,
      messages: [{ role: 'user', content: prompt }]
    });

    const textBlock = message.content.find(block => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    return textBlock.text;
  } catch (error) {
    console.error('Claude API error, using fallback:', error);
    return generateFallbackAlertUpdate(data, changes);
  }
}

function generateFallbackAlertUpdate(data: WeatherData, changes: StateChanges): string {
  const alerts = data.alerts || [];
  const t = data.tempest;

  let update = '';

  if (changes.alertChanges.length > 0) {
    update += `${changes.alertChanges.join('. ')}.\n\n`;
  }

  if (t) {
    update += `Currently ${Math.round(t.temperatureF)}°F with ${t.windDirection} winds at ${t.windSpeed} mph. `;
  }

  if (alerts.length > 0) {
    update += `\n\nActive: ${alerts.map(a => a.type).join(', ')}`;
  }

  if (changes.conditionChanges.length > 0) {
    update += `\n\nChanges: ${changes.conditionChanges.join('. ')}`;
  }

  return update.trim() || 'Weather update unavailable.';
}

// Allow running directly for testing
if (import.meta.main) {
  // Mock data for testing
  const mockData: WeatherData = {
    tempest: {
      temperature: 2,
      temperatureF: 35.6,
      humidity: 85,
      pressure: 1013,
      pressureTrend: 'falling',
      windSpeed: 15,
      windGust: 25,
      windDirection: 'NW',
      feelsLike: -2,
      feelsLikeF: 28.4,
      dewPoint: 0,
      dewPointF: 32,
      uv: 1,
      precipToday: 0.1,
      precipYesterday: 0,
      timestamp: new Date()
    },
    afd: {
      synopsis: 'A cold front will move through the region tonight, bringing snow showers and gusty winds.',
      nearTerm: 'Snow accumulations of 2-4 inches expected overnight.',
      shortTerm: '',
      longTerm: '',
      raw: ''
    },
    alerts: [
      {
        type: 'Winter Storm Warning',
        severity: 'high',
        icon: '❄️',
        headline: 'Winter Storm Warning in effect until midnight',
        description: ''
      }
    ],
    forecast: [
      { day: 'MON', high: 35, low: 22, condition: 'snow', icon: '❄️' },
      { day: 'TUE', high: 28, low: 18, condition: 'cloudy', icon: '☁️' },
      { day: 'WED', high: 32, low: 20, condition: 'partly cloudy', icon: '⛅' }
    ],
    fetchedAt: new Date()
  };

  console.log('Generating weather narrative with Claude Haiku...\n');
  const narrative = await generateNarrative(mockData);
  console.log('=== Generated Narrative ===\n');
  console.log(narrative);
}
