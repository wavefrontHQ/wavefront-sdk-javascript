const constants = require('./constants');

/**
 * Metadata about your application represented as tags in Wavefront.
 */
class ApplicationTags {
  /**
   * Construct ApplicationTags.
   * @param application - Application Name
   * @param service - Service Name
   * @param cluster - Cluster Name
   * @param shard - Shard Name
   * @param customTags - Array of arrays of custom tags
   */
  constructor({
    application,
    service,
    cluster = null,
    shard = null,
    customTags = null
  }) {
    if (!application) {
      throw Error(`Missing "application" parameter in ApplicationTags!`);
    }

    if (!service) {
      throw Error(`Missing "service" parameter in ApplicationTags!`);
    }

    this._application = application;
    this._service = service;
    this._cluster = cluster;
    this._shard = shard;
    this._customTags = customTags;
  }

  /**
   * Get Application Name.
   * @returns {string}
   */
  get application() {
    return this._application;
  }

  /**
   * Get Service Name.
   * @returns {string}
   */
  get service() {
    return this._service;
  }

  /**
   * Get Cluster Name.
   * @returns {string}
   */
  get cluster() {
    return this._cluster;
  }

  /**
   * Get Shard Name.
   * @returns {string}
   */
  get shard() {
    return this._shard;
  }

  /**
   * Get Custom Tags.
   * @returns {Array}
   */
  get customTags() {
    return this._customTags;
  }

  /**
   * Get all tags as an array.
   * @return {Array}
   */
  getAsList() {
    let tags = [
      [constants.APPLICATION_TAG_KEY, this.application],
      [constants.SERVICE_TAG_KEY, this.service],
      [
        constants.CLUSTER_TAG_KEY,
        this.cluster ? constants.NULL_TAG_VAL : this.cluster
      ],
      [
        constants.SHARD_TAG_KEY,
        this.shard ? constants.NULL_TAG_VAL : this.shard
      ]
    ];
    if (this.customTags != null) {
      tags.push(...this.customTags);
    }
    return tags;
  }
}

module.exports = { ApplicationTags };
