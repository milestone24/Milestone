# Stage 1: Dependencies - Cache node_modules separately
FROM node:24 AS dependencies
WORKDIR /app

# Copy package files for dependency installation
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Stage 2: Build - Build the application
FROM node:24 AS build
WORKDIR /app

# Copy dependencies from previous stage
COPY --from=dependencies /app/node_modules ./node_modules

# Copy source files needed for build
COPY package.json package-lock.json ./
COPY tsconfig.json ./
COPY vite.config.ts ./
COPY drizzle.config.ts ./

COPY server/ ./server/
COPY shared/ ./shared/
COPY public/ ./public/

COPY client/ ./client/

# Build the application
RUN npm run build

# Stage 3: Production - Minimal runtime image
# FROM node:24 AS production
# WORKDIR /app

# # Copy package files for production dependencies only
# COPY package.json package-lock.json ./

# # Install only production dependencies
# RUN npm ci --omit=dev

# # Copy built artifacts from build stage
# COPY --from=build /app/dist ./dist`
# COPY --from=build /app/public ./public

# Expose port (adjust if your app uses a different port)
EXPOSE 5001

# Set production environment
ENV NODE_ENV=production

# Start the application
CMD ["npm", "start"]

