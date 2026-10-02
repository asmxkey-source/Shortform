// HTML 타임라인(window.renderFrame(t)) → 프레임 캡처 → ffmpeg MP4
// usage: node render.mjs <page.html> <out.mp4> <durationSec> [audio.wav] [--stills t1,t2,...]
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';

const argv = process.argv.slice(2);
const stillsIdx = argv.indexOf('--stills');
const stills = stillsIdx >= 0 ? argv.splice(stillsIdx, 2)[1].split(',').map(Number) : [];
const [html, out, durArg, audio] = argv;
const dur = Number(durArg);
const FPS = 30;

// ES 모듈(three.js 등)은 file://에서 막히므로 작업 디렉터리를 로컬 HTTP로 서빙
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.woff2': 'font/woff2', '.json': 'application/json', '.png': 'image/png' };
const root = process.cwd();
const server = http.createServer((req, res) => {
  const f = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(0);
const port = server.address().port;

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
page.on('console', m => console.log('[page]', m.text()));
page.on('pageerror', e => { console.error('[pageerror]', e); process.exit(1); });
await page.goto(`http://127.0.0.1:${port}/${path.relative(root, path.resolve(html))}`);
await page.evaluate(() => document.fonts.ready);
await page.waitForFunction(() => window.__ready === true);

if (stills.length) {
  for (const t of stills) {
    await page.evaluate(t => window.renderFrame(t), t);
    await page.screenshot({ path: `${out.replace(/\.mp4$/, '')}_t${t}.jpg`, type: 'jpeg', quality: 85 });
  }
  await browser.close();
  server.close();
  process.exit(0);
}

const args = ['-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-'];
if (audio) args.push('-i', audio);
args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS));
if (audio) args.push('-c:a', 'aac', '-b:a', '192k', '-shortest');
args.push('-movflags', '+faststart', out);
const ff = spawn('ffmpeg', args, { stdio: ['pipe', 'ignore', 'inherit'] });

const N = Math.round(dur * FPS);
for (let i = 0; i < N; i++) {
  await page.evaluate(t => window.renderFrame(t), i / FPS);
  const buf = await page.screenshot({ type: 'jpeg', quality: 94 });
  if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  if (i % 60 === 0) process.stdout.write(`frame ${i}/${N}\n`);
}
ff.stdin.end();
await new Promise(r => ff.on('close', r));
await browser.close();
server.close();
console.log('done', out);
