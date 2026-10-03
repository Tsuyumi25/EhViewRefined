import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import monkey from 'vite-plugin-monkey'
import pkg from './package.json' with { type: 'json' }

export default defineConfig(({ command }) => ({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __VUE_PROD_DEVTOOLS__: command === 'serve' ? 'true' : 'false',
  },
  plugins: [
    vue(),
    monkey({
      entry: 'src/main.ts',
      userscript: {
        namespace: 'https://github.com/Tsuyumi25',
        match: ['https://e-hentai.org/*', 'https://exhentai.org/*'],
        name: {
          '': 'Eh View Refined',
          'zh-TW': 'Eh View Refined',
          'zh-CN': 'Eh View Refined',
          ja: 'Eh View Refined',
          ko: 'Eh View Refined',
        },
        description: {
          '': 'Get complete gallery tags in Extended mode and simulate other native layouts.',
          'zh-TW': '以 Extended 模式取得完整圖庫標籤，並模擬成其他原生的排版。',
          'zh-CN': '以 Extended 模式获取完整图库标签，并模拟成其他原生的排版。',
          ja: 'Extended モードでギャラリーの全タグを取得し、他の標準レイアウトを再現。',
          ko: 'Extended 모드로 전체 갤러리 태그를 가져오고 다른 기본 레이아웃을 재현합니다.',
        },
        author: 'tsuyumi',
        license: 'MIT',
        icon: 'https://e-hentai.org/favicon.ico',
        'run-at': 'document-start',
      },
      build: { metaFileName: true },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: { include: ['src/**/*.test.ts'] },
}))
