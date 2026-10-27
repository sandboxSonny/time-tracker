FROM node:22-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci
COPY . .
# Railway passes these service variables to the build; react-router.config.ts needs them for the origin check.
ARG APP_URL
ARG RAILWAY_PUBLIC_DOMAIN
RUN npm run build && npm prune --omit=dev

FROM node:22-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production DATABASE_PATH=/data/tracker.db
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY package*.json ./
EXPOSE 3000
CMD ["npm", "run", "start"]
