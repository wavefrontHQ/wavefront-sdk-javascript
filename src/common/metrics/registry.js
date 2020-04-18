import WavefrontSDKCounter from './counter';
import WavefrontSDKGauge from './gauge';

/**
 * Wavefront SDK Metrics Registry.
 */
export default class WavefrontSDKMetricsRegistry {
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
    this.prefix = prefix ? `${prefix}.` : '';
    this.reportingIntervalSecs =
      reportingIntervalSecs > 0 ? reportingIntervalSecs : 60;
    this.metrics = {};
    this._timer = null;
    if (wfMetricSender) {
      this._scheduleTimer();
    }
  }

  /**
   * Schedule timer for the internal metric sender.
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
   */
  _report(timeoutSecs = null) {
    const timestamp = Date.now();
    for (const [key, val] of Object.entries(this.metrics)) {
      if (timeoutSecs && Date.now() - timestamp > timeoutSecs * 1000) break;

      const name = this.prefix + key;
      if (val instanceof WavefrontSDKGauge) {
        const gaugeVal = val.getValue();
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
    return this._getOrAdd(name, WavefrontSDKCounter);
  }

  /**
   * Get or create a gauge from the registry.
   * @param name
   * @param supplier
   * @returns {WavefrontSDKGauge}
   */
  newGauge(name, supplier) {
    return this._getOrAdd(name, WavefrontSDKGauge, supplier);
  }

  _getOrAdd(name, initializer, supplier = null) {
    let existingMetric = this.metrics[name];
    if (existingMetric) return existingMetric;
    this.metrics[name] = supplier
      ? new initializer(supplier)
      : new initializer();
    return this.metrics[name];
  }
}
