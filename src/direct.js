const utils = require('./common/utils');
const constants = require('./common/constants');
const Queue = utils.Queue;
const WavefrontSdkMetricsRegistry = require('./common/metrics/registry')
  .WavefrontSdkMetricsRegistry;

class WavefrontDirectClient {
  static WAVEFRONT_METRIC_FORMAT = 'wavefront';
  static WAVEFRONT_HISTOGRAM_FORMAT = 'histogram';
  static WAVEFRONT_TRACING_SPAN_FORMAT = 'trace';
  static WAVEFRONT_SPAN_LOG_FORMAT = 'spanLogs';

  constructor(
    server,
    token,
    maxQueueSize = 50000,
    batchSize = 10000,
    flushIntervalSeconds = 5,
    enableInternalMetrics = true
  ) {
    self.server = server;
    self._token = token;
    self._maxQueueSize = maxQueueSize;
    self._batchSize = batchSize;
    self._flushIntervalSeconds = flushIntervalSeconds;
    // TODO: socket
    self._defaultSource = null;
    // TODO: implement JS queue
    self._metricsBuffer = new Queue(maxQueueSize);
    self._histogramsBuffer = new Queue(maxQueueSize);
    self._tracingSpansBuffer = new Queue(maxQueueSize);
    self._spanLogsBuffer = new Queue(maxQueueSize);
    self._headers = {
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'gzip',
      Authorization: 'Bearer ' + token
    };
    self._closed = false;
    self._timer = null;
    self._scheduleTimer();

    if (enableInternalMetrics) {
      // TODO: test destructuring
      self._sdkMetricsRegistry = WavefrontSdkMetricsRegistry({
        wfMetricSender: self,
        prefix: `${constants.SDK_METRIC_PREFIX}.core.sender.direct`
      });
    } else {
      self._sdkMetricsRegistry = WavefrontSdkMetricsRegistry({
        wfMetricSender: null
      });
    }

    // TODO: add queue size() function
    self._sdkMetricsRegistry.newGauge(
      'points.queue.size',
      self._metricsBuffer.size()
    );
    self._sdkMetricsRegistry.newGauge(
      'points.queue.remaining_capacity',
      self._metricsBuffer.remainCapacity()
    );
    self._pointsValid = self._sdkMetricsRegistry.newCounter('points.valid');
    self._pointsInvalid = self._sdkMetricsRegistry.newCounter('points.invalid');
    self._pointsDropped = self._sdkMetricsRegistry.newCounter('points.dropped');
    self._pointsReportErrors = self._sdkMetricsRegistry.newCounter(
      'points.report.errors'
    );

    self._sdkMetricsRegistry.newGauge(
      'histograms.queue.size',
      self._histogramsBuffer.size()
    );
    self._sdkMetricsRegistry.newGauge(
      'histograms.queue.remaining_capacity',
      self._histogramsBuffer.remainCapacity()
    );
    self._histogramsValid = self._sdkMetricsRegistry.newCounter(
      'histograms.valid'
    );
    self._histogramsInvalid = self._sdkMetricsRegistry.newCounter(
      'histograms.invalid'
    );
    self._histogramsDropped = self._sdkMetricsRegistry.newCounter(
      'histograms.dropped'
    );
    self._histogramsReportErrors = self._sdkMetricsRegistry.newCounter(
      'histograms.report.errors'
    );

    self._sdkMetricsRegistry.newGauge(
      'spans.queue.size',
      self._tracingSpansBuffer.size()
    );
    self._sdkMetricsRegistry.newGauge(
      'spans.queue.remaining_capacity',
      self._tracingSpansBuffer.remainCapacity()
    );
    self._spansValid = self._sdkMetricsRegistry.newCounter('spans.valid');
    self._spansInvalid = self._sdkMetricsRegistry.newCounter('spans.invalid');
    self._spansDropped = self._sdkMetricsRegistry.newCounter('spans.dropped');
    self._spansReportErrors = self._sdkMetricsRegistry.newCounter(
      'spans.report.errors'
    );

    self._sdkMetricsRegistry.newGauge(
      'span_logs.queue.size',
      self._spanLogsBuffer.size()
    );
    self._sdkMetricsRegistry.newGauge(
      'span_logs.queue.remaining_capacity',
      self._spanLogsBuffer.remainCapacity()
    );
    self._spanLogsValid = self._sdkMetricsRegistry.newCounter(
      'span_logs.valid'
    );
    self._spanLogsInvalid = self._sdkMetricsRegistry.newCounter(
      'span_logs.invalid'
    );
    self._spanLogsDropped = self._sdkMetricsRegistry.newCounter(
      'span_logs.dropped'
    );
    self._spanLogsReportErrors = self._sdkMetricsRegistry.newCounter(
      'span_logs.report.errors'
    );
  }

