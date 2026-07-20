FROM node:22-alpine
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
COPY package.json pnpm-workspace.yaml tsconfig.json ./
COPY packages ./packages
COPY apps/web ./apps/web
RUN pnpm install --filter @agent-test/web...
WORKDIR /app/apps/web
ENV PORT=8080
EXPOSE 8080
CMD ["pnpm", "exec", "tsx", "src/server.ts"]
