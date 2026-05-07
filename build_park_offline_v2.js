/**
 * build_park_offline_v2.js — 박명균 v2 offline HTML 생성 (Phase B 검증용)
 * 실행: node build_park_offline_v2.js
 *   → 박명균_offline_v2.html 생성
 */
const fs = require('fs');
const path = require('path');

// metadata.js에서 predictMaxVelocity·VELO_REGRESSION 가져오기 — Node에서는 global window 필요
global.window = {};
const META_PATH = path.join(__dirname, 'metadata.js');
// metadata.js를 eval 방식으로 로드 (브라우저용 const 선언이라 require 불가)
const metaCode = fs.readFileSync(META_PATH, 'utf-8');
// VELO_REGRESSION_v33_22, predictMaxVelocity만 evaluate (global에 등록)
const veloRegBlock = metaCode.match(/const VELO_REGRESSION_v33_22 = [\s\S]*?\};/)[0];
const predictBlock = metaCode.match(/function predictMaxVelocity\(mech, fit\) [\s\S]*?\n\}/)[0];
eval('global.VELO_REGRESSION_v33_22 = ' + veloRegBlock.replace('const VELO_REGRESSION_v33_22 = ', ''));
eval(predictBlock);
global.predictMaxVelocity = predictMaxVelocity;

