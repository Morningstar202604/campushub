FROM node:20-alpine as build-stage

WORKDIR /app
RUN corepack enable
RUN corepack prepare pnpm@latest --activate
RUN npm config set registry https://registry.npmmirror.com

# 构建期注入（Vite 编译时读取 VITE_* 环境变量，缺 .env 会导致启动崩溃）
ARG VITE_ROUTER_HISTORY=hash
ARG VITE_API_BASE=/api
ENV VITE_ROUTER_HISTORY=$VITE_ROUTER_HISTORY \
    VITE_API_BASE=$VITE_API_BASE

COPY .npmrc package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

FROM nginx:stable-alpine as production-stage

COPY --from=build-stage /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
