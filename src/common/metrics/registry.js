const WavefrontSDKCounter = require('./counter').WavefrontSDKCounter;
const WavefrontSDKGauge = require('./gauge').WavefrontSDKGauge;

/**
 * Wavefront SDK Metrics Registry.
 */
class WavefrontSdkMetricsRegistry {
  /**
   * Construct Wavefront SDK Metrics Registry.
   * @param wfMetricSender
   * @param source
   * @param tags
   * @param prefix
   * @param reportingIntervalSecs
   */
  constructor({
    wfMetricSender,
    source = null,
    tags = null,
    prefix = null,
    reportingIntervalSecs = 60
  }) {
    this.wfMetricSender = wfMetricSender;
    this.source = source;
    this.tags = tags;
    this.prefix = prefix ? prefix + '.' : '';
    this.reportingIntervalSecs = reportingIntervalSecs;
    this.metrics = new Map();
    this._timer = null;
    if (wfMetricSender) {
      this._scheduleTimer();
    }
  }

  /**
   * Schedule timer for the internal metric sender.
   * @private
   */
  _scheduleTimer() {
    this._timer = setInterval(() => this._report(), this.reportingIntervalSecs);
  }

  /**
   * Close the internal metric sender.
   * @param timeoutSecs
   */
  close(timeoutSecs = null) {
    try {
      if (this.wfMetricSender) this._report(timeoutSecs);
    } finally {
      if (this._timer) {
        clearInterval(this._timer);
      }
    }
  }

  /**
   * Report internal SDK metric to Wavefront.
   * @param timeoutSecs
   * @private
   */
  _report(timeoutSecs = null) {
    let timestamp = Date.now();
    for (const [key, val] of this.metrics.entries()) {
      if (timeoutSecs && Date.now() - timestamp > timeoutSecs) break;

      let name = this.prefix + key;
      if (val instanceof WavefrontSDKGauge) {
        let gaugeVal = val.getValue();
        if (gaugeVal) {
          this.wfMetricSender.sendMetric(
            name,
            gaugeVal,
            timestamp,
            this.source,
            this.tags
          );
        }
      } else if (val instanceof WavefrontSDKCounter) {
        this.wfMetricSender.sendMetric(
          name + '.count',
          val.count(),
          timestamp,
          this.source,
          this.tags
        );
      }
    }
  }

  /**
   * Get or create a counter from the registry.
   * @param name
   * @returns {WavefrontSDKCounter}
   */
  newCounter(name) {
    return this._getOrAdd(name, new WavefrontSDKCounter());
  }

  /**
   * Get or create a gauge from the registry.
   * @param name
   * @param supplier
   * @returns {WavefrontSDKGauge}
   */
  newGauge(name, supplier) {
    return this._getOrAdd(name, new WavefrontSDKGauge(supplier));
  }

  _getOrAdd(name, metric) {
    let existingMetric = this.metrics[name];
    if (existingMetric) return existingMetric;
    this.metrics[name] = metric;
    return metric;
  }
}

module.exports = {
  WavefrontSdkMetricsRegistry
};
