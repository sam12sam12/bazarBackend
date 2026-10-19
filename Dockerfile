# Stage 1: Build & Install dependencies
FROM oven/bun:alpine AS builder
WORKDIR /app

# Copy dependency files
COPY package.json bun.lock ./

# Install only production dependencies to keep the image small
RUN bun install --frozen-lockfile --production

# Copy the rest of the source code
COPY src ./src


# Stage 2: Runner (Final Image)
FROM oven/bun:alpine AS runner
WORKDIR /app

# Copy dependencies and application code from the builder stage
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY package.json ./


# Assuming default Hono port is 7426
ENV PORT=3000
EXPOSE 3000

# Set entrypoint to run the app
CMD ["bun", "src/server.ts"]