/// <reference types="react-scripts" />

// Configure webpack polyfills
if (window.process === undefined) {
  window.process = {
    env: { NODE_ENV: 'development' }
  };
}
