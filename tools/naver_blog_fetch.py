#!/usr/bin/env python3
"""네이버 블로그 글을 SE(스마트에디터 ONE) 컴포넌트 단위로 추출한다.

사용법:
    python3 tools/naver_blog_fetch.py <url> [<url> ...] --out data/raw

m.blog.naver.com/{blogId}/{logNo} 가 본문을 SSR로 내려주므로 로그인 없이 파싱 가능.
글마다 <logNo>.json 을 저장한다.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.request
from pathlib import Path

from bs4 import BeautifulSoup

UA = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 "
    "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
)


def parse_url(url: str) -> tuple[str, str]:
    """blog.naver.com/{id}/{logNo} 와 PostView.naver?blogId=&logNo= 둘 다 받는다."""
    m = re.search(r"[?&]blogId=([^&]+).*?[?&]logNo=(\d+)", url)
    if m:
        return m.group(1), m.group(2)
    m = re.search(r"blog\.naver\.com/([^/?]+)/(\d+)", url)
    if not m:
        raise ValueError(f"blogId/logNo를 찾을 수 없는 URL: {url}")
    return m.group(1), m.group(2)


def fetch(blog_id: str, log_no: str) -> str:
    url = f"https://m.blog.naver.com/{blog_id}/{log_no}"
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8", errors="replace")


def script_var(html: str, name: str) -> str:
    """`var gsTagName = "...";` 형태의 값을 읽는다.

    HTML은 이미 UTF-8로 디코딩된 상태라 unicode_escape를 그대로 태우면 한글이 깨진다.
    \\uXXXX 형태의 이스케이프만 선택적으로 되돌린다.
    """
    m = re.search(rf'var\s+{name}\s*=\s*"((?:[^"\\]|\\.)*)"', html)
    if not m:
        return ""
    raw = m.group(1)
    raw = re.sub(r"\\u([0-9a-fA-F]{4})", lambda x: chr(int(x.group(1), 16)), raw)
    return raw.replace('\\"', '"').replace("\\\\", "\\")


def _num_var(html: str, name: str) -> str:
    """`var gsCategoryNo = 29;` 처럼 따옴표 없는 값."""
    m = re.search(rf"var\s+{name}\s*=\s*'?\"?(\d+)", html)
    return m.group(1) if m else ""


def text_of(node) -> str:
    """SE 텍스트 컴포넌트를 줄 단위로. 빈 줄은 유지하지 않는다."""
    lines = []
    for p in node.select("p.se-text-paragraph, .se-text-paragraph"):
        t = p.get_text(strip=True).replace("​", "")
        if t:
            lines.append(t)
    if not lines:
        t = node.get_text(strip=True).replace("​", "")
        if t:
            lines.append(t)
    return "\n".join(lines)


def component_type(cls: list[str]) -> str:
    """se-component의 클래스 목록에서 컴포넌트 종류를 뽑는다."""
    known = {
        "se-text": "text",
        "se-image": "image",
        "se-imageGroup": "imageGroup",
        "se-sectionTitle": "sectionTitle",
        "se-quotation": "quotation",
        "se-horizontalLine": "horizontalLine",
        "se-video": "video",
        "se-oglink": "oglink",
        "se-placesMap": "map",
        "se-map": "map",
        "se-code": "code",
        "se-table": "table",
        "se-material": "material",
        "se-sticker": "sticker",
        "se-file": "file",
    }
    for c in cls:
        if c in known:
            return known[c]
    for c in cls:
        if c.startswith("se-") and c not in ("se-component", "se-l-default"):
            return c.replace("se-", "")
    return "unknown"


def style_hints(node) -> dict:
    """폰트 크기·정렬·색상 등 서식 힌트를 모은다 (스타일 재현용)."""
    hints: dict[str, list[str]] = {}
    classes = set()
    for el in node.select("[class]"):
        for c in el.get("class", []):
            if c.startswith(("se-fs", "se-ff", "se-text-align", "se-l-")):
                classes.add(c)
    if classes:
        hints["classes"] = sorted(classes)
    if node.select_one("b, strong"):
        hints["has_bold"] = True
    colors = {
        el.get("style")
        for el in node.select("[style*='color']")
        if el.get("style")
    }
    if colors:
        hints["inline_styles"] = sorted(colors)[:5]
    return hints


def parse(html: str, blog_id: str, log_no: str) -> dict:
    soup = BeautifulSoup(html, "lxml")
    container = soup.select_one(".se-main-container")
    components = []
    if container:
        for comp in container.select(":scope > .se-component"):
            ctype = component_type(comp.get("class", []))
            item = {"type": ctype}
            if ctype in ("text", "sectionTitle", "quotation"):
                item["text"] = text_of(comp)
            elif ctype in ("image", "imageGroup"):
                imgs = comp.select("img")
                item["count"] = len(imgs)
                caps = [
                    c.get_text(strip=True)
                    for c in comp.select(".se-caption")
                    if c.get_text(strip=True)
                ]
                if caps:
                    item["captions"] = caps
            elif ctype == "map":
                name = comp.select_one(".se-map-title, .se-place-name")
                addr = comp.select_one(".se-map-address, .se-place-address")
                if name:
                    item["name"] = name.get_text(strip=True)
                if addr:
                    item["address"] = addr.get_text(strip=True)
            elif ctype == "oglink":
                t = comp.select_one(".se-oglink-title")
                if t:
                    item["title"] = t.get_text(strip=True)
            hints = style_hints(comp)
            if hints:
                item["style"] = hints
            if item.get("text") == "" and ctype in ("text", "sectionTitle", "quotation"):
                item.pop("text")
            components.append(item)

    title_el = soup.select_one(".se-title-text, .se_title, .pcol1")
    title = title_el.get_text(strip=True) if title_el else script_var(html, "gsTitle")
    tags = [t for t in script_var(html, "gsTagName").split(",") if t]

    body_text = "\n\n".join(
        c["text"] for c in components if c.get("text")
    )

    date_el = soup.select_one(".se_publishDate, .blog_date, .date")
    published = date_el.get_text(strip=True) if date_el else ""

    return {
        "blog_id": blog_id,
        "log_no": log_no,
        "url": f"https://m.blog.naver.com/{blog_id}/{log_no}",
        "title": title,
        "published": published,
        "category": script_var(html, "gsCategoryName"),
        "category_no": script_var(html, "gsCategoryNo") or _num_var(html, "gsCategoryNo"),
        "tags": tags,
        "component_count": len(components),
        "type_counts": _counts(components),
        "components": components,
        "body_text": body_text,
        "char_count": len(body_text),
    }


def _counts(components: list[dict]) -> dict:
    out: dict[str, int] = {}
    for c in components:
        out[c["type"]] = out.get(c["type"], 0) + 1
    return dict(sorted(out.items(), key=lambda kv: -kv[1]))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("urls", nargs="+")
    ap.add_argument("--out", default="data/raw")
    ap.add_argument("--delay", type=float, default=1.5)
    args = ap.parse_args()

    outdir = Path(args.out)
    outdir.mkdir(parents=True, exist_ok=True)

    failures = []
    for i, url in enumerate(args.urls):
        try:
            blog_id, log_no = parse_url(url)
            html = fetch(blog_id, log_no)
            doc = parse(html, blog_id, log_no)
            (outdir / f"{log_no}.json").write_text(
                json.dumps(doc, ensure_ascii=False, indent=2), encoding="utf-8"
            )
            print(
                f"OK  {log_no}  {doc['component_count']:>3}개 컴포넌트 "
                f"{doc['char_count']:>5}자  {doc['category']:<12} {doc['title'][:40]}"
            )
        except Exception as exc:  # 한 건 실패가 전체를 막지 않게
            failures.append((url, exc))
            print(f"FAIL {url}: {exc}", file=sys.stderr)
        if i < len(args.urls) - 1:
            time.sleep(args.delay)

    if failures:
        print(f"\n실패 {len(failures)}건", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
