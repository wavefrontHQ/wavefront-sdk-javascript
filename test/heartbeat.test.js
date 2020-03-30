const expect = require('chai').expect;
const describe = require('mocha').describe;
const it = require('mocha').it;

const ApplicationTags = require('../src/common/applicationTags')
  .ApplicationTags;

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
      ['cluster', null],
      ['shard', null],
      ['customTagKey', 'customTagVal']
    ]);
  });
});
