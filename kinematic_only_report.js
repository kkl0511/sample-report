/**
 * kinematic_only_report.js — Theia 6 페이지 narrative + KBO light + Kinematic-only 안전 처리
 * ────────────────────────────────────────────────────────────────────────────
 * Phase B (이번): 골격 + dataAvailability + sanitize + renderCoachDelivery + P1
 * Phase A 후속: P2 (Kinematic Output) → P3 (Dynamic Sequence) → P4 → P5 → P6
 *
 * 가이드 핵심 원칙:
 *   1) GRF/Joint Power/Energy J/UCL stress = 사용 금지 (kinematic-only)
 *   2) Force Generation → Kinematic Output / Force Transmission → Kinematic Transfer Proxy
 *   3) Energy Leak → Kinematic leak indicator (조심스럽게)
 *   4) dataAvailability 플래그로 미지원 자동 숨김
 *   5) Coach Delivery + Athlete Card P1·P6 고정 컴포넌트
 *
 * 의존성:
 *   - metadata.js: VELO_REGRESSION_v33_22, predictMaxVelocity()
 *   - cohort_v29.js: var_distributions, category_vars
 *
 * ALGORITHM_VERSION: 'v33.22'  (Phase B 시점)
 */

// ════════════════════════════════════════════════════════════════════
// 1. dataAvailability — 미지원 지표 자동 판별
// ════════════════════════════════════════════════════════════════════
function getDataAvailability(input) {
  const m = input?.mechanics || {};
  const f = input?.fitness || {};
  const v = input?.video;
  return {
    kinematics: !!(m.peak_x_factor != null || m.max_pelvis_rot_vel_dps != null),
    grf:        false,  // Uplift는 GRF 측정 안 함 — 항상 false
    jointPower: false,  // Joint power/work/J — 항상 false
    ballTracking: !!(input?.measuredVelocity != null || m.measured_velo != null),
    forcePlate: !!(f['Height[M]'] != null && f['Weight[KG]'] != null && f['Grip Strength'] != null),
    cogDecel:   m.cog_decel != null,        // v33.22 신규
    video:      !!(v && v.src),              // 영상 통합 (P4·P3·P6에서 활성화)
  };
}

// ════════════════════════════════════════════════════════════════════
// 2. sanitizeUnsupportedMetrics — 미지원 라벨 일괄 제거
// ════════════════════════════════════════════════════════════════════
const _BANNED_LABELS_BY_FLAG = {
  grf:        ['GRF', 'vGRF', 'braking impulse', 'BW*s', 'ground reaction force'],
  jointPower: ['Joint Power', 'W+', 'W-', 'kW', 'energy J', 'ETE direct',
               'energy transfer rate', 'joint work', 'mechanical power'],
};

