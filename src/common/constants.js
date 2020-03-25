const SDK_METRIC_PREFIX = '~sdk.javascript';

const SPAN_LOG_KEY = '_spanLogs';

// Define static class properties
const WAVEFRONT_METRIC_FORMAT = 'wavefront';
const WAVEFRONT_HISTOGRAM_FORMAT = 'histogram';
const WAVEFRONT_TRACING_SPAN_FORMAT = 'trace';
const WAVEFRONT_SPAN_LOG_FORMAT = 'spanLogs';

module.exports = {
  SDK_METRIC_PREFIX,
  SPAN_LOG_KEY,
  WAVEFRONT_METRIC_FORMAT,
  WAVEFRONT_HISTOGRAM_FORMAT,
  WAVEFRONT_TRACING_SPAN_FORMAT,
  WAVEFRONT_SPAN_LOG_FORMAT
};
