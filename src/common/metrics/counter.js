import Metrics from './metrics';

class WavefrontSDKCounter extends Metrics {
  constructor() {
    super();
    this._count = 0;
  }

  inc(val = 1) {
    this._count += val;
  }

  count() {
    return this._count;
  }

  clear() {
    this._count = 0;
  }
}

export default WavefrontSDKCounter;
