// DNS 시퀀스 설명형 렌더 엔진 — window.VERSION ('A' 회원 복습용 / 'B' 강사 기록용)
// 인체는 옆모습 2D 리그(절대각, 수학 좌표계 y-up)로 정의하고 포즈 사이를 보간한다.
const ctx = document.getElementById('c').getContext('2d');
const W = 1080, H = 1920, CX = 540;
const PAPER = '#F3EEE6', INK = '#2B2724', FAR = '#BDB4A7', MUTE = '#8A837A', ACC = '#D9623B', ACC_F = '#EFA284', SAGE = '#5F8A6B', MAT = '#E3DACC', BAND = '#2E8C7A', BLOCK = '#7FA6CF';
const V = window.VERSION, TL = DNS.build(V), EX = DNS.EX;
window.DURATION = TL.dur;

// ── 리그 치수(px) ──
const L = Object.fromEntries(Object.entries({ torso: 250, neck: 24, head: 44, up: 128, fore: 122, thigh: 168, shin: 160, foot: 46, tw: 62, lw: 30 }).map(([k, v]) => [k, Math.round(v * 1.1)]));
const PI = Math.PI;
const FLOOR = V === 'A' ? 1180 : 1200;

// ── 자세별 기본 포즈와 목표 포즈 ──
// pose: {torso, head, aN:[u,f], aF, lN:[t,s], lF, foot:rel, ground:'pelvis'|'knee'|'toe'}
function basePose(post) {
  switch (post) {
    case 'knees': return { torso: PI, head: PI, aN: [-0.04, -0.04], aF: [-0.04, -0.04], lN: [0.95, -0.95], lF: [0.95, -0.95], footRel: 0.95, ground: 'pelvis' };
    case 'supine': return { torso: PI, head: PI, aN: [PI / 2, PI / 2], aF: [PI / 2, PI / 2], lN: [PI / 2, 0], lF: [PI / 2, 0], footRel: PI / 2, ground: 'pelvis' };
    case 'tuck': return { torso: PI, upper: PI - 0.5, head: PI - 0.85, aN: [0.28, 0.28], aF: [0.28, 0.28], lN: [PI / 2 + 0.3, -0.05], lF: [PI / 2 + 0.3, -0.05], footRel: PI / 2, ground: 'pelvis' };
    case 'band': return { torso: PI, upper: PI - 0.42, head: PI - 0.75, aN: [1.05, 0.9], aF: [1.05, 0.9], lN: [PI / 2, 0], lF: [PI / 2, 0], footRel: PI / 2, ground: 'pelvis' };
    case 'quad': {
      const dy = (L.up + L.fore + 8) - (L.thigh + 16);
      const tor = PI - Math.asin(dy / L.torso);
      return { torso: tor, head: tor + 0.1, aN: [-PI / 2, -PI / 2], aF: [-PI / 2, -PI / 2], lN: [-PI / 2, 0], lF: [-PI / 2, 0], footRel: 0, ground: 'knee' };
    }
    case 'plank': {
      const th = Math.asin((L.up + L.fore) / (L.torso + L.thigh + L.shin));
      return { torso: PI - th, head: PI - th, aN: [-PI / 2, -PI / 2], aF: [-PI / 2, -PI / 2], lN: [-th, -th], lF: [-th, -th], footRel: -PI / 2 + 0.2, ground: 'toe' };
    }
    case 'elbow': {
      const th = Math.asin((L.up + 14) / (L.torso + L.thigh + L.shin));
      return { torso: PI - th, head: PI - th, aN: [-PI / 2, PI], aF: [-PI / 2, PI], lN: [-th, -th], lF: [-th, -th], footRel: -PI / 2 + 0.2, ground: 'toe' };
    }
  }
}
// 움직임 목표(해당 팔다리만 덮어씀)
function targetFor(post, limb) {
  const arm = limb[0] === 'a';
  switch (post) {
    case 'supine': return arm ? [PI - 0.28, PI - 0.28] : [0.32, 0.26];
    case 'tuck': return arm ? [PI - 0.35, PI - 0.35] : [0.8, 0.7];
    case 'band': return arm ? [PI / 2 + 0.55, PI / 2 + 0.45] : [0.42, 0.36];
    case 'quad': return arm ? [-PI + 0.02, -PI + 0.02] : [0.04, 0.04];  // 팔은 아래→앞으로 (−π 쪽으로 회전)
    case 'elbow': return [-PI + 0.02, PI - 0.02];
  }
}
const prone = post => post === 'quad' || post === 'plank' || post === 'elbow';
function sideName(post, limb) {
  const near = limb[1] === 'N';
  const left = prone(post) ? near : !near;
  return (left ? '왼' : '오른') + (limb[0] === 'a' ? '팔' : '다리');
}

