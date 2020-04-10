/**
 * Wavefront SDK Gauge.
 */

class WavefrontSDKGauge {
  /**
   * Construct Wavefront SDK Gauge.
   * @param supplier
   */
  constructor(supplier) {
    // Returns the value of the gauge.
    this.getValue = supplier;
  }
}

module.exports = {
  WavefrontSDKGauge
};
