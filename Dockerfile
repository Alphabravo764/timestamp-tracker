FROM node:22-alpine

WORKDIR /app

RUN npm install -g pnpm@9.12.0

COPY package.json pnpm-lock.yaml ./

# IMPORTANT: keep no-frozen-lockfile for now (you changed package.json repeatedly)
RUN pnpm install --no-frozen-lockfile --prod=false

COPY . .

RUN pnpm build

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

CMD ["pnpm", "start"]
