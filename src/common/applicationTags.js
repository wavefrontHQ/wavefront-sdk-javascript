import * as constants from './constants';

/**
 * Metadata about your application represented as tags in Wavefront.
 */
export default function ApplicationTags({
  application,
  service,
  cluster = null,
  shard = null,
  customTags = null
}) {
  if (!application) {
    throw `Missing "application" parameter in ApplicationTags!`;
  }
  if (!service) {
    throw `Missing "service" parameter in ApplicationTags!`;
  }
  this.application = application;
  this.service = service;
  this.cluster = cluster;
  this.shard = shard;
  this.customTags = customTags;

  /**
   * Get all tags as an array.
   * @return {Array}
   */
  this.getAsList = () => {
    const tags = [
      [constants.APPLICATION_TAG_KEY, this.application],
      [constants.SERVICE_TAG_KEY, this.service],
      [constants.CLUSTER_TAG_KEY, this.cluster ?? constants.NULL_TAG_VAL],
      [constants.SHARD_TAG_KEY, this.shard ?? constants.NULL_TAG_VAL]
    ];
    if (this.customTags != null) {
      tags.push(...this.customTags);
    }
    return tags;
  };
}
