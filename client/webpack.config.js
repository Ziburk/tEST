const path = require('path');
const webpack = require('webpack');

module.exports = {
  target: 'web',
  resolve: {
    fallback: {
      crypto: false,
      fs: false,
      path: false,
      zlib: false,
      tty: false,
      os: false,
      net: false,
      dgram: false
    }
  }
};