// 한 회 반복의 진행량 0→1→0
function repK(p) {
  if (p < 0.08) return 0;
  if (p < 0.44) return ease.inOut((p - 0.08) / 0.36);
  if (p < 0.58) return 1;
  if (p < 0.94) return 1 - ease.inOut((p - 0.58) / 0.36);
  return 0;
}

// 포즈 → 관절 좌표(캔버스). pelvis를 바닥 조건에 맞춰 배치
function raw(pose) {
  const pt = (p, a, len) => [p[0] + len * Math.cos(a), p[1] - len * Math.sin(a)];
  const P0 = [0, 0];
  const M = pt(P0, pose.torso, L.torso / 2);
  const S = pt(M, pose.upper ?? pose.torso, L.torso / 2);
  const NK = pt(S, pose.head, L.neck), HD = pt(NK, pose.head, L.head);
  const limb = (root, a, l1, l2) => { const m = pt(root, a[0], l1); return [root, m, pt(m, a[1], l2)]; };
  const J = {
    S, M, NK, HD, P: P0,
    aN: limb(S, pose.aN, L.up, L.fore), aF: limb(S, pose.aF, L.up, L.fore),
    lN: limb(P0, pose.lN, L.thigh, L.shin), lF: limb(P0, pose.lF, L.thigh, L.shin),
  };
  J.fN = pt(J.lN[2], pose.lN[1] + pose.footRel, L.foot); J.fF = pt(J.lF[2], pose.lF[1] + pose.footRel, L.foot);
  return J;
}
// 바닥 접지는 자세의 기본 포즈로 한 번 정한다(움직이는 다리가 몸을 끌어내리지 않게)
// 골반(누움) / 무릎(네발) / 발끝(플랭크)
function groundY(post) {
  const B = basePose(post), J = raw(B);
  if (B.ground === 'pelvis') return L.tw / 2;
  if (B.ground === 'knee') return J.lF[1][1] + L.lw / 2;
  return Math.max(J.lF[2][1], J.fF[1]) + L.lw / 2;
}
function solve(pose, ox) {
  const J = raw(pose);
  const dx = ox, dy = FLOOR - groundY(pose.post);
  const mv = q => [q[0] + dx, q[1] + dy];
  for (const k of ['S', 'M', 'NK', 'HD', 'P', 'fN', 'fF']) J[k] = mv(J[k]);
  for (const k of ['aN', 'aF', 'lN', 'lF']) J[k] = J[k].map(mv);
  return J;
}
// 기본 포즈의 가로 중심이 화면 중앙에 오도록 오프셋 계산 (자세당 1회)
const OX = {};
function offsetFor(post) {
  if (OX[post] != null) return OX[post];
  const base = { ...basePose(post), post };
  const pts = [];
  const add = J => { pts.push(J.HD, J.S, J.P, J.fN, J.fF, ...J.aN, ...J.aF, ...J.lN, ...J.lF); };
  add(solve(base, 0));
  for (const limb of ['aN', 'lN']) { const tg = targetFor(post, limb); if (tg) add(solve({ ...base, [limb]: tg }, 0)); }
  const xs = pts.map(p => p[0]);
  return (OX[post] = CX - (Math.min(...xs) + Math.max(...xs)) / 2);
}

