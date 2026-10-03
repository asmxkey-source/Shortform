// 타임라인에서 사운드 설정 생성: 동작마다 화음 전환 + 휙, 단계마다 플럭
const vm = require('vm'), fs = require('fs');
vm.runInThisContext(fs.readFileSync(__dirname + '/dns-timeline.js', 'utf8'));
const hz = m => 440 * Math.pow(2, (m - 69) / 12);
const CH = [[48, 55, 60, 64], [41, 53, 57, 60], [43, 55, 59, 62], [45, 52, 57, 60]].map(c => c.map(hz));
for (const v of ['A', 'B']) {
  const tl = DNS.build(v), cfg = { dur: tl.dur, gain: 0.7, chords: [[0, CH[0]]], padLevel: [[0, 0], [0.5, 0.5], [tl.dur - 1.5, 0.5], [tl.dur, 0]], whoosh: [], plucks: [], rise: null };
  tl.segs.forEach(s => {
    if (s.type === 'title') { cfg.chords.push([s.s, CH[(s.xi + 1) % 4]]); cfg.whoosh.push([s.s, 0.3]); cfg.plucks.push([s.s, 72]); }
    if (s.type === 'step') cfg.plucks.push([s.s + 0.05, [67, 69, 72, 74, 76][s.si % 5]]);
    if (s.type === 'outro') { cfg.chords.push([s.s, CH[0]]); cfg.whoosh.push([s.s, 0.3]); }
  });
  fs.writeFileSync(`out/dns-${v}.json`, JSON.stringify(cfg));
  console.log(v, tl.dur);
}
