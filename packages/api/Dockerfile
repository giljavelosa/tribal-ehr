# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root workspace files
COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/api/package.json ./packages/api/
COPY packages/hl7-engine/package.json ./packages/hl7-engine/
COPY packages/auth/package.json ./packages/auth/
COPY packages/cds-hooks/package.json ./packages/cds-hooks/

# Install all dependencies (including dev for build)
RUN npm ci --workspace=packages/shared --workspace=packages/api --workspace=packages/hl7-engine --workspace=packages/auth --workspace=packages/cds-hooks --include-workspace-root

# Copy source files
COPY tsconfig.json ./
COPY packages/shared/ ./packages/shared/
COPY packages/api/ ./packages/api/
COPY packages/hl7-engine/ ./packages/hl7-engine/
COPY packages/auth/ ./packages/auth/
COPY packages/cds-hooks/ ./packages/cds-hooks/

# Build all packages in dependency order
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=packages/hl7-engine
RUN npm run build --workspace=packages/auth
RUN npm run build --workspace=packages/cds-hooks
RUN npm run build --workspace=packages/api

# Stage 2: Production
FROM node:20-alpine AS production

RUN apk add --no-cache dumb-init curl

WORKDIR /app

# Copy root workspace files
COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/api/package.json ./packages/api/
COPY packages/hl7-engine/package.json ./packages/hl7-engine/
COPY packages/auth/package.json ./packages/auth/
COPY packages/cds-hooks/package.json ./packages/cds-hooks/

# Install production dependencies only
RUN npm ci --workspace=packages/shared --workspace=packages/api --workspace=packages/hl7-engine --workspace=packages/auth --workspace=packages/cds-hooks --include-workspace-root --omit=dev

# Copy built artifacts
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/api/dist ./packages/api/dist
COPY --from=builder /app/packages/hl7-engine/dist ./packages/hl7-engine/dist
COPY --from=builder /app/packages/auth/dist ./packages/auth/dist
COPY --from=builder /app/packages/cds-hooks/dist ./packages/cds-hooks/dist

# Create non-root user
RUN addgroup -g 1001 -S ehruser && \
    adduser -S ehruser -u 1001

USER ehruser

EXPOSE 3001

ENV NODE_ENV=production

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "packages/api/dist/index.js"]
