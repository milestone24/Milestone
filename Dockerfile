# Temporary monorepo Docker build for legacy container deploy.
# Bundles the API with esbuild and serves the built client from public/.

# Stage 1: Dependencies — cache node_modules separately
FROM node:24 AS dependencies
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/data/package.json ./packages/data/
COPY packages/js-common/package.json ./packages/js-common/
COPY apps/api-primary-node/package.json ./apps/api-primary-node/
COPY apps/client-primary/package.json ./apps/client-primary/

# Docker only needs api, client, and shared packages — not expo or CDK infrastructure.
RUN node -e "\
  const fs = require('fs'); \
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8')); \
  pkg.workspaces = pkg.workspaces.filter( \
    (workspace) => !['apps/expo-primary', 'infrastructure'].includes(workspace), \
  ); \
  fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n'); \
"

RUN npm ci

# Stage 2: Build — compile workspaces and bundle the API
FROM node:24 AS build
WORKDIR /app

# Copy full dependency tree (root + workspace node_modules, e.g. packages/data/node_modules)
COPY --from=dependencies /app ./

COPY packages/ ./packages/
COPY apps/api-primary-node/ ./apps/api-primary-node/
COPY apps/client-primary/ ./apps/client-primary/

RUN npm run docker:build

# Stage 3: Production — minimal runtime image
# FROM node:24 AS production
# WORKDIR /app
#
# COPY package.json package-lock.json ./
# COPY packages/data/package.json ./packages/data/
# COPY packages/js-common/package.json ./packages/js-common/
# COPY apps/api-primary-node/package.json ./apps/api-primary-node/
# RUN npm ci --omit=dev
#
# COPY --from=build /app/dist ./dist
# COPY --from=build /app/public ./public
# COPY --from=build /app/packages/data/dist ./packages/data/dist
# COPY --from=build /app/packages/js-common/dist ./packages/js-common/dist

EXPOSE 5001

ENV NODE_ENV=production
ENV SERVE_CLIENT_STATIC=true

CMD ["npm", "start"]
