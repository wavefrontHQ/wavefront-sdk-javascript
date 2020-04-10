/**
 * Wavefront SDK Gauge.
 */
export default class WavefrontSDKGauge {
  /**
   * Construct Wavefront SDK Gauge.
   * @param supplier
   */
  constructor(supplier) {
    // Returns the value of the gauge.
    this.getValue = supplier;
  }
}
