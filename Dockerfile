FROM node:24-bookworm-slim

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.26.1 --activate

COPY . .

RUN pnpm install --frozen-lockfile --include-workspace-root \
    --filter @workspace/api-server... \
    --filter @workspace/sfile-web-downloader...

RUN pnpm --filter @workspace/api-server run build \
    && pnpm --filter @workspace/sfile-web-downloader run build:vercel

ENV NODE_ENV=production \
    PORT=7860 \
    WEB_ROOT=/app/artifacts/sfile-web-downloader/dist/public \
    USE_PACKAGED_CHROMIUM=1

EXPOSE 7860

CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]
