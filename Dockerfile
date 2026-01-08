FROM oven/bun:1-alpine

WORKDIR /app

# Install supercronic for container-friendly cron
ARG TARGETARCH
RUN apk add --no-cache tzdata curl && \
    SUPERCRONIC_ARCH=$([ "$TARGETARCH" = "arm64" ] && echo "linux-arm64" || echo "linux-amd64") && \
    curl -fsSLO "https://github.com/aptible/supercronic/releases/download/v0.2.29/supercronic-${SUPERCRONIC_ARCH}" && \
    chmod +x "supercronic-${SUPERCRONIC_ARCH}" && \
    mv "supercronic-${SUPERCRONIC_ARCH}" /usr/local/bin/supercronic && \
    apk del curl

# Copy package files
COPY package.json bun.lockb* ./
RUN bun install --production

# Copy source code
COPY src/ ./src/
COPY tsconfig.json ./

# Create non-root user
RUN addgroup -g 1001 -S radiosonde && \
    adduser -S radiosonde -u 1001 && \
    chown -R radiosonde:radiosonde /app

USER radiosonde

# Health check
HEALTHCHECK --interval=1m --timeout=10s --start-period=10s --retries=3 \
  CMD bun run src/healthcheck.ts || exit 1

# Environment defaults
ENV TZ=America/New_York \
    CRON_SCHEDULE="0 7 * * *"

# Copy entrypoint
COPY --chown=radiosonde:radiosonde entrypoint.sh /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
