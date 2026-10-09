/**
 * JSON 파일의 한 부분만 고쳐 쓴다 — 리뷰 도구가 후보 객체 하나를 바꿀 때 파일의 나머지 모양(손으로 쓴 줄바꿈 등)은 그대로 둔다.
 * 표준 라이브러리에 위치를 알려 주는 JSON 파서가 없어 작게 만들었다. 문법은 JSON 그대로다(주석 · 끝 쉼표 없음).
 */
import { format } from './json.mjs';

/**
 * 값마다 [start, end) 위치를 단 트리. object: entries[{key, node}] · array: items[node]
 * @param {string} text
 */
export function parseSpans(text) {
  let i = 0;
  const fail = (msg) => {
    throw new Error(`JSON ${i}번째 글자: ${msg}`);
  };
  const ws = () => {
    while (i < text.length && ' \t\r\n'.includes(text[i])) i++;
  };
  const string = () => {
    const start = i;
    if (text[i] !== '"') fail('문자열이 와야 한다');
    i++;
    while (i < text.length && text[i] !== '"') i += text[i] === '\\' ? 2 : 1;
    if (i >= text.length) fail('문자열이 닫히지 않았다');
    i++;
    return { type: 'string', start, end: i, value: JSON.parse(text.slice(start, i)) };
  };
  const value = () => {
    ws();
    const start = i;
    const ch = text[i];
    if (ch === '{') {
      i++;
      const entries = [];
      ws();
      if (text[i] === '}') return { type: 'object', start, end: ++i, entries };
      for (;;) {
        ws();
        const key = string();
        ws();
        if (text[i] !== ':') fail('":"가 와야 한다');
        i++;
        entries.push({ key: key.value, node: value() });
        ws();
        if (text[i] === ',') i++;
        else if (text[i] === '}') return { type: 'object', start, end: ++i, entries };
        else fail('"," 또는 "}"가 와야 한다');
      }
    }
    if (ch === '[') {
      i++;
      const items = [];
      ws();
      if (text[i] === ']') return { type: 'array', start, end: ++i, items };
      for (;;) {
        items.push(value());
        ws();
        if (text[i] === ',') i++;
        else if (text[i] === ']') return { type: 'array', start, end: ++i, items };
        else fail('"," 또는 "]"가 와야 한다');
      }
    }
    if (ch === '"') return string();
    const m = /^(?:-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)/.exec(text.slice(i, i + 64));
    if (!m) fail('값이 와야 한다');
    i += m[0].length;
    return { type: 'literal', start, end: i, value: JSON.parse(m[0]) };
  };
  const root = value();
  ws();
  if (i !== text.length) fail('값 뒤에 글자가 더 있다');
  return root;
}

/** root에서 경로(키 · 배열 번호)를 따라간 노드 */
export function nodeAt(root, pathParts) {
  let node = root;
  for (const p of pathParts) {
    if (node?.type === 'object') node = node.entries.find((e) => e.key === p)?.node;
    else if (node?.type === 'array') node = node.items[p];
    else return undefined;
  }
  return node;
}

/**
 * 여러 노드를 새 값으로 바꾼다. 들여쓰기는 그 노드가 있던 줄을 따른다.
 * @param {string} text
 * @param {{ path: (string|number)[], value: unknown }[]} changes
 */
export function replaceValues(text, changes) {
  const root = parseSpans(text);
  const located = changes.map((c) => {
    const node = nodeAt(root, c.path);
    if (!node) throw new Error(`경로를 못 찾았다: ${c.path.join('.')}`);
    return { node, value: c.value };
  });
  located.sort((a, b) => b.node.start - a.node.start);
  let out = text;
  for (const { node, value } of located) {
    const lineStart = out.lastIndexOf('\n', node.start - 1) + 1;
    const lead = out.slice(lineStart, node.start);
    const indent = lead.match(/^[ \t]*/)[0];
    const used = [...lead].length - [...indent].length;
    out = out.slice(0, node.start) + format(value, indent, used) + out.slice(node.end);
  }
  JSON.parse(out); // 깨지지 않았는지
  return out;
}
