export default {
  testMatch: ['<rootDir>/src/tests/**/*.test.ts'],
  transform: {
    '\\.[jt]sx?$': [
      'babel-jest',
      {
        presets: [
          ['@babel/preset-env', { targets: { node: 'current' } }],
          '@babel/preset-typescript',
        ],
      },
    ],
  },
  testTimeout: 15000,
  restoreMocks: true,
};
