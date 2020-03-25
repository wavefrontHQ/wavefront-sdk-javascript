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
    self.wfMetricSender = wfMetricSender;
    self.source = source;
    self.tags = tags;
    self.prefix = prefix ? prefix + '.' : '';
    self.reportingIntervalSecs = reportingIntervalSecs;
    self.metrics = {};
    self._closed = false;
    self._timer = null;
    if (wfMetricSender) {
      self._scheduleTimer();
    }
  }

  _scheduleTimer() {
    if (!self._closed) {
      self._timer = setInterval(this._run, self.reportingIntervalSecs);
    }
  }

  _run() {
    try {
      self._report();
    } finally {
      if (!self.closed) {
        self._scheduleTimer();
      }
    }
  }

  close(timeoutSecs = null) {
    try {
      if (self.wfMetricSender) self._report(timeoutSecs);
    } finally {
      self._closed = true;
      if (self._timer) {
        clearInterval(self._timer);
      }
    }
  }

  _report(timeoutSecs = null) {
    let timestamp = Date.now();
    for (const [key, val] of self.metrics.entries()) {
      if (timeoutSecs && Date.now() - timestamp > timeoutSecs) break;

      let name = self.prefix + key;
      try {
        if (val instanceof WavefrontSDKGauge) {
          let gaugeVal = val.getValue();
          if (gaugeVal) {
            // TODO: implement sendMetric
            self.wfMetricSender.sendMetric(
              name,
              gaugeVal,
              timestamp,
              self.source,
              self.tags
            );
          }
        } else if (val instanceof WavefrontSDKCounter) {
          self.wfMetricSender.sendMetric(
            name + '.count',
            val.count(),
            timestamp,
            self.source,
            self.tags
          );
        }
      } catch (error) {
        // TODO: find better logging intetrface
        console.log('Unable to send internal SDK metric.');
      }
    }
  }

  newCounter(name) {
    return self._getOrAdd(name, new WavefrontSDKCounter());
  }

  newGauge(name, supplier) {
    return self._getOrAdd(name, new WavefrontSDKGauge(supplier));
  }

  _getOrAdd(name, metric) {
    let existingMetric = self.metrics[name];
    if (existingMetric) return existingMetric;
    self.metrics[name] = metric;
    return metric;
  }
}

module.exports = {
  WavefrontSdkMetricsRegistry
};
