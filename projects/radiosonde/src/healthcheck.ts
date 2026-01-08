#!/usr/bin/env bun
/**
 * Docker health check script
 * Verifies that the last run was within acceptable time window
 */

import { existsSync } from 'fs';

const LAST_RUN_FILE = '/tmp/last_run';
const MAX_AGE_HOURS = 26; // Allow 2-hour grace for 24h schedule

try {
  // Check if we've run at least once
  if (!existsSync(LAST_RUN_FILE)) {
    console.log('OK: No run yet (new container)');
    process.exit(0);
  }

  // Check last run timestamp
  const lastRunStr = await Bun.file(LAST_RUN_FILE).text();
  const lastRun = new Date(lastRunStr);
  const ageHours = (Date.now() - lastRun.getTime()) / 1000 / 60 / 60;

  if (ageHours > MAX_AGE_HOURS) {
    console.error(`FAIL: Last run ${ageHours.toFixed(1)}h ago (max ${MAX_AGE_HOURS}h)`);
    process.exit(1);
  }

  console.log(`OK: Last run ${ageHours.toFixed(1)}h ago`);
  process.exit(0);
} catch (error) {
  console.error('FAIL: Healthcheck error:', error);
  process.exit(1);
}
