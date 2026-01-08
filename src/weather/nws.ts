/**
 * National Weather Service API clients
 */

import { CONFIG } from '../config.ts';
import { AFDData, HWOData, ForecastPeriod, Alert, ObservationPrecip, AirportObservation } from './types.ts';

const USER_AGENT = '(Radiosonde Weather Email, github.com/radiosonde)';

const STATION_NAMES: Record<string, string> = {
  'KBUF': 'Buffalo Intl Airport'
};

/**
 * Fetch hourly observation history from NWS
 * Returns both current conditions and precipitation totals
 *
 * Table columns (0-indexed):
 * 0: Date, 1: Time, 2: Wind, 3: Vis, 4: Weather, 5: Sky,
 * 6: Air Temp, 7: Dew Point, 8: 6hr Max, 9: 6hr Min,
 * 10: Humidity, 11: Wind Chill, 12: Heat Index,
 * 13: Altimeter, 14: Sea Level, 15: 1hr Precip, 16: 3hr Precip, 17: 6hr Precip
 */
export async function fetchAirportObservation(stationId = 'KBUF'): Promise<AirportObservation | undefined> {
  try {
    const url = `https://forecast.weather.gov/data/obhistory/${stationId}.html`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`NWS Observation error: ${response.status}`);
    }

    const html = await response.text();

    // Parse the HTML table - find all data rows (have class odd/even)
    const rowMatches = [...html.matchAll(/<tr class="(?:odd|even)"[^>]*>([\s\S]*?)<\/tr>/gi)];

    const now = new Date();
    const todayDate = now.getDate();
    const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000).getDate();

    let todayPrecip = 0;
    let yesterdayPrecip = 0;
    let currentObs: AirportObservation | undefined;

    const getCellText = (cell: string) => cell.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

    for (const match of rowMatches) {
      const row = match[0];

      // Extract cells from the row
      const cells = row.match(/<td[^>]*>[\s\S]*?<\/td>/gi);
      if (!cells || cells.length < 16) continue;

      const dateCell = getCellText(cells[0]);
      const timeCell = getCellText(cells[1]);
      const windCell = getCellText(cells[2]);
      const visCell = getCellText(cells[3]);
      const weatherCell = getCellText(cells[4]);
      const skyCell = getCellText(cells[5]);
      const tempCell = getCellText(cells[6]);
      const dewCell = getCellText(cells[7]);
      const humidityCell = getCellText(cells[10]);
      const altimeterCell = getCellText(cells[13]);
      const seaLevelCell = getCellText(cells[14]);
      const precip1hr = getCellText(cells[15]);

      // Parse the date (just the day number)
      const dayNum = parseInt(dateCell, 10);
      if (isNaN(dayNum)) continue;

      // Capture first (most recent) observation for current conditions
      if (!currentObs && dayNum === todayDate) {
        currentObs = {
          stationId,
          stationName: STATION_NAMES[stationId] || stationId,
          observationTime: timeCell,
          temperature: parseFloat(tempCell) || 0,
          dewPoint: parseFloat(dewCell) || 0,
          humidity: parseInt(humidityCell) || 0,
          wind: windCell || 'Calm',
          visibility: parseFloat(visCell) || 10,
          weather: weatherCell || 'Fair',
          sky: skyCell || 'Clear',
          pressureIn: parseFloat(altimeterCell) || 0,
          pressureMb: parseFloat(seaLevelCell) || 0,
          precipToday: 0,
          precipYesterday: 0
        };
      }

      // Sum precipitation
      const precipValue = parseFloat(precip1hr);
      if (!isNaN(precipValue) && precipValue > 0 && precipValue < 10) {
        if (dayNum === todayDate) {
          todayPrecip += precipValue;
        } else if (dayNum === yesterdayDate) {
          yesterdayPrecip += precipValue;
        }
      }
    }

    if (currentObs) {
      currentObs.precipToday = Math.round(todayPrecip * 100) / 100;
      currentObs.precipYesterday = Math.round(yesterdayPrecip * 100) / 100;
    }

    return currentObs;
  } catch (error) {
    console.error('Failed to fetch airport observation:', error);
    return undefined;
  }
}

/**
 * Fetch precipitation only (legacy function for compatibility)
 */
export async function fetchObservationPrecip(stationId = 'KBUF'): Promise<ObservationPrecip | undefined> {
  const obs = await fetchAirportObservation(stationId);
  if (!obs) return undefined;

  return {
    today: obs.precipToday,
    yesterday: obs.precipYesterday,
    source: 'NWS',
    stationId,
    lastObservation: obs.observationTime
  };
}

/**
 * Fetch Area Forecast Discussion from NWS
 */