const lerpA = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
function poseAt(post, mv, k, extra = {}) {
  const p = { ...basePose(post), post };
  for (const limb of mv) { const tg = targetFor(post, limb); if (tg) p[limb] = lerpA(p[limb], tg, k); }
  return Object.assign(p, extra);
}

// ── 그리기 ──
function seg(a, b, w, col) { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
function poly(pts, w, col) { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke(); }
function drawFigure(J, mv, opt = {}) {
  const colOf = (limb, near) => mv.includes(limb) ? (near ? ACC : ACC_F) : (near ? INK : FAR);
  // 뒤쪽 팔다리 → 몸통 → 앞쪽 팔다리
  poly([...J.lF, J.fF], L.lw, colOf('lF', false));
  poly(J.aF, L.lw - 2, colOf('aF', false));
  if (opt.block) { const k = J.lN[1]; ctx.save(); ctx.translate(k[0], k[1]); ctx.fillStyle = BLOCK; rr(-34, -34, 68, 68, 12); ctx.fill(); ctx.restore(); }
  if (opt.band) drawBand(J, opt.band);
  seg(J.P, J.M, L.tw, INK); seg(J.M, J.S, L.tw, INK);
  seg(J.S, J.NK, 30, INK);
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(J.HD[0], J.HD[1], L.head, 0, PI * 2); ctx.fill();
  poly([...J.lN, J.fN], L.lw, colOf('lN', true));
  poly(J.aN, L.lw, colOf('aN', true));
}
function drawBand(J, which) {
  const foot = which === 'N' ? J.fN : J.fF, ankle = which === 'N' ? J.lN[2] : J.lF[2];
  const sole = [(foot[0] + ankle[0]) / 2 + 6, (foot[1] + ankle[1]) / 2 - 4];
  for (const hand of [J.aF[2], J.aN[2]]) {
    ctx.strokeStyle = BAND; ctx.lineWidth = 9; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(hand[0], hand[1]); ctx.lineTo(sole[0] + 14, sole[1]); ctx.stroke();
  }
  ctx.strokeStyle = BAND; ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(sole[0] + 14, sole[1], 14, -PI / 2, PI / 2); ctx.stroke();
}
// 허리·가슴 긴장 표시: 몸통 중앙의 점선 고리
function drawRing(J, t, a) {
  const m = [(J.P[0] + J.S[0]) / 2, (J.P[1] + J.S[1]) / 2], ang = Math.atan2(J.S[1] - J.P[1], J.S[0] - J.P[0]);
  ctx.save(); ctx.globalAlpha = a * (0.55 + 0.25 * Math.sin(t * 3)); ctx.translate(m[0], m[1]); ctx.rotate(ang);
  ctx.setLineDash([10, 10]); ctx.strokeStyle = SAGE; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.ellipse(0, 0, 92, 60, 0, 0, PI * 2); ctx.stroke(); ctx.setLineDash([]);
  ctx.restore();
}
// 움직임 궤적 화살표(왕복)
function drawPath(post, mv, ox, a) {
  for (const limb of mv) {
    const e0 = solve(poseAt(post, []), ox)[limb][2], e1 = solve(poseAt(post, [limb], 1), ox)[limb][2];
    const root = solve(poseAt(post, []), ox)[limb][0];
    const mid = [(e0[0] + e1[0]) / 2, (e0[1] + e1[1]) / 2];
    const out = [mid[0] - root[0], mid[1] - root[1]], len = Math.hypot(...out) || 1;
    const cp = [mid[0] + out[0] / len * 70, mid[1] + out[1] / len * 70];
    ctx.save(); ctx.globalAlpha = a * 0.55; ctx.setLineDash([12, 12]);
    ctx.strokeStyle = limb[1] === 'N' ? ACC : ACC_F; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(e0[0], e0[1]); ctx.quadraticCurveTo(cp[0], cp[1], e1[0], e1[1]); ctx.stroke(); ctx.setLineDash([]);
    head(e1, Math.atan2(e1[1] - cp[1], e1[0] - cp[0])); head(e0, Math.atan2(e0[1] - cp[1], e0[0] - cp[0]));
    ctx.restore();
  }
  function head(p, ang) { ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate(ang); ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -11); ctx.lineTo(-8, 11); ctx.closePath(); ctx.fill(); ctx.restore(); }
}
function tag(p, text, near, a) {
  ctx.save(); ctx.globalAlpha = a; ctx.font = '900 30px Pretendard';
  const w = ctx.measureText(text).width + 28, x = clamp(p[0] - w / 2, 64, 1016 - w), y = p[1] - 78;
  ctx.fillStyle = near ? ACC : '#C9775A'; rr(x, y, w, 48, 24); ctx.fill();
  ctx.fillStyle = '#FFFFFF'; ctx.textBaseline = 'middle'; ctx.fillText(text, x + 14, y + 26); ctx.textBaseline = 'alphabetic';
  ctx.restore();
}
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function txt(s, x, y, size, color, weight = 700, align = 'left') { ctx.font = `${weight} ${size}px Pretendard`; ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(s, x, y); ctx.textAlign = 'left'; }

