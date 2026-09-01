#!/usr/bin/env python3
"""네이버 검색 자동완성 조회.

로그인이 필요 없고 실시간이다. 제목·소제목·태그의 표현을 정할 때
추측 대신 실제 질의 표현을 쓰기 위해 사용한다.

    python3 tools/naver_autocomplete.py 오크라 "오크라 데" "오크라 손질"
"""
import json
import sys
import urllib.parse
import urllib.request

ENDPOINT = "https://ac.search.naver.com/nx/ac"
PARAMS = {
    "con": "0", "frm": "nv", "ans": "2", "r_format": "json",
    "r_enc": "UTF-8", "r_unicode": "0", "t_koreng": "1",
    "run": "2", "rev": "4", "q_enc": "UTF-8", "st": "100",
}


def suggest(query: str, timeout: int = 20) -> list[str]:
    url = f"{ENDPOINT}?{urllib.parse.urlencode({**PARAMS, 'q': query})}"
    req = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0",
        "Referer": "https://search.naver.com/",
    })
    with urllib.request.urlopen(req, timeout=timeout) as res:
        data = json.load(res)
    return [item[0] for group in data.get("items", []) for item in group]


def main(argv: list[str]) -> int:
    if not argv:
        print(__doc__)
        return 1
    for q in argv:
        print(f"[{q}]")
        try:
            hits = suggest(q)
        except Exception as exc:
            print(f"  조회 실패: {exc}")
            continue
        if not hits:
            print("  (결과 없음 — 이 표현으로는 검색하지 않습니다)")
            continue
        for rank, hit in enumerate(hits, 1):
            print(f"  {rank:2}. {hit}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
