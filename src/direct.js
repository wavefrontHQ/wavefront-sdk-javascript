const utils = require('./common/utils'),
  constants = require('./common/constants'),
  Queue = utils.Queue,
  WavefrontSdkMetricsRegistry = require('./common/metrics/registry')
    .WavefrontSdkMetricsRegistry,
  https = require('https'),
  zlib = require('zlib');

/**
 * Wavefront direct ingestion client.
 * Sends data directly to Wavefront cluster via the direct ingestion API.
 */
class WavefrontDirectClient {
  /**
   * Construct Direct Client.
   * @param server - Server address, Example: https://INSTANCE.wavefront.com
   * @param token - Token with Direct Data Ingestion permission granted
   * @param maxQueueSize - Size of internal data buffer for each data type
   * @param batchSize - Amount of data sent by one api call
   * @param flushIntervalSeconds - Interval flush interval
   * @param enableInternalMetrics
   */
  constructor({
    server,
    token,
    maxQueueSize = 50000,
    batchSize = 10000,
    flushIntervalSeconds = 1,
    enableInternalMetrics = true
  }) {
    this.server = server;
    this._batchSize = batchSize;
    this._flushIntervalSeconds = flushIntervalSeconds;
    this._defaultSource = null;
    this._metricsBuffer = new Queue(maxQueueSize);
    this._histogramsBuffer = new Queue(maxQueueSize);
    this._tracingSpansBuffer = new Queue(maxQueueSize);
    this._spanLogsBuffer = new Queue(maxQueueSize);
    this._headers = {
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'gzip',
      Authorization: 'Bearer ' + token
    };
    this._timer = null;
    this._scheduleTimer();

    if (enableInternalMetrics) {
      this._sdkMetricsRegistry = new WavefrontSdkMetricsRegistry({
        wfMetricSender: this,
        prefix: `${constants.SDK_METRIC_PREFIX}.core.sender.direct`
      });
    } else {
      this._sdkMetricsRegistry = new WavefrontSdkMetricsRegistry({
        wfMetricSender: null
      });
    }

    this._sdkMetricsRegistry.newGauge(
      'points.queue.size',
      this._metricsBuffer.size()
    );
    this._sdkMetricsRegistry.newGauge(
      'points.queue.remaining_capacity',
      this._metricsBuffer.remainCapacity()
    );
    this._pointsValid = this._sdkMetricsRegistry.newCounter('points.valid');
    this._pointsInvalid = this._sdkMetricsRegistry.newCounter('points.invalid');
    this._pointsDropped = this._sdkMetricsRegistry.newCounter('points.dropped');
    this._pointsReportErrors = this._sdkMetricsRegistry.newCounter(
      'points.report.errors'
    );

    this._sdkMetricsRegistry.newGauge(
      'histograms.queue.size',
      this._histogramsBuffer.size()
    );
    this._sdkMetricsRegistry.newGauge(
      'histograms.queue.remaining_capacity',
      this._histogramsBuffer.remainCapacity()
    );
    this._histogramsValid = this._sdkMetricsRegistry.newCounter(
      'histograms.valid'
    );
    this._histogramsInvalid = this._sdkMetricsRegistry.newCounter(
      'histograms.invalid'
    );
    this._histogramsDropped = this._sdkMetricsRegistry.newCounter(
      'histograms.dropped'
    );
    this._histogramsReportErrors = this._sdkMetricsRegistry.newCounter(
      'histograms.report.errors'
    );

    this._sdkMetricsRegistry.newGauge(
      'spans.queue.size',
      this._tracingSpansBuffer.size()
    );
    this._sdkMetricsRegistry.newGauge(
      'spans.queue.remaining_capacity',
      this._tracingSpansBuffer.remainCapacity()
    );
    this._spansValid = this._sdkMetricsRegistry.newCounter('spans.valid');
    this._spansInvalid = this._sdkMetricsRegistry.newCounter('spans.invalid');
    this._spansDropped = this._sdkMetricsRegistry.newCounter('spans.dropped');
    this._spansReportErrors = this._sdkMetricsRegistry.newCounter(
      'spans.report.errors'
    );

    this._sdkMetricsRegistry.newGauge(
      'span_logs.queue.size',
      this._spanLogsBuffer.size()
    );
    this._sdkMetricsRegistry.newGauge(
      'span_logs.queue.remaining_capacity',
      this._spanLogsBuffer.remainCapacity()
    );
    this._spanLogsValid = this._sdkMetricsRegistry.newCounter(
      'span_logs.valid'
    );
    this._spanLogsInvalid = this._sdkMetricsRegistry.newCounter(
      'span_logs.invalid'
    );
    this._spanLogsDropped = this._sdkMetricsRegistry.newCounter(
      'span_logs.dropped'
    );
    this._spanLogsReportErrors = this._sdkMetricsRegistry.newCounter(
      'span_logs.report.errors'
    );
  }

