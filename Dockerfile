FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY scripts/patch-fontkit.mjs scripts/fontkit-southeast.mjs scripts/fontkit-myanmar-data.json ./scripts/
RUN npm ci --no-audit --no-fund
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ARG API_INTERNAL_URL=http://api:4000
ENV API_INTERNAL_URL=$API_INTERNAL_URL
RUN npm run build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ffmpeg fonts-dejavu-core fonts-noto-core ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY scripts/patch-fontkit.mjs scripts/fontkit-southeast.mjs scripts/fontkit-myanmar-data.json ./scripts/
RUN npm ci --omit=dev --no-audit --no-fund
COPY --from=build --chown=node:node /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/apps/web ./apps/web
COPY --from=build --chown=node:node /app/prisma ./prisma
USER node
EXPOSE 3000 4000
CMD ["npm", "run", "start:api"]
