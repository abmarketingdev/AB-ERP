# AB ERP — rekrutterings- og onboardingportal
#
# Three stages so the runtime image carries neither the source nor the build
# toolchain: deps installs, build compiles, runner holds only the traced output.

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# `npm ci` needs the dev dependencies — Tailwind, TypeScript and MSW all run at
# build time, so --omit=dev here would fail the build rather than slim it.
RUN npm ci

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Telemetry off: this builds on a client's server, and nothing should leave it.
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Run as a non-root user. The numeric ids are fixed rather than left to the
# distro, because the only thing this container writes is its own stdout and a
# surprise uid change between base-image rebuilds is a debugging session nobody
# needs.
RUN addgroup -g 1001 -S nodejs && adduser -u 1001 -S nextjs -G nodejs

COPY --from=build /app/public ./public
# `standalone` already contains the minimal node_modules and server.js.
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

# No healthcheck here — the compose file owns it, so it can be changed without
# a rebuild.
CMD ["node", "server.js"]