// ── 장면 ──
function drawHeader(ex, st, si, lt, tStep) {
  const a = ease.out(prog(lt, 0, 0.35));
  ctx.save(); ctx.globalAlpha = a;
  ctx.fillStyle = ACC; ctx.beginPath(); ctx.arc(116, 392, 42, 0, PI * 2); ctx.fill();
  ctx.textBaseline = 'middle'; txt(String(ex.no), 116, 396, 46, '#FFFFFF', 900, 'center'); ctx.textBaseline = 'alphabetic';
  txt(ex.name, 180, 412, ex.name.length > 9 ? 56 : 64, INK, 900);
  txt(ex.sub, 182, 472, 36, MUTE, 700);
  ctx.restore();
  if (V === 'B') drawMap(ex.no);
  // 단계 칩
  if (st && st.label && ex.steps.length > 1) {
    const y = V === 'A' ? 560 : 640;
    const ka = ease.out(prog(tStep, 0, 0.3));
    ctx.save(); ctx.globalAlpha = ka;
    ctx.font = '900 38px Pretendard';
    const label = `${ex.no}-${si + 1}  ${st.label}`, w = ctx.measureText(label).width + 48;
    ctx.fillStyle = INK; rr(84, y - 40, w, 64, 32); ctx.fill();
    ctx.fillStyle = '#FFFFFF'; ctx.fillText(label, 108, y + 5);
    ex.steps.forEach((_, i) => { ctx.fillStyle = i === si ? ACC : i < si ? INK : '#D8D0C4'; ctx.beginPath(); ctx.arc(84 + w + 34 + i * 30, y - 8, 9, 0, PI * 2); ctx.fill(); });
    ctx.restore();
  }
}
function drawMap(cur) {
  const n = EX.length, x0 = 84, gap = (1016 - 84 - 52) / (n - 1);
  EX.forEach((ex, i) => {
    const x = x0 + 26 + i * gap, y = 556, on = ex.no === cur, done = ex.no < cur;
    ctx.fillStyle = on ? ACC : done ? INK : '#E1D9CD'; ctx.beginPath(); ctx.arc(x, y, 24, 0, PI * 2); ctx.fill();
    ctx.textBaseline = 'middle'; txt(String(ex.no), x, y + 2, 26, on || done ? '#FFFFFF' : MUTE, 900, 'center'); ctx.textBaseline = 'alphabetic';
  });
}
function drawLegend(ex, st, mv, a) {
  if (!mv.length || !st) return;
  ctx.save(); ctx.globalAlpha = a;
  const post = ex.posture;
  const moving = mv.map(l => sideName(post, l));
  let text = '움직임  ' + (st.tags ? moving.join(' · ') : (st.label || ''));
  ctx.font = '700 36px Pretendard';
  const w = ctx.measureText(text).width + 40;
  ctx.fillStyle = ACC; ctx.beginPath(); ctx.arc(CX - w / 2 + 8, FLOOR + 92, 11, 0, PI * 2); ctx.fill();
  txt(text, CX - w / 2 + 32, FLOOR + 104, 36, INK, 700);
  ctx.restore();
}
function drawCaption(lines, s, e, t) {
  const n = lines.length;
  lines.forEach((line, i) => {
    const last = i === n - 1;
    drawLine(ctx, [{ text: line, color: last ? INK : '#5A544D' }], CX, 1540 - (n - 1 - i) * 76, { t, start: s + 0.05 + i * 0.08, end: e, size: last ? 54 : 46, weight: last ? 900 : 700, shadow: false, rise: 18, stagger: 0.012 });
  });
}

