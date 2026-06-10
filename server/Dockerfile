FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates chromium \
  && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

COPY server/package*.json ./
RUN npm ci --omit=dev

COPY server/ ./

RUN mkdir -p /app/media/live /app/uploads /videos

EXPOSE 8001 8000 1935

CMD ["node", "index.js"]
