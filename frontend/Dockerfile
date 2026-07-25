FROM node:24-alpine AS build
WORKDIR /web
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM nginx:1.27-alpine
COPY --from=build /web/dist /usr/share/nginx/html
EXPOSE 80
