const { buildWebpackConfig } = require('./config/webpack/buildWebpackConfig');
const dotenv = require('dotenv');

module.exports = (env, argv) => {
  const mode = argv.mode ?? 'development';
  const port = Number(env?.port ?? process.env.PORT ?? 3000);

  // Load .env into Node process for webpack-dev-server configuration (proxy, etc.).
  // DotenvWebpack plugin injects vars into the client bundle, but devServer needs them earlier.
  dotenv.config({ path: mode === 'development' ? '.env.development' : '.env.production' });

  return buildWebpackConfig({ mode, port });
};
