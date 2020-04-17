import { Queue } from './common/utils';
import * as utils from './common/utils';
import * as constants from './common/constants';
import WavefrontSDKMetricsRegistry from './common/metrics/registry';

require('isomorphic-fetch');
const pako = require('pako');

/**
 * Wavefront direct ingestion client.
 * Sends data directly to Wavefront cluster via the direct ingestion API.
 */
export default class WavefrontDirectClient {
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
    flushIntervalSeconds = 5,
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
      this._sdkMetricsRegistry = new WavefrontSDKMetricsRegistry({
        wfMetricSender: this,
        prefix: `${constants.SDK_METRIC_PREFIX}.core.sender.direct`
      });
    } else {
      this._sdkMetricsRegistry = new WavefrontSDKMetricsRegistry({
        wfMetricSender: null
      });
    }

    // Setup counters and gauges for SDK metrics
    const counterMap = ['points', 'histograms', 'spans', 'spanLogs'].map(t => ({
      [`_${t}Valid`]: `${t}.valid`,
      [`_${t}Invalid`]: `${t}.invalid`,
      [`_${t}Dropped`]: `${t}.dropped`,
      [`_${t}ReportErrors`]: `${t}.report.errors`
    }));
    for (const m of counterMap) {
      Object.entries(m).forEach(([key, value]) => {
        this[key] = this._sdkMetricsRegistry.newCounter(value);
      });
    }
    const gaugeMap = [
      ['points.queue.size', this._metricsBuffer.size],
      ['points.queue.remaining_capacity', this._metricsBuffer.remainCapacity],
      ['histograms.queue.size', this._histogramsBuffer.size],
      [
        'histograms.queue.remaining_capacity',
        this._histogramsBuffer.remainCapacity
      ],
      ['spans.queue.size', this._tracingSpansBuffer.size],
      [
        'spans.queue.remaining_capacity',
        this._tracingSpansBuffer.remainCapacity
      ],
      ['span_logs.queue.size', this._spanLogsBuffer.size],
      [
        'span_logs.queue.remaining_capacity',
        this._spanLogsBuffer.remainCapacity
      ]
    ];
    gaugeMap.forEach(g => this._sdkMetricsRegistry.newGauge(g[0], g[1]));
  }

  /**
   * Schedule a timer that flush every 5 seconds by default
   */
  _scheduleTimer() {
    this._timer = setInterval(() => {
      this._batchReport(
        this._metricsBuffer.toArray(),
        constants.WAVEFRONT_METRIC_FORMAT,
        'points',
        this._pointsReportErrors
      );
      this._batchReport(
        this._histogramsBuffer.toArray(),
        constants.WAVEFRONT_HISTOGRAM_FORMAT,
        'histograms',
        this._histogramsReportErrors
      );
      this._batchReport(
        this._tracingSpansBuffer.toArray(),
        constants.WAVEFRONT_TRACING_SPAN_FORMAT,
        'spans',
        this._spansReportErrors
      );
      this._batchReport(
        this._spanLogsBuffer.toArray(),
        constants.WAVEFRONT_SPAN_LOG_FORMAT,
        'span_logs',
        this._spanLogsReportErrors
      );
    }, this._flushIntervalSeconds);
  }

  /**
   * Report data to server, and record metrics
   */
  async _reportToServer(options, dataFormat, entityPrefix, reportErrors) {
    // TODO: only absolute URLs are supported
    const url = `${this.server.replace(/\w+:/, '')}/report/?f=${dataFormat}`;
    return await fetch(encodeURI(url), options).then(function(response) {
      if (!response.ok) {
        reportErrors.inc();
        console.error(response.statusText);
      }
      return response.status;
    });
  }

  /**
   * Api call that compress and send given string data.
   * @param points - List of data in string format, concat by '\n'
   * @param {string} dataFormat - Type of data to be sent
   * @param {string} entityPrefix
   * @param reportErrors
   */
  _report(points, dataFormat, entityPrefix, reportErrors) {
    let options = {
      method: 'POST',
      headers: this._headers
    };
    const compressedPoints = pako.gzip(points);
    options.headers['Content-Encoding'] = 'gzip';
    options.headers['Content-Length'] = compressedPoints.length;
    options['body'] = Buffer.from(compressedPoints);
    this._reportToServer(options, dataFormat, entityPrefix, reportErrors).then(
      statusCode => {
        this._sdkMetricsRegistry
          .newCounter(`${entityPrefix}.report.${statusCode}`)
          .inc();
      }
    );
  }

  /**
   * One api call sending one given list of data.
   * @param batchLineData {Array}
   * @param dataFormat {string}
   * @param entityPrefix {string}
   * @param reportErrors {string}
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
      this._metricsBuffer.toArray(),
      constants.WAVEFRONT_METRIC_FORMAT,
      'points',
      this._pointsReportErrors
    );
    this._batchReport(
      this._histogramsBuffer.toArray(),
      constants.WAVEFRONT_HISTOGRAM_FORMAT,
      'histograms',
      this._histogramsReportErrors
    );
    this._batchReport(
      this._tracingSpansBuffer.toArray(),
      constants.WAVEFRONT_TRACING_SPAN_FORMAT,
      'spans',
      this._spansReportErrors
    );
    this._batchReport(
      this._spanLogsBuffer.toArray(),
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
   * @param {Object} tags
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
   * @param {Object} tags
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
