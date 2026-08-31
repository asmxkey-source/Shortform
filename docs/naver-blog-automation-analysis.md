# 네이버 블로그 자동화 오픈소스 분석

> 조사일: 2026-08-31
> 목적: 기존에 작성한 블로그 글을 입력하면 카테고리(내돈내산 후기 / 레시피 / 체험단 / 정보성)별 스타일로
> 새 글을 생성·발행해주는 **개인용 블로그 자동화 웹앱** 설계를 위한 사전 조사.

---

## 1. 결론 요약 (TL;DR)

- 네이버 블로그는 **2020년에 공식 글쓰기 API(XML-RPC)가 종료**되어, 현존하는 모든 자동화는
  ① 브라우저 자동화(Selenium/Playwright)로 스마트에디터 ONE을 직접 조작하거나,
  ② 브라우저 로그인 세션(쿠키)을 확보한 뒤 **네이버 내부 발행 API(`RabbitWrite.naver`)** 를 호출하는 방식이다.
- GitHub 생태계 전체가 소규모(최대 수십 스타)이며, 그중 **가장 스타/포크가 많고 활발히 유지보수되는 프로젝트는
  [greekr4/viruagent-cli](https://github.com/greekr4/viruagent-cli) (★37 / fork 20, MIT, 2026년에도 활발)** 이다.
  Playwright 로그인 + SE Editor 컴포넌트 모델 + RabbitWrite API 조합으로, 우리가 만들 웹앱의 발행 계층
  레퍼런스로 가장 적합하다.
- 두 번째 레퍼런스는 [space-cap/naver-blog-mcp](https://github.com/space-cap/naver-blog-mcp)
  (★10 / fork 5, MIT, Python + Playwright). MCP 서버 형태라 Claude와의 연동 구조를 참고하기 좋다.
- 권장 아키텍처: **글 생성(LLM) → SE 컴포넌트 JSON 변환 → 초안(draft) 저장까지 자동화, 최종 발행은 사람이 확인**.
  네이버가 2025년 7월부터 봇 탐지를 강화했기 때문에, 계정 보호를 위해 "초안까지 자동"이 안전선이다.

---

## 2. 전제: 네이버 블로그에 공식 API가 없다

| 시기 | 상태 |
|---|---|
| ~2020 | XML-RPC 기반 글쓰기 API 제공 ([yousung/naver-blog-xmlrpc](https://github.com/yousung/naver-blog-xmlrpc) 등이 사용) |
| 2020~ | 글쓰기 API 종료. 네이버 오픈 API에는 블로그 **검색**만 남음 |
| 2025.07~ | 공감·댓글·서이추 등 상호작용 자동화에 대한 봇 차단 대폭 강화 |

따라서 "신뢰도"의 기준은 별점보다도 **어떤 우회 방식을 쓰는지, 그 방식이 얼마나 깨지기 어렵고 계정에 안전한지**로
봐야 한다.

---

## 3. 자동화 방식 3가지 비교

### 방식 A — Selenium + 클립보드 붙여넣기 (가장 흔함, 가장 취약)

`pyperclip`/`pyautogui`로 본문을 클립보드에 넣고 스마트에디터에 Ctrl+V 하는 방식.
[SIMHANSOL/Selenium-NaverBlogAutomaticPosting](https://github.com/SIMHANSOL/Selenium-NaverBlogAutomaticPosting)(★14),
[choigpt-ai/naver-blog-automation](https://github.com/choigpt-ai/naver-blog-automation)(★7) 등 대부분의 소형 레포가 이 방식이다.

- 장점: 구현이 쉽고 예제가 많다.
- 단점: headless 불가(클립보드/포커스 의존), 에디터 DOM 변경에 즉시 깨짐, 서식 제어가 조잡함(통짜 텍스트),
  봇 탐지에 가장 잘 걸림. **웹앱 백엔드로는 부적합.**

### 방식 B — Playwright 로그인 + 내부 발행 API(RabbitWrite) 호출 (권장)

브라우저는 **로그인 세션 확보용으로만** 쓰고, 실제 발행은 스마트에디터 ONE이 내부적으로 호출하는
`RabbitWrite.naver` 엔드포인트에 **SE 컴포넌트 문서모델(JSON)** 을 직접 POST하는 방식.
이미지도 네이버 전용 이미지 업로드 API로 올린 뒤 이미지 컴포넌트로 본문에 삽입한다.

- 대표 구현: **[greekr4/viruagent-cli](https://github.com/greekr4/viruagent-cli)** — HTML(`<p>`, `<h2>`, `<img>`,
  `<blockquote>` 등)을 SE 컴포넌트로 자동 변환해 발행. 카테고리 지정, 태그, 공개범위, 이미지 업로드 지원.
- 기술 해부 자료: [네이버 블로그 자동 발행기 해부 — SmartEditor, RabbitWrite, 이미지 업로드](https://wikidocs.net/379712)
  (draft 저장, 예약 발행, imageGroup 콜라주까지 다룸)
- 장점: headless 서버에서 동작 가능, 서식(소제목·인용구·구분선·이미지)을 구조적으로 제어, 에디터 UI 변경에 상대적으로 강함.
- 단점: 비공식 API라 네이버가 스키마를 바꾸면 추적 필요. 로그인 시 캡차/2단계 인증은 수동 개입 필요할 수 있음.

### 방식 C — MCP 서버 (Claude 연동형)

[space-cap/naver-blog-mcp](https://github.com/space-cap/naver-blog-mcp) (★10/fork 5, Python 3.13 + Playwright 1.55, MIT).
세션 저장·재사용, 글 작성, 다중 포맷 이미지 업로드, 카테고리 목록 조회, Tenacity 재시도 로직 포함.
웹앱 대신 "Claude Desktop에서 바로 발행"이 필요하면 이걸 그대로 쓰는 것도 선택지.

---

## 4. 주요 레포 신뢰도 비교표

| 레포 | ★ / fork | 방식 | 언어 | 활동성 | 라이선스 | 평가 |
|---|---|---|---|---|---|---|
| [greekr4/viruagent-cli](https://github.com/greekr4/viruagent-cli) | 37 / 20 | Playwright + SE컴포넌트 + RabbitWrite | JS(Node) | 2026 활발, 커밋 68+ | MIT | **1순위 레퍼런스.** 발행 계층 설계 그대로 참고 |
| [space-cap/naver-blog-mcp](https://github.com/space-cap/naver-blog-mcp) | 10 / 5 | Playwright + MCP | Python | 유지보수 중 | MIT | 세션 관리·재시도 로직 참고 |
| [SIMHANSOL/Selenium-NaverBlogAutomaticPosting](https://github.com/SIMHANSOL/Selenium-NaverBlogAutomaticPosting) | 14 / - | Selenium+클립보드 | Python | 2022 중단 | - | 방식 A 예제. 참고만 |
| [Jongjineee/auto_coupang_partners](https://github.com/Jongjineee/auto_coupang_partners) | - | 쿠팡API+네이버 업로드 | Python | 2020 중단 | - | 제휴글 파이프라인 아이디어 참고 |
| [pjt3591oo/blog_post_bot_cli](https://github.com/pjt3591oo/blog_post_bot_cli) | 7 / - | 봇 CLI | Python | 2020 중단 | - | 오래됨 |
| [lushlife99/automation-naver-blog](https://github.com/lushlife99/automation-naver-blog) | - | 공감/댓글/서이추 | Java | - | - | **참고 비권장** — 2025.07 이후 네이버가 강력 차단하는 영역 |
| [yousung/naver-blog-xmlrpc](https://github.com/yousung/naver-blog-xmlrpc) | - | XML-RPC | PHP | 사망(API 종료) | - | 역사적 참고용 |

※ 이 도메인은 니치라서 절대 스타 수가 작다. "포크 많이 된 것" 기준 1위도 viruagent-cli(20 fork)다.

---

## 5. 우리 웹앱 권장 아키텍처

```
[기존 글 입력]                [생성]                    [발행]
 블로그 글 URL/텍스트  ──▶  스타일 프로필 추출  ──▶  카테고리별 프롬프트
 (내 글 코퍼스)             (LLM, 카테고리별)         + 새 글 초안 생성 (Claude API)
                                                          │
                                                          ▼
                                              HTML → SE 컴포넌트 JSON 변환
                                                          │
                                                          ▼
                                          Playwright 세션 + RabbitWrite로
                                          네이버 블로그 "초안 저장" (기본값)
                                          └─ 사용자가 확인 후 발행 버튼 클릭
```

### 구성 요소

1. **콘텐츠 인제스트**: 기존 글을 URL로 받으면 크롤링(모바일 뷰 `m.blog.naver.com`이 파싱 쉬움), 텍스트로 받으면 그대로 저장.
2. **스타일 프로필**: 카테고리별(내돈내산/레시피/체험단/정보성)로 기존 글에서 어투·구성(도입-본문-총평), 문단 길이,
   이모지/말줄임 습관, 필수 고지문("내돈내산으로 작성", "체험단 제공받아 작성") 등을 추출해 프롬프트 템플릿화.
3. **생성기**: Claude API로 카테고리 템플릿 + 스타일 프로필 + 소재 입력 → HTML 초안 생성.
   - 체험단 글에는 **경제적 대가 고지문 자동 삽입**(공정위 표시광고법 필수), 내돈내산 글에는 반대 고지.
4. **발행기**: viruagent-cli 방식을 참고해 Node(Playwright) 발행 모듈 구현. 로그인 세션은 서버에 암호화 저장·재사용.
   기본 동작은 **초안 저장 + 카테고리 지정**, 발행/예약발행은 옵트인.
5. **웹 UI**: 글 목록 → 카테고리 선택 → 소재 입력 → 미리보기(스마트에디터 유사 렌더) → 초안 전송.

### 리스크와 대응

| 리스크 | 대응 |
|---|---|
| 비공식 API 스키마 변경 | 발행 모듈을 어댑터로 격리, viruagent-cli 업데이트 추적 |
| 로그인 캡차/2FA | 최초 로그인만 수동(브라우저 창) → 세션 쿠키 재사용 |
| 봇 탐지·계정 제재 | 발행 빈도 제한(랜덤 딜레이), 상호작용(공감·댓글) 자동화는 하지 않음 |
| AI 생성 글 저품질 판정(C-Rank/DIA) | 초안 후 사람 검수 필수, 실제 경험 사진·데이터 삽입 유도 |

---

## 6. 다음 단계 전 확인이 필요한 것 (사용자 질문)

1. **기존 글 전달 형태**: 블로그 URL 목록? 텍스트 복붙? 네이버 블로그 백업 파일?
2. **자동화 범위**: 네이버에 "초안 저장"까지만 자동(권장)인지, 발행·예약발행까지 원하는지.
3. **이미지**: 직접 업로드한 사진을 쓰는지(업로드 UI 필요), 글마다 몇 장 수준인지.
4. **글 생성 vs 글 변환**: 새 소재를 주면 글을 새로 써주는 것인지, 이미 쓴 초고를 카테고리 스타일로 다듬는 것인지, 둘 다인지.
5. **스택 선호**: 발행 모듈은 Node(Playwright)가 유리한데, 웹앱 전체를 Next.js 단일 스택으로 갈지, 프론트/백 분리할지.
6. **계정 리스크 감수 수준**: 비공식 자동화라 이용약관상 제재 가능성이 0이 아님을 전제로 진행해도 되는지.

---

## 참고 자료

- [greekr4/viruagent-cli](https://github.com/greekr4/viruagent-cli) — 1순위 레퍼런스 (★37/fork 20)
- [viruagent-cli Naver 가이드](https://github.com/greekr4/viruagent-cli/blob/main/docs/en/guide-naver.md)
- [space-cap/naver-blog-mcp](https://github.com/space-cap/naver-blog-mcp) — Playwright MCP 서버
- [네이버 블로그 자동 발행기 해부 (wikidocs)](https://wikidocs.net/379712) / [brunch 버전](https://brunch.co.kr/@little-books/198)
- [GitHub topic: naver-blog](https://github.com/topics/naver-blog)
- [네이버 오픈 API 목록](https://naver.github.io/naver-openapi-guide/apilist.html) — 블로그는 검색 API만 존재
- [SIMHANSOL/Selenium-NaverBlogAutomaticPosting](https://github.com/SIMHANSOL/Selenium-NaverBlogAutomaticPosting)
- [Jongjineee/auto_coupang_partners](https://github.com/Jongjineee/auto_coupang_partners) / [개발기 블로그](https://jongjineee.github.io/2020/03/29/auto_naver.html)
- [gpters: ChatGPT+Selenium 네이버 블로그 자동화 사례](https://www.gpters.org/dev/post/connect-naver-selenium-automatically-EzG4w5z8ru5ZF9V)
