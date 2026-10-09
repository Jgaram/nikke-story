/**
 * blablalink Shifty's Pad CDN의 경로 난독화 규칙 재현.
 *
 * 사이트 번들(index-*.js)의 createNormalObfuscatedPath / getDjb2Mod /
 * generateTwoLetterHash / generateTwoNumberHash를 옮긴 것이다.
 * 규칙 설명은 docs/data-sources.md 참고.
 */
import crypto from 'node:crypto';

export const CDN_BASE = 'https://sg-tools-cdn.blablalink.com';

const LARGE_PRIMES = [224737, 1000639, 2654435761, 2654435769, 1000621, 4294967291];

const md5 = (s) => crypto.createHash('md5').update(s, 'utf8').digest('hex');

/** 번들의 & 0xFFFFFFFF 는 JS에서 부호 있는 int32를 만든다. 아래 normalize가 그걸 보정한다. */
function djb2(str, seed) {
  let h = seed;
  for (let i = 0; i < str.length; i++) h = (h * 33 + str.charCodeAt(i)) & 0xffffffff;
  return h;
}

const normalize = (str, m) => ((djb2(str, m) % m) + m) % m;

function twoLetterHash(str, m) {
  const r = normalize(str, m);
  return String.fromCharCode(97 + (Math.floor(r / 26) % 26), 97 + (r % 26));
}

const twoNumberHash = (str, m) => String(normalize(str, m) % 99).padStart(2, '0');

/** 논리 경로 -> 난독화된 CDN 경로 */
export function obfuscatePath(logicalPath) {
  const full = logicalPath.replace(/^\//, '');
  const parts = full.split('/').filter(Boolean);
  return parts
    .map((part, i) => {
      if (i === parts.length - 1) {
        const segs = part.split('.');
        segs.shift(); // 파일명을 버리고 확장자만 남긴다
        return `${md5(full)}.${segs.join('.')}`;
      }
      return `${twoLetterHash(full, LARGE_PRIMES[i])}-${twoNumberHash(full, LARGE_PRIMES[i])}`;
    })
    .join('/');
}

/** `{lang}` / `{l_lang}` 치환. ko는 치환 후 `_ko`를 제거하는 예외가 있다. */
export function formatLangPath(template, lang = 'ko') {
  let p = template.replace(/\{lang\}/g, lang).replace(/\{l_lang\}/g, lang);
  if (lang === 'ko') p = p.replace(/_ko/g, '');
  return p;
}

/** 논리 경로(또는 {lang} 템플릿) -> 최종 URL */
export const resourceUrl = (template, lang = 'ko') =>
  `${CDN_BASE}/${obfuscatePath(formatLangPath(template, lang))}`;

if (import.meta.url === `file://${process.argv[1]}`) {
  const [template, lang = 'ko'] = process.argv.slice(2);
  if (!template) {
    console.error('usage: node obfuscate.mjs "/scene/{lang}/scene_list_{lang}.json" [lang]');
    process.exit(1);
  }
  console.log(resourceUrl(template, lang));
}
