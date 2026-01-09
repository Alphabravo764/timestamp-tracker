FROM node:22-alpine

# Install dependencies for sharp on Alpine
RUN apk add --no-cache vips-dev build-base

WORKDIR /app

COPY package.json package-lock.json ./

# Install all dependencies including sharp for Linux/musl
RUN npm ci

COPY . .

RUN npm run build

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

CMD ["npm", "start"]
