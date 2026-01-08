# Radiosonde

AI-powered weather briefings via email with drone flying forecasts.

Radiosonde fetches weather data from multiple sources, uses Claude AI to generate personalized weather narratives, and delivers them via email on a schedule. Includes specialized forecasts for Part 107 drone operators.

## Features

- **Multi-source weather data**: Tempest personal weather station + National Weather Service
- **AI-generated narratives**: Claude AI creates natural, contextual weather briefings
- **Time-aware briefings**: Adapts content for morning (6 AM), midday (12 PM), and evening (6 PM)
- **Drone flying forecast**: Hourly conditions from 6 AM - Midnight for Part 107 operations
- **Alert monitoring**: Hourly checks for weather warnings with smart notifications
- **Personalization**: Location-aware with configurable context (commutes, schedules, etc.)

## Drone Flying Forecast

Each briefing includes a drone flying forecast analyzing conditions hour-by-hour:

| Rating | Icon | Criteria |
|--------|------|----------|
| Excellent | 🟢 | <12 mph winds, no precipitation, good temps |
| Good | 🟡 | <15 mph winds, low precip chance |
| Marginal | 🟠 | 15-20 mph winds or 40%+ precip chance |
| No-Fly | 🔴 | >25 mph winds, precipitation, or fog |

**Factors analyzed:**
- Wind speed (DJI drone limits ~25 mph)
- Precipitation probability
- Temperature (cold affects battery performance)
- Visibility/fog (Part 107 requires 3 statute miles)

The forecast identifies the best flying window and total flyable hours for the day.

## Data Sources

1. **Tempest Weather Station** - Personal station current conditions
2. **National Weather Service**:
   - Hourly forecasts (for drone conditions)
   - 7-day forecasts
   - Area Forecast Discussion (AFD)
   - Hazardous Weather Outlook (HWO)
   - Active alerts
3. **Airport observations (KBUF)** - Official METAR data, precipitation totals

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

### OrbStack / Docker Compose

The service is designed to run in a Docker Compose stack:

```yaml
# In docker-compose.yml
radiosonde:
  build:
    context: ./services/radiosonde-briefing
    dockerfile: Dockerfile
  container_name: radiosonde
  environment:
    - TZ=America/New_York
    - CRON_SCHEDULE=0 6,12,18 * * *
    - RUN_ON_STARTUP=true
    - TEMPEST_TOKEN=${TEMPEST_TOKEN}
    - TEMPEST_STATION_ID=36763
    - NWS_LAT=42.9054
    - NWS_LON=-78.6923
    - NWS_OFFICE=BUF
    - LOCATION_NAME=Lancaster, NY
    - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    - SMTP_USER=${SMTP_USER}
    - SMTP_PASS=${SMTP_PASS}
    - EMAIL_TO=${EMAIL_TO}
  volumes:
    - ./data/radiosonde:/tmp
  restart: unless-stopped
```

### Build and Deploy

```bash
cd ~/stacks/home
docker-compose build radiosonde
docker-compose up -d radiosonde
```

### View Logs

```bash
docker logs -f radiosonde
```

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
| `CRON_SCHEDULE` | Briefing schedule | `0 6,12,18 * * *` |
| `RUN_ON_STARTUP` | Send on container start | `true` |

## Briefing Schedule

Default schedule sends briefings 3x daily:
- **6 AM** - Morning briefing (day ahead, commute focus)
- **12 PM** - Midday update (afternoon/evening focus)
- **6 PM** - Evening briefing (tonight and tomorrow focus)

Each briefing adapts its content and greeting based on the time of day.

## Project Structure

```
src/
├── index.ts          # Main briefing pipeline
├── alert-check.ts    # Hourly weather alert monitor
├── config.ts         # Configuration management
├── healthcheck.ts    # Container health checks
├── ai/
│   └── claude.ts     # Claude AI narrative generation
├── email/
│   ├── mailer.ts     # SMTP email sending
│   ├── template.ts   # HTML/text email templates
│   └── alert-template.ts
├── lib/
│   ├── retry.ts      # API retry logic
│   └── state.ts      # State tracking for alerts
└── weather/
    ├── nws.ts        # NWS API client + drone forecast
    ├── tempest.ts    # Tempest API client
    ├── types.ts      # TypeScript interfaces
    └── utils.ts      # Weather utilities
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

## Updating

To update the running container with new code:

```bash
# From the container with updated code (get container ID with: docker ps | grep claude)
docker cp CONTAINER_ID:/path/to/radiosonde/. ~/stacks/home/services/radiosonde-briefing/

# Rebuild and restart
cd ~/stacks/home
docker-compose build --no-cache radiosonde
docker-compose up -d radiosonde
```

## License

MIT
