const expect = require('chai').expect;
const describe = require('mocha').describe;
const it = require('mocha').it;
const utils = require('../src/common/utils');

describe('isBlank', function() {
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
});
