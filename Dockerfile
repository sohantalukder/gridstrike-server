FROM node:22-bookworm-slim

WORKDIR /app

ENV NODE_ENV=prod
ENV PORT=8080

COPY package*.json ./
COPY prisma ./prisma

RUN npm ci
RUN npm run prisma:generate

COPY nest-cli.json tsconfig.json ./
COPY src ./src

RUN npm run build
RUN npm prune --omit=dev

EXPOSE 8080

CMD ["node", "dist/main.js"]
