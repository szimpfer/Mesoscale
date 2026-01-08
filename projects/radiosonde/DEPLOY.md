# Radiosonde Deployment Instructions

**For Claude Code on Mac Mini M4**

## What This Is

Radiosonde is a Docker container that sends AI-powered daily weather briefings at 7 AM and hourly alert updates during active warnings.

## Deployment Steps

### 1. Extract Package

```bash
cd ~/Projects
tar -xzf radiosonde-deploy.tar.gz
cd radiosonde
```

### 2. Create Environment File

Copy `.env.example` to `.env` and fill in the secrets:

```bash
cp .env.example .env
```

Required secrets (ask Scott for values):
- `TEMPEST_TOKEN` - Tempest weather station API token
- `ANTHROPIC_API_KEY` - Claude API key for narrative generation
- `SMTP_USER` - Gmail address for sending
- `SMTP_PASS` - Gmail app password (not regular password)
- `EMAIL_TO` - Recipient email address

### 3. Add to Existing Docker Stack

Add this service block to `~/stacks/home/docker-compose.yml`:

```yaml
  # --- Radiosonde (Weather Briefings) ---
  radiosonde:
    build:
      context: ~/Projects/radiosonde
      dockerfile: Dockerfile
    container_name: radiosonde
    environment:
      - TZ=America/New_York
      - CRON_SCHEDULE=0 7 * * *
      - RUN_ON_STARTUP=${RUN_ON_STARTUP:-true}
      - TEMPEST_TOKEN=${TEMPEST_TOKEN}
      - TEMPEST_STATION_ID=${TEMPEST_STATION_ID:-36763}
      - NWS_LAT=${NWS_LAT:-42.9054}
      - NWS_LON=${NWS_LON:--78.6923}
      - NWS_OFFICE=${NWS_OFFICE:-BUF}
      - LOCATION_NAME=${LOCATION_NAME:-Lancaster, NY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - SMTP_USER=${SMTP_USER}
      - SMTP_PASS=${SMTP_PASS}
      - EMAIL_TO=${EMAIL_TO}
    volumes:
      - ./data/radiosonde:/tmp
    networks:
      - web
    restart: unless-stopped
```

### 4. Add Secrets to Main .env

Add these lines to `~/stacks/home/.env`:

```bash
# Radiosonde Weather Briefings
TEMPEST_TOKEN=<token>
ANTHROPIC_API_KEY=<key>
SMTP_USER=<email>
SMTP_PASS=<app-password>
EMAIL_TO=<recipient>
```

### 5. Create Data Directory

```bash
mkdir -p ~/stacks/home/data/radiosonde
```

### 6. Build and Deploy

```bash
cd ~/stacks/home
docker-compose build radiosonde
docker-compose up -d radiosonde
```

### 7. Verify

```bash
# Watch the initial run
docker logs -f radiosonde

# Should see:
# - Configuration validated
# - Fetching weather data
# - Generating narrative
# - Email sent
# - Starting cron scheduler
```

## What It Does

- **Daily briefing at 7 AM**: Full weather report with 7-day forecast
- **Hourly alert checks**: During active NWS warnings, sends compact updates
- **AI-powered narrative**: Claude Haiku generates conversational briefings
- **Family context**: Considers Michelle's Alden commute and Scott's Thursday East Aurora commute

## Troubleshooting

**Email not sending:**
```bash
docker exec -it radiosonde bun run src/index.ts
```

**Check logs:**
```bash
docker logs radiosonde
cat ~/stacks/home/data/radiosonde/cron.log
cat ~/stacks/home/data/radiosonde/alert-check.log
```

**Rebuild after changes:**
```bash
docker-compose build radiosonde && docker-compose up -d radiosonde
```

## File Structure

```
radiosonde/
├── Dockerfile
├── docker-compose.yml      # Standalone (not used when integrated)
├── entrypoint.sh
├── package.json
├── .env.example
└── src/
    ├── index.ts            # Main daily briefing
    ├── alert-check.ts      # Hourly alert checker
    ├── config.ts
    ├── weather/
    │   ├── tempest.ts
    │   ├── nws.ts
    │   ├── types.ts
    │   └── utils.ts
    ├── ai/
    │   └── claude.ts
    ├── email/
    │   ├── mailer.ts
    │   ├── template.ts
    │   └── alert-template.ts
    └── lib/
        ├── retry.ts
        └── state.ts
```
