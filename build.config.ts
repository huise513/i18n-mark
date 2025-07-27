import {defineBuildConfig} from 'unbuild'

export default defineBuildConfig({
  entries: [
    // 主入口文件
    'src/index',
    // CLI 入口文件
    {
      input: 'src/cli',
      name: 'cli',
    },
    {
      input: 'src/vite/index.ts',
      outDir: 'dist/vite',
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