FROM node:26-alpine AS build
WORKDIR /app
RUN npm install -g pnpm@11
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/core/package.json packages/core/
COPY packages/react/package.json packages/react/
COPY packages/sync/package.json packages/sync/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:26-alpine
ENV NODE_ENV=production \
    PORT=8080 \
    DATA_DIR=/data
WORKDIR /app
# the server only needs the sync/runtime deps, not the client toolchain
COPY server/package.json server/
RUN cd server && npm install --omit=dev && npm cache clean --force
COPY server/*.ts server/
COPY server/drizzle server/drizzle
COPY --from=build /app/dist ./dist
EXPOSE 8080
VOLUME /data
CMD ["node", "server/main.ts"]