export async function fetchAFD(): Promise<AFDData | undefined> {
  try {
    const response = await fetch(CONFIG.nws.afdUrl);
    if (!response.ok) {
      throw new Error(`NWS AFD error: ${response.status}`);
    }

    const html = await response.text();

    // Extract pre-formatted text content
    const preMatch = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
    if (!preMatch) {
      throw new Error('Could not parse AFD content');
    }

    const raw = preMatch[1]
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"');

    // Parse sections
    const sections: Record<string, string> = {};
    const sectionPatterns = [
      { key: 'synopsis', pattern: /\.SYNOPSIS\.\.\.([\s\S]*?)(?=\.\w|$)/i },
      { key: 'nearTerm', pattern: /\.NEAR TERM.*?\.\.\.([\s\S]*?)(?=\.\w|$)/i },
      { key: 'shortTerm', pattern: /\.SHORT TERM.*?\.\.\.([\s\S]*?)(?=\.\w|$)/i },
      { key: 'longTerm', pattern: /\.LONG TERM.*?\.\.\.([\s\S]*?)(?=\.\w|$)/i }
    ];

    for (const { key, pattern } of sectionPatterns) {
      const match = raw.match(pattern);
      if (match) {
        sections[key] = match[1].trim().replace(/\n\s+/g, ' ').substring(0, 500);
      }
    }

    return {
      synopsis: sections.synopsis || '',
      nearTerm: sections.nearTerm || '',
      shortTerm: sections.shortTerm || '',
      longTerm: sections.longTerm || '',
      raw
    };
  } catch (error) {
    console.error('Failed to fetch AFD:', error);
    return undefined;
  }
}

/**
 * Fetch Hazardous Weather Outlook
 */
export async function fetchHWO(): Promise<HWOData | undefined> {
  try {
    const response = await fetch(CONFIG.nws.hwoUrl);
    if (!response.ok) {
      throw new Error(`NWS HWO error: ${response.status}`);
    }

    const html = await response.text();

    const preMatch = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
    if (!preMatch) {
      throw new Error('Could not parse HWO content');
    }

    const raw = preMatch[1]
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"');

    let dayOne = '';
    let daysTwoThroughSeven = '';
    let spotterInfo = '';

    const dayOneMatch = raw.match(/\.DAY ONE[^.]*\.\.\.([\s\S]*?)(?=\.DAYS TWO|\.SPOTTER|$)/i);
    if (dayOneMatch) {
      dayOne = dayOneMatch[1].trim().replace(/\n\s+/g, ' ').substring(0, 500);
    }

    const daysTwoMatch = raw.match(/\.DAYS TWO THROUGH SEVEN[^.]*\.\.\.([\s\S]*?)(?=\.SPOTTER|$)/i);
    if (daysTwoMatch) {
      daysTwoThroughSeven = daysTwoMatch[1].trim().replace(/\n\s+/g, ' ').substring(0, 500);
    }

    const spotterMatch = raw.match(/\.SPOTTER INFORMATION STATEMENT[^.]*\.\.\.([\s\S]*?)(?=\$\$|$)/i);
    if (spotterMatch) {
      spotterInfo = spotterMatch[1].trim().replace(/\n\s+/g, ' ').substring(0, 200);
    }

    const hazardKeywords = /watch|warning|advisory|flood|storm|wind|snow|ice|freeze|blizzard|gale/i;
    const hasActiveHazards = hazardKeywords.test(dayOne) || hazardKeywords.test(daysTwoThroughSeven);

    return {
      dayOne,
      daysTwoThroughSeven,
      spotterInfo,
      hasActiveHazards,
      raw
    };
  } catch (error) {
    console.error('Failed to fetch HWO:', error);
    return undefined;
  }
}

/**
 * Fetch 7-day forecast from NWS API
 */
export async function fetchForecast(): Promise<ForecastPeriod[]> {
  try {
    // Get gridpoint info
    const pointsResponse = await fetch(CONFIG.nws.pointsUrl, {
      headers: { 'User-Agent': USER_AGENT }
    });

    if (!pointsResponse.ok) {
      throw new Error(`NWS Points API error: ${pointsResponse.status}`);
    }

    const pointsData = await pointsResponse.json();
    const forecastUrl = pointsData.properties.forecast;

    // Get forecast
    const forecastResponse = await fetch(forecastUrl, {
      headers: { 'User-Agent': USER_AGENT }
    });

    if (!forecastResponse.ok) {
      throw new Error(`NWS Forecast API error: ${forecastResponse.status}`);
    }

    const forecastData = await forecastResponse.json();
    const periods = forecastData.properties.periods;

    const dailyForecast: ForecastPeriod[] = [];
    const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

    for (let i = 0; i < Math.min(periods.length, 14); i += 2) {
      const dayPeriod = periods[i];
      const nightPeriod = periods[i + 1];

      const date = new Date(dayPeriod.startTime);
      const dayName = dayNames[date.getDay()];

      let icon = '☀️';
      let condition = 'clear';
      const forecast = dayPeriod.shortForecast.toLowerCase();
      const temp = dayPeriod.temperature;

      // Temperature-based precipitation logic
      if (temp <= 32 && (forecast.includes('rain') || forecast.includes('snow') ||
          forecast.includes('precip') || forecast.includes('shower') ||
          forecast.includes('wintry') || forecast.includes('mix'))) {
        icon = '❄️';
        condition = 'snow';
      } else if (forecast.includes('snow') || forecast.includes('flurr') || forecast.includes('wintry')) {
        icon = '❄️';
        condition = 'snow';
      } else if (forecast.includes('rain') || forecast.includes('shower')) {
        icon = '🌧️';
        condition = 'rain';
      } else if (forecast.includes('wind')) {
        icon = '💨';
        condition = 'windy';
      } else if (forecast.includes('cloud') || forecast.includes('overcast')) {
        icon = '☁️';
        condition = 'cloudy';
      } else if (forecast.includes('partly')) {
        icon = '⛅';
        condition = 'partly cloudy';
      }

      dailyForecast.push({
        day: dayName,
        high: dayPeriod.temperature,
        low: nightPeriod ? nightPeriod.temperature : dayPeriod.temperature - 10,
        condition,
        icon,
        shortForecast: dayPeriod.shortForecast
      });

      if (dailyForecast.length >= 7) break;
    }

    return dailyForecast;
  } catch (error) {
    console.error('Failed to fetch NWS forecast:', error);
    return [];
  }
}

