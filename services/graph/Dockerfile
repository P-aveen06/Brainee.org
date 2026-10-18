FROM node:22-bookworm-slim@sha256:c3de60bf2f9dd0ac6370e6117950ff62d6e339527e7472301c9c78a017978392 AS dependencies
WORKDIR /app/services/graph
COPY services/graph/package.json services/graph/package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund

FROM dependencies AS checked
COPY shared /app/shared
COPY services/graph/tsconfig.json ./
COPY services/graph/src ./src
COPY services/graph/test ./test
RUN npm run typecheck && npm test
RUN npm prune --omit=dev --ignore-scripts --no-audit --no-fund

FROM node:22-bookworm-slim@sha256:c3de60bf2f9dd0ac6370e6117950ff62d6e339527e7472301c9c78a017978392
WORKDIR /app/services/graph
ENV NODE_ENV=production
COPY --from=checked --chown=node:node /app /app
USER node
EXPOSE 3100
CMD ["node", "--experimental-strip-types", "src/index.ts"]
