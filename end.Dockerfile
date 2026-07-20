FROM node:24-alpine AS builder

WORKDIR /code

RUN npm install --global pnpm@11.14.0

COPY ./UNO-server/package.json ./UNO-server/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY ./UNO-server ./
RUN pnpm build

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "./dist/index.js"]
