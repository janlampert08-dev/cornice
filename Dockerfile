# Minimal Dockerfile for running worker or dashboard in compose
FROM node:20-alpine

WORKDIR /app

# Install dependencies (including dev for ts-node)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source
COPY . .

ENV NODE_ENV=development

# Default command overridden by compose service
CMD ["npm", "run", "worker"]
