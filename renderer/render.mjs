// HTML 타임라인(window.renderFrame(t)) → 프레임 캡처 → ffmpeg MP4
// usage: node render.mjs <page.html> <out.mp4> <durationSec> [audio.wav] [--stills t1,t2,...]
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';

const argv = process.argv.slice(2);
const stillsIdx = argv.indexOf('--stills');
const stills = stillsIdx >= 0 ? argv.splice(stillsIdx, 2)[1].split(',').map(Number) : [];
const [html, out, durArg, audio] = argv;
const dur = Number(durArg);
const FPS = 30;

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell' });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
page.on('console', m => console.log('[page]', m.text()));
page.on('pageerror', e => { console.error('[pageerror]', e); process.exit(1); });
await page.goto('file://' + path.resolve(html));
await page.evaluate(() => document.fonts.ready);
await page.waitForFunction(() => window.__ready === true);

if (stills.length) {
  for (const t of stills) {
    await page.evaluate(t => window.renderFrame(t), t);
    await page.screenshot({ path: `${out.replace(/\.mp4$/, '')}_t${t}.jpg`, type: 'jpeg', quality: 85 });
  }
  await browser.close();
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
console.log('done', out);
