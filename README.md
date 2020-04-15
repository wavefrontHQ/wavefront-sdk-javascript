# wavefront-sdk-javascript
Wavefront Core Javascript sender SDK

### Setup
$ npm install

### Requirements
NodeJS version 8

### Usage
* Replace `server` and `token` in the `start` section of `package.json`, and run `npm run start`
* To run with debugger, put `-r @babel/preset-env -r @babel/register -r regenerator-runtime` under the node parameters.
*  `npm run build` to generate a UMD bundle under `dist` directory.