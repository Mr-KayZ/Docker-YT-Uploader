# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files and install dependencies
COPY app/package*.json ./
RUN npm ci

# Copy the rest of the app and build
COPY app/ ./
RUN npm run build

# Stage 2: Run
FROM node:22-alpine AS runner

WORKDIR /app

# Copy only what's needed to run
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Create the uploads directory inside the container
RUN mkdir -p /uploads

# Expose the port
EXPOSE 4321

CMD ["node", "./dist/server/entry.mjs"]