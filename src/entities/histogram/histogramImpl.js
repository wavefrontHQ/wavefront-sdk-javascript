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
    if (!centroids) return null;

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
    if (!centroids) centroids = this.distribution.toArray();
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

/**
 * Representation of a bin holds histogram data in a minute.
 */
class MinuteBin {
  /**
   * Construct the Minute Bin.
   * @param accuracy - Accuracy range from [0, 100]
   * @param minuteMillis - The timestamp at the start of the minute.
   */
  constructor(accuracy = 100, minuteMillis = null) {
    this.accuracy = accuracy;
    this.minuteMillis = minuteMillis;
    this.dist = new TDigest(1 / this.accuracy);
  }

  /**
   * Update the value in the distribution.
   * @param value
   */
  updateDist(value) {
    this.dist.push(value);
  }

  /**
   * Bulk update values in the distribution
   * @param means
   * @param counts
   */
  bulkUpdateDist(means, counts) {
    if (means && counts) {
      for (let i = 0; i < Math.min(means.length, counts.length); i++) {
        this.dist.push(means[i], counts[i]);
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

/**
 * Wavefront implementation of a histogram.
 */
class WavefrontHistogramImpl {
  /**
   * Construct Wavefront Histogram.
   * @param clockMillis - A function which returns timestamp
   */
  constructor(clockMillis = null) {
    // accuracy = compression = 1 / delta.
    this._ACCURACY = 100;
    // If a bin queue has exceeded MAX_BINS number of bins (e.g.,
    // the queue has data that has yet to be reported for more than MAX_BINS
    // number of minutes), delete the oldest bin. Defaulted to 10 because we
    // can expect the histogram to be reported at least once every 10 minutes.
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

  /**
   * Retrieve the current bin.
   * @returns {MinuteBin} - Current minute bin
   */
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

  /**
   * Return newly-updated _priorMinuteBinsList.
   * @returns {[]|Array}
   */
  getPriorMinuteBinsList() {
    this.getOrUpdateCurrentBin(this.currentMinuteMillis());
    return this._priorMinuteBinsList;
  }

  /**
   * Return the standard deviation of the values in the distribution.
   */
  stdDev() {
    let mean = this.getMean();
    let varianceSum = 0,
      count = 0;
    for (let minuteBin of this.getPriorMinuteBinsList()) {
      let centroids = minuteBin.getCentroids();
      count += centroids.reduce((accumulator, c) => accumulator + c.n, 0);
      varianceSum += centroids.reduce(
        (accumulator, c) => accumulator + c.n * (c.mean - mean) ** 2,
        0
      );
    }
    let variance = count === 0 ? 0 : varianceSum / count;
    return Math.sqrt(variance);
  }

  /**
   * Aggregate all the minute bins prior to the current minute.
   * Returns a list of the distributions held within each bin.
   * Note that invoking this method will also clear all data from the
   * aggregated bins, thereby changing the state of the system and
   * preventing data from being flushed more than once.
   * @returns {Distribution[]}
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
      minuteBin.getCentroids().forEach(c => newDigest.push(c.mean, c.n));
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
      if (!currVal) return maxVal;
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
      if (!currVal) return minVal;
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
  WavefrontHistogramImpl,
  Distribution
};
