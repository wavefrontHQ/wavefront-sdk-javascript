module.exports = api => {
  // Cache configuration is a required option
  api.cache(false);

  const presets = [
    [
      '@babel/preset-env',
      {
        useBuiltIns: false
      }
    ]
  ];

  const plugins = [
    '@babel/plugin-proposal-export-default-from',
    '@babel/plugin-transform-runtime',
  ];

  return { presets, plugins };
};