  _scheduleTimer() {
    // Flush every 5 seconds by default
    if (!self._closed) {
      self._timer = setInterval(this._flush, self._flushIntervalSeconds);
    }
  }

  // TODO: test report function
  // TODO: util compress data
  _report(points, dataFormat, entityPrefix, reportErrors) {
    let compressedData = null;
    let url = self.server + '/report';
    fetch(url, {
      method: 'POST',
      headers: self._headers,
      data: compressedData
    })
      .then(response => response.json())
      .then(data => {
        console.log('Success:', data);
      })
      .catch(error => {
        reportErrors.inc();
        console.error('Error:', error);
      });
  }

  // TODO: use HTTP to report to server
  _batchReport(batchLineData, dataFormat, entityPrefix, reportErrors) {}

  _internalFlush(dataBuffer, dataFormat, entityPrefix, reportErrors) {
    // Get all data from one data buffer to a list, and report that list
  }

  _flush() {}

  _flushNow() {
    // Flush all the data buffer immediately using _batchReport
  }

  close() {}

  send_metric(name, value, timestamp, source, tags) {
    let lineData;
    try {
      lineData = util.metricToLineData(
        name,
        value,
        timestamp,
        source,
        tags,
        self._defaultSource
      );
      self._pointsValid.inc();
    } catch (error) {
      self._pointsInvalid.inc();
      console.error(error);
    }
    try {
      self._metricsBuffer.push(lineData);
    } catch (error) {
      self._pointsDropped.inc();
      console.error(error);
    }
  }

  sendMetricNow(metrics) {
    self._batchReport(
      metrics,
      self.WAVEFRONT_METRIC_FORMAT,
      'points',
      self._pointsReportErrors
    );
  }

  sendDistribution(
    name,
    centroids,
    histogramGranularities,
    timestamp,
    source,
    tags
  ) {
    let lineData;
    try {
      lineData = util.histogramToLineData(
        name,
        centroids,
        histogramGranularities,
        timestamp,
        source,
        tags,
        self._defaultSource
      );
      self._histogramsValid.inc();
    } catch (error) {
      self._histogramsInvalid.inc();
      console.error(error);
    }
    try {
      self._histogramsBuffer.push(lineData);
    } catch (error) {
      self._histogramsDropped.inc();
      console.error(error);
    }
  }

  sendDistributionNow(distributions) {
    self._batchReport(
      distributions,
      self.WAVEFRONT_HISTOGRAM_FORMAT,
      'histograms',
      self._histogramsReportErrors
    );
  }

  sendSpan(
    name,
    startMillis,
    durationMillis,
    source,
    traceId,
    spanId,
    parents,
    followsFrom,
    tags,
    spanLogs
  ) {
    let lineData;
    try {
      lineData = utils.tracingSpanToLineData(
        name,
        startMillis,
        durationMillis,
        source,
        traceId,
        spanId,
        parents,
        followsFrom,
        tags,
        spanLogs,
        self._defaultSource
      );
      self._spansValid.inc();
    } catch (error) {
      self._spansInvalid.inc();
      console.error(error);
    }
    try {
      self._tracingSpansBuffer.inc();
    } catch (error) {
      self._spansDropped.inc();
      console.error(error);
    }
    if (spanLogs) {
      let spanLineData;
      try {
        spanLineData = utils.spanLogToLineData(traceId, spanId, spanLogs);
        self._spanLogsValid.inc();
      } catch (error) {
        self._spanLogsInvalid.inc();
        console.error(error);
      }
      try {
        self._spanLogsBuffer.push(spanLineData);
      } catch (error) {
        self._spanLogsDropped.inc();
        console.error(error);
      }
    }
  }

  sendSpanNow(spans) {
    self._batchReport(
      spans,
      self.WAVEFRONT_TRACING_SPAN_FORMAT,
      'spans',
      self._spansReportErrors
    );
  }

  sendSpanLogNow(spanLogs) {
    self._batchReport(
      spanLogs,
      self.WAVEFRONT_SPAN_LOG_FORMAT,
      'span_logs',
      self._spanLogsReportErrors
    );
  }

  getFailureCount() {
    return (
      self._pointsReportErrors.count() +
      self._histogramsReportErrors.count() +
      self._spansReportErrors.count() +
      self._spanLogsReportErrors.count()
    );
  }
}

module.exports = {
  WavefrontDirectClient
};
