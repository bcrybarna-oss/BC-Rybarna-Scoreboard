FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates && rm -rf /var/lib/apt/lists/*
COPY studio-live-test/package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY studio-live-test/server.js ./
COPY studio-live-test/public ./public
ENV PORT=10000
EXPOSE 10000
USER node
CMD ["node", "server.js"]
