// 공용 타임라인 유틸 (결정적 렌더: 모든 상태는 t의 함수)
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, k) => a + (b - a) * k;
const ease = {
  inOut: k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
  out: k => 1 - Math.pow(1 - k, 3),
  outBack: k => { const c = 1.70158, c3 = c + 1; return 1 + c3 * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); },
};
// 키프레임 [[t, v], ...] 사이를 inOut 보간
function kf(frames, t, e = ease.inOut) {
  if (t <= frames[0][0]) return frames[0][1];
  for (let i = 1; i < frames.length; i++) {
    const [t1, v1] = frames[i];
    if (t <= t1) {
      const [t0, v0] = frames[i - 1];
      return lerp(v0, v1, e(clamp((t - t0) / (t1 - t0))));
    }
  }
  return frames[frames.length - 1][1];
}
// 0..1 진입/퇴장 진행도
const prog = (t, start, len) => clamp((t - start) / len);

// 캔버스 텍스트: 글자 단위 스태거 진입 + 퇴장 페이드
// spans: [{text, color}] 한 줄을 여러 색 조각으로
function drawLine(ctx, spans, x, y, opt) {
  const { t, start, end, size, weight = 900, align = 'center', stagger = 0.022, rise = 34, shadow = true } = opt;
  ctx.font = `${weight} ${size}px Pretendard`;
  ctx.textBaseline = 'alphabetic';
  const full = spans.map(s => s.text).join('');
  const W = ctx.measureText(full).width;
  let cx = align === 'center' ? x - W / 2 : x;
  const out = 1 - prog(t, end - 0.25, 0.25);
  let idx = 0;
  for (const s of spans) {
    for (const ch of s.text) {
      const w = ctx.measureText(ch).width;
      const k = ease.out(prog(t, start + idx * stagger, 0.38));
      const a = k * out;
      if (a > 0.001) {
        ctx.save();
        ctx.globalAlpha = a;
        if (shadow) { ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 4; }
        ctx.fillStyle = s.color;
        ctx.fillText(ch, cx, y + (1 - k) * rise);
        ctx.restore();
      }
      cx += w; idx++;
    }
  }
  return W;
}
const visible = (t, s, e) => t >= s && t < e;
