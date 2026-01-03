FROM node:22-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9.12.0

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile --prod=false

# Copy source code
COPY . .

# Build the server
RUN pnpm build

# Expose port
EXPOSE 3000

# Set environment to production
ENV NODE_ENV=production
ENV PORT=3000

# Start the server
CMD ["sh", "-c", "pnpm db:push && pnpm start"]
