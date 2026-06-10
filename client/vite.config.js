import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
function deferCss() {
  return {
    name: 'defer-css',
    enforce: 'post',
    transformIndexHtml(html) {
      return html.replace(
        /<link rel="stylesheet"([^>]+)>/g,
        '<link rel="preload" as="style"$1>\n    <link rel="stylesheet"$1 media="print" onload="this.media=\'all\'">\n    <noscript><link rel="stylesheet"$1></noscript>'
      );
    }
  }
}

export default defineConfig({
  plugins: [react(), deferCss()],
  server: {
    allowedHosts: ['dagacpc.live']
  },
  build: {
    target: 'esnext',
    cssCodeSplit: true,
    chunkSizeWarningLimit: 600,
    rolldownOptions: {
      output: {
        codeSplitting: true
      }
    }
  }
})