// 빌더 로드
const KIR_PATH = path.join(__dirname, 'kinematic_only_report.js');
const builderCode = fs.readFileSync(KIR_PATH, 'utf-8');
eval(builderCode.replace(/if \(typeof module[\s\S]*$/, ''));  // module.exports 부분 제거

// 박명균 입력 (현재 박명균_offline.html의 CURRENT_INPUT 그대로)
const PARK_INPUT = {
  playerId: 'parkmyeonggyun',
  ageGroup: '고교 우투',
  measuredVelocity: 140.5,
  // 영상 통합 — src를 실제 영상 경로/URL로 바꾸면 P3·P4·P6에 자동 활성화
  // 영상이 없으면 src를 null로 두거나 video 객체 자체를 삭제 → 영상 영역 모두 숨김
  video: {
    src: 'parkmyeonggyun_pitch_2026-05-07.mp4',  // 영상 파일을 같은 폴더에 두면 작동
    fps: 240,  // Uplift 기본 캡처 — 1프레임 = 4.17ms, 5프레임 = 20.83ms
    stages: {
      drive:   { start: 0.20, peak: 0.50 },   // 디딤발 추진
      landing: { start: 0.85, peak: 1.10 },   // 앞발 착지
      torso:   { start: 1.10, peak: 1.30 },   // 몸통 회전
      arm:     { start: 1.30, peak: 1.45 },   // 팔 채찍
      release: { start: 1.45, peak: 1.55 },   // 공 놓기
    },
    events: {
      kh:  0.40,
      fc:  1.10,
      mer: 1.40,
      br:  1.55,
    },
  },
  fitness: {
    'Height[M]': 1.77,
    'Weight[KG]': 78,
    'BMI': 24.9,
    'CMJ Peak Power / BM [W/kg]': 59.7,
    'CMJ RSI-modified [m/s]': 0.89,
    'SJ Peak Power / BM [W/kg]': 36.5,
    'EUR': 1.17,
    'IMTP Peak Vertical Force / BM [N/kg]': 25.87,
    'Grip Strength': 51.2,
  },
  mechanics: {
    max_pelvis_rot_vel_dps: 516.88,
    max_trunk_twist_vel_dps: 791.94,
    trunk_flex_vel_max: 502.80,
    peak_x_factor: 40.73,
    max_shoulder_ER: 203.58,
    max_shoulder_ER_deg: 203.58,
    trunk_rotation_at_fc: -88.51,
    hip_shoulder_sep_at_fc: 33.29,
    trunk_forward_tilt_at_fc: 4.16,
    lead_knee_ext_vel_max: 319.87,
    lead_knee_ext_change_fc_to_br: 8.61,
    max_cog_velo: 3.17,
    cog_decel: 1.18,  // 박명균 추정 (코호트 평균 1.02 + 약간 우수)
    hip_ir_vel_max_drive: 876.52,
    com_decel_pct: 92.34,
    elbow_ext_vel_max: 1854.92,
    shoulder_ir_vel_max: 1637.98,
    pelvis_to_trunk_lag_ms: 54.28,
    pelvis_to_trunk_lag_ms_sd: 12,  // 추정
    arm_trunk_speedup: 1.91,
    pelvis_trunk_speedup: 1.53,
    proper_sequence: 1,
    proper_sequence_pct: 100,
    _proper_seq_x_of_n: '10/10',
    trunk_to_arm_lag_ms: 35,  // 추정값 (raw 데이터에는 0개 trial이지만 arm_trunk_speedup 1.91 기반 추정)
    arm_slot_mean_deg: 25.01,
    release_height_m: 1.12,
    stride_mean_m: 1.85,
  },
};

// HTML 생성
const reportHtml = buildKinematicOnlyReport(PARK_INPUT);

// 완성 HTML (KBO CSS 포함)
const KBO_CSS = `
.kbo-scope {
  font-family: 'Inter', 'Noto Sans KR', 'Malgun Gothic', -apple-system, system-ui, sans-serif;
  font-size: 15px; line-height: 1.55; color: #0F1419; background: #FFFFFF;
  --kbo-navy: #0F2A4A; --kbo-navy-soft: #3B5A82; --kbo-navy-tint: #EAF0F7;
  --kbo-bg-card: #FFFFFF; --kbo-bg-elev: #F6F7F9;
  --kbo-border: #E1E5EB; --kbo-text: #0F1419; --kbo-text-muted: #6B7280;
  --kbo-good: #3F7D5C; --kbo-caution: #A87333; --kbo-leak: #A8443A;
  --kbo-shadow: none;
}
.kbo-scope * { box-sizing: border-box; }
.kbo-scope .kbo-pad { padding: 24px 20px 40px; }
.kbo-scope .kbo-display { font-family: 'Space Grotesk', system-ui, sans-serif; font-weight: 700; letter-spacing: -0.01em; }
.kbo-scope .kbo-mono { font-family: 'JetBrains Mono', 'SF Mono', monospace; }
.kbo-scope .kbo-plain { background: var(--kbo-navy-tint); border-radius: 10px; padding: 12px 14px; margin-top: 14px; display: flex; gap: 10px; align-items: flex-start; }
.kbo-scope .kbo-plain-tag { flex: 0 0 auto; font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 700; color: var(--kbo-navy); letter-spacing: 0.08em; text-transform: uppercase; background: #fff; border: 1px solid var(--kbo-navy); padding: 3px 7px; border-radius: 4px; line-height: 1; margin-top: 1px; }
.kbo-scope .kbo-plain-text { font-size: 13.5px; color: #0F1419; line-height: 1.55; }
.kbo-scope .kbo-plain-text b { font-weight: 700; color: var(--kbo-navy); }
.kbo-scope .kbo-page-head { display: flex; align-items: baseline; gap: 8px; padding-bottom: 14px; margin-bottom: 20px; border-bottom: 2px solid var(--kbo-navy); flex-wrap: wrap; }
.kbo-scope .kbo-page-num { font-family: 'Space Grotesk', system-ui, sans-serif; font-weight: 700; font-size: 11px; letter-spacing: 0.16em; color: var(--kbo-navy); padding: 4px 9px; border: 1.5px solid var(--kbo-navy); border-radius: 4px; }
.kbo-scope .kbo-page-title-en { font-family: 'Space Grotesk', system-ui, sans-serif; font-weight: 700; font-size: 20px; color: var(--kbo-navy); letter-spacing: -0.01em; }
.kbo-scope .kbo-page-title-kr { font-size: 13px; color: var(--kbo-text-muted); margin-left: 2px; }
.kbo-scope .kbo-page-q { flex-basis: 100%; font-size: 12px; color: var(--kbo-text-muted); margin-top: 4px; }
.kbo-scope .kbo-headline { font-family: 'Space Grotesk', system-ui, sans-serif; font-weight: 700; font-size: 22px; line-height: 1.32; letter-spacing: -0.012em; color: var(--kbo-text); }
.kbo-scope .kbo-headline em { font-style: normal; color: var(--kbo-navy); }
.kbo-scope .kbo-card { background: var(--kbo-bg-card); border: 1px solid var(--kbo-border); border-radius: 10px; box-shadow: var(--kbo-shadow); }
.kbo-scope .kbo-conf { display: inline-flex; align-items: center; gap: 6px; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 999px; letter-spacing: 0.04em; text-transform: uppercase; }
.kbo-scope .kbo-conf-h { color: var(--kbo-good); background: rgba(63,125,92,0.08); border: 1px solid var(--kbo-good); }
.kbo-scope .kbo-conf-m { color: var(--kbo-caution); background: rgba(168,115,51,0.08); border: 1px solid var(--kbo-caution); }
.kbo-scope .kbo-conf-l { color: var(--kbo-leak); background: rgba(168,68,58,0.06); border: 1px solid var(--kbo-leak); }
.kbo-scope .kbo-pill { display: inline-flex; align-items: center; gap: 6px; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 4px; letter-spacing: 0.06em; text-transform: uppercase; }
.kbo-scope .kbo-pill::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.kbo-scope .kbo-pill-good { color: var(--kbo-good); background: rgba(63,125,92,0.10); }
.kbo-scope .kbo-pill-caution { color: var(--kbo-caution); background: rgba(168,115,51,0.10); }
.kbo-scope .kbo-pill-leak { color: var(--kbo-leak); background: rgba(168,68,58,0.10); }
.kbo-scope .kbo-eyebrow { font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 600; letter-spacing: 0.14em; color: var(--kbo-text-muted); text-transform: uppercase; }
.kbo-scope .kbo-metric-num { font-family: 'Space Grotesk', system-ui, sans-serif; font-weight: 700; line-height: 0.95; letter-spacing: -0.02em; }
.kbo-scope .kbo-metric-unit { font-family: 'Inter', sans-serif; font-weight: 400; color: var(--kbo-text-muted); font-size: 0.4em; margin-left: 4px; }
.kbo-scope .kbo-na { color: #9CA3AF; font-style: italic; }
@media (max-width: 768px) {
  .kbo-scope .kbo-pad { padding: 18px 14px 32px; }
  .kbo-scope .kbo-page-title-en { font-size: 17px; }
  .kbo-scope .kbo-headline { font-size: 18px; }
  .kbo-scope .kbo-card > div[style*="grid-template-columns: 140px 1fr 80px 1fr"] { grid-template-columns: 100px 1fr !important; }
  .kbo-scope .kbo-card > div[style*="grid-template-columns: repeat(3, 1fr)"] { grid-template-columns: 1fr !important; }
}
body { margin: 0; background: #F2F5FA; min-height: 100vh; }
.report-container { max-width: 1100px; margin: 0 auto; background: #fff; min-height: 100vh; }
`;

const fullHtml = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>박명균 Kinematic-Only Report v2 (Phase B)</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+KR:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@500;600;700&display=swap" rel="stylesheet">
<style>${KBO_CSS}</style>
</head>
<body>
<div class="report-container">
${reportHtml}
</div>
</body>
</html>`;

const outPath = path.join(__dirname, '_v33_22_upload', '박명균_offline_v2_phaseB.html');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, fullHtml, 'utf-8');
console.log(`✓ 생성 완료: ${outPath}`);
console.log(`  크기: ${(fs.statSync(outPath).size / 1024).toFixed(1)} KB`);
console.log(`\n박명균 v33.22 예측: ${predictMaxVelocity(PARK_INPUT.mechanics, PARK_INPUT.fitness)} km/h`);
console.log(`측정 구속: ${PARK_INPUT.measuredVelocity} km/h`);
console.log(`잔차: ${(PARK_INPUT.measuredVelocity - predictMaxVelocity(PARK_INPUT.mechanics, PARK_INPUT.fitness)).toFixed(1)} km/h`);