function drawStep(sg, t) {
  const ex = EX[sg.xi], st = ex.steps[sg.si], post = ex.posture, ox = offsetFor(post);
  const lt = t - sg.s;
  // 현재 반복
  let mv = [], k = 0, extra = {}, rot = 0, rollX = 0;
  const rep = sg.reps.find(r => t >= r.s && t < r.e) || (sg.reps.length ? null : null);
  if (rep) { mv = rep.mv; k = repK((t - rep.s) / (rep.e - rep.s)); }
  if (st.kind === 'nod' && rep) { extra.head = PI - 0.35 * k; }
  if (st.kind === 'rock' && rep) { const ph = (t - rep.s) / (rep.e - rep.s); rot = 0.1 * Math.sin(ph * PI * 2); rollX = 0; }
  const pose = poseAt(post, mv, k, extra);
  const J = solve(pose, ox + rollX);
  const a = ease.out(prog(t, TL.segs.find(x => x.type === 'title' && x.xi === sg.xi).s, 0.4));
  // 매트
  ctx.fillStyle = MAT; rr(70, FLOOR, 940, 18, 9); ctx.fill();
  ctx.save(); ctx.globalAlpha = a;
  if (rot) { const pv = [J.M[0], FLOOR]; ctx.translate(pv[0], pv[1]); ctx.rotate(-rot); ctx.translate(-pv[0], -pv[1]); }
  const anyMv = sg.reps.length > 0 && st.kind !== 'nod' && st.kind !== 'rock';
  const mvShow = anyMv ? [...new Set(sg.reps.flatMap(r => r.mv))] : [];
  if (anyMv) drawPath(post, rep ? rep.mv : mvShow, ox, 1);
  drawFigure(J, anyMv && rep ? rep.mv : [], { block: ex.block, band: st.band });
  if (ex.ring) drawRing(J, t, 1);
  ctx.restore();
  if (st.kind === 'rock') drawRockArrow(J, a);
  if (st.kind === 'nod') drawNodArrow(J, a);
  if (st.tags && rep) for (const limb of rep.mv) tag(J[limb][2], sideName(post, limb), limb[1] === 'N', clamp(k * 3));
  if (anyMv) drawLegend(ex, st, rep ? rep.mv : [], a);
  drawCaption(V === 'A' ? st.cue : [st.note], sg.s, sg.e, t);
}
function drawRockArrow(J, a) {
  const c = [J.M[0], FLOOR + 60];
  ctx.save(); ctx.globalAlpha = a * 0.6; ctx.strokeStyle = ACC; ctx.lineWidth = 6; ctx.setLineDash([12, 12]);
  ctx.beginPath(); ctx.arc(c[0], c[1] - 260, 300, PI / 2 + 0.25, PI / 2 - 0.25, true); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
}
function drawNodArrow(J, a) {
  ctx.save(); ctx.globalAlpha = a * 0.6; ctx.strokeStyle = ACC; ctx.lineWidth = 6; ctx.setLineDash([10, 10]);
  ctx.beginPath(); ctx.arc(J.NK[0], J.NK[1], 100, PI + 0.2, PI + 1.0); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
}

