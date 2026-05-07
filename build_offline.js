/**
 * build_offline.js — 단일 자급자족 HTML 파일 생성 (오프라인 데스크탑 사용)
 *
 * 무엇을 하나:
 *   1) index.html을 베이스로 시작
 *   2) 우리 JS 5개(cohort_v29, metadata, kinematic_only_report, video_input, app)을 인라인
 *   3) kbo.css 인라인
 *   4) CDN 의존성(Tailwind, Chart.js, xlsx) 다운로드 후 인라인
 *   5) SVG 로고 base64로 변환해 인라인
 *   6) Google Fonts link 제거 (시스템 폰트 fallback)
 *   7) 결과: 바이오모션_투수리포트_offline.html (단일 파일, ~3-5 MB)
 *
 * 사용:
 *   node build_offline.js
 *
 * 출력 파일을 더블클릭하면 브라우저에서 열림. 인터넷 없이 100% 작동.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO = __dirname;
const OUT_NAME = '바이오모션_투수리포트_offline.html';

// ── CDN 다운로드 (curl 사용 — Node https보다 빠르고 안정적) ──────
function fetchUrl(url) {
  // -L: redirects, -s: silent, -A: User-Agent, --max-time: 30초 타임아웃
  return execSync(`curl -L -s -A "Mozilla/5.0" --max-time 30 "${url}"`, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
}

// ── 메인 빌드 ──────────────────────────────────────────────────────
(async () => {
  console.log('=== Biomotion 투수 리포트 오프라인 빌드 시작 ===\n');

  // 1) index.html
  let html = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
  console.log(`✓ index.html 로드 (${html.length.toLocaleString()} bytes)`);

  // 2) 우리 JS 5개 인라인
  const jsFiles = ['cohort_v29.js', 'metadata.js', 'kinematic_only_report.js', 'video_input.js', 'app.js'];
  for (const f of jsFiles) {
    const code = fs.readFileSync(path.join(REPO, f), 'utf8');
    // </script> 안전 처리 (드물지만 문자열 안에 있을 수 있음)
    const safe = code.replace(/<\/script>/gi, '<\\/script>');
    const re = new RegExp(`<script src="${f.replace(/\./g, '\\.')}"[^>]*></script>`, 'g');
    if (!re.test(html)) { console.warn(`⚠ ${f} <script src> 못 찾음 — 위치 확인 필요`); continue; }
    html = html.replace(re, `<script>\n/* ${f} */\n${safe}\n</script>`);
    console.log(`✓ ${f} 인라인 (${(code.length / 1024).toFixed(1)} KB)`);
  }

  // 3) kbo.css 인라인
  const kboCss = fs.readFileSync(path.join(REPO, 'kbo.css'), 'utf8');
  html = html.replace(/<link rel="stylesheet" href="kbo\.css"[^>]*>/g, `<style>\n/* kbo.css */\n${kboCss}\n</style>`);
  console.log(`✓ kbo.css 인라인 (${(kboCss.length / 1024).toFixed(1)} KB)`);

  // 4) CDN 의존성 다운로드 + 인라인
  const cdnDeps = [
    { name: 'tailwindcss',  url: 'https://cdn.tailwindcss.com',                                                  re: /<script src="https:\/\/cdn\.tailwindcss\.com"[^>]*><\/script>/ },
    { name: 'chart.js',     url: 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js',       re: /<script src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/Chart\.js\/4\.4\.1\/chart\.umd\.min\.js"[^>]*><\/script>/ },
    { name: 'xlsx',         url: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',          re: /<script src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/xlsx\/0\.18\.5\/xlsx\.full\.min\.js"[^>]*><\/script>/ },
  ];
  for (const dep of cdnDeps) {
    console.log(`  ⬇ ${dep.name} 다운로드...`);
    const code = fetchUrl(dep.url);
    const safe = code.replace(/<\/script>/gi, '<\\/script>');
    if (!dep.re.test(html)) { console.warn(`⚠ ${dep.name} 매칭 패턴 못 찾음`); continue; }
    html = html.replace(dep.re, `<script>\n/* ${dep.name} */\n${safe}\n</script>`);
    console.log(`✓ ${dep.name} 인라인 (${(code.length / 1024).toFixed(1)} KB)`);
  }

  // 5) Google Fonts link 제거 (시스템 폰트 fallback — 한글은 Noto Sans KR/Malgun Gothic)
  const beforeFonts = html.length;
  html = html.replace(/<link[^>]*fonts\.googleapis[^>]*>/g, '');
  html = html.replace(/<link[^>]*fonts\.gstatic[^>]*>/g, '');
  console.log(`✓ Google Fonts link 제거 (${((beforeFonts - html.length) / 1024).toFixed(1)} KB 절약)`);

  // 6) SVG 로고 base64 인라인
  const svgPath = path.join(REPO, 'assets/biomotion_logo.svg');
  if (fs.existsSync(svgPath)) {
    const svg = fs.readFileSync(svgPath, 'utf8');
    const dataUrl = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
    // index.html의 <img src="assets/...">
    html = html.replace(/src="assets\/biomotion_logo\.svg"/g, `src="${dataUrl}"`);
    // 인라인된 JS 안의 'assets/biomotion_logo.svg' 문자열도 교체
    html = html.replace(/['"]assets\/biomotion_logo\.svg['"]/g, `"${dataUrl}"`);
    console.log(`✓ SVG 로고 base64 인라인 (${(svg.length / 1024).toFixed(1)} KB)`);
  }

  // 7) Bookmark/title 수정 — 오프라인 임을 표시
  html = html.replace(/<title>[^<]*<\/title>/, '<title>바이오모션 투수 리포트 (오프라인)</title>');

  // 출력
  const outPath = path.join(REPO, OUT_NAME);
  fs.writeFileSync(outPath, html, 'utf8');
  const sizeMB = (fs.statSync(outPath).size / 1024 / 1024).toFixed(2);
  console.log(`\n✓✓✓ 빌드 완료: ${OUT_NAME}`);
  console.log(`    크기: ${sizeMB} MB`);
  console.log(`    위치: ${outPath}`);
  console.log(`\n사용법: ${OUT_NAME}을 더블클릭하면 브라우저에서 열립니다.`);
  console.log(`        인터넷 없이 모든 기능 작동.`);
})().catch(err => {
  console.error('\n✗ 빌드 실패:', err.message);
  console.error(err.stack);
  process.exit(1);
});
