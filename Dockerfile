FROM node:22-slim AS base
WORKDIR /app

# Install dependencies for both workspaces
FROM base AS deps
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY dashboard/package.json dashboard/
RUN npm ci

# Build dashboard
FROM deps AS dashboard-build
COPY dashboard/ dashboard/
RUN npm run build -w dashboard

# Build server
FROM deps AS server-build
COPY server/ server/
RUN npm run build -w server

# Production
FROM base AS production
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/server/node_modules ./server/node_modules
COPY --from=server-build /app/server/dist ./server/dist
COPY --from=dashboard-build /app/dashboard/dist ./dashboard/dist
COPY server/package.json server/
COPY server/seed-data/ server/seed-data/
COPY package.json ./

# Create data directory for SQLite
RUN mkdir -p /app/data

EXPOSE 3001
CMD ["node", "server/dist/index.js"]
