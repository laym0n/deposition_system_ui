const { buildWebpackConfig } = require('./config/webpack/buildWebpackConfig');

module.exports = (env, argv) => {
  const mode = argv.mode ?? 'development';
  const port = Number(env?.port ?? process.env.PORT ?? 3000);
  return buildWebpackConfig({ mode, port });
};
