# Temporary monorepo Docker build for legacy container deploy.
# Bundles the API with esbuild and serves the built client from public/.

FROM node:24 AS build
WORKDIR /app

# Package manifests (cached dependency layer)
COPY package.json package-lock.json ./
COPY packages/data/package.json ./packages/data/
COPY packages/js-common/package.json ./packages/js-common/
COPY apps/api-primary-node/package.json ./apps/api-primary-node/
COPY apps/client-primary/package.json ./apps/client-primary/
COPY apps/expo-primary/package.json ./apps/expo-primary/
COPY infrastructure/package.json ./infrastructure/

RUN npm ci

# Application source (workspace node_modules from npm ci are preserved)
COPY packages/ ./packages/
COPY apps/api-primary-node/ ./apps/api-primary-node/
COPY apps/client-primary/ ./apps/client-primary/

RUN npm run docker:build

ENV NODE_ENV=production
ENV SERVE_CLIENT_STATIC=true

EXPOSE 5001

CMD ["npm", "start"]
