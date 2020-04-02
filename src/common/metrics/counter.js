const Metrics = require('./metrics').Metrics;

/**
 * Wavefront SDK Counter.
 */
class WavefrontSDKCounter extends Metrics {
  /**
   * Construct Wavefront SDK Counter.
   */
  constructor() {
    super();
    this._count = 0;
  }

  /**
   * Increase the value of the counter.
   * @param val
   */
  inc(val = 1) {
    this._count += val;
  }

  /**
   * Get the value of the counter.
   * @returns {number}
   */
  count() {
    return this._count;
  }

  /**
   * Reset the counter.
   */
  clear() {
    this._count = 0;
  }
}

module.exports = {
  WavefrontSDKCounter
};
