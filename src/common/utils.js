'use strict';

class Queue {
  constructor(maxQueueSize) {
    self._items = [];
    self._maxQueueSize = maxQueueSize;
  }

  isEmpty() {
    return self._items.length === 0;
  }

  push(val) {
    if (self.size() >= self._maxQueueSize) {
      throw Error('Exception raised because the queue is full.');
    } else {
      self._items.push(val);
    }
  }

  dequeue() {
    if (!self.isEmpty()) {
      return self._items.shift();
    }
    return null;
  }

  peek() {
    if (!self.isEmpty()) {
      return self._items[0];
    }
    return null;
  }

  size() {
    return self._items.length;
  }

  remainCapacity() {
    return self._maxQueueSize - self._items.length;
  }

  get toArray() {
    return self._items;
  }
}

function isBlank(str) {
  // Check if a string contains nothing or only whitespace
  return (
    str === null || str.length === 0 || str.replace(/\s/g, '').length === 0
  );
}

function metricToLineData(
  name,
  value,
  timestamp,
  source,
  tags,
  defaultSource
) {}

function histogramToLineData(
  centroids,
  histogramGranularities,
  timestamp,
  source,
  tags,
  defaultSource
) {}

function tracingSpanToLineData(
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
  defaultSource
) {}

function spanLogToLineData(traceId, spanId, spanLogs, scrambler = null) {}

module.exports = {
  metricToLineData,
  histogramToLineData,
  tracingSpanToLineData,
  spanLogToLineData,
  isBlank,
  Queue
};
// export default Queue;