  /**
   * Schedule a timer that flush every 5 seconds by default
   */
  _scheduleTimer() {
    this._timer = setInterval(() => {
      this._batchReport(
        this._metricsBuffer.toArray,
        constants.WAVEFRONT_METRIC_FORMAT,
        'points',
        this._pointsReportErrors
      );
      this._batchReport(
        this._histogramsBuffer.toArray,
        constants.WAVEFRONT_HISTOGRAM_FORMAT,
        'histograms',
        this._histogramsReportErrors
      );
      this._batchReport(
        this._tracingSpansBuffer.toArray,
        constants.WAVEFRONT_TRACING_SPAN_FORMAT,
        'spans',
        this._spansReportErrors
      );
      this._batchReport(
        this._spanLogsBuffer.toArray,
        constants.WAVEFRONT_SPAN_LOG_FORMAT,
        'span_logs',
        this._spanLogsReportErrors
      );
    }, this._flushIntervalSeconds);
  }

  /**
   * Report data to server, and record metrics
   */
  _reportToServer(data, options, entityPrefix, reportErrors) {
    let req = https.request(options, res => {
      res.on('data', d => {
        process.stdout.write(d);
      });
    });

    req.on('error', e => {
      reportErrors.inc();
      console.error(e);
    });

    req.on('response', res => {
      this._sdkMetricsRegistry
        .newCounter(`${entityPrefix}.report.${res.statusCode}`)
        .inc();
    });
    req.write(data);
    req.end();
  }

  /**
   * One api call sending one given string data.
   * @param {string} points - List of data in string format, concat by '\n'
   * @param {string} dataFormat - Type of data to be sent
   * @param {string} entityPrefix
   * @param reportErrors
   * @private
   */
  _report(points, dataFormat, entityPrefix, reportErrors) {
    let options = {
      hostname: this.server,
      path: `/report/?f=${dataFormat}`,
      method: 'POST',
      headers: this._headers
    };
    zlib.gzip(points, (err, compressedPoints) => {
      if (!err) {
        options.headers['Content-Encoding'] = 'gzip';
        options.headers['Content-Length'] = compressedPoints.length;
        this._reportToServer(
          compressedPoints,
          options,
          entityPrefix,
          reportErrors
        );
      } else {
        console.error('Error compressing data');
        options.headers['Content-Length'] = points.length;
        this._reportToServer(points, options, entityPrefix, reportErrors);
      }
    });
  }

  /**
   * One api call sending one given list of data.
   * @param batchLineData {Array}
   * @param dataFormat {string}
   * @param entityPrefix {string}
   * @param reportErrors {string}
   * @private
   */
  _batchReport(batchLineData, dataFormat, entityPrefix, reportErrors) {
    for (let batch of utils.getChunks(batchLineData, this._batchSize)) {
      try {
        this._report(batch.join('\n'), dataFormat, entityPrefix, reportErrors);
      } catch (error) {
        console.error(
          `Failed to report ${dataFormat} data points to wavefront ${error}`
        );
      }
    }
  }

  /**
   * Flush all buffer and close the client.
   */
  close() {
    this._batchReport(
      this._metricsBuffer.toArray,
      constants.WAVEFRONT_METRIC_FORMAT,
      'points',
      this._pointsReportErrors
    );
    this._batchReport(
      this._histogramsBuffer.toArray,
      constants.WAVEFRONT_HISTOGRAM_FORMAT,
      'histograms',
      this._histogramsReportErrors
    );
    this._batchReport(
      this._tracingSpansBuffer.toArray,
      constants.WAVEFRONT_TRACING_SPAN_FORMAT,
      'spans',
      this._spansReportErrors
    );
    this._batchReport(
      this._spanLogsBuffer.toArray,
      constants.WAVEFRONT_SPAN_LOG_FORMAT,
      'span_logs',
      this._spanLogsReportErrors
    );
    clearInterval(this._timer);
    this._sdkMetricsRegistry.close(1);
  }

