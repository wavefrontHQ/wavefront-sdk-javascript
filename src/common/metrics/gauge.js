const Metrics = require('./metrics').Metrics;

class WavefrontSDKGauge extends Metrics {
  constructor(supplier) {
    super();
    this.supplier = supplier;
  }

  getValue() {
    // TODO: if callable
    return this.supplier();
  }
}

module.exports = {
  WavefrontSDKGauge
};
