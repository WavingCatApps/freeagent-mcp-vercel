# syntax=docker/dockerfile:1
# Official Bun multi-stage pattern: https://bun.com/guides/ecosystem/docker
# Pin to packageManager (bun@1.4.2). Compatible with Docker and Apple Container.

FROM oven/bun:1.4.2 AS base
WORKDIR /usr/src/app

FROM base AS install
RUN mkdir -p /temp/dev
COPY package.json bun.lock /temp/dev/
RUN cd /temp/dev && bun install --frozen-lockfile

RUN mkdir -p /temp/prod
COPY package.json bun.lock /temp/prod/
RUN cd /temp/prod && bun install --frozen-lockfile --production

FROM base AS prerelease
COPY --from=install /temp/dev/node_modules node_modules
COPY . .
ENV NODE_ENV=production
# Use vitest (package.json "test"), not `bun test` — suites rely on vitest APIs.
RUN bun run test
RUN bun run build

FROM base AS release
COPY --from=install /temp/prod/node_modules node_modules
COPY --from=prerelease /usr/src/app/package.json .
COPY --from=prerelease /usr/src/app/bun.lock .
COPY --from=prerelease /usr/src/app/tsconfig.json .
COPY --from=prerelease /usr/src/app/server.ts .
COPY --from=prerelease /usr/src/app/api ./api
COPY --from=prerelease /usr/src/app/src ./src
COPY --from=prerelease /usr/src/app/dist ./dist
COPY --from=prerelease /usr/src/app/public ./public

# Dedicated receipts dir for attachment.path (mount a host folder here).
RUN mkdir -p /receipts && chown bun:bun /receipts

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV FREEAGENT_ATTACHMENTS_DIR=/receipts

USER bun
VOLUME ["/receipts"]
EXPOSE 3000/tcp
ENTRYPOINT ["bun", "run", "server.ts"]
