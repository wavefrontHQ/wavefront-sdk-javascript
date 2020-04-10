import { expect } from 'chai';
import { describe } from 'mocha';
import { it } from 'mocha';

import ApplicationTags from '../src/common/applicationTags';

describe('Test Wavefront Histogram', function() {
  it('Test application tag getAsList with custom tags', function() {
    let res = new ApplicationTags({
      application: 'testApp',
      service: 'testService',
      customTags: [['customTagKey', 'customTagVal']]
    }).getAsList();

    expect(res).to.eql([
      ['application', 'testApp'],
      ['service', 'testService'],
      ['cluster', 'none'],
      ['shard', 'none'],
      ['customTagKey', 'customTagVal']
    ]);
  });
});
