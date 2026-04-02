import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/** Vite вставляет entry в <head> — в Telegram/WebView порядок должен быть: SDK → Tailwind → React. */
const moveEntryScriptToBodyEnd = () => ({
  name: 'move-entry-script-to-body-end',
  enforce: 'post',
  transformIndexHtml(html) {
    const re =
      /<script type="module"[^>]*src="\/assets\/[^"]+"[^>]*>\s*<\/script>\s*/;
    const m = html.match(re);
    if (!m) return html;
    const tag = m[0].trim();
    const stripped = html.replace(re, '');
    if (!stripped.includes('</body>')) return html;
    return stripped.replace('</body>', `    ${tag}\n  </body>`);
  }
});

/** У части iOS standalone WKWebView бывают сбои с type=module + crossorigin на своём же origin */
const stripModuleCrossorigin = () => ({
  name: 'strip-module-crossorigin',
  enforce: 'post',
  transformIndexHtml(html) {
    return html.replace(/\s+crossorigin(?:=["'][^"']*["'])?/gi, '');
  }
});

export default defineConfig({
  plugins: [react(), moveEntryScriptToBodyEnd(), stripModuleCrossorigin()],
  server: {
    port: 5173
  }
});
