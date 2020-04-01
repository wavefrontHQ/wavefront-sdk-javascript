const WavefrontSDKCounter = require('./counter').WavefrontSDKCounter;
const WavefrontSDKGauge = require('./gauge').WavefrontSDKGauge;

class WavefrontSdkMetricsRegistry {
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
    this._closed = false;
    this._timer = null;
    if (wfMetricSender) {
      this._scheduleTimer();
    }
  }

  _scheduleTimer() {
    if (!this._closed) {
      this._timer = setInterval(
        () => this._report(),
        this.reportingIntervalSecs
      );
    }
  }

  close(timeoutSecs = null) {
    try {
      if (this.wfMetricSender) this._report(timeoutSecs);
    } finally {
      this._closed = true;
      if (this._timer) {
        clearInterval(this._timer);
      }
    }
  }

  _report(timeoutSecs = null) {
    let timestamp = Date.now();
    for (const [key, val] of this.metrics.entries()) {
      if (timeoutSecs && Date.now() - timestamp > timeoutSecs) break;

      let name = this.prefix + key;
      try {
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
      } catch (error) {
        // TODO: find better logging interface
        console.log('Unable to send internal SDK metric.');
      }
    }
  }

  newCounter(name) {
    return this._getOrAdd(name, new WavefrontSDKCounter());
  }

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
