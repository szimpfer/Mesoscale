/**
 * Tempest Weather Station API client
 */

import { CONFIG } from '../config.ts';
import { TempestData, TempestObservation } from './types.ts';
import { celsiusToFahrenheit, degreesToCardinal, mmToInches, mpsToMph } from './utils.ts';

export async function fetchTempest(): Promise<TempestData | undefined> {
  if (!CONFIG.tempest.token) {
    console.error('TEMPEST_TOKEN not configured');
    return undefined;
  }

  try {
    const url = `${CONFIG.tempest.baseUrl}/observations/station/${CONFIG.tempest.stationId}?token=${CONFIG.tempest.token}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Tempest API error: ${response.status}`);
    }

    const data = await response.json();
    const obs: TempestObservation = data.obs[0];

    if (!obs) {
      throw new Error('No observation data returned');
    }

    return {
      temperature: obs.air_temperature,
      temperatureF: celsiusToFahrenheit(obs.air_temperature),
      humidity: obs.relative_humidity,
      pressure: obs.sea_level_pressure,
      pressureTrend: obs.pressure_trend,
      windSpeed: mpsToMph(obs.wind_avg),
      windGust: mpsToMph(obs.wind_gust),
      windDirection: degreesToCardinal(obs.wind_direction),
      feelsLike: obs.feels_like,
      feelsLikeF: celsiusToFahrenheit(obs.feels_like),
      dewPoint: obs.dew_point,
      dewPointF: celsiusToFahrenheit(obs.dew_point),
      uv: obs.uv,
      precipToday: mmToInches(obs.precip_accum_local_day),
      precipYesterday: mmToInches(obs.precip_accum_local_yesterday),
      timestamp: new Date(obs.timestamp * 1000)
    };
  } catch (error) {
    console.error('Failed to fetch Tempest data:', error);
    return undefined;
  }
}

// Allow running directly for testing
if (import.meta.main) {
  const data = await fetchTempest();
  if (data) {
    console.log('Tempest Data:');
    console.log(`  Temperature: ${data.temperatureF}°F (feels like ${data.feelsLikeF}°F)`);
    console.log(`  Humidity: ${data.humidity}%`);
    console.log(`  Wind: ${data.windDirection} at ${data.windSpeed} mph, gusts ${data.windGust} mph`);
    console.log(`  Pressure: ${data.pressure} mb (${data.pressureTrend})`);
    console.log(`  Precip Today: ${data.precipToday}"`);
  } else {
    console.error('Failed to fetch data');
    process.exit(1);
  }
}
