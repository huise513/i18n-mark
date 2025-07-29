import {defineBuildConfig} from 'unbuild'

export default defineBuildConfig({
  entries: [
    'src/index',
    {
      input: 'src/cli',
      name: 'cli',
    },
    {
      input: 'src/vite/index.ts',
      name: 'vite',
      declaration: true
    }
  ],
  declaration: true,
  clean: true,
  rollup: {
    emitCJS: true,
    inlineDependencies: true
  },
  externals: ['vite']
})