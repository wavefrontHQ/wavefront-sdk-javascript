const {
  APPLICATION_TAG_KEY,
  CLUSTER_TAG_KEY,
  SERVICE_TAG_KEY,
  SHARD_TAG_KEY,
  COMPONENT_TAG_KEY,
  HEART_BEAT_METRIC,
  HEART_BEAT_INTERVAL,
  NULL_TAG_VAL
} = require('./constants');

/**
 * Service that periodically reports component heartbeats to Wavefront.
 */
class HeartbeatService {
  /**
   *
   * @param {WavefrontDirectClient} wavefrontClient
   * @param applicationTags
   * @param {Array} components - Array of string indicates Components.
   * @param source
   */
  constructor(wavefrontClient, applicationTags, components, source) {
    this.wavefrontClient = wavefrontClient;
    this.applicationTags = applicationTags;
    this.source = source;
    this.reportingIntervalSeconds = HEART_BEAT_INTERVAL;
    this.heartbeatMetricTagsList = [];
    this.customTagsSet = new Set();

    if (!Array.isArray(components)) {
      components = [components];
    }

    for (let component of components) {
      let metricTags = {
        [APPLICATION_TAG_KEY]: applicationTags.application,
        [CLUSTER_TAG_KEY]: applicationTags.cluster || NULL_TAG_VAL,
        [SERVICE_TAG_KEY]: applicationTags.service,
        [SHARD_TAG_KEY]: applicationTags.shard || NULL_TAG_VAL,
        [COMPONENT_TAG_KEY]: component
      };

      if (applicationTags.customTags) {
        metricTags = { ...applicationTags.customTags, ...metricTags };
      }
      this.heartbeatMetricTagsList.push(metricTags);
    }
    this._timer = null;
    this._run();
  }

  /**
   * Schedule the timer to report.
   */
  _run() {
    this._timer = setInterval(this._report, this.reportingIntervalSeconds);
  }

  _report() {
    this.heartbeatMetricTagsList.forEach(heartbeat => {
      this.wavefrontClient.sendMetric(
        HEART_BEAT_METRIC,
        1.0,
        Date.now(),
        this.source,
        heartbeat
      );
    });
    this.customTagsSet.forEach(customTagsMap => {
      this.wavefrontClient.sendMetric(
        HEART_BEAT_METRIC,
        1.0,
        Date.now(),
        this.source,
        customTagsMap
      );
      this.customTagsSet.delete(customTagsMap);
    });
  }

  /**
   * Add custom tags for heartbeat reporting.
   * @param customTags - Map of custom tags.
   */
  reportCustomTags(customTags) {
    this.customTagsSet.add(customTags);
  }

  /**
   * Cancel the timer.
   */
  close() {
    clearInterval(this._timer);
  }
}

module.exports = {
  HeartbeatService
};
