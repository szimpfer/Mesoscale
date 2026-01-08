#!/bin/sh
set -e

echo "=================================================="
echo "  Radiosonde - Weather Briefing Service"
echo "=================================================="
echo "Timezone: $TZ"
echo "Schedule: $CRON_SCHEDULE"
echo "Recipient: $EMAIL_TO"
echo "Location: ${NWS_LAT},${NWS_LON} (${LOCATION_NAME:-Buffalo, NY})"
echo ""

# Validate required environment variables
missing=""
[ -z "$TEMPEST_TOKEN" ] && missing="$missing TEMPEST_TOKEN"
[ -z "$ANTHROPIC_API_KEY" ] && missing="$missing ANTHROPIC_API_KEY"
[ -z "$SMTP_USER" ] && missing="$missing SMTP_USER"
[ -z "$SMTP_PASS" ] && missing="$missing SMTP_PASS"
[ -z "$EMAIL_TO" ] && missing="$missing EMAIL_TO"

if [ -n "$missing" ]; then
  echo "ERROR: Missing required environment variables:$missing"
  exit 1
fi

echo "Configuration validated"
echo ""

# Create crontab with both daily briefing and hourly alert check
cat > /tmp/crontab << EOF
# Daily morning briefing
$CRON_SCHEDULE cd /app && bun run src/index.ts >> /tmp/cron.log 2>&1

# Hourly alert check (runs every hour, only sends if active warnings)
0 * * * * cd /app && bun run src/alert-check.ts >> /tmp/alert-check.log 2>&1
EOF

echo "Cron schedules:"
echo "  Daily briefing: $CRON_SCHEDULE"
echo "  Alert check: Every hour (0 * * * *)"
echo ""

# Optional: Run immediately on startup
if [ "${RUN_ON_STARTUP:-true}" = "true" ]; then
  echo "Sending initial weather briefing..."
  bun run src/index.ts || echo "Initial run failed (continuing anyway)"
  echo ""
fi

# Start supercronic
echo "Starting cron scheduler..."
echo "=================================================="
exec supercronic /tmp/crontab
