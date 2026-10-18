# syntax=docker/dockerfile:1

# --- build -------------------------------------------------------------------
FROM node:24-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY . .
RUN npm run build

# --- serve -------------------------------------------------------------------
FROM nginxinc/nginx-unprivileged:1.31.7-alpine3.24 AS runtime

# The image's nginx user is uid 101. Keep it explicit so the runtime never
# starts as root, even if the base image default changes.
USER 101

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
