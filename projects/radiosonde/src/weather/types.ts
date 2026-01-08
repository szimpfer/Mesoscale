/**
 * Weather data types for Radiosonde
 */

export interface TempestObservation {
  air_temperature: number;
  relative_humidity: number;
  sea_level_pressure: number;
  wind_avg: number;
  wind_gust: number;
  wind_direction: number;
  precip_accum_local_day: number;
  precip_accum_local_yesterday: number;
  feels_like: number;
  dew_point: number;
  uv: number;
  solar_radiation: number;
  pressure_trend: string;
  timestamp: number;
}

export interface TempestData {
  temperature: number;
  temperatureF: number;
  humidity: number;
  pressure: number;
  pressureTrend: string;
  windSpeed: number;
  windGust: number;
  windDirection: string;
  feelsLike: number;
  feelsLikeF: number;
  dewPoint: number;
  dewPointF: number;
  uv: number;
  precipToday: number;
  precipYesterday: number;
  timestamp: Date;
}

export interface AFDData {
  synopsis: string;
  nearTerm: string;
  shortTerm: string;
  longTerm: string;
  raw: string;
}

export interface HWOData {
  dayOne: string;
  daysTwoThroughSeven: string;
  spotterInfo: string;
  hasActiveHazards: boolean;
  raw: string;
}

export interface ForecastPeriod {
  day: string;
  high: number;
  low: number;
  condition: string;
  icon: string;
  shortForecast?: string;
}

export interface Alert {
  type: string;
  severity: 'low' | 'moderate' | 'high';
  icon: string;
  headline: string;
  description: string;
  effective?: Date;
  expires?: Date;
  areas?: string;
}

export interface ObservationPrecip {
  today: number;
  yesterday: number;
  source: string;
  stationId: string;
  lastObservation?: string;
}

export interface AirportObservation {
  stationId: string;
  stationName: string;
  observationTime: string;
  temperature: number;
  dewPoint: number;
  humidity: number;
  wind: string;
  visibility: number;
  weather: string;
  sky: string;
  pressureIn: number;
  pressureMb: number;
  precipToday: number;
  precipYesterday: number;
}

export type DroneCondition = 'excellent' | 'good' | 'marginal' | 'no-fly';

export interface DroneHourForecast {
  hour: number;           // 0-23
  timeLabel: string;      // "6 AM", "12 PM", etc.
  condition: DroneCondition;
  temperature: number;
  windSpeed: number;      // mph
  windDirection: string;
  precipChance: number;   // percentage
  shortForecast: string;
  issues: string[];       // e.g., ["High winds", "Precipitation likely"]
}

export interface DroneForecast {
  date: string;
  hours: DroneHourForecast[];
  bestWindow: string | null;      // e.g., "6 AM - 10 AM"
  flyableHours: number;
  summary: string;
}

export interface WeatherData {
  tempest?: TempestData;
  afd?: AFDData;
  hwo?: HWOData;
  forecast?: ForecastPeriod[];
  alerts?: Alert[];
  precip?: ObservationPrecip;
  airport?: AirportObservation;
  droneForecast?: DroneForecast;
  fetchedAt: Date;
}
