// 코드로 합성하는 사운드트랙: 패드 화음 + 컷 전환 휙(whoosh) + 자막 진입 플럭
// usage: node synth.mjs <motion|explainer> <out.wav>
import fs from 'node:fs';
const [, , kind, out] = process.argv;
const SR = 44100;
const note = n => 440 * Math.pow(2, (n - 69) / 12); // MIDI → Hz
const F = { F2: 41, C3: 48, D3: 50, F3: 53, G3: 55, A3: 57, Bb2: 46, Bb3: 58, C4: 60, D4: 62, E4: 64, F4: 65, G4: 67, A4: 69 };
const ch = names => names.map(n => note(F[n]));

const CFG = {
  motion: {
    dur: 21, gain: 0.9,
    chords: [[0, ch(['F2', 'F3', 'A3', 'C4', 'E4'])], [5, ch(['D3', 'F3', 'A3', 'C4'])], [9.1, ch(['Bb2', 'F3', 'A3', 'D4'])], [11, ch(['C3', 'G3'])], [16.6, ch(['F2', 'F3', 'A3', 'C4', 'E4'])]],
    padLevel: [[0, 0], [0.4, 0.8], [11, 0.8], [12.5, 0.35], [16, 0.35], [16.8, 0.85], [20.2, 0.8], [21, 0]],
    whoosh: [[1.0, 0.5], [2.0, 0.9], [5.0, 0.5], [9.15, 1.0], [16.75, 0.6], [18.45, 0.5]],
    plucks: [[0.05, 'C4'], [1.0, 'A4'], [2.0, 'F4'], [3.5, 'A4'], [5.0, 'D4'], [7.5, 'F4'], [9.0, 'A4'], [11.0, 'G3'], [13.5, 'C4'], [16.05, 'A4'], [16.75, 'C4'], [17.45, 'F4'], [18.6, 'F4']],
    rise: [8.4, 9.15],
  },
  explainer: {
    dur: 22, gain: 0.8,
    chords: [[0, ch(['C3', 'G3', 'C4', 'E4'])], [4.5, ch(['F2', 'F3', 'A3', 'C4'])], [7, ch(['G3', 'D4', 'F4'])], [9.5, ch(['D3', 'A3', 'C4', 'F4'])], [12, ch(['C3', 'G3', 'C4', 'E4'])], [14.5, ch(['F2', 'F3', 'A3', 'E4'])], [17, ch(['G3', 'C4', 'D4'])], [19.5, ch(['C3', 'G3', 'C4', 'E4'])]],
    padLevel: [[0, 0], [0.3, 0.6], [21.2, 0.6], [22, 0]],
    whoosh: [[1.0, 0.35], [2.0, 0.35], [7.0, 0.35], [9.5, 0.9], [12.0, 0.4], [14.5, 0.4], [17.0, 0.4], [19.5, 0.6]],
    plucks: [[0.05, 'G4'], [0.4, 'C4'], [1.0, 'E4'], [2.0, 'G4'], [4.5, 'F4'], [7.0, 'D4'], [7.7, 'G4'], [9.5, 'A4'], [9.9, 'F4'], [10.25, 'G4'], [10.6, 'A4'], [12.0, 'G4'], [13.3, 'C4'], [14.5, 'E4'], [15.8, 'A4'], [17.0, 'G4'], [19.5, 'C4'], [20.05, 'G4']],
    rise: null,
  },
}[kind];

const N = Math.round(CFG.dur * SR);
const L = new Float32Array(N), R = new Float32Array(N);
const env = (frames, t) => {
  if (t <= frames[0][0]) return frames[0][1];
  for (let i = 1; i < frames.length; i++) if (t <= frames[i][0]) {
    const [t0, v0] = frames[i - 1], [t1, v1] = frames[i]; return v0 + (v1 - v0) * (t - t0) / (t1 - t0);
  }
  return frames[frames.length - 1][1];
};

