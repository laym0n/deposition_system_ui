const HtmlWebpackPlugin = require('html-webpack-plugin');
const Dotenv = require('dotenv-webpack');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');

function buildPlugins(options) {
  const { paths, isDev } = options;

  return [
    new CleanWebpackPlugin(),
    new HtmlWebpackPlugin({
      template: paths.html,
      favicon: undefined,
    }),
    new Dotenv({
      path: isDev ? paths.env.dev : paths.env.prod,
      systemvars: true,
    }),
  ];
}

module.exports = { buildPlugins };
