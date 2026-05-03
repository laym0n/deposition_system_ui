const MiniCssExtractPlugin = require('mini-css-extract-plugin');

function buildLoaders(options) {
  const { isDev } = options;

  const tsLoader = {
    test: /\.tsx?$/,
    use: {
      loader: 'ts-loader',
      options: {
        // Our base tsconfig is used for type-check only (noEmit: true).
        // For webpack build we need actual JS output.
        configFile: 'tsconfig.webpack.json',
      },
    },
    exclude: /node_modules/,
  };

  const svgLoader = {
    test: /\.svg$/,
    issuer: /\.[jt]sx?$/,
    use: ['@svgr/webpack'],
  };

  const assetLoader = {
    test: /\.(png|jpe?g|gif|webp|ico)$/i,
    type: 'asset/resource',
  };

  const cssLoader = {
    test: /\.css$/,
    use: [isDev ? 'style-loader' : MiniCssExtractPlugin.loader, 'css-loader', 'postcss-loader'],
  };

  return [assetLoader, svgLoader, cssLoader, tsLoader];
}

module.exports = { buildLoaders };
