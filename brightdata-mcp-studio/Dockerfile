FROM node:22-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --ignore-scripts --omit=dev

FROM node:22-alpine AS release

WORKDIR /app

COPY --from=builder /app/node_modules /app/node_modules
COPY package.json package-lock.json ./

# Upstream's server files.
COPY server.js browser_tools.js browser_session.js prompts.js \
    tool_groups.js search_utils.js search_dataset_schema.js \
    aria_snapshot_filter.js ./

# Scraper Studio lifecycle, account tools and the extra browser verbs.
COPY scraper/ ./scraper/
COPY account/ ./account/
COPY browser/ ./browser/

ENV NODE_ENV=production

# registry.json is the only record of which scraper belongs to which site,
# and there is no API to rebuild it. Mount a volume here or every redeploy
# loses every scraper.
VOLUME ["/data"]
ENV REGISTRY_PATH=/data/registry.json

ENTRYPOINT ["node", "server.js"]
