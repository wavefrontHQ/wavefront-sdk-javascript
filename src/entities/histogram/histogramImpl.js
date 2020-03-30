const TDigest = require('tdigest').TDigest;

/**
 * Wrapper for TDigest distribution.
 */
class Snapshot {
  /**
   * Construct TDigest Wrapper.
   * @param {TDigest} dist
   */
  constructor(dist) {
    this.distribution = dist;
  }

  /**
   * Get the maximum value in the distribution.
   * @returns {Number}
   */
  getMax() {
    let maxVal;
    try {
      maxVal = this.distribution.percentile(1);
    } catch (e) {
      maxVal = null;
    }
    return maxVal === undefined ? null : maxVal;
  }

  /**
   * Get the minimum value in the distribution.
   * @returns {Number}
   */
  getMin() {
    let minVal;
    try {
      minVal = this.distribution.percentile(0);
    } catch (e) {
      minVal = null;
    }
    return minVal === undefined ? null : minVal;
  }

  /**
   * Get the mean of the values in the distribution.
   * @return {Number}
   */
  getMean() {
    let centroids = this.distribution.toArray();
    if (centroids == null) return null;

    let total = this.getSum(centroids);
    let count = centroids.reduce((accumulator, c) => accumulator + c.n, 0);
    return count !== 0 ? total / count : null;
  }

  /**
   * Get the sum of the values in the distribution.
   * @param centroids (optional)
   * @returns {Number}
   */
  getSum(centroids = null) {
    if (centroids == null) centroids = this.distribution.toArray();
    return centroids.reduce((accumulator, c) => accumulator + c.mean * c.n, 0);
  }

  /**
   * Get the value of given quantile.
   * Return null if distribution is empty.
   * @param {Number} quantile - Quantile range from 0 to 1
   * @return {Number} the value in the distribution at the given quantile.
   */
  getValue(quantile) {
    try {
      let value = this.distribution.percentile(quantile);
      return value === undefined ? null : value;
    } catch (e) {
      return null;
    }
  }

  /**
   * Get the size of snapshot.
   * @returns {Number}
   */
  getSize() {
    return this.distribution.n;
  }

  /**
   * Get the number of values in the distribution.
   * @returns {Number}
   */
  getCount() {
    return this.distribution.n;
  }
}

/**
 * Representation of a histogram distribution.
 * Containing a timestamp and a list of centroids.
 */
class Distribution {
  /**
   * Construct a distribution.
   * @constructor
   * @param {Number} timestamp - Timestamp in milliseconds since the epoch.
   * @param {Array} centroids - An array of centroid [mean, count]
   */
  constructor(timestamp, centroids) {
    this.timestamp = timestamp;
    this.centroids = centroids;
  }
}

class MinuteBin {
  constructor(accuracy = 100, minuteMillis = null) {
    this.accuracy = accuracy;
    this.minuteMillis = minuteMillis;
    this.dist = null;
  }

  getDist() {
    if (this.dist == null) {
      this.dist = new TDigest(1 / this.accuracy);
    }
    return this.dist;
  }

  updateDist(value) {
    this.getDist().push(value);
  }

  bulkUpdateDist(means, counts) {
    if (means && counts) {
      for (let i = 0; i < Math.min(means.length, counts.length); i++) {
        this.getDist().push(means[i], counts[i]);
      }
    }
  }

  /**
   * Get list of centroids for dists in this minute.
   * @returns {Array}
   */
  getCentroids() {
    return this.dist.toArray();
  }

  /**
   * Convert to Distribution.
   */
  toDistribution() {
    let centroids = [];
    this.dist.toArray().forEach(centroid => {
      centroids.push([centroid.mean, centroid.n]);
    });
    return new Distribution(this.minuteMillis, centroids);
  }
}

class WavefrontHistogramImpl {
  constructor(clockMillis = null) {
    // TODO: think move to constants
    this._ACCURACY = 100;
    this._MAX_BINS = 10;

    this._clockMillis = clockMillis || this.currentClockMillis;
    this._priorMinuteBinsList = [];
    this._currentMinuteBin = new MinuteBin(
      this._ACCURACY,
      this.currentMinuteMillis()
    );
  }

  /**
   * Get current time in millisecond.
   * @returns {number}
   */
  currentClockMillis() {
    return Date.now();
  }

  /**
   * Get the timestamp of start of certain minute.
   * @returns {number}
   */
  currentMinuteMillis() {
    return Math.floor(this._clockMillis() / 60000) * 60000;
  }

