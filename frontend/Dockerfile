# Stage 1: Build the SvelteKit app
FROM node:20-alpine as builder

WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the application source code
COPY . .

# Build the application
RUN npm run build

# Stage 2: Create the final production image
FROM node:20-alpine

WORKDIR /app

# Install production dependencies (if any specific runtime deps are needed)
# If the adapter-node output includes node_modules, this might not be needed
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Copy the built application output
COPY --from=builder /app/build ./

# Expose the port the app runs on (default for adapter-node is 3000)
EXPOSE 3000

# Set the command to run the application
CMD ["node", "index.js"] 