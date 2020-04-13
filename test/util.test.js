import { expect } from 'chai';
import { describe } from 'mocha';
import { it } from 'mocha';

import * as utils from '../src/common/utils';
import granularity from '../src/entities/histogram/histogramGranularity';

describe('Test utility functions', function() {
  it('Validate queue', function() {
    let queue = new utils.Queue(10);
    queue.push(1);
    queue.push(2);

    expect(queue.size()).to.equal(2);
    expect(queue.remainCapacity()).to.equal(8);
    expect(queue.toArray()).to.eql([1, 2]);
  });

  it('Validate get chunk', function() {
    let res = utils.getChunks([0, 0, 0, 0, 0, 0, 0], 3);
    expect(res).to.eql([[0, 0, 0], [0, 0, 0], [0]]);
  });

  it('Validate blank string checker', function() {
    let testEmptyString = '';
    let result = utils.isBlank(testEmptyString);
    expect(result).to.equal(true);

    let testSpaces = '  ';
    result = utils.isBlank(testSpaces);
    expect(result).to.equal(true);

    let testNonEmptyString = 'test';
    result = utils.isBlank(testNonEmptyString);
    expect(result).to.equal(false);
  });

  it('Validate string sanitizer', function() {
    let testString = `url:"https://test url.com"`;
    let expectString = `"url:\\"https://test-url.com\\""`;
    expect(utils.sanitize(testString)).to.equal(expectString);
  });

  it('Validate metricToLineData', function() {
    // With timestamp and tags
    expect(
      utils.metricToLineData(
        'new-york.power.usage',
        42422,
        1493773500,
        'localhost',
        { datacenter: 'dc1' },
        'defaultSource'
      )
    ).to.equal(
      `"new-york.power.usage" 42422 1493773500 source="localhost" "datacenter"="dc1"\n`
    );
    // No timestamp
    expect(
      utils.metricToLineData(
        'new-york.power.usage',
        42422,
        null,
        'localhost',
        { datacenter: 'dc1' },
        'defaultSource'
      )
    ).to.equal(
      `"new-york.power.usage" 42422 source="localhost" "datacenter"="dc1"\n`
    );
    // No tags
    expect(
      utils.metricToLineData(
        'new-york.power.usage',
        42422,
        1493773500,
        'localhost',
        null,
        'defaultSource'
      )
    ).to.equal(`"new-york.power.usage" 42422 1493773500 source="localhost"\n`);
  });

  it('Validate histogram to line data', function() {
    expect(
      utils.histogramToLineData(
        'request.latency',
        [
          [30.0, 20],
          [5.1, 10]
        ],
        new Set().add(granularity.MINUTE),
        1493773500,
        'appServer1',
        { region: 'us-west' },
        'defaultSource'
      )
    ).to.equal(
      `!M 1493773500 #20 30 #10 5.1 "request.latency" source="appServer1" "region"="us-west"\n`
    );
    // No timestamp
    expect(
      utils.histogramToLineData(
        'request.latency',
        [
          [30.0, 20],
          [5.1, 10]
        ],
        new Set().add(granularity.MINUTE),
        null,
        'appServer1',
        { region: 'us-west' },
        'defaultSource'
      )
    ).to.equal(
      `!M #20 30 #10 5.1 "request.latency" source="appServer1" "region"="us-west"\n`
    );
    // No tags
    expect(
      utils.histogramToLineData(
        'request.latency',
        [
          [30.0, 20],
          [5.1, 10]
        ],
        new Set().add(granularity.MINUTE),
        1493773500,
        'appServer1',
        null,
        'defaultSource'
      )
    ).to.equal(
      `!M 1493773500 #20 30 #10 5.1 "request.latency" source="appServer1"\n`
    );
    // Empty centroids
    expect(() =>
      utils.histogramToLineData(
        'request.latency',
        null,
        new Set().add(granularity.MINUTE),
        1493773500,
        'appServer1',
        { region: 'us-west' },
        'defaultSource'
      )
    ).to.throw('A distribution should have at least one centroid');
    // No histogram granularity specified
    expect(() =>
      utils.histogramToLineData(
        'request.latency',
        [
          [30.0, 20],
          [5.1, 10]
        ],
        new Set(),
        1493773500,
        'appServer1',
        { region: 'us-west' },
        'defaultSource'
      )
    ).to.throw('Histogram granularities cannot be null or empty');
    // Multiple granularities
    expect(
      utils
        .histogramToLineData(
          'request.latency',
          [
            [30.0, 20],
            [5.1, 10]
          ],
          new Set([granularity.MINUTE, granularity.HOUR, granularity.DAY]),
          1493773500,
          'appServer1',
          { region: 'us-west' },
          'defaultSource'
        )
        .trim()
        .split('\n')
    ).to.have.members([
      '!M 1493773500 #20 30 #10 5.1 "request.latency" source="appServer1" "region"="us-west"',
      '!H 1493773500 #20 30 #10 5.1 "request.latency" source="appServer1" "region"="us-west"',
      '!D 1493773500 #20 30 #10 5.1 "request.latency" source="appServer1" "region"="us-west"'
    ]);
  });

  it('Validate tracing span to line data', function() {
    expect(
      utils.tracingSpanToLineData(
        'getAllUsers',
        1493773500,
        343500,
        'localhost',
        '7b3bf470-9456-11e8-9eb6-529269fb1459',
        '0313bafe-9457-11e8-9eb6-529269fb1459',
        ['2f64e538-9457-11e8-9eb6-529269fb1459'],
        ['5f64e538-9457-11e8-9eb6-529269fb1459'],
        [
          ['application', 'Wavefront'],
          ['http.method', 'GET']
        ],
        null,
        'defaultSource'
      )
    ).to.equal(
      [
        `"getAllUsers" source="localhost"`,
        `traceId=7b3bf470-9456-11e8-9eb6-529269fb1459`,
        `spanId=0313bafe-9457-11e8-9eb6-529269fb1459`,
        `parent=2f64e538-9457-11e8-9eb6-529269fb1459`,
        `followsFrom=5f64e538-9457-11e8-9eb6-529269fb1459`,
        `"application"="Wavefront"`,
        `"http.method"="GET" 1493773500 343500\n`
      ].join(' ')
    );
    // null followsFrom
    expect(
      utils.tracingSpanToLineData(
        'getAllUsers',
        1493773500,
        343500,
        'localhost',
        '7b3bf470-9456-11e8-9eb6-529269fb1459',
        '0313bafe-9457-11e8-9eb6-529269fb1459',
        ['2f64e538-9457-11e8-9eb6-529269fb1459'],
        null,
        [
          ['application', 'Wavefront'],
          ['http.method', 'GET']
        ],
        null,
        'defaultSource'
      )
    ).to.equal(
      [
        `"getAllUsers" source="localhost"`,
        `traceId=7b3bf470-9456-11e8-9eb6-529269fb1459`,
        `spanId=0313bafe-9457-11e8-9eb6-529269fb1459`,
        `parent=2f64e538-9457-11e8-9eb6-529269fb1459`,
        `"application"="Wavefront"`,
        `"http.method"="GET" 1493773500 343500\n`
      ].join(' ')
    );
    // root span
    expect(
      utils.tracingSpanToLineData(
        'getAllUsers',
        1493773500,
        343500,
        'localhost',
        '7b3bf470-9456-11e8-9eb6-529269fb1459',
        '0313bafe-9457-11e8-9eb6-529269fb1459',
        null,
        null,
        [
          ['application', 'Wavefront'],
          ['http.method', 'GET']
        ],
        null,
        'defaultSource'
      )
    ).to.equal(
      [
        `"getAllUsers" source="localhost"`,
        `traceId=7b3bf470-9456-11e8-9eb6-529269fb1459`,
        `spanId=0313bafe-9457-11e8-9eb6-529269fb1459`,
        `"application"="Wavefront"`,
        `"http.method"="GET" 1493773500 343500\n`
      ].join(' ')
    );
    // duplicate tags
    expect(
      utils.tracingSpanToLineData(
        'getAllUsers',
        1493773500,
        343500,
        'localhost',
        '7b3bf470-9456-11e8-9eb6-529269fb1459',
        '0313bafe-9457-11e8-9eb6-529269fb1459',
        null,
        null,
        [
          ['application', 'Wavefront'],
          ['http.method', 'GET'],
          ['application', 'Wavefront']
        ],
        null,
        'defaultSource'
      )
    ).to.equal(
      [
        `"getAllUsers" source="localhost"`,
        `traceId=7b3bf470-9456-11e8-9eb6-529269fb1459`,
        `spanId=0313bafe-9457-11e8-9eb6-529269fb1459`,
        `"application"="Wavefront"`,
        `"http.method"="GET" 1493773500 343500\n`
      ].join(' ')
    );
    // null tags
    expect(
      utils.tracingSpanToLineData(
        'getAllUsers',
        1493773500,
        343500,
        'localhost',
        '7b3bf470-9456-11e8-9eb6-529269fb1459',
        '0313bafe-9457-11e8-9eb6-529269fb1459',
        null,
        null,
        null,
        null,
        'defaultSource'
      )
    ).to.equal(
      [
        `"getAllUsers" source="localhost"`,
        `traceId=7b3bf470-9456-11e8-9eb6-529269fb1459`,
        `spanId=0313bafe-9457-11e8-9eb6-529269fb1459`,
        `1493773500 343500\n`
      ].join(' ')
    );
  });
});
