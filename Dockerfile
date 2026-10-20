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

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Run as a non-root user
RUN addgroup -S bun && adduser -S bun -G bun

# Copy dependencies and application code from the builder stage
COPY --from=builder --chown=bun:bun /app/node_modules ./node_modules
COPY --from=builder --chown=bun:bun /app/src ./src
COPY --chown=bun:bun package.json ./

USER bun

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/ || exit 1

# Set entrypoint to run the app
CMD ["bun", "src/server.ts"]