const path = require('path');

// The function to transform the webpack config
const transformConfig = function (initialWebpackConfig) {
  // Adding worker-loader configuration to the webpack config
  initialWebpackConfig.module.rules.push({
    test: /\.worker\.ts$/,
    use: { loader: 'worker-loader' },
    include: path.resolve(__dirname, '../src/workers') // Make sure this path points to your workers directory
  });

  // When using worker-loader, you may encounter "window is not defined" errors. To fix this, set the globalObject to 'this'.
  initialWebpackConfig.output.globalObject = 'this';

  // Return the modified config
  return initialWebpackConfig;
};

// Export the configuration
module.exports = {
  transformConfig // The function exported here will be used to modify the webpack configuration
};
