FROM node:22-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9.12.0

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --no-frozen-lockfile --prod=false

# Copy source code
COPY . .

# Build the server
RUN pnpm build:all

# Expose port
EXPOSE 3000

# Set environment to production
ENV NODE_ENV=production
ENV PORT=3000

# Run migrations and start the server
CMD ["pnpm", "start"]
