#!/bin/sh
set -eu

APP_DIR="/app"
DIST_DIR="/usr/share/nginx/html"

PORT="${PORT:-3000}"
API_URL="${API_URL:-/api}"
OIDC_AUTHORITY="${OIDC_AUTHORITY:-https://158.160.194.122/keycloak/realms/deposition}"
OIDC_CLIENT_ID="${OIDC_CLIENT_ID:-deposition-client}"
ETHEREUM_RPC_URL="${ETHEREUM_RPC_URL:-https://158.160.194.122/rpc/}"

cat > "$APP_DIR/.env.production" <<EOF_ENV
PORT=$PORT
API_URL=$API_URL
OIDC_AUTHORITY=$OIDC_AUTHORITY
OIDC_CLIENT_ID=$OIDC_CLIENT_ID
ETHEREUM_RPC_URL=$ETHEREUM_RPC_URL
EOF_ENV

echo "[entrypoint] Building frontend with runtime environment variables..."
cd "$APP_DIR"
npm run build

rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"
cp -r "$APP_DIR/dist/." "$DIST_DIR/"

echo "[entrypoint] Frontend build completed, starting nginx..."
exec "$@"