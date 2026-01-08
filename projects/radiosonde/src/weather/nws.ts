/**
 * National Weather Service API clients
 */

import { CONFIG } from '../config.ts';
import { AFDData, HWOData, ForecastPeriod, Alert, ObservationPrecip, AirportObservation, DroneForecast, DroneHourForecast, DroneCondition } from './types.ts';

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

/**
 * Analyze drone flying conditions based on weather
 * DJI drones typically max out at 20-25 mph winds
 */
function analyzeDroneCondition(
  windSpeed: number,
  precipChance: number,
  temperature: number,
  forecast: string
): { condition: DroneCondition; issues: string[] } {
  const issues: string[] = [];
  let condition: DroneCondition = 'excellent';

  // Wind analysis (DJI limits ~25mph, ideal <12mph)
  if (windSpeed >= 25) {
    condition = 'no-fly';
    issues.push('Winds exceed drone limits');
  } else if (windSpeed >= 20) {
    condition = 'marginal';
    issues.push('High winds - experienced pilots only');
  } else if (windSpeed >= 15) {
    if (condition === 'excellent') condition = 'good';
    issues.push('Moderate winds');
  }

  // Precipitation analysis
  if (precipChance >= 70 || forecast.toLowerCase().includes('rain') ||
      forecast.toLowerCase().includes('snow') || forecast.toLowerCase().includes('storm')) {
    condition = 'no-fly';
    issues.push('Precipitation likely');
  } else if (precipChance >= 40) {
    if (condition !== 'no-fly') condition = 'marginal';
    issues.push('Chance of precipitation');
  }

  // Temperature analysis (battery performance)
  if (temperature <= 20) {
    if (condition === 'excellent') condition = 'good';
    issues.push('Cold - reduced battery life');
  } else if (temperature <= 32) {
    if (condition === 'excellent') condition = 'good';
    issues.push('Cold - monitor battery');
  } else if (temperature >= 95) {
    if (condition === 'excellent') condition = 'good';
    issues.push('Hot - risk of overheating');
  }

  // Fog/visibility
  if (forecast.toLowerCase().includes('fog')) {
    condition = 'no-fly';
    issues.push('Fog - visibility below Part 107 minimums');
  }

  return { condition, issues };
}

function formatHour(hour: number): string {
  if (hour === 0 || hour === 24) return '12 AM';
  if (hour === 12) return '12 PM';
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
}

function parseWindSpeed(windStr: string): number {
  // Parse "15 mph" or "10 to 20 mph" format
  const match = windStr.match(/(\d+)\s*(?:to\s*(\d+))?\s*mph/i);
  if (match) {
    // If range, use the higher value for safety
    return match[2] ? parseInt(match[2]) : parseInt(match[1]);
  }
  return 0;
}

/**
 * Fetch hourly forecast and analyze for drone flying conditions
 * Returns forecast for 6 AM to midnight (Part 107 with night waiver)
 */
export async function fetchDroneForecast(): Promise<DroneForecast | undefined> {
  try {
    // Get gridpoint info first
    const pointsResponse = await fetch(CONFIG.nws.pointsUrl, {
      headers: { 'User-Agent': USER_AGENT }
    });

    if (!pointsResponse.ok) {
      throw new Error(`NWS Points API error: ${pointsResponse.status}`);
    }

    const pointsData = await pointsResponse.json();
    const hourlyUrl = pointsData.properties.forecastHourly;

    // Get hourly forecast
    const hourlyResponse = await fetch(hourlyUrl, {
      headers: { 'User-Agent': USER_AGENT }
    });

    if (!hourlyResponse.ok) {
      throw new Error(`NWS Hourly Forecast error: ${hourlyResponse.status}`);
    }

    const hourlyData = await hourlyResponse.json();
    const periods = hourlyData.properties.periods;

    // Get today's date
    const now = new Date();
    const todayStr = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    // Filter to today's hours from 6 AM to midnight (hour 23)
    const todayHours: DroneHourForecast[] = [];

    for (const period of periods) {
      const periodDate = new Date(period.startTime);
      const hour = periodDate.getHours();

      // Only include today's hours from 6 AM to 11 PM
      if (periodDate.toDateString() !== now.toDateString()) {
        // If we've moved to tomorrow, stop
        if (todayHours.length > 0) break;
        continue;
      }

      if (hour < 6) continue; // Skip before 6 AM
      if (hour >= 24) break;   // Stop at midnight

      const windSpeed = parseWindSpeed(period.windSpeed);
      const precipChance = period.probabilityOfPrecipitation?.value || 0;
      const { condition, issues } = analyzeDroneCondition(
        windSpeed,
        precipChance,
        period.temperature,
        period.shortForecast
      );

      todayHours.push({
        hour,
        timeLabel: formatHour(hour),
        condition,
        temperature: period.temperature,
        windSpeed,
        windDirection: period.windDirection,
        precipChance,
        shortForecast: period.shortForecast,
        issues
      });
    }

    // Calculate best flying window
    let bestWindowStart: number | null = null;
    let bestWindowEnd: number | null = null;
    let currentWindowStart: number | null = null;
    let longestWindow = 0;
    let currentWindowLength = 0;
    let flyableHours = 0;

    for (const hour of todayHours) {
      if (hour.condition === 'excellent' || hour.condition === 'good') {
        flyableHours++;
        if (currentWindowStart === null) {
          currentWindowStart = hour.hour;
        }
        currentWindowLength++;
      } else {
        if (currentWindowLength > longestWindow) {
          longestWindow = currentWindowLength;
          bestWindowStart = currentWindowStart;
          bestWindowEnd = todayHours.find(h => h.hour === currentWindowStart)!.hour + currentWindowLength - 1;
        }
        currentWindowStart = null;
        currentWindowLength = 0;
      }
    }

    // Check if the last window was the longest
    if (currentWindowLength > longestWindow && currentWindowStart !== null) {
      bestWindowStart = currentWindowStart;
      bestWindowEnd = currentWindowStart + currentWindowLength - 1;
    }

    const bestWindow = bestWindowStart !== null && bestWindowEnd !== null
      ? `${formatHour(bestWindowStart)} - ${formatHour(bestWindowEnd + 1)}`
      : null;

    // Generate summary
    let summary: string;
    if (flyableHours === 0) {
      summary = 'No suitable flying conditions today. Check individual hours for details.';
    } else if (flyableHours >= 12) {
      summary = 'Excellent flying day! Most hours are suitable for drone operations.';
    } else if (flyableHours >= 6) {
      summary = `Good flying conditions for ${flyableHours} hours today.${bestWindow ? ` Best window: ${bestWindow}.` : ''}`;
    } else {
      summary = `Limited flying windows today (${flyableHours} hours).${bestWindow ? ` Best window: ${bestWindow}.` : ''}`;
    }

    return {
      date: todayStr,
      hours: todayHours,
      bestWindow,
      flyableHours,
      summary
    };
  } catch (error) {
    console.error('Failed to fetch drone forecast:', error);
    return undefined;
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
