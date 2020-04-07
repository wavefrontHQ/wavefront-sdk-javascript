import resolve from 'rollup-plugin-node-resolve';
import { uglify } from 'rollup-plugin-uglify';

export default {
  input: 'src/index.js',
  output: [
    {
      name: 'WavefrontSDK',
      file: 'dist/index.js',
      format: 'umd'
    }
  ],
  plugins: [
    resolve({
      jsnext: true,
      main: true,
      browser: true
    }),
    uglify()
  ]
};
