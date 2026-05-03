const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

const { buildAliases } = require('./buildAliases');
const { buildLoaders } = require('./buildLoaders');
const { buildPlugins } = require('./buildPlugins');
const { buildResolvers } = require('./buildResolvers');
const { buildDevServer } = require('./buildDevServer');

/**
 * @param {{mode:'development'|'production', port?: number}} env
 */
function buildWebpackConfig(env) {
  const isDev = env.mode === 'development';
  const port = env.port ?? 3000;

  const paths = {
    entry: path.resolve(__dirname, '..', '..', 'src', 'app', 'index.tsx'),
    html: path.resolve(__dirname, '..', '..', 'public', 'index.html'),
    output: path.resolve(__dirname, '..', '..', 'dist'),
    env: {
      dev: path.resolve(__dirname, '..', '..', '.env.development'),
      prod: path.resolve(__dirname, '..', '..', '.env.production'),
    },
  };

  const srcPath = path.resolve(__dirname, '..', '..', 'src');
  const aliases = buildAliases(srcPath);

  return {
    mode: env.mode,
    entry: paths.entry,
    output: {
      path: paths.output,
      filename: isDev ? '[name].js' : '[name].[contenthash].js',
      publicPath: '/',
      assetModuleFilename: 'assets/[hash][ext][query]',
    },
    devtool: isDev ? 'inline-source-map' : false,
    devServer: isDev ? buildDevServer({ port }) : undefined,
    module: {
      rules: buildLoaders({ isDev }),
    },
    resolve: buildResolvers({ aliases }),
    plugins: [
      ...buildPlugins({ paths, isDev }),
      ...(isDev
        ? []
        : [
            new MiniCssExtractPlugin({
              filename: 'styles/[name].[contenthash].css',
            }),
          ]),
    ],
    optimization: {
      splitChunks: { chunks: 'all' },
      runtimeChunk: 'single',
    },
    performance: {
      hints: false,
    },
  };
}

module.exports = { buildWebpackConfig };
