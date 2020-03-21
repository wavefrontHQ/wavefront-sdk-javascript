import Metrics from './metrics';

class WavefrontSDKGauge extends Metrics {
  constructor(supplier) {
    super();
    this.supplier = supplier;
  }

  getValue() {
    // TODO: if callable
    return this.supplier();
  }
}

export default WavefrontSDKGauge;
