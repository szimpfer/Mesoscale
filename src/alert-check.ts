#!/usr/bin/env bun
/**
 * Radiosonde Alert Check
 *
 * Hourly check for active warnings - sends mini-update if conditions warrant
 * Run this every hour; it will only send email if:
 * 1. There are active warnings
 * 2. Conditions have changed significantly since last update
 */

import { CONFIG } from './config.ts';
import { fetchTempest } from './weather/tempest.ts';
import { fetchAFD, fetchHWO, fetchAlerts, fetchAirportObservation } from './weather/nws.ts';
import { generateAlertUpdate } from './ai/claude.ts';
import { sendEmail } from './email/mailer.ts';
import { renderAlertUpdateHtml, renderAlertUpdateText } from './email/alert-template.ts';
import { WeatherData } from './weather/types.ts';
import { fetchWithRetry } from './lib/retry.ts';
import {
  loadState,
  saveState,
  detectChanges,
  hasActiveWarnings,
  getHoursSinceLastUpdate,
  StateChanges
} from './lib/state.ts';

async function main(): Promise<void> {
  const startTime = Date.now();
  console.log('='.repeat(50));
  console.log('  Radiosonde - Alert Check');
  console.log('='.repeat(50));
  console.log(`Time: ${new Date().toLocaleString()}`);

  // Fetch weather data
  console.log('\nFetching weather data...');

  let tempest, afd, hwo, alerts, airport;

  try {
    [tempest, afd, hwo, alerts, airport] = await Promise.all([
      fetchWithRetry(() => fetchTempest(), { retries: 2 }),
      fetchWithRetry(() => fetchAFD(), { retries: 2 }),
      fetchWithRetry(() => fetchHWO(), { retries: 2 }),
      fetchWithRetry(() => fetchAlerts(), { retries: 2 }),
      fetchWithRetry(() => fetchAirportObservation('KBUF'), { retries: 2 })
    ]);
    console.log('  Data fetched');
  } catch (error) {
    console.error('  Failed to fetch data:', error);
    process.exit(1);
  }

  const weatherData: WeatherData = {
    tempest,
    afd,
    hwo,
    forecast: [],
    alerts: alerts || [],
    airport,
    fetchedAt: new Date()
  };

  // Check if there are active warnings
  const activeWarnings = hasActiveWarnings(weatherData);
  console.log(`\nActive warnings: ${activeWarnings ? 'YES' : 'No'}`);
  console.log(`Alert count: ${alerts?.length || 0}`);

  if (!activeWarnings) {
    console.log('\nNo active warnings - skipping update');

    // Still save state for tracking
    await saveState(weatherData);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\nCompleted in ${elapsed}s (no email sent)`);
    console.log('='.repeat(50));
    return;
  }

  // Load previous state and detect changes
  const previousState = await loadState();
  const changes = detectChanges(weatherData, previousState);
  const hoursSinceUpdate = await getHoursSinceLastUpdate();

  console.log(`\nHours since last update: ${hoursSinceUpdate.toFixed(1)}`);
  console.log(`Changes detected: ${changes.hasChanges ? 'YES' : 'No'}`);

  if (changes.alertChanges.length > 0) {
    console.log('  Alert changes:', changes.alertChanges.join('; '));
  }
  if (changes.conditionChanges.length > 0) {
    console.log('  Condition changes:', changes.conditionChanges.join('; '));
  }
  if (changes.forecastChanges.length > 0) {
    console.log('  Forecast changes:', changes.forecastChanges.join('; '));
  }

  // Decide whether to send update
  // Send if: significant changes OR first hour of warning OR every 2 hours during warning
  const shouldSend =
    changes.hasChanges ||
    hoursSinceUpdate >= 2 ||
    previousState === null;

  if (!shouldSend) {
    console.log('\nNo significant changes - skipping update');
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\nCompleted in ${elapsed}s (no email sent)`);
    console.log('='.repeat(50));
    return;
  }

  // Generate mini-update narrative
  console.log('\nGenerating alert update narrative...');
  const narrative = await generateAlertUpdate(weatherData, changes);
  console.log(`  Generated ${narrative.length} characters`);

  // Render email
  const generatedAt = new Date();
  const html = renderAlertUpdateHtml({
    weather: weatherData,
    narrative,
    changes,
    generatedAt
  });
  const text = renderAlertUpdateText({
    weather: weatherData,
    narrative,
    changes,
    generatedAt
  });

  // Determine subject based on changes
  let subject = `Weather Alert Update - ${CONFIG.location.name}`;
  if (changes.alertChanges.some(c => c.includes('NEW ALERTS'))) {
    subject = `NEW: ${alerts?.[0]?.type || 'Weather Alert'} - ${CONFIG.location.name}`;
  }

  // Send email
  console.log('\nSending alert update...');
  try {
    await sendEmail({
      to: CONFIG.email.to,
      subject,
      html,
      text
    });
    console.log(`  Sent to ${CONFIG.email.to}`);
  } catch (error) {
    console.error('  Failed to send email:', error);
    process.exit(1);
  }

  // Save state after successful send
  await saveState(weatherData);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nCompleted in ${elapsed}s`);
  console.log('='.repeat(50));
}

// Run
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
