ARG NODE_IMAGE=swr.cn-north-4.myhuaweicloud.com/ddn-k8s/docker.io/library/node:20-bookworm-slim
ARG NGINX_IMAGE=swr.cn-north-4.myhuaweicloud.com/ddn-k8s/docker.io/library/nginx:1.27

FROM ${NODE_IMAGE} AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci --no-fund --no-audit

COPY . .
ARG VITE_OPENHARNESS_API_BASE=
ENV VITE_OPENHARNESS_API_BASE=${VITE_OPENHARNESS_API_BASE}
RUN npm run build

FROM ${NGINX_IMAGE}
COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
