/**
 * Wavefront SDK Gauge.
 */
class WavefrontSDKGauge {
  /**
   * Construct Wavefront SDK Gauge.
   * @param supplier
   */
  constructor(supplier) {
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
