ARG BUN_IMAGE=dockerproxy.net/oven/bun:1.3.14-alpine
ARG NGINX_IMAGE=dockerproxy.net/library/nginx:alpine
FROM ${BUN_IMAGE} AS build

WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile || bun install
COPY . .
RUN bun run build

FROM ${NGINX_IMAGE}
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
