const path = require('path');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

function buildResolvers(options) {
  const { aliases } = options;

  return {
    extensions: ['.tsx', '.ts', '.js'],
    alias: aliases,
    fallback: {},
    plugins: [
      new TsconfigPathsPlugin({
        configFile: path.resolve(__dirname, '..', '..', 'tsconfig.json'),
      }),
    ],
  };
}

module.exports = { buildResolvers };
