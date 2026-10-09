/**
 * 공지 원본 → 줄 단위 평문.
 *
 * 공식 공지 본문은 HTML이다(문단마다 <p>, 안에 <span>이 여러 겹). 블록 태그와 <br>을 줄바꿈으로,
 * 표 칸은 공백 두 칸으로 바꾸고 나머지 태그는 지운다. 파서는 이 결과만 본다.
 * nikke-analysis build/notices.py의 html_to_text와 같은 규칙이다(외부 의존성 없이).
 */
import fs from 'node:fs';
import path from 'node:path';
import { OFFICIAL_DIR, INDEX_PATH } from './fetch.mjs';

const BLOCK_TAGS = [
  'p', 'div', 'li', 'ul', 'ol', 'table', 'tr', 'section', 'article',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote',
];
const BLOCK_RE = new RegExp(`<\\/?(?:${BLOCK_TAGS.join('|')})\\b[^>]*>`, 'gi');

const NAMED = { nbsp: ' ', lt: '<', gt: '>', amp: '&', quot: '"', apos: "'", middot: '·', hellip: '…', rarr: '→' };

export function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return NAMED[e.toLowerCase()] ?? m;
  });
}

/** 한 줄 정리: 보이지 않는 문자를 빼고 공백을 하나로 모은다. */
export function cleanLine(s) {
  return s.replace(/[​‌‍﻿]/g, '').replace(/[ \t 　]+/g, ' ').trim();
}

export function htmlToLines(html) {
  const text = html
    .replace(/<(script|style|head)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(BLOCK_RE, '\n')
    .replace(/<\/t[dh]>/gi, '  ')
    .replace(/<[^>]+>/g, '');
  return decodeEntities(text).split('\n').map(cleanLine).filter(Boolean);
}

/**
 * 저장된 공지 전부를 게시 시각 순으로.
 * { id, title, publishedAt(Date), lines[] }
 */
export function loadNotices() {
  const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  const out = [];
  for (const [id, meta] of Object.entries(index.notices)) {
    const file = path.join(OFFICIAL_DIR, `${id}.json`);
    if (!fs.existsSync(file)) continue;
    const data = JSON.parse(fs.readFileSync(file, 'utf8')).data ?? {};
    out.push({
      id,
      title: cleanLine(decodeEntities(data.title ?? meta.title ?? '')),
      publishedAt: new Date(Number(data.pub_timestamp ?? meta.pubTimestamp) * 1000),
      lines: htmlToLines(String(data.content ?? '')),
    });
  }
  return out.sort((a, b) => a.publishedAt - b.publishedAt || a.id.localeCompare(b.id));
}
