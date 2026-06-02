# syntax=docker/dockerfile:1

FROM node:20-alpine AS runtime

WORKDIR /app

# nginx is used to serve the built frontend after runtime build
RUN apk add --no-cache nginx

# Install dependencies once at image build time
COPY package.json package-lock.json .npmrc ./
RUN npm ci

# Copy application sources and runtime assets
COPY . .

# nginx configuration and startup script
COPY nginx.conf /etc/nginx/http.d/default.conf
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
