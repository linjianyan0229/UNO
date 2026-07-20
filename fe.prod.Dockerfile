FROM node:24-alpine AS builder

WORKDIR /code

RUN npm install --global pnpm@11.14.0

COPY ./UNO-client/package.json ./UNO-client/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY ./UNO-client ./
RUN pnpm build

FROM nginx:1.29-alpine

COPY nginx.prod.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /code/dist /usr/share/nginx/html
