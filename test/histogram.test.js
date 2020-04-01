const expect = require('chai').expect;
const assert = require('chai').assert;
const describe = require('mocha').describe;
const it = require('mocha').it;
const histogram = require('../src/entities/histogram/histogramImpl');

class MockClock {
  constructor(timestamp) {
    this._timestamp = timestamp;
    this.get = () => this._timestamp;
    this.increment = millis => (this._timestamp += millis);
  }
}

class TestBuilder {
  constructor() {
    this._DELTA = 1e-1;
    this.clock = new MockClock(Date.now());
    this._pow10 = this.createPow10Histogram(this.clock.get);
    this._inc100 = this.createIncHistogram(this.clock.get, 100);
    this._inc1000 = this.createIncHistogram(this.clock.get, 1000);
    this._empty = new histogram.WavefrontHistogramImpl(this.clock.get);

    this.clock.increment(60001);
  }

  createPow10Histogram(clockMillis) {
    let h = new histogram.WavefrontHistogramImpl(clockMillis);
    h.update(0.1);
    h.update(1.0);
    h.update(1e1);
    h.update(1e1);
    h.update(1e2);
    h.update(1e3);
    h.update(1e4);
    h.update(1e4);
    h.update(1e5);
    return h;
  }

  createIncHistogram(clockMillis, upperBound) {
    let h = new histogram.WavefrontHistogramImpl(clockMillis);
    for (let i = 1; i <= upperBound; i++) {
      h.update(i);
    }
    return h;
  }

  distributionToMap(distributions) {
    let distMap = new Map();
    distributions.forEach(distribution => {
      distribution.centroids.forEach(c =>
        distMap.has(c[0])
          ? distMap.set(c[0], distMap.get(c[0]) + c[1])
          : distMap.set(c[0], c[1])
      );
    });
    return distMap;
  }
}

describe('Test Wavefront Histogram', function() {
  let testBuilder = new TestBuilder();

  it('Test distribution', function() {
    let hist = testBuilder.createPow10Histogram(testBuilder.clock.get);
    testBuilder.clock.increment(60001);

    let distributions = hist.flushDistributions();
    let distMap = testBuilder.distributionToMap(distributions);

    expect(distMap.size).to.equal(7);
    expect(distMap.get(0.1)).to.equal(1);
    expect(distMap.get(1)).to.equal(1);
    expect(distMap.get(1e1)).to.equal(2);
    expect(distMap.get(1e2)).to.equal(1);
    expect(distMap.get(1e3)).to.equal(1);
    expect(distMap.get(1e4)).to.equal(2);
    expect(distMap.get(1e5)).to.equal(1);

    expect(hist.getCount()).to.equal(0);
    expect(hist.getMax()).to.equal(null, testBuilder._DELTA);
    expect(hist.getMin()).to.equal(null, testBuilder._DELTA);
    expect(hist.getMean()).to.equal(null, testBuilder._DELTA);
    expect(hist.getSum()).to.equal(0, testBuilder._DELTA);

    let snapshot = hist.getSnapshot();
    expect(snapshot.getCount()).to.equal(0);
    expect(snapshot.getMax()).to.equal(null, testBuilder._DELTA);
    expect(snapshot.getMin()).to.equal(null, testBuilder._DELTA);
    expect(snapshot.getMean()).to.equal(null, testBuilder._DELTA);
    expect(snapshot.getSum()).to.equal(0, testBuilder._DELTA);
    expect(snapshot.getValue(0.5)).to.equal(null, testBuilder._DELTA);
  });

  it('Test bulk update', function() {
    let hist = new histogram.WavefrontHistogramImpl(testBuilder.clock.get);
    hist.bulkUpdate([24.2, 84.35, 1002.0], [80, 1, 9]);
    testBuilder.clock.increment(60001);

    let distributions = hist.flushDistributions();
    let distMap = testBuilder.distributionToMap(distributions);

    expect(distMap.size).to.equal(3);
    expect(distMap.get(24.2)).to.equal(80);
    expect(distMap.get(84.35)).to.equal(1);
    expect(distMap.get(1002.0)).to.equal(9);
  });

  it('Test count', function() {
    expect(testBuilder._pow10.getCount()).to.equal(9);
    expect(testBuilder._pow10.getSnapshot().getCount()).to.equal(9);
  });

  it('Test max', function() {
    expect(testBuilder._pow10.getMax()).to.equal(1e5);
    expect(testBuilder._pow10.getSnapshot().getMax()).to.equal(1e5);
  });

  it('Test min', function() {
    expect(testBuilder._inc100.getMin()).to.equal(1);
    expect(testBuilder._inc100.getSnapshot().getMin()).to.equal(1);
  });

  it('Test mean', function() {
    assert.closeTo(testBuilder._pow10.getMean(), 13457.9, testBuilder._DELTA);
    assert.closeTo(
      testBuilder._pow10.getSnapshot().getMean(),
      13457.9,
      testBuilder._DELTA
    );
  });

  it('Test sum', function() {
    assert.closeTo(testBuilder._pow10.getSum(), 121121.1, testBuilder._DELTA);
    assert.closeTo(
      testBuilder._pow10.getSnapshot().getSum(),
      121121.1,
      testBuilder._DELTA
    );
  });

  it('Test size', function() {
    expect(testBuilder._pow10.getSnapshot().getSize()).to.equal(9);
    expect(testBuilder._inc100.getSnapshot().getSize()).to.equal(100);
    expect(testBuilder._inc1000.getSnapshot().getSize()).to.equal(1000);
  });

  it('Test stddev', function() {
    assert.closeTo(testBuilder._pow10.stdDev(), 30859.85, testBuilder._DELTA);
    assert.closeTo(testBuilder._inc100.stdDev(), 28.87, testBuilder._DELTA);
    assert.closeTo(testBuilder._inc1000.stdDev(), 288.67, testBuilder._DELTA);
    expect(testBuilder._empty.stdDev()).to.equal(0);
  });
});
