# syntax=docker/dockerfile:1
# Stage 1: Build the SvelteKit app
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first (cached layer)
COPY package.json package-lock.json ./

# Use BuildKit cache mount for npm
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# Copy the rest of the application source code
COPY . .

# Build arguments for SvelteKit static env
ARG API_URL
ARG PUBLIC_API_URL
ARG PUBLIC_TILE_SERVER_URL
ENV API_URL=${API_URL}
ENV PUBLIC_API_URL=${PUBLIC_API_URL}
ENV PUBLIC_TILE_SERVER_URL=${PUBLIC_TILE_SERVER_URL}

# Build the application
RUN npm run build

# Prune dev dependencies for smaller production image
RUN npm prune --production

# Stage 2: Create the final production image
FROM node:20-alpine

WORKDIR /app

# Copy only production node_modules and build output
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/build ./

# Expose the port the app runs on (default for adapter-node is 3000)
EXPOSE 3000

# Set the command to run the application
CMD ["node", "index.js"]
