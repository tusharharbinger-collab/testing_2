# Production-ready minimal Alpine-based Node.js image
FROM node:20-alpine

# Install curl for AWS ALB / container health checks
RUN apk add --no-cache curl

# Set working directory
WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=8080
ENV HOST=0.0.0.0

# Copy package descriptors
COPY package*.json ./

# Install dependencies (production only, clean)
RUN npm ci --omit=dev || npm install --omit=dev

# Copy application source
COPY . .

# Expose port 8080
EXPOSE 8080

# ALB / Container Healthcheck
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Start server
CMD ["node", "server.js"]
