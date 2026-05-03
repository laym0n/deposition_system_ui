function buildDevServer(options) {
  const { port } = options;

  return {
    port,
    historyApiFallback: true,
    hot: true,
    open: true,
  };
}

module.exports = { buildDevServer };
