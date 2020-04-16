import WavefrontDirectClient from './src/direct';
import histogramGranularity from './src/entities/histogram/histogramGranularity';

// Utility function to generate random UUID
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = (Math.random() * 16) | 0,
      v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function sendMetrics(client) {
  console.log('sent metric');
  client.sendMetric(
    'javascript.direct.new york.power.usage',
    42422.0,
    Date.now(),
    'localhost',
    null
  );
}

function sendHistogram(client) {
  console.log('sent histogram');
  client.sendDistribution(
    'javascript.direct.request.latency',
    [
      [30, 20],
      [5.1, 10]
    ],
    new Set([
      histogramGranularity.MINUTE,
      histogramGranularity.HOUR,
      histogramGranularity.DAY
    ]),
    Date.now(),
    'appServer1',
    { region: 'us-west' }
  );
}

function sendTracingSpan(client) {
  console.log('sent span');
  client.sendSpan(
    'testSpan',
    Date.now(),
    3000,
    'localhost',
    uuidv4(),
    uuidv4(),
    ['2f64e538-9457-11e8-9eb6-529269fb1459'],
    null,
    [
      ['application', 'testApp'],
      ['service', 'testService'],
      ['http.method', 'GET']
    ],
    null
  );
}

function send(wavefrontClient) {
  sendMetrics(wavefrontClient);
  sendHistogram(wavefrontClient);
  sendTracingSpan(wavefrontClient);
}

function main() {
  if (process.argv.length !== 4) {
    return new Error(`Usage: node example.js <server> <token>`);
  }
  let wavefrontClient = new WavefrontDirectClient({
    server: process.argv[2],
    token: process.argv[3]
  });

  send(wavefrontClient);
  wavefrontClient.close();
}

main();
