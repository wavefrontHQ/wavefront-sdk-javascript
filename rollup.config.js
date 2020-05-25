import resolve from 'rollup-plugin-node-resolve';
import babel from 'rollup-plugin-babel';
import commonjs from 'rollup-plugin-commonjs';
import { uglify } from 'rollup-plugin-uglify';

export default {
  input: 'src/index.js',
  output: [
    {
      name: 'WavefrontSDK',
      file: 'dist/index.umd.js',
      format: 'umd'
    }
  ],
  plugins: [
    resolve({
      jsnext: true,
      main: true,
      browser: true
    }),
    babel({
      exclude: ['node_modules/**'],
      runtimeHelpers: true
    }),
    commonjs(),
    uglify()
  ]
};