  /**
   * Add one value to the distribution.
   * @param value
   */
  update(value) {
    this.getCurrentBin().updateDist(value);
  }

  /**
   * Bulk-update this histogram with a set of centroids.
   * @param {Array} means - the centroid values
   * @param {Array} counts - the centroid weights/sample counts
   */
  bulkUpdate(means, counts) {
    this.getCurrentBin().bulkUpdateDist(means, counts);
  }

  getCurrentBin() {
    return this.getOrUpdateCurrentBin(this.currentMinuteMillis());
  }

  /**
   * Get current minute bin.
   * Will update _priorMinuteBinsList if the minute has passed.
   * @param currMinuteMillis
   * @returns {MinuteBin} MinuteBin of current minute.
   */
  getOrUpdateCurrentBin(currMinuteMillis) {
    if (this._currentMinuteBin.minuteMillis === currMinuteMillis) {
      return this._currentMinuteBin;
    }
    if (this._priorMinuteBinsList.length > this._MAX_BINS) {
      this._priorMinuteBinsList.shift();
    }
    this._priorMinuteBinsList.push(this._currentMinuteBin);
    this._currentMinuteBin = new MinuteBin(this._ACCURACY, currMinuteMillis);
    return this._currentMinuteBin;
  }

  getPriorMinuteBinsList() {
    this.getOrUpdateCurrentBin(this.currentMinuteMillis());
    return this._priorMinuteBinsList;
  }

  stdDev() {
    // TODO
  }

  /**
   * Aggregate all the minute bins prior to the current minute.
   * Returns a list of the distributions held within each bin.
   * Note that invoking this method will also clear all data from the
   * aggregated bins, thereby changing the state of the system and
   * preventing data from being flushed more than once.
   * @returns {Array}
   */
  flushDistributions() {
    let distributions = [];
    this.getOrUpdateCurrentBin(this.currentMinuteMillis());
    this._priorMinuteBinsList.forEach(minuteBin =>
      distributions.push(minuteBin.toDistribution())
    );
    this._priorMinuteBinsList = [];
    return distributions;
  }

  /**
   * Get the number of values in the distribution.
   * @return {number}
   */
  getCount() {
    return this.getPriorMinuteBinsList().reduce(
      (accumulator, minuteBin) => accumulator + minuteBin.dist.n,
      0
    );
  }

  /**
   * Get the sum of the values in the distribution.
   */
  getSum() {
    let res = 0;
    this.getPriorMinuteBinsList().forEach(minuteBin => {
      res += minuteBin
        .getCentroids()
        .reduce((accumulator, c) => accumulator + c.mean * c.n, 0);
    });
    return res;
  }

  /**
   * Return a statistical of the histogram distribution.
   * @return {Snapshot} Snapshot of Histogram
   */
  getSnapshot() {
    let newDigest = new TDigest(1 / this._ACCURACY);
    for (let minuteBin of this.getPriorMinuteBinsList()) {
      minuteBin.getCentroids().forEach(c => newDigest.push(c.mean, c.n)); // TODO: push right?
    }
    return new Snapshot(newDigest);
  }

  /**
   * Get the maximum value in the distribution.
   * Return null if the distribution is empty.
   * @return {Number}
   */
  getMax() {
    let maxCallback = (maxVal, currVal) => {
      if (currVal == null) return maxVal;
      return Math.max(maxVal, Number(currVal.dist.percentile(1)));
    };
    let max = this.getPriorMinuteBinsList().reduce(maxCallback, -Infinity);
    return max === -Infinity ? null : max;
  }

  /**
   * Get the minimum value in the distribution.
   * Return null if the distribution is empty.
   * @return {Number}
   */
  getMin() {
    let minCallback = (minVal, currVal) => {
      if (currVal == null) return minVal;
      return Math.min(minVal, Number(currVal.dist.percentile(0)));
    };
    let min = this.getPriorMinuteBinsList().reduce(minCallback, Infinity);
    return min === Infinity ? null : min;
  }

  /**
   * Get the mean of the values in the distribution.
   * Return null if the distribution is empty.
   * @return {Number}
   */
  getMean() {
    let count = 0,
      total = 0;
    this.getPriorMinuteBinsList().forEach(minuteBin => {
      let centroids = minuteBin.getCentroids();
      count += centroids.reduce((accumulator, c) => accumulator + c.n, 0);
      total += centroids.reduce(
        (accumulator, c) => accumulator + c.n * c.mean,
        0
      );
    });
    return count !== 0 ? total / count : null;
  }
}

module.exports = {
  WavefrontHistogramImpl
};
