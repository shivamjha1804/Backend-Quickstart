# Multi-stage build for production optimization
FROM node:18-alpine AS base

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodeuser -u 1001

#########################################
# Dependencies stage
#########################################
FROM base AS deps

# Install all dependencies (including dev dependencies)
RUN npm ci --only=production && npm cache clean --force

#########################################
# Build stage (only if TypeScript)
#########################################
FROM base AS build

# Install all dependencies (including dev)
RUN npm ci

# Copy source code
COPY src ./src

# Build the application
RUN npm run build

# Remove dev dependencies
RUN npm prune --production

#########################################
# Production stage
#########################################
FROM base AS production

# Set NODE_ENV to production
ENV NODE_ENV=production

# Copy production dependencies
COPY --from=build /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/dist ./dist


# Copy other necessary files
COPY package*.json ./
COPY tsconfig.json ./

# Create logs directory
RUN mkdir -p logs && chown -R nodeuser:nodejs logs

# Create uploads directory
RUN mkdir -p uploads && chown -R nodeuser:nodejs uploads

# Change ownership of the app directory to the node user
RUN chown -R nodeuser:nodejs /usr/src/app

# Switch to non-root user
USER nodeuser

# Expose the port the app runs on
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/app.js"]
