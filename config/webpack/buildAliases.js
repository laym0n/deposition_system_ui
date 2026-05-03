const path = require('path');

/**
 * Aliases for Feature-Sliced Design layers.
 * Keep in sync with tsconfig.json -> compilerOptions.paths.
 */
function buildAliases(srcPath) {
  return {
    '@app': path.resolve(srcPath, 'app'),
    '@processes': path.resolve(srcPath, 'processes'),
    '@pages': path.resolve(srcPath, 'pages'),
    '@widgets': path.resolve(srcPath, 'widgets'),
    '@features': path.resolve(srcPath, 'features'),
    '@entities': path.resolve(srcPath, 'entities'),
    '@shared': path.resolve(srcPath, 'shared'),
  };
}

module.exports = { buildAliases };