  /**
   * Send Metric Data via direct ingest.
   * @param {string} name - Metric name
   * @param {number} value - Metric value
   * @param {Number} timestamp
   * @param {string} source
   * @param {Map} tags
   */
  sendMetric(name, value, timestamp, source, tags) {
    let lineData;
    try {
      lineData = utils.metricToLineData(
        name,
        value,
        timestamp,
        source,
        tags,
        this._defaultSource
      );
      this._pointsValid.inc();
    } catch (error) {
      this._pointsInvalid.inc();
      console.error(error);
    }
    try {
      this._metricsBuffer.push(lineData);
    } catch (error) {
      this._pointsDropped.inc();
      console.error(error);
    }
  }

  /**
   * Send a list of metrics immediately.
   * Have to construct the data manually by calling
   * common.utils.metricToLineData()
   * @param {Array} metrics - Array of string metrics data
   */
  sendMetricNow(metrics) {
    this._batchReport(
      metrics,
      constants.WAVEFRONT_METRIC_FORMAT,
      'points',
      this._pointsReportErrors
    );
  }

  /**
   * Send Distribution Data via direct ingestion.
   * @param {string} name - Histogram name
   * @param {Array} centroids - Array of centroids(pairs)
   * @param {Set} histogramGranularities
   * @param {Number} timestamp
   * @param {string} source
   * @param {Map} tags
   */
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
      lineData = utils.histogramToLineData(
        name,
        centroids,
        histogramGranularities,
        timestamp,
        source,
        tags,
        this._defaultSource
      );
      this._histogramsValid.inc();
    } catch (error) {
      this._histogramsInvalid.inc();
      console.error(error);
    }
    try {
      this._histogramsBuffer.push(lineData);
    } catch (error) {
      this._histogramsDropped.inc();
      console.error(error);
    }
  }

  /**
   * Send a list of distribution immediately.
   * Have to construct the data manually by calling
   * common.utils.histogramToLineData()
   * @param {Array} distributions - Array of string histogram data
   */
  sendDistributionNow(distributions) {
    this._batchReport(
      distributions,
      constants.WAVEFRONT_HISTOGRAM_FORMAT,
      'histograms',
      this._histogramsReportErrors
    );
  }

  /**
   * Send span data via direct ingestion.
   * @param {string} name - Span name
   * @param {number} startMillis
   * @param {number} durationMillis
   * @param {string} source
   * @param {string} traceId
   * @param {string} spanId
   * @param {Array} parents - Parents span ID
   * @param {Array} followsFrom
   * @param {Array} tags
   * @param spanLogs
   */
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
        this._defaultSource
      );
      this._spansValid.inc();
    } catch (error) {
      this._spansInvalid.inc();
      console.error(error);
    }
    try {
      this._tracingSpansBuffer.push(lineData);
    } catch (error) {
      this._spansDropped.inc();
      console.error(error);
    }
    if (spanLogs) {
      let spanLineData;
      try {
        spanLineData = utils.spanLogToLineData(traceId, spanId, spanLogs);
        this._spanLogsValid.inc();
      } catch (error) {
        this._spanLogsInvalid.inc();
        console.error(error);
      }
      try {
        this._spanLogsBuffer.push(spanLineData);
      } catch (error) {
        this._spanLogsDropped.inc();
        console.error(error);
      }
    }
  }

  /**
   * Send a list of spans immediately.
   * Have to construct the data manually by calling
   * common.utils.tracingSpanToLineData()
   * @param {Array} spans - List of string spans data
   */
  sendSpanNow(spans) {
    this._batchReport(
      spans,
      constants.WAVEFRONT_TRACING_SPAN_FORMAT,
      'spans',
      this._spansReportErrors
    );
  }

  /**
   * Send a list of span logs immediately.
   * Have to construct the data manually by calling
   * common.utils.spanLogToLineData()
   * @param {Array} spanLogs - List of string span logs data
   */
  sendSpanLogNow(spanLogs) {
    this._batchReport(
      spanLogs,
      constants.WAVEFRONT_SPAN_LOG_FORMAT,
      'span_logs',
      this._spanLogsReportErrors
    );
  }

  /**
   * Get failure count for one connection.
   * @returns {number}
   */
  getFailureCount() {
    return (
      this._pointsReportErrors.count() +
      this._histogramsReportErrors.count() +
      this._spansReportErrors.count() +
      this._spanLogsReportErrors.count()
    );
  }
}

module.exports = {
  WavefrontDirectClient
};
