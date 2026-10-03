// DNS 코어 시퀀스: 동작 데이터 + 버전별 타임라인 (브라우저·Node 공용 classic script)
// 좌우 규칙: 화면에서 머리가 왼쪽일 때
//   바로 누운 자세 → 화면 앞쪽(N) 팔다리 = 오른쪽, 뒤쪽(F) = 왼쪽
//   엎드린 자세(네발기기·플랭크) → 앞쪽(N) = 왼쪽, 뒤쪽(F) = 오른쪽
(function () {
  const EX = [
    { no: 1, name: '목풀기', sub: '바로 누워 무릎 세우기', posture: 'knees',
      steps: [{ label: null, kind: 'nod', cue: ['편하게 누워', '목을 부드럽게 풀기'], note: '바로 누움 · 무릎 세움' }] },
    { no: 2, name: '허리·가슴 긴장', sub: '바로 누워 90/90', posture: 'supine', ring: true,
      steps: [
        { label: '양팔', reps: [['aN', 'aF']], cue: ['허리·가슴 긴장을 유지한 채', '양팔을 머리 위로 내렸다 올리기'], note: '움직임: 양팔 · 고정: 양다리' },
        { label: '양다리', reps: [['lN', 'lF']], cue: ['허리가 뜨지 않게', '양다리를 뻗어 내렸다 올리기'], note: '움직임: 양다리 · 고정: 양팔' },
        { label: '팔·다리 동시', reps: [['aN', 'aF', 'lN', 'lF']], cue: ['팔은 머리 위로, 다리는 발끝 쪽으로', '몸이 길어지듯 동시에'], note: '양팔·양다리 동시 · 서로 반대 방향' },
        { label: '왼팔 + 오른다리', reps: [['aF', 'lN']], tags: true, cue: ['오른팔·왼다리는 고정', '왼팔과 오른다리만 반대 방향으로'], note: '움직임: 왼팔·오른다리 · 고정: 오른팔·왼다리' },
        { label: '오른팔 + 왼다리', reps: [['aN', 'lF']], tags: true, cue: ['왼팔·오른다리는 고정', '오른팔과 왼다리만 반대 방향으로'], note: '움직임: 오른팔·왼다리 · 고정: 왼팔·오른다리' },
      ] },
    { no: 3, name: '허리·가슴 긴장', sub: '엎드려서 · 네발기기', posture: 'quad', ring: true,
      steps: [
        { label: '팔', reps: [['aN'], ['aF']], tags: true, cue: ['손과 무릎으로 지지한 채', '한 팔씩 앞으로 뻗기'], note: '움직임: 팔(좌우 교대)' },
        { label: '다리', reps: [['lN'], ['lF']], tags: true, cue: ['허리가 처지지 않게', '한 다리씩 뒤로 뻗기'], note: '움직임: 다리(좌우 교대)' },
        { label: '팔·다리 동시', reps: [['aN', 'lF'], ['aF', 'lN']], tags: true, cue: ['반대쪽 팔과 다리를', '동시에 번갈아 뻗기'], note: '반대쪽 팔·다리 동시 · 좌우 교대' },
        { label: '왼팔 + 오른다리', reps: [['aN', 'lF']], tags: true, cue: ['오른팔·왼다리로 지지하고', '왼팔과 오른다리만 뻗기'], note: '움직임: 왼팔·오른다리 · 지지: 오른팔·왼다리' },
        { label: '오른팔 + 왼다리', reps: [['aF', 'lN']], tags: true, cue: ['왼팔·오른다리로 지지하고', '오른팔과 왼다리만 뻗기'], note: '움직임: 오른팔·왼다리 · 지지: 왼팔·오른다리' },
      ] },
    { no: 4, name: '턱 할로우', sub: '무릎 사이 블럭 · 머리 들기', posture: 'tuck', ring: true, block: true,
      steps: [
        { label: '자세 잡기', kind: 'hold', cue: ['허리는 바닥에 붙인 채', '머리·어깨만 들고 블럭 조이기'], note: '허리 바닥 고정 · 블럭: 무릎 사이 · 머리·어깨만 들기' },
        { label: '팔 들기', reps: [['aN', 'aF']], cue: ['허리가 뜨지 않게', '양팔을 머리 위로 들기'], note: '움직임: 양팔 · 허리 바닥 고정' },
        { label: '다리 들기', reps: [['lN', 'lF']], cue: ['허리가 뜨지 않는 높이까지만', '양다리를 뻗어 들기'], note: '움직임: 양다리 · 허리 바닥 고정' },
      ] },
    { no: 5, name: '턱 락', sub: '턱 할로우로 앞뒤 흔들기', posture: 'tuck', block: true,
      steps: [{ label: null, kind: 'rock', cue: ['허리는 바닥에 붙인 채', '앞뒤로 작게 흔들기'], note: '허리 바닥 고정 · 작은 범위로 앞뒤 흔들기' }] },
    { no: 6, name: '밴드 + 허리·가슴 긴장', sub: '바로 누워 · 목 든 채로', posture: 'band', ring: true,
      steps: [
        { label: '오른발', reps: [['aN', 'aF', 'lN']], band: 'N', tags: true, cue: ['양손에 밴드, 오른발 바닥에 걸기', '목을 든 채 장력을 느끼며 움직이기'], note: '밴드: 양손 → 오른발 바닥 · 목 든 채 유지' },
        { label: '왼발', reps: [['aN', 'aF', 'lF']], band: 'F', tags: true, cue: ['밴드를 왼발 바닥으로 옮기고', '목을 든 채 장력을 느끼며 움직이기'], note: '밴드: 양손 → 왼발 바닥 · 목 든 채 유지' },
      ] },
    { no: 7, name: '풀플랭크', sub: '손으로 지지', posture: 'plank', ring: true,
      steps: [{ label: null, kind: 'hold', cue: ['손으로 바닥을 밀고', '머리부터 발끝까지 일직선'], note: '손 지지 · 일직선 유지' }] },
    { no: 8, name: '팔꿈치 플랭크', sub: '팔꿈치로 지지', posture: 'elbow', ring: true,
      steps: [{ label: null, kind: 'hold', cue: ['팔꿈치로 지지하고', '일직선 유지'], note: '팔꿈치 지지 · 일직선 유지' }] },
    { no: 9, name: '플랭크 한 팔 뻗기', sub: '팔꿈치 플랭크에서', posture: 'elbow', ring: true,
      steps: [{ label: null, reps: [['aN'], ['aF']], tags: true, cue: ['몸이 흔들리지 않게', '한 팔씩 앞으로 뻗기'], note: '움직임: 팔(좌우 교대)' }] },
  ];

  const VER = {
    A: { rep: 2.6, repsPer: 2, hold: 4.0, title: 1.6, gap: 0.3, intro: 4.8, outro: 4.0 },
    B: { rep: 2.2, repsPer: 1, hold: 2.4, title: 0.9, gap: 0.2, intro: 2.6, outro: 6.5 },
  };

  // 세그먼트: {s,e,type:'intro'|'title'|'step'|'outro', ex, si, reps:[{s,e,mv}]}
  function build(v) {
    const C = VER[v]; let t = 0; const segs = [];
    segs.push({ s: 0, e: C.intro, type: 'intro' }); t = C.intro;
    EX.forEach((ex, xi) => {
      segs.push({ s: t, e: t + C.title, type: 'title', xi }); t += C.title;
      ex.steps.forEach((st, si) => {
        const s0 = t; const reps = [];
        if (st.kind === 'hold') t += C.hold;
        else {
          const sets = st.reps || [[]];
          // 교대 동작(세트 2개)은 좌우 한 번씩, 단일 세트는 repsPer 회
          const n = sets.length > 1 ? Math.max(sets.length, C.repsPer) : C.repsPer;
          for (let i = 0; i < n; i++) { reps.push({ s: t, e: t + C.rep, mv: sets[i % sets.length] }); t += C.rep; }
        }
        t += C.gap;
        segs.push({ s: s0, e: t, type: 'step', xi, si, reps });
      });
    });
    segs.push({ s: t, e: t + C.outro, type: 'outro' }); t += C.outro;
    return { dur: Math.round(t * 30) / 30, segs };
  }
  globalThis.DNS = { EX, VER, build };
})();
