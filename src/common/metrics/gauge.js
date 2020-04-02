const Metrics = require('./metrics').Metrics;

/**
 * Wavefront SDK Gauge.
 */
class WavefrontSDKGauge extends Metrics {
  /**
   * Construct Wavefront SDK Gauge.
   * @param supplier
   */
  constructor(supplier) {
    super();
    this.supplier = supplier;
  }

  /**
   * Get value of the gauge.
   * @returns {*}
   */
  getValue() {
    if (this.supplier instanceof Function) return this.supplier();
    return null;
  }
}

module.exports = {
  WavefrontSDKGauge
};
