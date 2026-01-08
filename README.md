# Radiosonde

AI-powered daily weather briefings via email.

Radiosonde fetches weather data from multiple sources, uses Claude AI to generate personalized weather narratives, and delivers them via email on a schedule.

## Features

- **Multi-source weather data**: Tempest personal weather station + National Weather Service
- **AI-generated narratives**: Claude AI creates natural, contextual weather briefings
- **Daily briefings**: Comprehensive morning weather reports
- **Alert monitoring**: Hourly checks for weather warnings with smart notifications
- **Personalization**: Location-aware with configurable context (commutes, schedules, etc.)

## Data Sources

1. **Tempest Weather Station** - Personal station current conditions
2. **National Weather Service** - Forecasts, alerts, Area Forecast Discussion (AFD), Hazardous Weather Outlook (HWO)
3. **Airport observations** - Official METAR data

## Requirements

- [Bun](https://bun.sh/) runtime (v1.0+)
- Tempest weather station and API token
- Anthropic API key (Claude)
- Gmail account with App Password for SMTP

## Quick Start

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Fill in your credentials in `.env`

3. Install dependencies:
   ```bash
   bun install
   ```

4. Run a test briefing:
   ```bash
   bun run start
   ```

## Docker Deployment

Build and run with Docker Compose:

```bash
docker-compose up -d
```

The container will:
- Send an initial briefing on startup (if `RUN_ON_STARTUP=true`)
- Run daily briefings on schedule (default: 7 AM)
- Check for weather alerts hourly

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `TEMPEST_TOKEN` | Tempest API token | Required |
| `TEMPEST_STATION_ID` | Your station ID | `36763` |
| `NWS_LAT` | Latitude for NWS | `42.9054` |
| `NWS_LON` | Longitude for NWS | `-78.6923` |
| `NWS_OFFICE` | NWS forecast office | `BUF` |
| `LOCATION_NAME` | Display name | `Buffalo, NY` |
| `ANTHROPIC_API_KEY` | Claude API key | Required |
| `SMTP_USER` | Gmail address | Required |
| `SMTP_PASS` | Gmail App Password | Required |
| `EMAIL_TO` | Recipient email | Required |
| `TZ` | Timezone | `America/New_York` |
| `CRON_SCHEDULE` | Briefing schedule | `0 7 * * *` |
| `RUN_ON_STARTUP` | Send on container start | `true` |

## Project Structure

```
src/
├── index.ts          # Main daily briefing pipeline
├── alert-check.ts    # Hourly weather alert monitor
├── config.ts         # Configuration management
├── healthcheck.ts    # Container health checks
├── ai/               # Claude AI integration
├── email/            # Email sending (nodemailer)
├── lib/              # Utilities
└── weather/          # Weather API clients (Tempest, NWS)
```

## Scripts

```bash
bun run start          # Run daily briefing
bun run dev            # Development mode with watch
bun run healthcheck    # Container health check
bun run test:tempest   # Test Tempest API
bun run test:nws       # Test NWS API
bun run test:claude    # Test Claude API
bun run test:email     # Test email sending
```

## License

MIT
