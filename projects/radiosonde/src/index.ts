#!/usr/bin/env bun
/**
 * Radiosonde - AI-powered daily weather briefings
 *
 * Main pipeline: fetch → AI → email
 */

import { CONFIG, validateConfig } from './config.ts';
import { fetchTempest } from './weather/tempest.ts';
import { fetchAFD, fetchHWO, fetchForecast, fetchAlerts, fetchAirportObservation } from './weather/nws.ts';
import { generateNarrative } from './ai/claude.ts';
import { sendEmail, formatSubject } from './email/mailer.ts';
import { renderHtmlEmail, renderTextEmail } from './email/template.ts';
import { WeatherData } from './weather/types.ts';
import { fetchWithRetry } from './lib/retry.ts';
import { saveState } from './lib/state.ts';

async function main(): Promise<void> {
  const startTime = Date.now();
  console.log('='.repeat(50));
  console.log('  Radiosonde - Weather Briefing');
  console.log('='.repeat(50));
  console.log(`Time: ${new Date().toLocaleString()}`);
  console.log(`Location: ${CONFIG.location.name}`);
  console.log('');

  // Validate configuration
  const { valid, errors } = validateConfig();
  if (!valid) {
    console.error('Configuration errors:');
    errors.forEach(e => console.error(`  - ${e}`));
    process.exit(1);
  }
  console.log('Configuration validated');

  // Fetch weather data
  console.log('\nFetching weather data...');

  let tempest, afd, hwo, forecast, alerts, airport;

  // Priority 1: Current conditions (critical)
  try {
    tempest = await fetchWithRetry(() => fetchTempest(), { retries: 3 });
    console.log('  Tempest data fetched');
  } catch (error) {
    console.error('  Tempest data unavailable:', error);
  }

  // Priority 2: NWS data (important but degradable)
  try {
    [afd, hwo, forecast, alerts, airport] = await Promise.all([
      fetchWithRetry(() => fetchAFD(), { retries: 2 }),
      fetchWithRetry(() => fetchHWO(), { retries: 2 }),
      fetchWithRetry(() => fetchForecast(), { retries: 2 }),
      fetchWithRetry(() => fetchAlerts(), { retries: 2 }),
      fetchWithRetry(() => fetchAirportObservation('KBUF'), { retries: 2 })
    ]);
    console.log('  NWS data fetched');
  } catch (error) {
    console.warn('  Some NWS data unavailable:', error);
  }

  // Assemble weather data
  const weatherData: WeatherData = {
    tempest,
    afd,
    hwo,
    forecast: forecast || [],
    alerts: alerts || [],
    airport,
    fetchedAt: new Date()
  };

  // Check if we have enough data to proceed
  if (!tempest && !afd) {
    console.error('\nInsufficient weather data. Aborting.');
    process.exit(1);
  }

  // Log data summary
  console.log('\nData summary:');
  console.log(`  Tempest: ${tempest ? `${tempest.temperatureF}°F` : 'unavailable'}`);
  console.log(`  Airport: ${airport ? `${airport.stationName} @ ${airport.observationTime} - ${airport.temperature}°F` : 'unavailable'}`);
  console.log(`  AFD: ${afd ? 'available' : 'unavailable'}`);
  console.log(`  HWO: ${hwo ? (hwo.hasActiveHazards ? 'ACTIVE HAZARDS' : 'no hazards') : 'unavailable'}`);
  console.log(`  Forecast: ${forecast?.length || 0} days`);
  console.log(`  Alerts: ${alerts?.length || 0} active`);
  console.log(`  Precip: ${airport ? `${airport.precipToday}" today, ${airport.precipYesterday}" yesterday` : 'unavailable'}`);

  // Generate narrative with Claude
  console.log('\nGenerating narrative...');
  const narrative = await generateNarrative(weatherData);
  console.log(`  Generated ${narrative.length} characters`);

  // Render email templates
  console.log('\nRendering email...');
  const generatedAt = new Date();
  const html = renderHtmlEmail({ weather: weatherData, narrative, generatedAt });
  const text = renderTextEmail({ weather: weatherData, narrative, generatedAt });

  // Send email
  console.log('\nSending email...');
  try {
    await sendEmail({
      to: CONFIG.email.to,
      subject: formatSubject(generatedAt),
      html,
      text
    });
    console.log(`  Sent to ${CONFIG.email.to}`);
  } catch (error) {
    console.error('  Failed to send email:', error);
    process.exit(1);
  }

  // Save state for alert tracking
  await saveState(weatherData);
  console.log('  State saved for alert tracking');

  // Update health check timestamp
  const healthFile = '/tmp/last_run';
  try {
    await Bun.write(healthFile, new Date().toISOString());
  } catch {
    // Ignore - may not be in Docker
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nCompleted in ${elapsed}s`);
  console.log('='.repeat(50));
}

// Run
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