/**
 * Fetch active weather alerts
 */
export async function fetchAlerts(): Promise<Alert[]> {
  try {
    const response = await fetch(CONFIG.nws.alertsUrl, {
      headers: { 'User-Agent': USER_AGENT }
    });

    if (!response.ok) {
      throw new Error(`NWS Alerts API error: ${response.status}`);
    }

    const data = await response.json();
    const alerts = data.features || [];

    return alerts.map((alert: any) => {
      const props = alert.properties;
      const event = props.event;

      let severity: 'low' | 'moderate' | 'high' = 'low';
      let icon = '⚠️';

      if (props.severity === 'Extreme' || props.severity === 'Severe') {
        severity = 'high';
        icon = props.severity === 'Extreme' ? '🚨' : '⚠️';
      } else if (props.severity === 'Moderate') {
        severity = 'moderate';
      }

      // Event-specific icons
      if (event.includes('Flood')) icon = '🌊';
      if (event.includes('Wind')) icon = '💨';
      if (event.includes('Snow')) icon = '❄️';
      if (event.includes('Ice') || event.includes('Freez')) icon = '🧊';
      if (event.includes('Thunder')) icon = '⛈️';
      if (event.includes('Tornado')) icon = '🌪️';

      return {
        type: event,
        severity,
        icon,
        headline: props.headline,
        description: props.description,
        effective: props.effective ? new Date(props.effective) : undefined,
        expires: props.expires ? new Date(props.expires) : undefined,
        areas: props.areaDesc
      };
    });
  } catch (error) {
    console.error('Failed to fetch NWS alerts:', error);
    return [];
  }
}

// Allow running directly for testing
if (import.meta.main) {
  console.log('Fetching NWS data...\n');

  const [afd, hwo, forecast, alerts, airport] = await Promise.all([
    fetchAFD(),
    fetchHWO(),
    fetchForecast(),
    fetchAlerts(),
    fetchAirportObservation('KBUF')
  ]);

  if (afd) {
    console.log('=== AFD Synopsis ===');
    console.log(afd.synopsis.substring(0, 200) + '...\n');
  }

  if (hwo) {
    console.log('=== HWO Day One ===');
    console.log(hwo.dayOne.substring(0, 200) + '...\n');
    console.log(`Active Hazards: ${hwo.hasActiveHazards ? 'YES' : 'No'}\n`);
  }

  if (forecast.length > 0) {
    console.log('=== 7-Day Forecast ===');
    forecast.forEach(f => {
      console.log(`  ${f.day}: ${f.icon} ${f.high}°/${f.low}° - ${f.condition}`);
    });
    console.log('');
  }

  if (alerts.length > 0) {
    console.log('=== Active Alerts ===');
    alerts.forEach(a => {
      console.log(`  ${a.icon} ${a.type} (${a.severity})`);
    });
  } else {
    console.log('No active alerts.');
  }

  if (airport) {
    console.log('\n=== Airport Observation (KBUF) ===');
    console.log(`  Time: ${airport.observationTime}`);
    console.log(`  Temperature: ${airport.temperature}°F`);
    console.log(`  Dew Point: ${airport.dewPoint}°F`);
    console.log(`  Wind: ${airport.wind}`);
    console.log(`  Visibility: ${airport.visibility} mi`);
    console.log(`  Weather: ${airport.weather}`);
    console.log(`  Pressure: ${airport.pressureIn}" / ${airport.pressureMb} mb`);
    console.log(`  Precip Today: ${airport.precipToday}"`);
    console.log(`  Precip Yesterday: ${airport.precipYesterday}"`);
  }
}