function drawTitle(sg, t) {
  // 동작 전환: 헤더 등장 + 기본 포즈 페이드인
  const ex = EX[sg.xi], post = ex.posture, ox = offsetFor(post);
  const a = ease.out(prog(t, sg.s, 0.4));
  ctx.fillStyle = MAT; rr(70, FLOOR, 940, 18, 9); ctx.fill();
  ctx.save(); ctx.globalAlpha = a;
  const J = solve(poseAt(post, []), ox);
  drawFigure(J, [], { block: ex.block, band: ex.steps[0].band });
  ctx.restore();
}

function drawList(title, sub, t, s, withNotes) {
  drawLine(ctx, [{ text: title, color: INK }], CX, 420, { t, start: s + 0.05, end: 1e9, size: 80, shadow: false });
  if (sub) drawLine(ctx, [{ text: sub, color: MUTE }], CX, 490, { t, start: s + 0.25, end: 1e9, size: 38, weight: 700, shadow: false });
  const y0 = 600, gap = withNotes ? 108 : 92;
  EX.forEach((ex, i) => {
    const k = ease.out(prog(t, s + 0.4 + i * (withNotes ? 0.12 : 0.18), 0.35));
    ctx.save(); ctx.globalAlpha = k; ctx.translate((1 - k) * 30, 0);
    const y = y0 + i * gap;
    ctx.fillStyle = ACC; ctx.beginPath(); ctx.arc(130, y, 28, 0, PI * 2); ctx.fill();
    ctx.textBaseline = 'middle'; txt(String(ex.no), 130, y + 2, 30, '#FFFFFF', 900, 'center'); ctx.textBaseline = 'alphabetic';
    txt(ex.name, 182, y + 14, 42, INK, 900);
    if (withNotes) txt(ex.sub + (ex.steps.length > 1 ? ` · ${ex.steps.length}단계` : ''), 182, y + 56, 28, MUTE, 700);
    else { ctx.font = '900 42px Pretendard'; const w = ctx.measureText(ex.name).width; txt(ex.sub, 196 + w, y + 12, 30, MUTE, 700); }
    ctx.restore();
  });
}

window.renderFrame = function (t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
  const sg = TL.segs.find(x => t >= x.s && t < x.e) || TL.segs[TL.segs.length - 1];
  if (sg.type === 'intro') {
    if (V === 'A') drawList('오늘의 시퀀스', 'DNS 기반 코어 운동', t, sg.s, false);
    else drawList('시퀀스 기록', 'DNS 기반 코어 · 9동작', t, sg.s, false);
  } else if (sg.type === 'outro') {
    if (V === 'A') drawList('오늘 한 동작', '천천히 다시 따라 해 보세요', t, sg.s, false);
    else drawList('시퀀스 요약', null, t, sg.s, true);
  } else {
    const ex = EX[sg.xi];
    const exStart = TL.segs.find(x => x.type === 'title' && x.xi === sg.xi).s;
    const st = sg.type === 'step' ? ex.steps[sg.si] : null;
    drawHeader(ex, st, sg.si, t - exStart, sg.type === 'step' ? t - sg.s : 0);
    if (sg.type === 'title') drawTitle(sg, t); else drawStep(sg, t);
  }
  // 진행 바
  ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.fillRect(60, 262, 960, 6);
  ctx.fillStyle = ACC; ctx.fillRect(60, 262, 960 * clamp(t / TL.dur), 6);
};
(async () => { await Promise.all(['900 80px Pretendard', '700 50px Pretendard'].map(f => document.fonts.load(f))); window.renderFrame(0); window.__ready = true; })();
