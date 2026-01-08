/**
 * State management for tracking weather changes between updates
 */

import { WeatherData } from '../weather/types.ts';

const STATE_FILE = '/tmp/radiosonde-state.json';

export interface WeatherState {
  timestamp: string;
  alerts: {
    count: number;
    types: string[];
    headlines: string[];
  };
  conditions: {
    temperature: number;
    wind: string;
    pressure: number;
    weather: string;
    visibility: number;
  };
  afd: {
    synopsis: string;
    nearTerm: string;
  };
  hwo: {
    dayOne: string;
    hasActiveHazards: boolean;
  };
  precip: {
    today: number;
    yesterday: number;
  };
}

export interface StateChanges {
  hasChanges: boolean;
  alertChanges: string[];
  conditionChanges: string[];
  forecastChanges: string[];
}

/**
 * Save current weather state to file
 */
export async function saveState(data: WeatherData): Promise<void> {
  const state: WeatherState = {
    timestamp: new Date().toISOString(),
    alerts: {
      count: data.alerts?.length || 0,
      types: data.alerts?.map(a => a.type) || [],
      headlines: data.alerts?.map(a => a.headline) || []
    },
    conditions: {
      temperature: data.airport?.temperature || data.tempest?.temperatureF || 0,
      wind: data.airport?.wind || `${data.tempest?.windDirection} ${data.tempest?.windSpeed}`,
      pressure: data.airport?.pressureMb || data.tempest?.pressure || 0,
      weather: data.airport?.weather || '',
      visibility: data.airport?.visibility || 10
    },
    afd: {
      synopsis: data.afd?.synopsis || '',
      nearTerm: data.afd?.nearTerm || ''
    },
    hwo: {
      dayOne: data.hwo?.dayOne || '',
      hasActiveHazards: data.hwo?.hasActiveHazards || false
    },
    precip: {
      today: data.airport?.precipToday || 0,
      yesterday: data.airport?.precipYesterday || 0
    }
  };

  await Bun.write(STATE_FILE, JSON.stringify(state, null, 2));
}

/**
 * Load previous weather state from file
 */
export async function loadState(): Promise<WeatherState | null> {
  try {
    const file = Bun.file(STATE_FILE);
    if (await file.exists()) {
      const text = await file.text();
      return JSON.parse(text) as WeatherState;
    }
  } catch (error) {
    console.error('Failed to load state:', error);
  }
  return null;
}

/**
 * Compare current weather data with previous state to detect changes
 */
export function detectChanges(current: WeatherData, previous: WeatherState | null): StateChanges {
  const changes: StateChanges = {
    hasChanges: false,
    alertChanges: [],
    conditionChanges: [],
    forecastChanges: []
  };

  if (!previous) {
    changes.hasChanges = true;
    changes.alertChanges.push('Initial report - no previous data to compare');
    return changes;
  }

  const currentAlerts = current.alerts || [];
  const prevAlerts = previous.alerts;

  // Check for new alerts
  const newAlertTypes = currentAlerts
    .map(a => a.type)
    .filter(t => !prevAlerts.types.includes(t));

  if (newAlertTypes.length > 0) {
    changes.hasChanges = true;
    changes.alertChanges.push(`NEW ALERTS: ${newAlertTypes.join(', ')}`);
  }

  // Check for expired alerts
  const expiredAlerts = prevAlerts.types.filter(
    t => !currentAlerts.map(a => a.type).includes(t)
  );

  if (expiredAlerts.length > 0) {
    changes.hasChanges = true;
    changes.alertChanges.push(`EXPIRED: ${expiredAlerts.join(', ')}`);
  }

  // Check for significant temperature change (5+ degrees)
  const currentTemp = current.airport?.temperature || current.tempest?.temperatureF || 0;
  const tempDiff = Math.abs(currentTemp - previous.conditions.temperature);
  if (tempDiff >= 5) {
    changes.hasChanges = true;
    const direction = currentTemp > previous.conditions.temperature ? 'risen' : 'fallen';
    changes.conditionChanges.push(
      `Temperature has ${direction} ${Math.round(tempDiff)}°F (was ${Math.round(previous.conditions.temperature)}°F, now ${Math.round(currentTemp)}°F)`
    );
  }

  // Check for significant visibility change
  const currentVis = current.airport?.visibility || 10;
  if (currentVis < 3 && previous.conditions.visibility >= 3) {
    changes.hasChanges = true;
    changes.conditionChanges.push(`Visibility dropped to ${currentVis} miles`);
  } else if (currentVis >= 6 && previous.conditions.visibility < 3) {
    changes.hasChanges = true;
    changes.conditionChanges.push(`Visibility improved to ${currentVis} miles`);
  }

  // Check for precipitation increase
  const currentPrecip = current.airport?.precipToday || 0;
  const precipIncrease = currentPrecip - previous.precip.today;
  if (precipIncrease >= 0.1) {
    changes.hasChanges = true;
    changes.conditionChanges.push(
      `Additional ${precipIncrease.toFixed(2)}" precipitation recorded (total today: ${currentPrecip}")`
    );
  }

  // Check for weather condition changes
  const currentWeather = current.airport?.weather || '';
  if (currentWeather && currentWeather !== previous.conditions.weather) {
    if (currentWeather.toLowerCase().includes('snow') &&
        !previous.conditions.weather.toLowerCase().includes('snow')) {
      changes.hasChanges = true;
      changes.conditionChanges.push(`Snow has begun: ${currentWeather}`);
    } else if (currentWeather.toLowerCase().includes('rain') &&
               !previous.conditions.weather.toLowerCase().includes('rain')) {
      changes.hasChanges = true;
      changes.conditionChanges.push(`Rain has begun: ${currentWeather}`);
    } else if (previous.conditions.weather && currentWeather !== previous.conditions.weather) {
      changes.conditionChanges.push(`Conditions changed from "${previous.conditions.weather}" to "${currentWeather}"`);
    }
  }

  // Check for significant AFD/forecast changes (rough comparison)
  const currentSynopsis = current.afd?.synopsis || '';
  const currentNearTerm = current.afd?.nearTerm || '';

  // Simple check: if synopsis changed significantly (more than 20% different)
  if (previous.afd.synopsis && currentSynopsis) {
    const synopsisChanged = !currentSynopsis.includes(previous.afd.synopsis.substring(0, 50));
    if (synopsisChanged) {
      changes.hasChanges = true;
      changes.forecastChanges.push('NWS forecast discussion has been updated');
    }
  }

  // Check HWO changes
  if (current.hwo?.hasActiveHazards && !previous.hwo.hasActiveHazards) {
    changes.hasChanges = true;
    changes.forecastChanges.push('Hazardous Weather Outlook now indicates active hazards');
  }

  return changes;
}

/**
 * Check if we're currently in an active warning state
 */
export function hasActiveWarnings(data: WeatherData): boolean {
  const alerts = data.alerts || [];
  // Look for actual warnings (not just watches or advisories)
  return alerts.some(a =>
    a.type.toLowerCase().includes('warning') ||
    a.severity === 'high'
  );
}

/**
 * Get hours since last state update
 */
export async function getHoursSinceLastUpdate(): Promise<number> {
  const state = await loadState();
  if (!state) return Infinity;

  const lastUpdate = new Date(state.timestamp);
  const now = new Date();
  return (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);
}