// 1) 패드: 디튠된 사인 2개 + 약한 3배음, 화음 사이 0.6초 크로스페이드
for (let c = 0; c < CFG.chords.length; c++) {
  const [s, freqs] = CFG.chords[c];
  const e = c + 1 < CFG.chords.length ? CFG.chords[c + 1][0] : CFG.dur;
  const i0 = Math.max(0, Math.floor((s - 0.6) * SR)), i1 = Math.min(N, Math.floor((e + 0.6) * SR));
  for (let i = i0; i < i1; i++) {
    const t = i / SR;
    const xf = Math.min(1, Math.max(0, (t - (s - 0.6)) / 1.2)) * Math.min(1, Math.max(0, ((e + 0.6) - t) / 1.2));
    const lvl = env(CFG.padLevel, t) * xf * 0.055;
    let l = 0, r = 0;
    freqs.forEach((f, k) => {
      const lfo = 1 + 0.002 * Math.sin(2 * Math.PI * (0.13 + k * 0.05) * t);
      const a = Math.sin(2 * Math.PI * f * 1.003 * lfo * t), b = Math.sin(2 * Math.PI * f * 0.997 * t + k);
      const h = 0.12 * Math.sin(2 * Math.PI * f * 3 * t);
      l += a * 0.6 + b * 0.4 + h; r += a * 0.4 + b * 0.6 + h;
    });
    L[i] += l * lvl / Math.sqrt(freqs.length); R[i] += r * lvl / Math.sqrt(freqs.length);
  }
}
// 2) whoosh: 필터링한 노이즈 스웰
let seed = 7; const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
for (const [at, amp] of CFG.whoosh) {
  const pre = 0.35, post = 0.45;
  let lp = 0, lp2 = 0;
  for (let i = Math.floor((at - pre) * SR); i < Math.min(N, (at + post) * SR); i++) {
    if (i < 0) continue;
    const t = i / SR - at;
    const shape = t < 0 ? Math.pow((t + pre) / pre, 2.5) : Math.exp(-t * 9);
    const cut = 0.02 + 0.18 * (t < 0 ? (t + pre) / pre : Math.exp(-t * 6));
    lp += cut * (rnd() - lp); lp2 += cut * (lp - lp2);
    const v = lp2 * shape * amp * 0.9;
    L[i] += v * (t < 0 ? 0.8 : 1.0); R[i] += v * (t < 0 ? 1.0 : 0.8);
  }
}
// 3) 플럭: 부드러운 마림바풍 (사인 + 4배음, 빠른 감쇠)
for (const [at, n] of CFG.plucks) {
  const f = note(F[n]) * 2;
  for (let i = Math.floor(at * SR); i < Math.min(N, (at + 1.2) * SR); i++) {
    const t = i / SR - at;
    const a = Math.min(1, t / 0.004) * Math.exp(-t * 5.5);
    const v = (Math.sin(2 * Math.PI * f * t) + 0.25 * Math.sin(2 * Math.PI * f * 4 * t) * Math.exp(-t * 20)) * a * 0.09;
    L[i] += v; R[i] += v;
  }
}
// 4) 이탈 직전 상승음
if (CFG.rise) {
  const [s, e] = CFG.rise;
  let ph = 0;
  for (let i = Math.floor(s * SR); i < Math.min(N, (e + 0.3) * SR); i++) {
    const t = i / SR, k = Math.min(1, (t - s) / (e - s));
    ph += 2 * Math.PI * (220 + 660 * k * k) / SR;
    const a = (t < e ? k * k : Math.exp(-(t - e) * 14)) * 0.05;
    const v = Math.sin(ph) * a; L[i] += v; R[i] += v;
  }
}
// 5) 아주 짧은 리버브(멀티탭 딜레이) + 소프트 리미터
const taps = [[0.043, 0.25], [0.071, 0.2], [0.113, 0.15], [0.167, 0.1]];
const outL = Float32Array.from(L), outR = Float32Array.from(R);
for (const [d, g] of taps) { const o = Math.floor(d * SR); for (let i = o; i < N; i++) { outL[i] += R[i - o] * g; outR[i] += L[i - o] * g; } }
const buf = Buffer.alloc(44 + N * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  const l = Math.tanh(outL[i] * CFG.gain * 1.6), r = Math.tanh(outR[i] * CFG.gain * 1.6);
  buf.writeInt16LE(Math.round(l * 32000), 44 + i * 4); buf.writeInt16LE(Math.round(r * 32000), 46 + i * 4);
}
fs.writeFileSync(out, buf);
console.log('wrote', out);
