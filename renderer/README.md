# renderer — 코드로 짜는 숏폼 영상

장면을 `window.renderFrame(t)` 하나로 정의한 HTML(Canvas)을 Chromium에서 프레임 단위로 캡처해 ffmpeg로 MP4를 만든다.
모든 상태가 `t`의 함수라서 렌더 결과가 항상 같다(결정적 렌더).

```bash
cd renderer && npm i
node synth.mjs motion out/motion.wav                  # 사운드트랙도 코드로 합성
ffmpeg -i out/motion.wav -af loudnorm=I=-16:TP=-1.5 out/motion_n.wav
node render.mjs scenes/exercise-flow-motion.html out/motion.mp4 21 out/motion_n.wav
node render.mjs scenes/exercise-flow-motion.html out/motion.mp4 21 --stills 0.5,9.6   # 점검용 스틸
```

`render.mjs`는 작업 디렉터리를 로컬 HTTP로 서빙하므로(ES 모듈용) `renderer/`에서 실행한다. 3D는 SwiftShader 소프트웨어 WebGL로 렌더되어 느리다(약 1fps). 사운드 종류: `motion` · `3d` · `kinetic` · `explainer`.

`render.mjs`의 `executablePath`는 클라우드 세션에 미리 깔린 headless shell 경로다. 로컬에서는 이 옵션을 지우고 `npx playwright install chromium`을 실행한다.

| 장면 파일 | 템플릿 | 길이 | 구성 |
|---|---|---|---|
| `scenes/exercise-flow-motion.html` | B 시각 몰입형 | 21초 | 흐르는 선: 새로움 → 익숙한 고리 → 이탈(★인터럽트 9초) → 쉼 → 다시 흐름 → 루프 |
| `scenes/exercise-flow-kinetic.html` | 키네틱 타이포 | 21초 | 글자가 피사체: 슬램 훅 → 흩어지는 단어 → 반복 마퀴(패턴) → ★한 줄 이탈 → 느린 쉼 → 취소선 → 세 동사 컬러 비트 → 물결 엔딩 |
| `scenes/exercise-flow-3d.html` | 3D (Three.js) | 21초 | 리본 다발 → 토러스 표면을 맴돎 → ★리본 하나가 카메라 앞으로 이탈 → 수면처럼 가라앉는 쉼 → 다시 흐름 |
| `scenes/exercise-flow-explainer.html` | A 설명형 | 22초 | 훅 → 효과 체감 곡선 → 관점 전환 → ①알아차리기(★인터럽트 9.5초) ②벗어나 보기 ③쉬기 → 순환 → CTA |

공통 규격: 1080×1920, 30fps, Pretendard. 텍스트는 `top_safe`, `lower_safe`(하단 기준선 1540), `cta_center` 밴드에만 둔다(`docs/shortform-screen-layout.md` §3).

## DNS 코어 시퀀스 (설명형, 2버전)

`scenes/dns/` — 동작 데이터(`dns-timeline.js`) 하나로 두 버전을 만든다. 인체는 옆모습 2D 리그(몸통 2분절: 허리/등 위쪽)로 그린다.

| 파일 | 용도 | 길이 | 하단 문구 |
|---|---|---|---|
| `dns-review.html` (A) | 회원 복습용 | 약 2분 10초 | 큐잉 2줄, 단계당 2회 반복 |
| `dns-record.html` (B) | 강사 시퀀스 기록용 | 약 1분 15초 | 기술 노트 1줄, 시퀀스 맵, 요약 카드 |

```bash
mkdir -p out && node scenes/dns/dns-audio.cjs          # 타임라인 → out/dns-A.json, dns-B.json
node synth.mjs out/dns-A.json out/dns-A.wav
node render.mjs scenes/dns/dns-review.html out/dns-A.mp4 129.6 out/dns-A.wav
```

좌우 규칙(머리가 화면 왼쪽): 바로 누운 자세는 화면 앞쪽 팔다리가 오른쪽, 엎드린 자세는 왼쪽.
