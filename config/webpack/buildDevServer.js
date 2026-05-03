function buildDevServer(options) {
  const { port } = options;

  return {
    host: 'localhost',
    port,
    historyApiFallback: true,
    hot: true,
    open: { target: ['http://localhost:' + port] },
    // webpack-dev-server v5 in this project validates proxy as an array
    // (each item may specify `context`).
    proxy: [
      {
        context: ['/api'],
        target: process.env.API_PROXY_TARGET || 'http://158.160.194.122',
        changeOrigin: true,
        secure: false,
        // Keep cookies/auth headers working when backend uses them.
        cookieDomainRewrite: '',
        // Our client uses API_URL=/api, but backend expects paths without /api.
        pathRewrite: { '^/api': '' },
        logLevel: 'warn',
      },
      {
        context: ['/keycloak'],
        target: process.env.OIDC_PROXY_TARGET || 'https://158.160.194.122',
        changeOrigin: true,
        secure: false,
        cookieDomainRewrite: '',
        logLevel: 'warn',
      },
    ],
  };
}

module.exports = { buildDevServer };