function sanitizeUnsupportedMetrics(html, dataAvailability) {
  let out = html;
  for (const flag of Object.keys(_BANNED_LABELS_BY_FLAG)) {
    if (dataAvailability[flag]) continue;
    for (const label of _BANNED_LABELS_BY_FLAG[flag]) {
      const re = new RegExp(`\\b${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      out = out.replace(re, '<span class="kbo-na" title="kinematic-only — 미지원 지표">미측정</span>');
    }
  }
  return out;
}

// ════════════════════════════════════════════════════════════════════
// 3. renderCoachDelivery — Coach 1문장 박스 (kbo-plain 활용, P1·P3·P4·P6 재사용)
// ════════════════════════════════════════════════════════════════════
function renderCoachDelivery({ message, cue, videoPoint, kpi, tag = '코치 메시지' } = {}) {
  const lines = [];
  if (message) lines.push(`<div class="kbo-plain-text"><b>지금 상태</b> · ${escapeHtml(message)}</div>`);
  if (cue)     lines.push(`<div class="kbo-plain-text"><b>오늘 한 가지만</b> · ${escapeHtml(cue)}</div>`);
  if (videoPoint) lines.push(`<div class="kbo-plain-text"><b>영상 볼 곳</b> · ${escapeHtml(videoPoint)}</div>`);
  if (kpi)     lines.push(`<div class="kbo-plain-text"><b>다시 측정할 때</b> · ${escapeHtml(kpi)}</div>`);
  return `<div class="kbo-plain" style="flex-direction: column; gap: 8px; padding: 14px 16px;">
    <div style="display:flex; gap:10px; align-items:flex-start;">
      <span class="kbo-plain-tag">${tag}</span>
      <div style="flex:1; display:flex; flex-direction:column; gap:6px;">${lines.join('')}</div>
    </div>
  </div>`;
}

// ════════════════════════════════════════════════════════════════════
// 4. renderDataBadge — Kinematic-only / GRF 미측정 / Joint Power 미측정 등
// ════════════════════════════════════════════════════════════════════
function renderDataBadge(dataAvailability) {
  const da = dataAvailability;
  const items = [];
  // 보유한 데이터 (있는 것)
  if (da.kinematics) items.push(`<span class="kbo-pill kbo-pill-good">투구 동작 측정</span>`);
  if (da.ballTracking) items.push(`<span class="kbo-pill kbo-pill-good">구속 측정</span>`);
  if (da.forcePlate) items.push(`<span class="kbo-pill kbo-pill-good">체력 측정</span>`);
  if (da.video) items.push(`<span class="kbo-pill kbo-pill-good">영상 통합</span>`);
  // 없는 것 — 작게 안내 (이 리포트는 동작 분석 중심)
  if (!da.grf) items.push(`<span class="kbo-pill kbo-pill-caution">지면 반력 측정 안 함</span>`);
  if (!da.jointPower) items.push(`<span class="kbo-pill kbo-pill-caution">관절 파워 측정 안 함</span>`);
  return `<div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:10px;">${items.join('')}</div>`;
}

// ════════════════════════════════════════════════════════════════════
// 5-pre. 영상 (Video) 헬퍼 — P3·P4·P6에서 재사용
// ════════════════════════════════════════════════════════════════════
//   input.video = {
//     src: 'parkmg.mp4',                    // 영상 파일 또는 URL
//     stages: {                              // 5단계 timestamp (초)
//       drive:   { start: 0.3, peak: 0.6 },
//       landing: { start: 0.9, peak: 1.2 },
//       torso:   { start: 1.2, peak: 1.4 },
//       arm:     { start: 1.4, peak: 1.55 },
//       release: { start: 1.55, peak: 1.65 },
//     },
//     events: { kh: 0.5, fc: 1.2, mer: 1.45, br: 1.65 },  // 키 이벤트 (선택)
//   };
//
//   영상 없으면 모든 video 함수는 빈 문자열 반환 (graceful)

function _hasVideo(video) { return !!(video && video.src); }

// 글로벌 video player — 한 페이지당 하나, 모든 jump 버튼이 이 player 조작
//   240 fps 기준 frame-step (1f / 5f) + slow motion (0.1× / 0.25× / 0.5× / 1×) 컨트롤 포함
function renderGlobalVideoPlayer(video, idSuffix = 'main') {
  if (!_hasVideo(video)) return '';
  const id = `kbo-video-${idSuffix}`;
  const fps = video.fps ?? 240;  // 기본 240 Hz (Uplift 기본 캡처)
  const frameMs = (1000 / fps).toFixed(2);
  const fiveFrameMs = (5 * 1000 / fps).toFixed(1);

  // 속도 버튼 (0.1×, 0.25×, 0.5×, 1×)
  const speeds = [
    { rate: 0.1,  label: '0.1×', sub: '극저속' },
    { rate: 0.25, label: '0.25×', sub: '저속' },
    { rate: 0.5,  label: '0.5×', sub: '슬로우' },
    { rate: 1.0,  label: '1×',   sub: '정상' },
  ];

  return `<div class="kbo-video-wrap" style="max-width:560px; margin:12px auto;">
    <div style="position:relative; background:#000; border-radius:10px; overflow:hidden;">
      <video id="${id}" controls preload="metadata" playsinline style="width:100%; display:block;">
        <source src="${escapeHtml(video.src)}" type="video/mp4">
        이 브라우저는 video 태그를 지원하지 않습니다.
      </video>
      <div style="position:absolute; top:8px; left:10px; background:rgba(15,42,74,0.85); color:#fff; padding:3px 8px; border-radius:4px; font-family:'JetBrains Mono',monospace; font-size:10px; font-weight:700; letter-spacing:0.06em;">
        투구 영상 · ${fps} fps
      </div>
    </div>

    <!-- Frame-step + speed 컨트롤 -->
    <div class="kbo-video-controls" style="margin-top:8px; padding:8px 10px; background:#F2F5FA; border:1px solid #E1E5EB; border-radius:8px; display:flex; gap:10px; flex-wrap:wrap; align-items:center; justify-content:space-between;">
      <!-- Frame step group -->
      <div style="display:flex; gap:4px; align-items:center;">
        <span style="font-size:10px; color:#6B7280; font-family:'JetBrains Mono',monospace; font-weight:600; margin-right:4px;">FRAME</span>
        <button onclick="kboVideoStep('${id}', -5, ${fps})" title="5프레임 뒤로 (${fiveFrameMs}ms)" style="${_btnStyleSmall()}">⏮ −5f</button>
        <button onclick="kboVideoStep('${id}', -1, ${fps})" title="1프레임 뒤로 (${frameMs}ms)" style="${_btnStyleSmall()}">◀ −1f</button>
        <button onclick="kboVideoTogglePlay('${id}')" title="재생/일시정지 (Space)" style="${_btnStyleSmall(true)}">▶ / ⏸</button>
        <button onclick="kboVideoStep('${id}', 1, ${fps})" title="1프레임 앞으로 (${frameMs}ms)" style="${_btnStyleSmall()}">+1f ▶</button>
        <button onclick="kboVideoStep('${id}', 5, ${fps})" title="5프레임 앞으로 (${fiveFrameMs}ms)" style="${_btnStyleSmall()}">+5f ⏭</button>
      </div>
      <!-- Speed group -->
      <div style="display:flex; gap:4px; align-items:center;">
        <span style="font-size:10px; color:#6B7280; font-family:'JetBrains Mono',monospace; font-weight:600; margin-right:4px;">속도</span>
        ${speeds.map(s => `<button onclick="kboVideoSpeed('${id}', ${s.rate}, this)" title="${s.sub}" data-rate="${s.rate}" style="${_btnStyleSmall(s.rate === 1.0)}">${s.label}</button>`).join('')}
      </div>
    </div>

    <!-- 시간 표시 + frame counter -->
    <div id="${id}-info" style="margin-top:6px; font-family:'JetBrains Mono',monospace; font-size:10.5px; color:#6B7280; text-align:center;">
      <span id="${id}-time">0.000</span>s
      · frame <span id="${id}-frame">0</span> / ${fps} fps
      · <span id="${id}-rate">1.0</span>×
    </div>

    <!-- 한 번만 등록되는 글로벌 helper (모든 video player 공유) -->
    <script>${_KBO_VIDEO_HELPERS}</script>
    <script>kboVideoBindInfo('${id}', ${fps});</script>
  </div>`;
}

function _btnStyleSmall(active = false) {
  return active
    ? 'padding:4px 9px; background:#0F2A4A; color:#fff; border:1px solid #0F2A4A; border-radius:5px; font-family:Inter,sans-serif; font-size:11px; font-weight:600; cursor:pointer; transition:all 0.15s;'
    : 'padding:4px 9px; background:#fff; color:#0F2A4A; border:1px solid #C5CCD5; border-radius:5px; font-family:Inter,sans-serif; font-size:11px; font-weight:600; cursor:pointer; transition:all 0.15s;';
}

// 모든 video player가 공유하는 JS 헬퍼 (각 player가 inline <script>로 1회 register)
const _KBO_VIDEO_HELPERS = `
if (!window._kboVideoHelpersInit) {
  window._kboVideoHelpersInit = true;
  window.kboVideoStep = function(id, frames, fps) {
    var v = document.getElementById(id);
    if (!v) return;
    v.pause();
    var dt = frames / fps;
    var t = (v.currentTime || 0) + dt;
    if (t < 0) t = 0;
    if (v.duration && t > v.duration) t = v.duration;
    v.currentTime = t;
  };
  window.kboVideoTogglePlay = function(id) {
    var v = document.getElementById(id);
    if (!v) return;
    if (v.paused) v.play(); else v.pause();
  };
  window.kboVideoSpeed = function(id, rate, btn) {
    var v = document.getElementById(id);
    if (!v) return;
    v.playbackRate = rate;
    var rateEl = document.getElementById(id + '-rate');
    if (rateEl) rateEl.textContent = rate.toFixed(2);
    // 같은 그룹 내 active toggle
    if (btn && btn.parentElement) {
      Array.prototype.forEach.call(btn.parentElement.querySelectorAll('button[data-rate]'), function(b) {
        if (b === btn) {
          b.style.background = '#0F2A4A'; b.style.color = '#fff'; b.style.borderColor = '#0F2A4A';
        } else {
          b.style.background = '#fff'; b.style.color = '#0F2A4A'; b.style.borderColor = '#C5CCD5';
        }
      });
    }
  };
  window.kboVideoBindInfo = function(id, fps) {
    var v = document.getElementById(id);
    if (!v) return;
    var tEl = document.getElementById(id + '-time');
    var fEl = document.getElementById(id + '-frame');
    var rEl = document.getElementById(id + '-rate');
    function update() {
      var t = v.currentTime || 0;
      if (tEl) tEl.textContent = t.toFixed(3);
      if (fEl) fEl.textContent = Math.round(t * fps);
      if (rEl) rEl.textContent = (v.playbackRate || 1).toFixed(2);
    }
    v.addEventListener('timeupdate', update);
    v.addEventListener('seeked', update);
    v.addEventListener('ratechange', update);
    update();
  };
}`;

// 단계별 jump 버튼 (P4용)
function renderVideoJumpButton(video, stageKey, label, idSuffix = 'main') {
  if (!_hasVideo(video) || !video.stages || !video.stages[stageKey]) return '';
  const stage = video.stages[stageKey];
  const peak = stage.peak ?? stage.start;
  const id = `kbo-video-${idSuffix}`;
  return `<button onclick="document.getElementById('${id}').currentTime=${peak}; document.getElementById('${id}').play(); document.getElementById('${id}').scrollIntoView({behavior:'smooth', block:'center'});"
    style="display:inline-flex; align-items:center; gap:6px; padding:6px 12px; background:#0F2A4A; color:#fff; border:none; border-radius:6px; font-family:'Inter','Noto Sans KR',sans-serif; font-size:12px; font-weight:600; cursor:pointer; margin-top:8px;">
    <span style="font-size:13px;">▶</span>
    <span>${escapeHtml(label)} 보기 (${peak.toFixed(2)}초)</span>
  </button>`;
}

// 이벤트 jump 버튼 (P6 Video Checkpoint용 — FC/MER/BR)
function renderVideoEventJump(video, eventKey, label, idSuffix = 'main') {
  if (!_hasVideo(video) || !video.events || video.events[eventKey] == null) return '';
  const t = video.events[eventKey];
  const id = `kbo-video-${idSuffix}`;
  return `<button onclick="document.getElementById('${id}').currentTime=${t}; document.getElementById('${id}').pause(); document.getElementById('${id}').scrollIntoView({behavior:'smooth', block:'center'});"
    style="display:inline-flex; align-items:center; gap:5px; padding:4px 10px; background:#fff; color:#0F2A4A; border:1.5px solid #0F2A4A; border-radius:5px; font-family:'JetBrains Mono',monospace; font-size:11px; font-weight:700; cursor:pointer; margin-top:6px;">
    ⏸ ${escapeHtml(label)} (${t.toFixed(2)}s)
  </button>`;
}


// ════════════════════════════════════════════════════════════════════
// 5. P1 — Executive Summary (Kinematic-only)
// ════════════════════════════════════════════════════════════════════
function renderP1ExecutiveSummaryKinematic(input, dataAvailability) {
  const m = input.mechanics || {};
  const f = input.fitness || {};
  const playerId = input.playerId || input.player || 'parkmyeonggyun';
  const ageGroup = input.ageGroup || '고교 우투';

  // 측정 구속 (있을 때만)
  const measured = input.measuredVelocity || m.measured_velo || null;
  const measuredStr = measured != null ? `${measured.toFixed(1)} km/h` : '미측정';

  // 모델 예측 (v33.22 활용 — 안전 fallback)
  // ─────────────────────────────────────────────────────────────────
  // [v33.22 + Phase B-Fix] baseline = 측정값 (있을 때) 또는 모델 예측
  //   잔차(측정 - 모델 예측)는 "모델로 설명 안 되는 효율 보너스"이며 시나리오에서도 보존됨
  //   시나리오 = baseline + max(0, model_delta) — 음수 클램프로 "발전 시 측정값보다 낮음" 모순 방지
  //   imputation은 max-only — 본인이 이미 elite 이상이면 그대로 (elite 변경 시 향상 폭 0)
  // ─────────────────────────────────────────────────────────────────
  let currentPred = null, ceiling = null, fitnessOnly = null, mechOnly = null;
  let residual = null;  // 잔차 = 측정 - 모델 예측 (효율 보너스)
  try {
    if (typeof predictMaxVelocity === 'function') {
      currentPred = predictMaxVelocity(m, f);

      // imputation: max-only (본인 값과 코호트 elite 중 더 큰 값)
      const _max = (a, b) => Math.max((a == null || isNaN(a)) ? -Infinity : a, b);
      const fitMax = { ...f,
        'CMJ Peak Power / BM [W/kg]': _max(f['CMJ Peak Power / BM [W/kg]'], 70),
        'IMTP Peak Vertical Force / BM [N/kg]': _max(f['IMTP Peak Vertical Force / BM [N/kg]'], 35),
        'Grip Strength': _max(f['Grip Strength'], 65) };
      const mechMax = { ...m,
        peak_x_factor: _max(m.peak_x_factor, 40),
        lead_knee_ext_change_fc_to_br: _max(m.lead_knee_ext_change_fc_to_br, 12),
        proper_sequence_pct: _max(m.proper_sequence_pct, 100),
        cog_decel: _max(m.cog_decel, 1.8) };

      const fitOnlyPred  = predictMaxVelocity(m, fitMax);
      const mechOnlyPred = predictMaxVelocity(mechMax, f);
      const ceilingPred  = predictMaxVelocity(mechMax, fitMax);

      // baseline: 측정값 우선, 없으면 모델 예측
      const baseline = (measured != null && !isNaN(measured)) ? measured : currentPred;
      residual = (measured != null) ? Math.round((measured - currentPred) * 10) / 10 : null;

      // 시나리오 = baseline + max(0, model_delta)
      const _scenario = (pred) => {
        const delta = Math.max(0, pred - currentPred);
        return Math.round((baseline + delta) * 10) / 10;
      };
      fitnessOnly = _scenario(fitOnlyPred);
      mechOnly    = _scenario(mechOnlyPred);
      ceiling     = _scenario(ceilingPred);
    }
  } catch (e) { /* metadata.js 로드 안 됐을 때 graceful */ }

  // 강점·우선과제 자동 도출 — 선수/코치 친화 한글 표현
  const strengths = [];
  const priorities = [];
  if ((m.proper_sequence_pct ?? 0) >= 90) strengths.push('투구 동작 순서가 정확함 (10번 중 10번 합격)');
  if ((m.peak_x_factor ?? 0) >= 35) strengths.push(`골반-몸통 분리 각도 ${m.peak_x_factor.toFixed(1)}° — 또래 상위권`);
  if ((m.max_shoulder_ER_deg ?? m.max_shoulder_ER ?? 0) >= 195) strengths.push(`어깨 젖힘 각도 ${(m.max_shoulder_ER_deg ?? m.max_shoulder_ER).toFixed(0)}° — 미국 엘리트 수준`);

  if (m.max_pelvis_rot_vel_dps != null && m.max_pelvis_rot_vel_dps < 550) priorities.push('골반 회전 속도 키우기 — 하체에서 몸통으로 힘 전달 보강');
  if (m.cog_decel != null && m.cog_decel < 1.2) priorities.push('앞다리 단단히 박기 — 몸 전진 멈춤이 약해 회전으로 잘 안 바뀜');
  if (priorities.length === 0) priorities.push('투구 동작은 이미 잘 되어 있음 — 체력(악력·점프력·코어 힘) 키우면 더 빨라짐');

  // Hero headline (한 문장)
  const heroLine = strengths.length >= 2
    ? `<em>${strengths.slice(0,2).join(' · ')}</em>이 강점입니다. ${priorities[0] ?? ''}이(가) 다음 우선 과제입니다.`
    : `현재 메카닉을 기반으로 <em>${priorities[0] ?? '효율 향상'}</em>이 우선 과제입니다.`;

  // ── HTML 조립 ──
  return `
<section id="p1" class="report-page kbo-scope">
  <div class="kbo-pad">

    <!-- Page header -->
    <div class="kbo-page-head">
      <span class="kbo-page-num">P1</span>
      <span class="kbo-page-title-en">한눈에 보는 결론</span>
      <span class="kbo-page-title-kr">Executive Summary</span>
      <span class="kbo-page-q">이 선수의 강점과 우선 과제는 무엇인가</span>
    </div>

    <!-- Hero block -->
    <div style="margin-bottom: 28px;">
      <div class="kbo-eyebrow" style="margin-bottom: 10px;">투구 동작 분석 · ${escapeHtml(playerId)} · ${escapeHtml(ageGroup)}</div>
      <div class="kbo-headline">${heroLine}</div>
      ${renderDataBadge(dataAvailability)}
    </div>

    <!-- 예상 구속 향상 (Kinematic-only, 참고값) -->
    <div class="kbo-card" style="padding: 24px; margin-bottom: 18px;">
      <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:14px; gap:12px; flex-wrap:wrap;">
        <div>
          <div class="kbo-eyebrow" style="margin-bottom: 4px;">예상 구속 향상 · 참고값</div>
          <div class="kbo-display" style="font-size: 18px; color: #0F2A4A; font-weight: 700;">무엇을 키우면 어디까지 빨라질까?</div>
          <div style="font-size: 13px; color: #6B7280; margin-top: 2px;">BBL 고교 투수 166명 자료로 만든 모델 기반 예상치 — 보장값 아님</div>
        </div>
        <span class="kbo-conf kbo-conf-m">
          <span style="font-weight: 700;">● 참고</span>
          <span style="opacity: 0.7;">예상치</span>
        </span>
      </div>

      ${renderVelocityWaterfall({ measured, fitnessOnly, mechOnly, ceiling })}

      ${residual != null && Math.abs(residual) >= 3 ? `
      <div style="margin-top: 14px; padding: 12px 14px; border-left: 3px solid ${residual > 0 ? '#3F7D5C' : '#A8443A'}; background: ${residual > 0 ? 'rgba(63,125,92,0.06)' : 'rgba(168,68,58,0.06)'}; border-radius: 4px; font-size: 13px; color: #0F1419;">
        <b style="color: ${residual > 0 ? '#3F7D5C' : '#A8443A'};">${residual > 0 ? '실제 구속이 예상보다 빠름' : '실제 구속이 예상보다 느림'} (${residual > 0 ? '+' : ''}${residual.toFixed(1)} km/h)</b>
        <div style="color: #3F4651; margin-top: 4px; line-height: 1.5;">
          ${residual > 0
            ? '동작·체력 외에도 잘 던지게 만드는 무엇이 있다는 뜻 (감각·릴리스 타이밍·연습량 등). 강점이지만 모델로는 설명 안 됨.'
            : '동작·체력은 좋은데 실제 구속이 따라오지 않는 상태. 동작 효율을 점검할 필요가 있음.'}
        </div>
      </div>` : ''}

      <div style="margin-top: 14px; padding: 10px 14px; border-left: 3px solid #A87333; background: rgba(180,83,9,0.05); border-radius: 4px; font-size: 12px; color: #3F4651; line-height: 1.55;">
        ※ 위 km/h 값은 BBL 또래 투수 자료로 만든 예상치입니다. 실제 도달은 훈련·컨디션·재측정 환경에 따라 달라집니다. 보장이 아니라 "이 방향으로 갈 수 있다"는 참고용입니다.
      </div>
    </div>

    <!-- 3 핵심 카드: 강점 / 우선 과제 / 재측정 KPI -->
    <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:14px; margin-bottom: 18px;">
      ${render3HeroCards({
        strengths,
        priorities,
        kpi: [
          '투구 동작 순서 (10번 중 몇 번 합격?)',
          '골반 → 몸통 시간차 (ms)',
          '골반 → 몸통 속도 증폭 (몇 배?)'
        ]
      })}
    </div>

    <!-- Coach Delivery -->
    ${renderCoachDelivery({
      message: strengths.length >= 2
        ? `${strengths[0]} · ${strengths[1]} 모두 잘 되고 있음. 다음은 ${priorities[0]}.`
        : `${priorities[0]}`,
      cue: '골반 먼저, 몸통 다음에, 팔이 마지막에 나오게.',
      videoPoint: '앞발 착지 → 어깨 최대로 젖혀짐 → 공 놓는 순간, 이 세 장면을 함께 보세요.',
      kpi: '6주 후 다시 측정 — 투구 동작 순서, 골반-몸통 시간차, 속도 증폭이 어떻게 변했는지 확인.',
    })}

  </div>
</section>`;
}

// ════════════════════════════════════════════════════════════════════
// 헬퍼 — Velocity Upside Waterfall (4단계 막대그래프)
// ════════════════════════════════════════════════════════════════════
function renderVelocityWaterfall({ measured, fitnessOnly, mechOnly, ceiling }) {
  const rows = [];
  const baseline = measured;
  const max = Math.max(measured || 0, fitnessOnly || 0, mechOnly || 0, ceiling || 0, 1);

  function row(label, value, color, deltaTxt, sub) {
    if (value == null) {
      return `<div style="display:grid; grid-template-columns: 140px 1fr 80px 1fr; gap:16px; align-items:center; padding:10px 0;">
        <div style="font-size:14px; color:#0F1419; font-weight:600;">${label}</div>
        <div style="background:#F6F7F9; height:32px; border-radius:6px; padding:0 14px; display:flex; align-items:center; color:#9CA3AF;">미측정</div>
        <div class="kbo-mono" style="font-size:14px; color:#9CA3AF; font-weight:700; text-align:right;">—</div>
        <div style="font-size:12px; color:#9CA3AF;">${sub ?? ''}</div>
      </div>`;
    }
    const widthPct = Math.min(100, Math.max(20, (value / max) * 100));
    return `<div style="display:grid; grid-template-columns: 140px 1fr 80px 1fr; gap:16px; align-items:center; padding:10px 0;">
      <div style="font-size:14px; color:#0F1419; font-weight:600;">${label}</div>
      <div style="background:#F6F7F9; height:32px; border-radius:6px; position:relative; overflow:hidden;">
        <div style="position:absolute; top:0; left:0; bottom:0; width:${widthPct}%; background:${color}; opacity:0.92; border-radius:6px;"></div>
        <div style="position:absolute; inset:0; display:flex; align-items:center; padding:0 14px; font-family:'Space Grotesk',sans-serif; font-size:16px; color:#fff; font-weight:700; text-shadow:0 1px 2px rgba(0,0,0,0.25);">
          ${value.toFixed(1)} <span style="font-size:11px; margin-left:4px; opacity:0.85;">km/h</span>
        </div>
      </div>
      <div class="kbo-mono" style="font-size:14px; color:${deltaTxt && deltaTxt.startsWith('+') ? '#3F7D5C' : '#6B7280'}; font-weight:700; text-align:right;">${deltaTxt ?? '—'}</div>
      <div style="font-size:12px; color:#6B7280;">${sub ?? ''}</div>
    </div>`;
  }

  // delta 형식: 양수면 '+1.5', 0이면 '—', 음수는 표시 안 됨 (clamp 됨)
  const fmtDelta = (v) => {
    if (v == null || isNaN(v)) return '—';
    const d = Math.round(v * 10) / 10;
    if (d <= 0) return '—';
    return `+${d.toFixed(1)}`;
  };

  rows.push(row('지금 구속', measured, '#3F4651', '—', 'BBL 평균 (10번 던진 평균)'));
  rows.push(row('체력만 키우면', fitnessOnly, '#3B5A82',
    fitnessOnly != null && baseline != null ? fmtDelta(fitnessOnly - baseline) : null,
    '악력·점프력·코어 힘을 또래 상위까지 키울 때'));
  rows.push(row('동작만 다듬으면', mechOnly, '#0F2A4A',
    mechOnly != null && baseline != null ? fmtDelta(mechOnly - baseline) : null,
    '회전 출력·동작 순서를 또래 상위까지 다듬을 때'));
  rows.push(row('둘 다 발전하면', ceiling, '#A87333',
    ceiling != null && baseline != null ? fmtDelta(ceiling - baseline) : null,
    '체력+동작 둘 다 발전 시 6주 후 도달 가능 상한'));
  return rows.join('');
}

// ════════════════════════════════════════════════════════════════════
// 헬퍼 — 3 핵심 카드 (강점 / 우선 과제 / 재측정 KPI)
// ════════════════════════════════════════════════════════════════════
function render3HeroCards({ strengths, priorities, kpi }) {
  function card(title, items, color, icon) {
    const list = items.map(t => `<li style="margin-top:6px; line-height:1.4;">${escapeHtml(t)}</li>`).join('');
    return `<div class="kbo-card" style="padding:18px; border-left:3px solid ${color};">
      <div class="kbo-eyebrow" style="margin-bottom:8px;">${icon} ${title}</div>
      <ul style="margin:0; padding-left:18px; font-size:13px; color:#0F1419; list-style:disc;">
        ${list || '<li style="color:#9CA3AF;">—</li>'}
      </ul>
    </div>`;
  }
  return [
    card('강점',          strengths,  '#3F7D5C', '✓'),
    card('우선 과제',     priorities, '#A87333', '◎'),
    card('재측정 KPI',    kpi,        '#3B5A82', '◇'),
  ].join('');
}

// ════════════════════════════════════════════════════════════════════
// 6. P2 — Kinematic Output (속도 만드는 능력)
// ════════════════════════════════════════════════════════════════════
// 가이드 §5: "이 선수가 속도를 만들 수 있는가?"
// 선수/코치 친화 톤: "회전 속도", "속도 증폭", "공 놓는 속도" 사용
// Uplift Pro 레인지 (LITERATURE_OVERRIDE 기반) — 또래 상위(Pro) 범위 표시
const _PRO_RANGES = {
  pelvis_av:    { lo: 445,  hi: 580,  unit: '°/s', name: '골반 회전 속도' },
  trunk_av:     { lo: 825,  hi: 1100, unit: '°/s', name: '몸통 회전 속도' },
  arm_av:       { lo: 1235, hi: 1480, unit: '°/s', name: '팔 회전 속도' },
  pelvis_speedup: { lo: 1.45, hi: 1.85, unit: '배', name: '골반→몸통 증폭' },
  arm_speedup:  { lo: 1.55, hi: 2.10, unit: '배', name: '몸통→팔 증폭' },
};

function _gradeRange(value, lo, hi) {
  if (value == null || isNaN(value)) return { tone: 'na', label: '미측정', color: '#9CA3AF' };
  if (value >= lo && value <= hi) return { tone: 'good', label: '또래 상위 범위', color: '#3F7D5C' };
  if (value < lo) {
    const gap = ((lo - value) / lo) * 100;
    if (gap > 20) return { tone: 'leak', label: '낮음 (보강 필요)', color: '#A8443A' };
    return { tone: 'caution', label: '약간 낮음', color: '#A87333' };
  }
  // value > hi
  const over = ((value - hi) / hi) * 100;
  if (over > 20) return { tone: 'caution', label: '범위 초과 (안정성 점검)', color: '#A87333' };
  return { tone: 'good', label: '또래 상위 범위', color: '#3F7D5C' };
}

function _outputBar(label, value, range, helpText) {
  const v = value != null && !isNaN(value) ? value : null;
  const grade = _gradeRange(v, range.lo, range.hi);
  // 막대 시각화 — Pro 범위(lo~hi)를 중앙 영역으로 표시
  const visMin = range.lo * 0.7;
  const visMax = range.hi * 1.25;
  const proStart = ((range.lo - visMin) / (visMax - visMin)) * 100;
  const proWidth = ((range.hi - range.lo) / (visMax - visMin)) * 100;
  const valuePos = v != null ? Math.max(0, Math.min(100, ((v - visMin) / (visMax - visMin)) * 100)) : 0;
  return `<div class="kbo-card" style="padding:18px; margin-bottom:12px;">
    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin-bottom:10px;">
      <div>
        <div style="font-size:13px; color:#6B7280; font-weight:500; margin-bottom:2px;">${label}</div>
        <div style="display:flex; align-items:baseline; gap:6px;">
          <span class="kbo-metric-num" style="font-size:32px; color:#0F2A4A;">${v != null ? v.toFixed(v > 100 ? 0 : 2) : '—'}</span>
          <span class="kbo-metric-unit" style="font-size:14px;">${range.unit}</span>
        </div>
        ${helpText ? `<div style="font-size:11px; color:#9CA3AF; margin-top:4px;">${helpText}</div>` : ''}
      </div>
      <span class="kbo-pill kbo-pill-${grade.tone === 'good' ? 'good' : grade.tone === 'leak' ? 'leak' : 'caution'}">${grade.label}</span>
    </div>
    <!-- 분포 막대: Pro 범위(중앙 녹색) + 선수 위치(검정 점) -->
    <div style="position:relative; height:14px; background:#F6F7F9; border-radius:7px; overflow:hidden;">
      <div style="position:absolute; top:0; bottom:0; left:${proStart}%; width:${proWidth}%; background:rgba(63,125,92,0.18); border-radius:7px;"></div>
      ${v != null ? `
      <div style="position:absolute; top:-4px; left:calc(${valuePos}% - 11px); width:22px; height:22px; background:${grade.color}; border:2px solid #fff; border-radius:50%; box-shadow:0 1px 3px rgba(0,0,0,0.15);"></div>
      ` : ''}
    </div>
    <div style="display:flex; justify-content:space-between; font-size:10px; color:#9CA3AF; font-family:'JetBrains Mono',monospace; margin-top:4px;">
      <span>${visMin.toFixed(0)}</span>
      <span style="color:#3F7D5C; font-weight:600;">또래 상위 ${range.lo.toFixed(0)}~${range.hi.toFixed(0)}</span>
      <span>${visMax.toFixed(0)}</span>
    </div>
  </div>`;
}

function renderP2KinematicOutput(input, dataAvailability) {
  const m = input.mechanics || {};

  // 변수 매핑
  const pelvis_av = m.peak_pelvis_av ?? m.max_pelvis_rot_vel_dps;
  const trunk_av  = m.peak_trunk_av  ?? m.max_trunk_twist_vel_dps;
  const arm_av    = m.peak_arm_av    ?? m.elbow_ext_vel_max;  // arm peak proxy
  const pelvis_speedup = m.pelvis_trunk_speedup;
  const arm_speedup    = m.arm_trunk_speedup;
  const release_speed  = m.wrist_release_speed;  // m/s

  // 진단 자동 생성
  const diagBits = [];
  const pg = _gradeRange(pelvis_av, _PRO_RANGES.pelvis_av.lo, _PRO_RANGES.pelvis_av.hi);
  const tg = _gradeRange(trunk_av,  _PRO_RANGES.trunk_av.lo,  _PRO_RANGES.trunk_av.hi);
  const ag = _gradeRange(arm_av,    _PRO_RANGES.arm_av.lo,    _PRO_RANGES.arm_av.hi);

  if (pg.tone === 'good' && tg.tone === 'good' && ag.tone === 'good') {
    diagBits.push('골반·몸통·팔 회전이 모두 또래 상위 범위에 있습니다. 속도를 만드는 능력은 충분합니다.');
  } else if (pg.tone === 'good' && tg.tone !== 'good') {
    diagBits.push('골반은 잘 돌아가는데 몸통이 따라오는 속도가 약합니다. 골반과 몸통 사이 연결을 점검하세요.');
  } else if (pg.tone !== 'good') {
    diagBits.push('골반 회전 속도가 또래 상위 범위에 미치지 못합니다. 하체→몸통 추진을 보강하면 전체 속도가 따라옵니다.');
  } else {
    diagBits.push('회전 속도 일부가 또래 상위 범위 밖입니다. 어느 분절에서 막히는지 아래에서 확인하세요.');
  }

  if (arm_speedup != null && arm_speedup >= 1.7) {
    diagBits.push(`몸통→팔 속도 증폭 ${arm_speedup.toFixed(2)}배 — 팔로 힘이 잘 전달되고 있습니다.`);
  }

  return `
<section id="p2" class="report-page kbo-scope">
  <div class="kbo-pad">

    <div class="kbo-page-head">
      <span class="kbo-page-num">P2</span>
      <span class="kbo-page-title-en">속도를 만드는 능력</span>
      <span class="kbo-page-title-kr">Kinematic Output</span>
      <span class="kbo-page-q">이 선수는 회전 속도를 충분히 만들 수 있는가?</span>
    </div>

    <div style="margin-bottom: 18px;">
      <div class="kbo-headline" style="font-size: 18px;">${escapeHtml(diagBits[0] || '회전 출력 분석')}</div>
      ${diagBits[1] ? `<div style="font-size:13.5px; color:#3F4651; margin-top:6px; line-height:1.55;">${escapeHtml(diagBits[1])}</div>` : ''}
      <div style="font-size:11px; color:#6B7280; margin-top:8px; font-style:italic;">
        ※ 이 페이지는 회전 속도와 속도 증폭으로 "속도를 만드는 능력"을 봅니다. 지면 반력·관절 파워는 측정하지 않으므로 회전 출력으로 대체 평가합니다.
      </div>
    </div>

    <!-- 분절별 peak velocity 3카드 -->
    <div class="kbo-eyebrow" style="margin-bottom: 8px;">분절별 회전 속도 — 골반에서 시작해 팔로 전달</div>
    ${_outputBar('① 골반 회전 속도', pelvis_av, _PRO_RANGES.pelvis_av, '하체에서 만든 회전을 골반으로 옮기는 속도')}
    ${_outputBar('② 몸통 회전 속도', trunk_av, _PRO_RANGES.trunk_av, '골반 회전을 몸통이 받아서 빨라지는 속도')}
    ${_outputBar('③ 팔 회전 속도', arm_av, _PRO_RANGES.arm_av, '몸통 회전을 팔이 마지막으로 받아 공으로 전달')}

    <!-- 속도 증폭 (Speed Gain) — 분절 사이에서 얼마나 빨라지나 -->
    <div class="kbo-eyebrow" style="margin: 22px 0 8px 0;">속도 증폭 — 다음 분절로 갈 때 속도가 몇 배 빨라지나</div>
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
      ${_outputBar('골반 → 몸통', pelvis_speedup, _PRO_RANGES.pelvis_speedup, '몸통이 골반보다 몇 배 빠르게 돌아가나')}
      ${_outputBar('몸통 → 팔', arm_speedup, _PRO_RANGES.arm_speedup, '팔이 몸통보다 몇 배 빠르게 돌아가나')}
    </div>

    <!-- 공 놓는 순간의 속도 (release speed) -->
    ${release_speed != null ? `
    <div class="kbo-card" style="padding:18px; margin-top:14px; border-left: 3px solid #0F2A4A;">
      <div class="kbo-eyebrow" style="margin-bottom:6px;">공 놓는 순간 손목 속도</div>
      <div style="display:flex; align-items:baseline; gap:8px;">
        <span class="kbo-metric-num" style="font-size:36px; color:#0F2A4A;">${release_speed.toFixed(1)}</span>
        <span class="kbo-metric-unit" style="font-size:16px;">m/s</span>
        <span style="font-size:11px; color:#6B7280; margin-left:8px;">(${(release_speed * 3.6).toFixed(0)} km/h 환산)</span>
      </div>
      <div style="font-size:12px; color:#6B7280; margin-top:6px;">
        팔로 전달된 회전 에너지가 손목·공으로 빠져나가는 마지막 속도. 회전 출력 + 시퀀스가 잘 맞을수록 큼.
      </div>
    </div>
    ` : ''}

    <!-- Coach Delivery -->
    ${renderCoachDelivery({
      message: diagBits[0],
      cue: pg.tone !== 'good'
        ? '하체 추진 강화 — 디딤발에 체중 싣고 골반부터 돌리기.'
        : (tg.tone !== 'good' ? '몸통 회전 늦추기 — 골반이 먼저 돌아간 뒤 몸통이 받게.' : '지금 회전 출력은 충분 — 다음 페이지에서 시퀀스 점검.'),
      videoPoint: '앞발 착지 직후 골반·몸통이 도는 순서를 옆에서 확인.',
      kpi: '6주 후 골반·몸통·팔 회전 속도 + 속도 증폭 재측정.',
    })}

  </div>
</section>`;
}


// ════════════════════════════════════════════════════════════════════
// 7. P3 — Kinematic Transfer Proxy (Dynamic Sequence 시각화 핵심)
// ════════════════════════════════════════════════════════════════════
// 가이드 §6: "골반→몸통→팔 순서와 시간차가 좋은가?"
// 핵심 visual: SVG simulated curve (가우시안) + peak marker + lag bar
// 선수/코치 친화: "동작 순서 그래프", "골반에서 몸통까지 시간차"

function _gaussianAt(x, peakX, peakY, sigma) {
  return peakY * Math.exp(-Math.pow((x - peakX) / sigma, 2));
}

function _renderDynamicSequenceSVG({ pelvisPeak, trunkPeak, armPeak, pelvisLag, trunkArmLag }) {
  // 시간축 (ms): KH(0) → FC(~250) → BR(~400)
  const W = 720, H = 280, padL = 50, padR = 20, padT = 20, padB = 40;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const tMin = 0, tMax = 450;  // ms
  const yMax = Math.max(armPeak * 1.1, 2000);

  // 분절별 peak 시간 (가정 — 일반적 패턴)
  // 골반 peak ~ 280ms (FC 직후)
  // 몸통 peak = 골반 peak + pelvisLag
  // 팔 peak = 몸통 peak + trunkArmLag (없으면 추정 50ms)
  const pelvisT = 280;
  const trunkT = pelvisT + (pelvisLag ?? 50);
  const armT = trunkT + (trunkArmLag ?? 50);

  // 시뮬레이션 곡선 — 가우시안 (sigma 30~50ms)
  const segments = [
    { name: '골반', peakT: pelvisT, peakV: pelvisPeak, sigma: 45, color: '#3B5A82' },
    { name: '몸통', peakT: trunkT,  peakV: trunkPeak,  sigma: 38, color: '#0F2A4A' },
    { name: '팔',   peakT: armT,    peakV: armPeak,    sigma: 30, color: '#A87333' },
  ];

  function tx(t) { return padL + ((t - tMin) / (tMax - tMin)) * plotW; }
  function vy(v) { return padT + plotH - (v / yMax) * plotH; }

  // 곡선 path 생성
  const pathStr = (seg) => {
    const pts = [];
    for (let t = 0; t <= tMax; t += 5) {
      pts.push(`${tx(t)},${vy(_gaussianAt(t, seg.peakT, seg.peakV, seg.sigma))}`);
    }
    return `M ${pts.join(' L ')}`;
  };

  // 격자 배경 (KH/FC/BR 표시)
  const events = [
    { t: 0,   label: 'KH (드는 발)' },
    { t: 250, label: 'FC (앞발 착지)' },
    { t: armT, label: 'BR (공 놓기)' },
  ];

  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:720px; display:block; margin:0 auto;">
    <!-- 격자 -->
    ${events.map(e => `
      <line x1="${tx(e.t)}" y1="${padT}" x2="${tx(e.t)}" y2="${padT + plotH}" stroke="#E1E5EB" stroke-dasharray="3,3" />
      <text x="${tx(e.t)}" y="${H - 8}" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="10" fill="#6B7280">${e.label}</text>
    `).join('')}
    <!-- y축 라벨 -->
    <text x="${padL - 8}" y="${vy(yMax) + 4}" text-anchor="end" font-family="JetBrains Mono, monospace" font-size="9" fill="#9CA3AF">${yMax.toFixed(0)}</text>
    <text x="${padL - 8}" y="${padT + plotH}" text-anchor="end" font-family="JetBrains Mono, monospace" font-size="9" fill="#9CA3AF">0</text>
    <text x="${padL - 8}" y="${padT + plotH / 2}" text-anchor="end" font-family="JetBrains Mono, monospace" font-size="9" fill="#9CA3AF">°/s</text>
    <!-- 곡선 + peak marker -->
    ${segments.map(seg => `
      <path d="${pathStr(seg)}" fill="none" stroke="${seg.color}" stroke-width="2.5" />
      <circle cx="${tx(seg.peakT)}" cy="${vy(seg.peakV)}" r="5" fill="${seg.color}" stroke="#fff" stroke-width="2" />
      <text x="${tx(seg.peakT)}" y="${vy(seg.peakV) - 10}" text-anchor="middle" font-family="Space Grotesk, sans-serif" font-size="11" font-weight="700" fill="${seg.color}">${seg.name}</text>
      <text x="${tx(seg.peakT)}" y="${vy(seg.peakV) - 24}" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="9" fill="#6B7280">${seg.peakV.toFixed(0)} °/s</text>
    `).join('')}
    <!-- lag 표시 (골반→몸통) -->
    <line x1="${tx(pelvisT)}" y1="${padT + plotH + 5}" x2="${tx(trunkT)}" y2="${padT + plotH + 5}" stroke="#A87333" stroke-width="2" />
    <text x="${(tx(pelvisT) + tx(trunkT)) / 2}" y="${padT + plotH + 18}" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="10" fill="#A87333" font-weight="700">${(pelvisLag ?? 50).toFixed(0)}ms</text>
  </svg>`;
}

function renderP3KinematicTransferProxy(input, dataAvailability) {
  const m = input.mechanics || {};
  const pelvisAv  = m.peak_pelvis_av ?? m.max_pelvis_rot_vel_dps ?? 500;
  const trunkAv   = m.peak_trunk_av  ?? m.max_trunk_twist_vel_dps ?? 800;
  const armAv     = m.peak_arm_av    ?? m.elbow_ext_vel_max ?? 1500;
  const pelvisLag = m.pelvis_to_trunk_lag_ms;
  const trunkArmLag = m.trunk_to_arm_lag_ms;
  const seqPct    = m.proper_sequence_pct ?? null;
  const xOfN      = m._proper_seq_x_of_n;
  const pelvisSpeedup = m.pelvis_trunk_speedup;
  const armSpeedup    = m.arm_trunk_speedup;

  // 시퀀스 평가
  const seqState = seqPct >= 90 ? { tone: 'good', label: '정확함', color: '#3F7D5C' }
                  : seqPct >= 70 ? { tone: 'caution', label: '대체로 OK', color: '#A87333' }
                  : { tone: 'leak', label: '순서가 자주 어긋남', color: '#A8443A' };

  // lag 평가 (target 30~70ms)
  const lagState = pelvisLag != null
    ? (pelvisLag >= 30 && pelvisLag <= 70 ? { tone: 'good', label: '적절', color: '#3F7D5C' }
       : pelvisLag < 30 ? { tone: 'caution', label: '시간차 너무 짧음 (몸통이 골반과 거의 동시에 돔)', color: '#A87333' }
       : { tone: 'caution', label: '시간차 너무 김 (몸통이 너무 늦게 돔)', color: '#A87333' })
    : { tone: 'na', label: '미측정', color: '#9CA3AF' };

  // 한 줄 진단
  let topLine;
  if (seqState.tone === 'good' && lagState.tone === 'good') {
    topLine = `골반 → 몸통 → 팔이 ${(pelvisLag ?? 50).toFixed(0)}ms 시간차로 정확하게 이어집니다. 동작 순서·시간차 모두 양호.`;
  } else if (seqState.tone !== 'good') {
    topLine = `투구 순서가 자주 어긋납니다 (${xOfN ?? `${Math.round(seqPct ?? 0)}%`}). 골반보다 몸통·팔이 먼저 도는지 점검하세요.`;
  } else {
    topLine = `순서는 맞지만 시간차가 ${pelvisLag != null ? pelvisLag.toFixed(0) + 'ms로 ' : ''}${lagState.label}.`;
  }

  return `
<section id="p3" class="report-page kbo-scope">
  <div class="kbo-pad">

    <div class="kbo-page-head">
      <span class="kbo-page-num">P3</span>
      <span class="kbo-page-title-en">동작 순서·시간차 (전달 효율)</span>
      <span class="kbo-page-title-kr">Kinematic Transfer Proxy</span>
      <span class="kbo-page-q">골반 → 몸통 → 팔 순서와 시간차가 좋은가?</span>
    </div>

    <div style="margin-bottom: 18px;">
      <div class="kbo-headline" style="font-size: 18px;">${escapeHtml(topLine)}</div>
      <div style="font-size:12px; color:#6B7280; margin-top:8px; font-style:italic; line-height:1.55;">
        ※ 이 페이지는 회전 속도가 골반에서 시작해 팔로 이어지는 "흐름"을 봅니다. 직접적인 힘 전달율은 측정하지 않으므로, 동작 순서와 시간차로 대체 평가합니다.
      </div>
    </div>

    <!-- Dynamic Sequence Curve (핵심 시각화) -->
    <div class="kbo-card" style="padding: 18px; margin-bottom: 14px;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px; margin-bottom: 8px;">
        <div>
          <div class="kbo-eyebrow" style="margin-bottom: 4px;">동작 순서 그래프 — 골반에서 시작해 팔로 가는 흐름</div>
          <div style="font-size:12px; color:#6B7280;">좋은 투구는 골반 → 몸통 → 팔 순서로 약간의 시간차를 두고 회전 속도가 정점을 찍습니다.</div>
        </div>
        ${_hasVideo(input.video) ? `<button onclick="document.getElementById('kbo-video-p3').play();"
          style="display:inline-flex; align-items:center; gap:6px; padding:6px 12px; background:#fff; color:#0F2A4A; border:1.5px solid #0F2A4A; border-radius:6px; font-family:'Inter',sans-serif; font-size:12px; font-weight:600; cursor:pointer; flex-shrink:0;">
          <span>▶</span><span>전체 투구 영상 보기</span>
        </button>` : ''}
      </div>
      ${_hasVideo(input.video) ? renderGlobalVideoPlayer(input.video, 'p3') : ''}
      ${_renderDynamicSequenceSVG({
        pelvisPeak: pelvisAv, trunkPeak: trunkAv, armPeak: armAv,
        pelvisLag, trunkArmLag,
      })}
      <div style="display:flex; gap:14px; flex-wrap:wrap; margin-top:10px; font-size:12px; color:#3F4651;">
        <span><span style="display:inline-block; width:10px; height:3px; background:#3B5A82; margin-right:4px; vertical-align:middle;"></span>골반</span>
        <span><span style="display:inline-block; width:10px; height:3px; background:#0F2A4A; margin-right:4px; vertical-align:middle;"></span>몸통</span>
        <span><span style="display:inline-block; width:10px; height:3px; background:#A87333; margin-right:4px; vertical-align:middle;"></span>팔</span>
        <span style="margin-left:auto; color:#9CA3AF; font-style:italic;">※ 곡선은 peak 시점·속도를 시뮬레이션. 실제 raw 시계열은 부록 참조</span>
      </div>
    </div>

    <!-- 3 핵심 지표 -->
    <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:12px; margin-bottom: 16px;">
      <!-- 시퀀스 합격 여부 -->
      <div class="kbo-card" style="padding:16px; border-left:3px solid ${seqState.color};">
        <div class="kbo-eyebrow" style="margin-bottom:6px;">동작 순서 합격</div>
        <div style="display:flex; align-items:baseline; gap:6px;">
          <span class="kbo-metric-num" style="font-size:30px; color:${seqState.color};">${xOfN ?? (seqPct != null ? Math.round(seqPct) + '%' : '—')}</span>
        </div>
        <div style="font-size:12px; color:${seqState.color}; font-weight:600; margin-top:4px;">${seqState.label}</div>
        <div style="font-size:11px; color:#6B7280; margin-top:4px;">10번 던졌을 때 골반→몸통→팔 순서가 맞은 횟수</div>
      </div>
      <!-- 골반→몸통 시간차 -->
      <div class="kbo-card" style="padding:16px; border-left:3px solid ${lagState.color};">
        <div class="kbo-eyebrow" style="margin-bottom:6px;">골반 → 몸통 시간차</div>
        <div style="display:flex; align-items:baseline; gap:6px;">
          <span class="kbo-metric-num" style="font-size:30px; color:${lagState.color};">${pelvisLag != null ? pelvisLag.toFixed(0) : '—'}</span>
          <span class="kbo-metric-unit" style="font-size:13px;">ms</span>
        </div>
        <div style="font-size:12px; color:${lagState.color}; font-weight:600; margin-top:4px;">${lagState.label}</div>
        <div style="font-size:11px; color:#6B7280; margin-top:4px;">또래 상위 30~70ms — 너무 짧으면 동시, 너무 길면 끊김</div>
      </div>
      <!-- 속도 증폭 (몸통→팔) -->
      <div class="kbo-card" style="padding:16px; border-left:3px solid #0F2A4A;">
        <div class="kbo-eyebrow" style="margin-bottom:6px;">몸통 → 팔 속도 증폭</div>
        <div style="display:flex; align-items:baseline; gap:6px;">
          <span class="kbo-metric-num" style="font-size:30px; color:#0F2A4A;">${armSpeedup != null ? armSpeedup.toFixed(2) : '—'}</span>
          <span class="kbo-metric-unit" style="font-size:13px;">배</span>
        </div>
        <div style="font-size:12px; color:${armSpeedup != null && armSpeedup >= 1.7 ? '#3F7D5C' : '#A87333'}; font-weight:600; margin-top:4px;">
          ${armSpeedup == null ? '미측정' : armSpeedup >= 1.7 ? '잘 전달됨' : '전달 약함'}
        </div>
        <div style="font-size:11px; color:#6B7280; margin-top:4px;">팔이 몸통보다 몇 배 빠르게 돌아가나 — 클수록 잘 전달</div>
      </div>
    </div>

    <!-- Coach Delivery -->
    ${renderCoachDelivery({
      message: topLine,
      cue: seqState.tone !== 'good'
        ? '몸통·팔이 먼저 나오지 않게 — 골반이 돈 다음에 몸통, 그 다음 팔.'
        : (lagState.tone !== 'good' ? '골반과 몸통 사이 "잠깐 기다리기" 연습.' : '지금 흐름은 좋음 — 다음 페이지에서 시간 흐름별 점검.'),
      videoPoint: '옆에서 본 영상에서 골반·몸통이 도는 시점을 슬로우로 보세요. 골반이 먼저 정점을 찍고, 몸통이 그 다음에 정점을 찍어야 합니다.',
      kpi: '6주 후 동작 순서 합격 횟수, 골반-몸통 시간차, 속도 증폭 재측정.',
    })}

  </div>
</section>`;
}


// ════════════════════════════════════════════════════════════════════
// 8. P4 — Flow Leak Timeline (Drive → Landing → Torso → Arm → Release)
// ════════════════════════════════════════════════════════════════════
// 가이드 §5: "투구 시간 흐름에서 어디서 동작이 막히는가?"
// 5단계 timeline + 단계별 leak flag + cue + drill 1개씩

function _stageStatus(metricVals, rules) {
  // rules: [{label, ok: bool}], ok가 모두 true면 good, 일부 false면 caution, 다수 false면 leak
  const oks = rules.filter(r => r.ok).length;
  const total = rules.length;
  if (oks === total) return { tone: 'good', label: '양호', color: '#3F7D5C' };
  if (oks >= Math.ceil(total / 2)) return { tone: 'caution', label: '주의', color: '#A87333' };
  return { tone: 'leak', label: '점검 필요', color: '#A8443A' };
}

function renderP4FlowLeakTimeline(input, dataAvailability) {
  const m = input.mechanics || {};

  // 5 단계별 평가 — 박명균 같은 elite는 모두 양호하지만, 일반 케이스 대응
  const stages = [
    {
      key: 'drive', icon: '①', en: 'Drive', kr: '구동',
      desc: '디딤발에서 시작해 골반이 돌기 시작하는 단계',
      metrics: [
        m.hip_ir_vel_max_drive != null ? { label: '뒷다리 hip 회전 속도', value: `${m.hip_ir_vel_max_drive.toFixed(0)} °/s`, ok: m.hip_ir_vel_max_drive >= 600 } : null,
        m.max_pelvis_rot_vel_dps != null || m.peak_pelvis_av != null ? {
          label: '골반 회전 속도',
          value: `${(m.max_pelvis_rot_vel_dps ?? m.peak_pelvis_av).toFixed(0)} °/s`,
          ok: (m.max_pelvis_rot_vel_dps ?? m.peak_pelvis_av) >= 445,
        } : null,
      ].filter(Boolean),
      cue: '디딤발에 체중 단단히 싣기 — 그 위에서 골반이 돌게.',
      drill: '벽 밀기 드릴 (Wall drill) — 디딤발 자세에서 벽을 미는 느낌으로 골반 회전 학습',
    },
    {
      key: 'landing', icon: '②', en: 'Landing', kr: '착지',
      desc: '앞발이 땅에 닿고, 그 다리로 몸의 전진을 받쳐주는 단계',
      metrics: [
        m.lead_knee_ext_change_fc_to_br != null ? {
          label: '앞무릎 유지력 (착지→릴리스)',
          value: `${m.lead_knee_ext_change_fc_to_br > 0 ? '+' : ''}${m.lead_knee_ext_change_fc_to_br.toFixed(1)}°`,
          ok: m.lead_knee_ext_change_fc_to_br >= 0,
        } : null,
        m.trunk_forward_tilt_at_fc != null ? {
          label: '착지 시 몸통 기울기',
          value: `${m.trunk_forward_tilt_at_fc.toFixed(1)}°`,
          ok: m.trunk_forward_tilt_at_fc >= -5 && m.trunk_forward_tilt_at_fc <= 15,
        } : null,
        m.cog_decel != null ? {
          label: '무게중심 정지력',
          value: `${m.cog_decel.toFixed(2)} m/s`,
          ok: m.cog_decel >= 1.0,
        } : null,
      ].filter(Boolean),
      cue: '앞발 디딘 다음 무릎이 더 굽혀지지 않게 — 단단히 받쳐서.',
      drill: 'Block step throw — 앞발 착지 후 무릎 신전 유지하며 던지기',
    },
    {
      key: 'torso', icon: '③', en: 'Torso', kr: '몸통',
      desc: '골반-몸통 분리에서 몸통이 회전하며 팔로 힘을 전달',
      metrics: [
        m.peak_x_factor != null ? {
          label: '골반-몸통 분리 (X-Factor)',
          value: `${m.peak_x_factor.toFixed(1)}°`,
          ok: m.peak_x_factor >= 30,
        } : null,
        m.pelvis_to_trunk_lag_ms != null ? {
          label: '골반 → 몸통 시간차',
          value: `${m.pelvis_to_trunk_lag_ms.toFixed(0)} ms`,
          ok: m.pelvis_to_trunk_lag_ms >= 30 && m.pelvis_to_trunk_lag_ms <= 70,
        } : null,
        m.pelvis_trunk_speedup != null ? {
          label: '골반 → 몸통 속도 증폭',
          value: `${m.pelvis_trunk_speedup.toFixed(2)}배`,
          ok: m.pelvis_trunk_speedup >= 1.45,
        } : null,
      ].filter(Boolean),
      cue: '몸통이 골반보다 먼저 돌지 않게 — "잠깐 기다렸다가" 회전.',
      drill: 'Hip-shoulder separation drill — 골반 먼저 돌리고 몸통 따라가는 분리 동작 연습',
    },
    {
      key: 'arm', icon: '④', en: 'Arm', kr: '팔',
      desc: '어깨가 최대로 젖혀지고, 그 반동으로 팔이 채찍처럼 빠르게 돔',
      metrics: [
        (m.max_shoulder_ER_deg ?? m.max_shoulder_ER) != null ? {
          label: '어깨 젖힘 각도 (Layback)',
          value: `${(m.max_shoulder_ER_deg ?? m.max_shoulder_ER).toFixed(0)}°`,
          ok: (m.max_shoulder_ER_deg ?? m.max_shoulder_ER) >= 165,
        } : null,
        m.elbow_ext_vel_max != null ? {
          label: '팔꿈치 신전 속도',
          value: `${m.elbow_ext_vel_max.toFixed(0)} °/s`,
          ok: m.elbow_ext_vel_max >= 1500,
        } : null,
        m.arm_trunk_speedup != null ? {
          label: '몸통 → 팔 증폭',
          value: `${m.arm_trunk_speedup.toFixed(2)}배`,
          ok: m.arm_trunk_speedup >= 1.55,
        } : null,
      ].filter(Boolean),
      cue: '팔이 먼저 나가지 않게 — 어깨가 충분히 젖혀진 다음에 채찍처럼.',
      drill: 'Connected throw — 몸통-팔 연결 감각 위해 짧은 거리 캐치볼',
    },
    {
      key: 'release', icon: '⑤', en: 'Release', kr: '릴리스',
      desc: '공을 놓는 순간 — 팔이 어디서 어떤 자세로 공을 놓는지',
      metrics: [
        m.arm_slot_mean_deg != null ? {
          label: '팔 각도 (arm slot)',
          value: `${m.arm_slot_mean_deg.toFixed(0)}° ${_armSlotName(m.arm_slot_mean_deg)}`,
          ok: m.arm_slot_sd_deg == null || m.arm_slot_sd_deg <= 5,
        } : null,
        m.release_height_m != null ? {
          label: '릴리스 높이',
          value: `${m.release_height_m.toFixed(2)} m`,
          ok: true,  // release height 자체는 좋고나쁨 없음 — 일관성이 중요
        } : null,
        m.wrist_release_speed != null ? {
          label: '공 놓는 손목 속도',
          value: `${m.wrist_release_speed.toFixed(1)} m/s`,
          ok: m.wrist_release_speed >= 12,
        } : null,
        m.arm_slot_sd_deg != null ? {
          label: '팔 각도 일관성 (SD)',
          value: `±${m.arm_slot_sd_deg.toFixed(1)}°`,
          ok: m.arm_slot_sd_deg <= 3,
        } : null,
      ].filter(Boolean),
      cue: '매 투구 같은 지점에서 같은 각도로 — 일관성이 제구.',
      drill: 'Target throw — 동일 타겟 반복 투구로 릴리스 일관성 훈련',
    },
  ];

  // 가장 큰 leak 단계
  const leakStage = stages.find(s => _stageStatus(null, s.metrics).tone === 'leak');
  const cautionStage = stages.find(s => _stageStatus(null, s.metrics).tone === 'caution');
  const primaryLeak = leakStage || cautionStage || null;

  const topLine = primaryLeak
    ? `투구 흐름에서 가장 점검할 부분은 <em>${primaryLeak.en} (${primaryLeak.kr})</em> 단계입니다.`
    : `5단계 모두 양호하게 이어집니다. 이 흐름을 유지하면서 체력 보강에 집중하세요.`;

  return `
<section id="p4" class="report-page kbo-scope">
  <div class="kbo-pad">

    <div class="kbo-page-head">
      <span class="kbo-page-num">P4</span>
      <span class="kbo-page-title-en">시간 흐름별 점검</span>
      <span class="kbo-page-title-kr">Flow Leak Timeline</span>
      <span class="kbo-page-q">투구 시간 흐름에서 어디가 막히는가?</span>
    </div>

    <div style="margin-bottom: 18px;">
      <div class="kbo-headline" style="font-size: 18px;">${topLine}</div>
      <div style="font-size:12px; color:#6B7280; margin-top:8px; font-style:italic; line-height:1.55;">
        ※ 투구 동작을 5 단계로 나눠 어디서 흐름이 끊기는지 봅니다. 각 단계마다 측정값·평가·코칭 cue·연습 드릴을 함께 표시합니다.${_hasVideo(input.video) ? ' 각 단계 카드의 영상 버튼을 누르면 해당 시점부터 재생됩니다.' : ''}
      </div>
    </div>

    <!-- 영상 (있을 때만) -->
    ${_hasVideo(input.video) ? `
    <div class="kbo-card" style="padding:14px; margin-bottom:14px; background:#F2F5FA;">
      <div class="kbo-eyebrow" style="margin-bottom:6px;">실제 투구 영상 — 단계별 jump 버튼으로 해당 시점 재생</div>
      ${renderGlobalVideoPlayer(input.video, 'p4')}
    </div>
    ` : ''}

    <!-- 5 단계 타임라인 -->
    ${stages.map((s, i) => _renderStageCard(s, i, stages.length, input.video)).join('')}

    <!-- 우선 코칭 -->
    ${primaryLeak ? `
    <div class="kbo-card" style="padding:16px; margin-top:14px; border-left:3px solid #A8443A; background: rgba(168,68,58,0.04);">
      <div class="kbo-eyebrow" style="margin-bottom:6px; color:#A8443A;">우선 코칭 — ${primaryLeak.en} (${primaryLeak.kr})</div>
      <div style="font-size:14px; color:#0F1419; line-height:1.5;">${escapeHtml(primaryLeak.cue)}</div>
      <div style="font-size:12px; color:#6B7280; margin-top:6px;"><b>드릴</b> · ${escapeHtml(primaryLeak.drill)}</div>
    </div>` : ''}

    <!-- Coach Delivery -->
    ${renderCoachDelivery({
      message: primaryLeak
        ? `5단계 중 ${primaryLeak.kr} 단계가 가장 큰 점검 포인트입니다.`
        : '5단계 모두 양호 — 흐름을 유지하며 체력 보강.',
      cue: primaryLeak ? primaryLeak.cue : '오늘 흐름 그대로 유지하기.',
      videoPoint: '옆에서 본 영상에서 5단계가 끊기지 않고 이어지는지 슬로우로 확인.',
      kpi: '6주 후 동일 5단계 점검 — 가장 약한 단계가 어떻게 변했는지.',
    })}

  </div>
</section>`;
}

function _armSlotName(deg) {
  if (deg >= 60) return '(오버핸드)';
  if (deg >= 30) return '(쓰리쿼터)';
  if (deg >= 0) return '(사이드)';
  return '(언더)';
}

function _renderStageCard(s, idx, total, video) {
  const status = _stageStatus(null, s.metrics);
  const ok = s.metrics.filter(x => x.ok).length;
  const total_ = s.metrics.length;
  const isLast = (idx === total - 1);
  const videoBtn = _hasVideo(video) ? renderVideoJumpButton(video, s.key, `${s.kr} 보기`, 'p4') : '';

  return `<div style="display:grid; grid-template-columns: 32px 1fr; gap:14px; margin-bottom:8px;">
    <!-- 좌측: 단계 번호 + 연결선 -->
    <div style="position:relative; display:flex; flex-direction:column; align-items:center;">
      <div style="width:32px; height:32px; background:${status.color}; color:#fff; border-radius:50%; display:flex; align-items:center; justify-content:center; font-family:'Space Grotesk',sans-serif; font-size:14px; font-weight:700; flex-shrink:0;">
        ${idx + 1}
      </div>
      ${!isLast ? `<div style="flex:1; width:2px; background:${status.color}; opacity:0.3; margin-top:4px;"></div>` : ''}
    </div>
    <!-- 우측: 카드 -->
    <div class="kbo-card" style="padding:16px; margin-bottom:6px; border-left:3px solid ${status.color};">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin-bottom:8px;">
        <div>
          <div style="display:flex; align-items:baseline; gap:8px;">
            <span style="font-family:'Space Grotesk',sans-serif; font-weight:700; font-size:16px; color:#0F2A4A;">${s.en}</span>
            <span style="font-size:13px; color:#6B7280;">— ${s.kr}</span>
          </div>
          <div style="font-size:12px; color:#6B7280; margin-top:2px;">${s.desc}</div>
        </div>
        <span class="kbo-pill kbo-pill-${status.tone === 'good' ? 'good' : (status.tone === 'leak' ? 'leak' : 'caution')}">${status.label}</span>
      </div>
      <!-- metrics -->
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap:8px; margin-bottom:10px;">
        ${s.metrics.map(mt => `
          <div style="background:#F6F7F9; border-radius:6px; padding:8px 10px;">
            <div style="font-size:10.5px; color:#6B7280; line-height:1.2;">${escapeHtml(mt.label)}</div>
            <div style="display:flex; align-items:center; gap:4px; margin-top:3px;">
              <span style="font-family:'Space Grotesk',sans-serif; font-weight:700; font-size:14px; color:${mt.ok ? '#3F7D5C' : '#A87333'};">${mt.value}</span>
              <span style="color:${mt.ok ? '#3F7D5C' : '#A87333'}; font-size:11px;">${mt.ok ? '✓' : '⚠'}</span>
            </div>
          </div>
        `).join('')}
      </div>
      <!-- cue + video button -->
      <div style="font-size:13px; color:#3F4651; padding:8px 12px; background:rgba(15,42,74,0.04); border-radius:6px;">
        <b style="color:#0F2A4A;">cue</b> · ${escapeHtml(s.cue)}
      </div>
      ${videoBtn}
    </div>
  </div>`;
}


// ════════════════════════════════════════════════════════════════════
// 9. P5 — Evidence Dashboard (4~5 카드 + details 펼침)
// ════════════════════════════════════════════════════════════════════
// 가이드 §6: 근거는 보여주되, primary는 압축. "측정값-기준-해석" 3줄만
function renderP5EvidenceDashboardKinematic(input, dataAvailability) {
  const m = input.mechanics || {};

  function evidenceCard({ title, metrics, interpretation, color = '#3B5A82' }) {
    return `<div class="kbo-card" style="padding:18px; border-left:3px solid ${color}; margin-bottom:12px;">
      <div class="kbo-eyebrow" style="margin-bottom:8px; color:${color};">${title}</div>
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap:10px; margin-bottom:10px;">
        ${metrics.map(mt => `
          <div>
            <div style="font-size:11px; color:#6B7280;">${escapeHtml(mt.label)}</div>
            <div style="font-family:'Space Grotesk',sans-serif; font-weight:700; font-size:18px; color:#0F2A4A; margin-top:2px;">
              ${mt.value}
              ${mt.ref ? `<span style="font-size:10px; color:#9CA3AF; font-weight:400; margin-left:4px;">(기준 ${mt.ref})</span>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
      <div style="font-size:13px; color:#3F4651; line-height:1.5;">${escapeHtml(interpretation)}</div>
    </div>`;
  }

  const cards = [];

  // 1. 동작 순서 (Sequence Timing)
  if (m.proper_sequence_pct != null || m.pelvis_to_trunk_lag_ms != null) {
    cards.push(evidenceCard({
      title: '① 동작 순서 (Sequence)',
      metrics: [
        { label: '순서 합격', value: m._proper_seq_x_of_n ?? `${Math.round(m.proper_sequence_pct ?? 0)}%`, ref: '90%+' },
        m.pelvis_to_trunk_lag_ms != null ? { label: '골반→몸통 시간차', value: `${m.pelvis_to_trunk_lag_ms.toFixed(0)}ms`, ref: '30~70ms' } : null,
        m.trunk_to_arm_lag_ms != null ? { label: '몸통→팔 시간차', value: `${m.trunk_to_arm_lag_ms.toFixed(0)}ms`, ref: '20~50ms' } : null,
      ].filter(Boolean),
      interpretation: m.proper_sequence_pct >= 90
        ? '분절이 골반 → 몸통 → 팔 순서로 정확히 이어집니다.'
        : '분절 순서가 자주 어긋납니다. 골반보다 몸통·팔이 먼저 도는지 점검 필요.',
      color: '#3B5A82',
    }));
  }

  // 2. 회전 속도 (Peak Velocity)
  cards.push(evidenceCard({
    title: '② 회전 속도 (Peak Velocity)',
    metrics: [
      { label: '골반', value: `${(m.peak_pelvis_av ?? m.max_pelvis_rot_vel_dps ?? 0).toFixed(0)} °/s`, ref: '445~580' },
      { label: '몸통', value: `${(m.peak_trunk_av ?? m.max_trunk_twist_vel_dps ?? 0).toFixed(0)} °/s`, ref: '825~1100' },
      { label: '팔(팔꿈치)', value: `${(m.elbow_ext_vel_max ?? 0).toFixed(0)} °/s`, ref: '1500+' },
    ],
    interpretation: '속도를 만들고 전달하는 회전 출력의 위치를 보여줍니다.',
    color: '#0F2A4A',
  }));

  // 3. 속도 증폭 (Speed Gain)
  if (m.pelvis_trunk_speedup != null || m.arm_trunk_speedup != null) {
    cards.push(evidenceCard({
      title: '③ 속도 증폭 (Speed Gain)',
      metrics: [
        m.pelvis_trunk_speedup != null ? { label: '골반→몸통', value: `${m.pelvis_trunk_speedup.toFixed(2)}배`, ref: '1.45+' } : null,
        m.arm_trunk_speedup != null ? { label: '몸통→팔', value: `${m.arm_trunk_speedup.toFixed(2)}배`, ref: '1.55+' } : null,
      ].filter(Boolean),
      interpretation: '다음 분절로 갈 때 속도가 몇 배 빨라지는지. 클수록 잘 전달.',
      color: '#3F7D5C',
    }));
  }

  // 4. 분리·자세 (Separation/Posture)
  if (m.peak_x_factor != null) {
    cards.push(evidenceCard({
      title: '④ 분리·자세 (Separation / Posture)',
      metrics: [
        m.peak_x_factor != null ? { label: '골반-몸통 분리', value: `${m.peak_x_factor.toFixed(1)}°`, ref: '30°+' } : null,
        m.trunk_forward_tilt_at_fc != null ? { label: '착지 시 몸통 기울기', value: `${m.trunk_forward_tilt_at_fc.toFixed(1)}°`, ref: '0~10°' } : null,
        (m.max_shoulder_ER_deg ?? m.max_shoulder_ER) != null ? { label: '어깨 젖힘', value: `${(m.max_shoulder_ER_deg ?? m.max_shoulder_ER).toFixed(0)}°`, ref: '165°+' } : null,
      ].filter(Boolean),
      interpretation: '힘을 모아두고 팔로 넘길 준비 자세를 봅니다.',
      color: '#A87333',
    }));
  }

  // 5. 무게중심 정지력 (Block / CoG Decel) — v33.22 신규 회귀 변수
  if (m.cog_decel != null) {
    const cd = m.cog_decel;
    const cdState = cd >= 1.4 ? '잘 멈춤 (또래 상위)'
                  : cd >= 1.0 ? '평균 수준'
                  : '약함 (앞다리 블록 보강 필요)';
    const cdColor = cd >= 1.4 ? '#3F7D5C' : cd >= 1.0 ? '#A87333' : '#A8443A';
    cards.push(evidenceCard({
      title: '⑤ 무게중심 정지력 (Block)',
      metrics: [
        { label: '정지력 (속도 차이)', value: `${cd.toFixed(2)} m/s`, ref: '1.4 m/s+' },
        m.lead_knee_ext_change_fc_to_br != null ? {
          label: '앞무릎 유지',
          value: `${m.lead_knee_ext_change_fc_to_br > 0 ? '+' : ''}${m.lead_knee_ext_change_fc_to_br.toFixed(1)}°`,
          ref: '0° 이상',
        } : null,
      ].filter(Boolean),
      interpretation: `앞다리로 몸 전진을 단단히 멈춰야 그 운동량이 회전 에너지로 바뀝니다. 현재 ${cdState}.`,
      color: cdColor,
    }));
  }

  // 6. 릴리스 일관성 (Release Consistency)
  if (m.arm_slot_sd_deg != null || m.release_height_sd_cm != null) {
    cards.push(evidenceCard({
      title: '⑥ 릴리스 일관성 (Release Consistency)',
      metrics: [
        m.arm_slot_mean_deg != null ? { label: '팔 각도', value: `${m.arm_slot_mean_deg.toFixed(0)}° ${_armSlotName(m.arm_slot_mean_deg)}` } : null,
        m.arm_slot_sd_deg != null ? { label: '팔 각도 SD', value: `±${m.arm_slot_sd_deg.toFixed(1)}°`, ref: '≤3°' } : null,
        m.release_height_sd_cm != null ? { label: '릴리스 높이 SD', value: `±${m.release_height_sd_cm.toFixed(2)}cm`, ref: '≤5cm' } : null,
      ].filter(Boolean),
      interpretation: '매 투구 같은 위치·각도에서 공을 놓는 일관성. 제구의 핵심.',
      color: '#0F2A4A',
    }));
  }

  return `
<section id="p5" class="report-page kbo-scope">
  <div class="kbo-pad">

    <div class="kbo-page-head">
      <span class="kbo-page-num">P5</span>
      <span class="kbo-page-title-en">핵심 근거</span>
      <span class="kbo-page-title-kr">Evidence Dashboard</span>
      <span class="kbo-page-q">코칭 우선순위를 설명하는 대표 지표</span>
    </div>

    <div style="margin-bottom: 18px;">
      <div class="kbo-headline" style="font-size: 17px;">아래 5개 지표가 이번 평가의 핵심 근거입니다.</div>
      <div style="font-size:12px; color:#6B7280; margin-top:8px; font-style:italic; line-height:1.55;">
        ※ 각 카드는 측정값·기준값·해석 한 줄로 압축했습니다. 전체 변수표·산식은 아래 펼침에서 확인.
      </div>
    </div>

    ${cards.join('')}

    <!-- 펼침: 전체 변수표 (가이드 §6 — details 안으로) -->
    <details class="kbo-card" style="padding:14px 16px; margin-top:8px; background:#F6F7F9;">
      <summary style="cursor:pointer; font-family:'Space Grotesk',sans-serif; font-weight:600; color:#0F2A4A; font-size:14px;">
        ▾ 전체 변수표 (연구·분석용)
      </summary>
      <div style="margin-top:12px; font-size:11.5px; color:#3F4651; font-family:'JetBrains Mono',monospace;">
        ${_renderRawVariableTable(m)}
      </div>
    </details>

    <!-- 신뢰도 안내 -->
    <div style="margin-top: 14px; padding: 10px 14px; border-left: 3px solid #A87333; background: rgba(180,83,9,0.05); border-radius: 4px; font-size: 12px; color: #3F4651; line-height:1.55;">
      ※ 측정 도구는 Uplift Capture (스마트폰 2대 markerless). 마커 기반 시스템 대비 정확도는 보통 수준. 절대값보다 같은 선수의 시간 변화 비교가 더 안전합니다.
    </div>

  </div>
</section>`;
}

function _renderRawVariableTable(m) {
  const keys = Object.keys(m).filter(k => !k.startsWith('_') && typeof m[k] === 'number');
  const rows = keys.map(k => {
    const v = m[k];
    return `<tr style="border-bottom:1px solid #E1E5EB;">
      <td style="padding:4px 8px; color:#6B7280;">${escapeHtml(k)}</td>
      <td style="padding:4px 8px; text-align:right; color:#0F2A4A;">${typeof v === 'number' ? v.toFixed(2) : v}</td>
    </tr>`;
  }).join('');
  return `<table style="width:100%; border-collapse:collapse;">${rows}</table>`;
}


// ════════════════════════════════════════════════════════════════════
// 10. P6 — Action & Retest (Athlete Card + Drill + Retest KPI)
// ════════════════════════════════════════════════════════════════════
// 가이드 §7: 분석의 끝은 훈련 우선순위 + 6주 재측정 기준
function renderP6ActionRetestKinematic(input, dataAvailability) {
  const m = input.mechanics || {};
  const playerId = input.playerId || input.player || '선수';

  // 강점·약점·우선과제 자동 도출 (P1과 일관되게)
  const strengths = [];
  const issues = [];
  if ((m.proper_sequence_pct ?? 0) >= 90) strengths.push('투구 동작 순서가 정확함');
  if ((m.peak_x_factor ?? 0) >= 35) strengths.push('골반-몸통 분리가 충분함');
  if ((m.max_shoulder_ER_deg ?? m.max_shoulder_ER ?? 0) >= 195) strengths.push('어깨 젖힘 각도가 미국 엘리트 수준');
  if ((m.arm_trunk_speedup ?? 0) >= 1.7) strengths.push('몸통→팔 속도 증폭이 우수함');

  if ((m.max_pelvis_rot_vel_dps ?? m.peak_pelvis_av ?? 999) < 445) issues.push('골반 회전 속도 부족 — 하체 추진 약함');
  if ((m.peak_trunk_av ?? m.max_trunk_twist_vel_dps ?? 999) < 825) issues.push('몸통 회전 속도가 평균보다 낮음');
  if (m.cog_decel != null && m.cog_decel < 1.0) issues.push('앞다리 블록이 약해 무게중심 정지가 약함');
  if (m.proper_sequence_pct != null && m.proper_sequence_pct < 80) issues.push('투구 동작 순서가 자주 어긋남');
  if (m.arm_slot_sd_deg != null && m.arm_slot_sd_deg > 5) issues.push('팔 각도 일관성이 약함 (제구 영향)');

  if (issues.length === 0) issues.push('현재 동작 양호 — 체력(악력·점프력·코어 힘) 향상으로 효율 활용');

  // Drill 패키지 (우선순위 1~3)
  const drills = [];
  if (issues[0]?.includes('골반') || issues[0]?.includes('하체')) {
    drills.push({ name: 'Wall drill', desc: '디딤발 자세에서 벽을 미는 느낌으로 골반 회전 학습', focus: '하체→골반 추진' });
    drills.push({ name: 'Lunge throw', desc: '런지 자세에서 던지기 — 디딤발 안정성 + 골반 회전 강화', focus: '하체 안정' });
  }
  if (issues[0]?.includes('순서') || issues[0]?.includes('몸통 회전')) {
    drills.push({ name: 'Hip-shoulder separation', desc: '골반 먼저 돌리고 몸통이 따라가는 분리 동작 연습', focus: '동작 순서' });
    drills.push({ name: 'Connected throw', desc: '짧은 거리 캐치볼로 몸통-팔 연결 감각', focus: '전달 연결' });
  }
  if (issues[0]?.includes('블록') || issues[0]?.includes('무게중심')) {
    drills.push({ name: 'Block step throw', desc: '앞발 착지 후 무릎 신전 유지하며 던지기', focus: '앞다리 블록' });
  }
  if (m.arm_slot_sd_deg != null && m.arm_slot_sd_deg > 4) {
    drills.push({ name: 'Target throw', desc: '동일 타겟 반복 투구로 릴리스 일관성 훈련', focus: '제구 일관성' });
  }
  if (drills.length === 0) {
    drills.push({ name: 'Maintenance throw', desc: '현재 동작 유지하며 강도 점진 증가', focus: '현 상태 유지' });
    drills.push({ name: '체력 보강', desc: 'CMJ·악력·코어 운동 — 동작 효율을 받쳐줄 출력 향상', focus: '체력 출력' });
  }

  return `
<section id="p6" class="report-page kbo-scope">
  <div class="kbo-pad">

    <div class="kbo-page-head">
      <span class="kbo-page-num">P6</span>
      <span class="kbo-page-title-en">훈련 우선순위 · 6주 후 재측정</span>
      <span class="kbo-page-title-kr">Action &amp; Retest</span>
      <span class="kbo-page-q">오늘부터 무엇을 어떻게 할 것인가?</span>
    </div>

    <!-- Athlete Card — 선수에게 바로 전달 가능한 1장 요약 -->
    <div class="kbo-card" style="padding:24px; margin-bottom:18px; background: linear-gradient(180deg, #F2F5FA 0%, #FFFFFF 100%); border:2px solid #0F2A4A;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:8px;">
        <div>
          <div class="kbo-eyebrow" style="margin-bottom:2px; color:#0F2A4A;">선수 카드 · ATHLETE CARD</div>
          <div class="kbo-display" style="font-size:20px; color:#0F2A4A;">${escapeHtml(playerId)} — 오늘 한 장 요약</div>
        </div>
        <span class="kbo-pill kbo-pill-good">선수에게 그대로 전달 OK</span>
      </div>

      <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:14px;">
        <!-- 잘되는 점 -->
        <div style="padding:14px; background:rgba(63,125,92,0.06); border-radius:8px; border-left:3px solid #3F7D5C;">
          <div class="kbo-eyebrow" style="color:#3F7D5C; margin-bottom:6px;">✓ 잘되는 점</div>
          <ul style="margin:0; padding-left:16px; font-size:13px; color:#0F1419; line-height:1.5;">
            ${strengths.length ? strengths.map(s => `<li style="margin-top:3px;">${escapeHtml(s)}</li>`).join('') : '<li style="color:#9CA3AF;">—</li>'}
          </ul>
        </div>
        <!-- 고칠 점 -->
        <div style="padding:14px; background:rgba(168,115,51,0.06); border-radius:8px; border-left:3px solid #A87333;">
          <div class="kbo-eyebrow" style="color:#A87333; margin-bottom:6px;">◎ 우선 고칠 점</div>
          <ul style="margin:0; padding-left:16px; font-size:13px; color:#0F1419; line-height:1.5;">
            ${issues.slice(0, 2).map(s => `<li style="margin-top:3px;">${escapeHtml(s)}</li>`).join('')}
          </ul>
        </div>
      </div>

      <!-- 오늘의 cue + drill -->
      <div style="margin-top:14px; padding:14px; background:#FFFFFF; border-radius:8px; border:1px solid #E1E5EB;">
        <div style="display:flex; gap:14px; flex-wrap:wrap;">
          <div style="flex:1; min-width:200px;">
            <div class="kbo-eyebrow" style="margin-bottom:6px; color:#0F2A4A;">오늘 한 가지만</div>
            <div style="font-size:14px; color:#0F1419; font-weight:600; line-height:1.5;">
              ${escapeHtml(issues[0]?.includes('골반') ? '디딤발에 단단히 — 그 위에서 골반부터 돌리기.'
                : issues[0]?.includes('몸통') ? '골반이 돈 다음 몸통이 돌게 — "잠깐 기다리기".'
                : issues[0]?.includes('블록') ? '앞발 디딘 다음 무릎 굽혀지지 않게.'
                : '지금 동작 유지하며 체력 보강.')}
            </div>
          </div>
          <div style="flex:1; min-width:200px;">
            <div class="kbo-eyebrow" style="margin-bottom:6px; color:#0F2A4A;">오늘 1개 drill</div>
            <div style="font-size:14px; color:#0F1419; font-weight:600; line-height:1.5;">${escapeHtml(drills[0]?.name ?? 'Maintenance throw')}</div>
            <div style="font-size:11.5px; color:#6B7280; margin-top:2px;">${escapeHtml(drills[0]?.desc ?? '')}</div>
          </div>
        </div>
      </div>

      <!-- 6주 후 확인 -->
      <div style="margin-top:14px; padding:12px 14px; background:rgba(15,42,74,0.04); border-radius:8px;">
        <div class="kbo-eyebrow" style="margin-bottom:4px; color:#0F2A4A;">6주 후 확인</div>
        <div style="font-size:13px; color:#0F1419; line-height:1.5;">
          같은 4가지 — <b>동작 순서, 골반-몸통 시간차, 속도 증폭, 팔 각도 일관성</b> — 이 어떻게 변했는지 다시 측정합니다.
          <span style="color:#6B7280; font-size:11.5px;">(보장이 아니라, 같은 지표로 변화를 본다는 뜻)</span>
        </div>
      </div>
    </div>

    <!-- Drill Package -->
    <div class="kbo-card" style="padding:18px; margin-bottom:14px;">
      <div class="kbo-eyebrow" style="margin-bottom:10px;">우선순위 드릴 — 1순위부터 진행</div>
      <div style="display:grid; gap:10px;">
        ${drills.slice(0, 3).map((d, i) => `
          <div style="display:grid; grid-template-columns: 32px 1fr; gap:12px; align-items:start;">
            <div style="width:28px; height:28px; background:${i === 0 ? '#A8443A' : (i === 1 ? '#A87333' : '#3F7D5C')}; color:#fff; border-radius:50%; display:flex; align-items:center; justify-content:center; font-family:'Space Grotesk',sans-serif; font-weight:700; font-size:12px;">${i + 1}</div>
            <div>
              <div style="display:flex; align-items:baseline; gap:8px;">
                <span style="font-family:'Space Grotesk',sans-serif; font-weight:700; font-size:14px; color:#0F2A4A;">${escapeHtml(d.name)}</span>
                <span style="font-size:11px; color:#6B7280;">— ${escapeHtml(d.focus)}</span>
              </div>
              <div style="font-size:12.5px; color:#3F4651; margin-top:2px; line-height:1.4;">${escapeHtml(d.desc)}</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Retest KPI 표 -->
    <div class="kbo-card" style="padding:18px; margin-bottom:14px;">
      <div class="kbo-eyebrow" style="margin-bottom:10px;">6주 후 재측정 KPI — 같은 지표로 변화 확인</div>
      <table class="kpi-retest-table" style="width:100%; border-collapse:collapse; font-size:12.5px;">
        <thead>
          <tr style="background:#F6F7F9; border-bottom:1px solid #E1E5EB;">
            <th style="text-align:left; padding:8px;">지표</th>
            <th style="text-align:right; padding:8px;">현재</th>
            <th style="text-align:right; padding:8px;">목표 (또래 상위)</th>
            <th style="text-align:left; padding:8px;">의미</th>
          </tr>
        </thead>
        <tbody>
          <tr style="border-bottom:1px solid #EEF1F5;"><td style="padding:8px;">동작 순서 합격</td><td style="text-align:right; padding:8px; font-family:'JetBrains Mono',monospace;">${m._proper_seq_x_of_n ?? `${Math.round(m.proper_sequence_pct ?? 0)}%`}</td><td style="text-align:right; padding:8px; color:#3F7D5C; font-family:'JetBrains Mono',monospace;">9/10+</td><td style="padding:8px; color:#6B7280;">10번 중 골반→몸통→팔 순서</td></tr>
          <tr style="border-bottom:1px solid #EEF1F5;"><td style="padding:8px;">골반→몸통 시간차</td><td style="text-align:right; padding:8px; font-family:'JetBrains Mono',monospace;">${m.pelvis_to_trunk_lag_ms != null ? m.pelvis_to_trunk_lag_ms.toFixed(0) + 'ms' : '—'}</td><td style="text-align:right; padding:8px; color:#3F7D5C; font-family:'JetBrains Mono',monospace;">30~70ms</td><td style="padding:8px; color:#6B7280;">너무 짧으면 동시, 너무 길면 끊김</td></tr>
          <tr style="border-bottom:1px solid #EEF1F5;"><td style="padding:8px;">몸통→팔 속도 증폭</td><td style="text-align:right; padding:8px; font-family:'JetBrains Mono',monospace;">${m.arm_trunk_speedup != null ? m.arm_trunk_speedup.toFixed(2) + '배' : '—'}</td><td style="text-align:right; padding:8px; color:#3F7D5C; font-family:'JetBrains Mono',monospace;">1.7배+</td><td style="padding:8px; color:#6B7280;">팔로 힘이 잘 전달되는지</td></tr>
          <tr style="border-bottom:1px solid #EEF1F5;"><td style="padding:8px;">앞무릎 유지</td><td style="text-align:right; padding:8px; font-family:'JetBrains Mono',monospace;">${m.lead_knee_ext_change_fc_to_br != null ? (m.lead_knee_ext_change_fc_to_br > 0 ? '+' : '') + m.lead_knee_ext_change_fc_to_br.toFixed(1) + '°' : '—'}</td><td style="text-align:right; padding:8px; color:#3F7D5C; font-family:'JetBrains Mono',monospace;">0° 이상</td><td style="padding:8px; color:#6B7280;">착지에서 릴리스까지 무릎 굽혀지지 않기</td></tr>
          <tr><td style="padding:8px;">팔 각도 일관성 (SD)</td><td style="text-align:right; padding:8px; font-family:'JetBrains Mono',monospace;">${m.arm_slot_sd_deg != null ? '±' + m.arm_slot_sd_deg.toFixed(1) + '°' : '—'}</td><td style="text-align:right; padding:8px; color:#3F7D5C; font-family:'JetBrains Mono',monospace;">±3° 이내</td><td style="padding:8px; color:#6B7280;">매 투구 같은 각도로 — 제구의 핵심</td></tr>
        </tbody>
      </table>
    </div>

    <!-- Video Checkpoint -->
    <div class="kbo-card" style="padding:18px; margin-bottom:14px;">
      <div class="kbo-eyebrow" style="margin-bottom:10px;">영상에서 볼 3 순간 — 코치용 체크포인트</div>

      ${_hasVideo(input.video) ? `
      <div style="margin-bottom:14px;">
        ${renderGlobalVideoPlayer(input.video, 'p6')}
        <div style="font-size:12px; color:#3F4651; margin-top:8px; text-align:center;">
          ↓ 아래 카드의 시점 버튼을 누르면 해당 순간으로 일시정지됩니다 ↓
        </div>
      </div>` : ''}

      <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:12px;">
        ${[
          { tag: '①', label: '앞발 착지', desc: '디딤발에 체중 → 앞발이 단단히 닿는 순간. 골반이 막 돌기 시작', eventKey: 'fc' },
          { tag: '②', label: '어깨 최대 젖혀짐', desc: '어깨 외회전 정점. 이때 몸통이 최대 회전 + 팔이 채찍처럼 준비', eventKey: 'mer' },
          { tag: '③', label: '공 놓는 순간', desc: '릴리스. 어디서·어떤 각도로 공이 빠져나가나 (제구 시작점)', eventKey: 'br' },
        ].map(s => `
          <div style="background:#F6F7F9; border-radius:8px; padding:12px;">
            <div style="display:flex; align-items:baseline; gap:6px; margin-bottom:4px;">
              <span style="font-family:'Space Grotesk',sans-serif; font-weight:700; color:#0F2A4A;">${s.tag} ${escapeHtml(s.label)}</span>
            </div>
            <div style="font-size:11.5px; color:#6B7280; line-height:1.45;">${escapeHtml(s.desc)}</div>
            ${_hasVideo(input.video) ? renderVideoEventJump(input.video, s.eventKey, s.label, 'p6') : ''}
          </div>
        `).join('')}
      </div>
      <div style="font-size:11px; color:#9CA3AF; margin-top:10px; font-style:italic;">
        ※ ${_hasVideo(input.video) ? '버튼을 누르면 영상이 해당 시점으로 이동해 일시정지됩니다. 슬로우로 단계 사이 흐름을 확인하세요.' : '옆에서 본 영상에서 이 3 순간을 슬로우로 함께 보세요. 단계 사이의 흐름이 끊기지 않는지가 핵심.'}
      </div>
    </div>

    <!-- Coach Delivery (P6 정리) -->
    ${renderCoachDelivery({
      message: strengths.length >= 2
        ? `${strengths[0]} · ${strengths[1]}이 강점. 6주간 ${issues[0]} 해결에 집중.`
        : `${issues[0]} 해결을 우선 6주 목표로.`,
      cue: drills[0]?.name ? `${drills[0].name} — ${drills[0].focus}` : '현재 동작 유지하며 체력 보강.',
      videoPoint: '앞발 착지 → 어깨 최대 젖혀짐 → 공 놓는 순간, 이 3 장면 슬로우.',
      kpi: '6주 후 동일 5가지 KPI 재측정. "보장"이 아니라 "변화 확인" 목적.',
      tag: '코치 메시지 · 최종',
    })}

    <!-- 안전 안내 -->
    <div style="margin-top: 14px; padding: 10px 14px; border-left: 3px solid #6B7280; background: rgba(107,114,128,0.06); border-radius: 4px; font-size: 11.5px; color: #6B7280; line-height:1.55;">
      ※ 본 리포트는 진단용이 아닙니다. 부상 위험·관절 부하는 별도 측정이 필요하며, 통증·이상 감각이 있으면 즉시 트레이너·의사 상담을 권합니다.
    </div>

  </div>
</section>`;
}


// ════════════════════════════════════════════════════════════════════
// 11. buildKinematicOnlyReport — 메인 (P1~P6 모두 본문)
// ════════════════════════════════════════════════════════════════════
function buildKinematicOnlyReport(input) {
  const da = getDataAvailability(input);

  // 안전 검사 — kinematics 자체가 없으면 리포트 생성 불가
  if (!da.kinematics) {
    return `<div class="kbo-scope" style="padding:40px; text-align:center; color:#6B7280;">
      <div class="kbo-headline">Uplift kinematic 데이터가 없어 리포트를 생성할 수 없습니다.</div>
    </div>`;
  }

  const sections = [
    renderP1ExecutiveSummaryKinematic(input, da),
    renderP2KinematicOutput(input, da),
    renderP3KinematicTransferProxy(input, da),
    renderP4FlowLeakTimeline(input, da),
    renderP5EvidenceDashboardKinematic(input, da),
    renderP6ActionRetestKinematic(input, da),
  ];

  // sticky nav
  const nav = `
    <nav class="report-nav-sticky" style="position:sticky; top:0; z-index:40; background:rgba(255,255,255,0.96); backdrop-filter:blur(12px); border-bottom:1px solid #E1E5EB; padding:8px 16px;">
      <div style="max-width:1200px; margin:0 auto; display:flex; gap:6px; overflow-x:auto;">
        ${['P1','P2','P3','P4','P5','P6'].map((p,i) => {
          const labels = ['Executive', 'Output', 'Transfer', 'Leak', 'Evidence', 'Action'];
          return `<a class="p-nav-tab" href="#${p.toLowerCase()}" style="display:flex; align-items:center; gap:8px; min-width:120px; padding:6px 12px; border:1px solid #E1E5EB; border-radius:8px; text-decoration:none; color:#0F2A4A;">
            <span class="p-nav-num" style="width:24px; height:24px; display:flex; align-items:center; justify-content:center; background:#0F2A4A; color:#fff; border-radius:50%; font-size:12px; font-weight:700;">${i+1}</span>
            <span class="p-nav-label" style="font-size:12px; font-weight:600;">${labels[i]}</span>
          </a>`;
        }).join('')}
      </div>
    </nav>`;

  let html = nav + sections.join('\n');
  html = sanitizeUnsupportedMetrics(html, da);
  return html;
}

// placeholder 페이지 (Phase A에서 채울 예정)
function placeholderPage(id, num, titleEn, titleKr, q) {
  return `
<section id="${id}" class="report-page kbo-scope">
  <div class="kbo-pad">
    <div class="kbo-page-head">
      <span class="kbo-page-num">${num}</span>
      <span class="kbo-page-title-en">${titleKr}</span>
      <span class="kbo-page-title-kr">${titleEn}</span>
      <span class="kbo-page-q">${q}</span>
    </div>
    <div class="kbo-card" style="padding:24px; text-align:center; color:#6B7280;">
      <div class="kbo-eyebrow" style="margin-bottom:8px;">PHASE A · 다음 세션 구현 예정</div>
      <div style="font-size:14px;">이 페이지는 Phase A에서 구현됩니다. (가이드 §2 ${num} 참고)</div>
    </div>
  </div>
</section>`;
}

// ════════════════════════════════════════════════════════════════════
// 유틸
// ════════════════════════════════════════════════════════════════════
function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, ch => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[ch]));
}

// Node 환경 (테스트용) export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    buildKinematicOnlyReport,
    getDataAvailability,
    sanitizeUnsupportedMetrics,
    renderCoachDelivery,
    renderDataBadge,
    renderP1ExecutiveSummaryKinematic,
  };
}
