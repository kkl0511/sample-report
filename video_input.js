/**
 * video_input.js — v2 P3 player + P6 정지 frame 4장 자동 캡처 (2026-05-07 분리)
 *   knee_high / FC / MER / BR — Uplift CSV 이벤트 시간 자동 추출 + 영상 frame 캡처
 *   다중 trial 지원: 영상 파일명의 _NNN_ / trial_NNN / clip.N 패턴으로 자동 매칭
 *
 * 의존성: 없음 (순수 DOM/JS). app.js의 processUpliftCsv·handleMultipleUpliftFiles에서
 *         _makeTrialEventEntry / autofillVideoEventsFromUplift / renderTrialSelector /
 *         _autoMatchTrialByFilename 를 typeof 가드로 호출함.
 *
 * Public API:
 *   - 전역 변수: CURRENT_VIDEO_FILE, CURRENT_VIDEO_OBJECT_URL,
 *               CURRENT_UPLIFT_TRIAL_EVENTS, CURRENT_UPLIFT_SELECTED_TRIAL
 *   - 함수: onVideoFileSelected(event), clearVideoInput(),
 *          setupVideoDropZone(), buildVideoInputForV2(),
 *          autofillVideoEventsFromUplift(opts), _autoMatchTrialByFilename(name),
 *          _makeTrialEventEntry(...), renderTrialSelector() [no-op]
 */

// ── 전역 상태 ───────────────────────────────────────────────────────
let CURRENT_VIDEO_FILE = null;
let CURRENT_VIDEO_OBJECT_URL = null;
let CURRENT_UPLIFT_TRIAL_EVENTS = [];   // [{ index, filename, fps, captureDate, events, eventTimes }, ...]
let CURRENT_UPLIFT_SELECTED_TRIAL = 0;

// ── 유틸 ────────────────────────────────────────────────────────────
function escapeHtmlSafe(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}

// trial event entry 빌드 — frame을 fps로 나눠 시간(초) 변환
function _makeTrialEventEntry(index, filename, fps, events, captureDate) {
  const e = events || {};
  const t = (f) => (f != null ? f / fps : null);
  return {
    index, filename, fps, captureDate,
    events: { kh: e.kh ?? null, fc: e.fc ?? null, mer: e.mer ?? null, br: e.br ?? null },
    eventTimes: { kh_time: t(e.kh), fc_time: t(e.fc), mer_time: t(e.mer), br_time: t(e.br) },
  };
}

// 드롭다운 UI 제거됨 (2026-05-07) — 호출처 호환성을 위해 no-op으로 유지
function renderTrialSelector() {}
function onTrialSelectChange() {}

// ── 영상 ↔ trial 자동 매칭 (파일명 패턴 기반) ───────────────────────
//   1) _NNN_ (3-5자리, 가장 강한 신호: _009_ → 9)
//   2) trial_NNN
//   3) clip.N / clip_N / clip-N
//   4) trial CSV 파일명이 영상명에 부분 포함
//   5) _NNN_ (1-2자리 포함)
//   6) 영상명 첫 숫자 (마지막 fallback)
//   매칭은 trial CSV의 trial 번호와 비교 (선행 0 무시: 009 == 0009 == 9)
function _autoMatchTrialByFilename(videoFilename) {
  if (!videoFilename || CURRENT_UPLIFT_TRIAL_EVENTS.length === 0) return 0;
  const vname = videoFilename.toLowerCase().replace(/\.[^.]+$/, '');

  // trial CSV 별 trial 번호 추출
  const trialNumbers = CURRENT_UPLIFT_TRIAL_EVENTS.map((t, i) => {
    const tname = (t.filename || '').toLowerCase().replace(/\.[^.]+$/, '');
    const m = tname.match(/trial[_-]?(\d+)/) || tname.match(/(\d+)/);
    return { index: i, num: m ? parseInt(m[1], 10) : null };
  });

  // 영상명 후보 번호 (우선순위 순)
  const candidates = [];
  for (const m of vname.matchAll(/_(\d{3,5})_/g)) candidates.push(parseInt(m[1], 10));
  const tm = vname.match(/trial[_-]?(\d+)/);     if (tm) candidates.push(parseInt(tm[1], 10));
  const cm = vname.match(/clip[._\-](\d+)/);     if (cm) candidates.push(parseInt(cm[1], 10));
  for (const m of vname.matchAll(/_(\d{1,5})_/g)) candidates.push(parseInt(m[1], 10));

  for (const cand of candidates) {
    const hit = trialNumbers.find(t => t.num != null && t.num === cand);
    if (hit) return hit.index;
  }
  // 부분 문자열 fallback
  for (let i = 0; i < CURRENT_UPLIFT_TRIAL_EVENTS.length; i++) {
    const tname = (CURRENT_UPLIFT_TRIAL_EVENTS[i].filename || '').toLowerCase().replace(/\.[^.]+$/, '');
    if (tname && (vname.includes(tname) || tname.includes(vname))) return i;
  }
  // 첫 숫자 fallback
  const numMatch = vname.match(/(\d+)/);
  if (numMatch) {
    const n = parseInt(numMatch[1], 10);
    const hit = trialNumbers.find(t => t.num != null && t.num === n);
    if (hit) return hit.index;
  }
  return 0;
}

// ── 자동 채움 ────────────────────────────────────────────────────────
//   opts.overwrite=true: 사용자 입력값도 덮어씀 (CSV 재업로드/trial 변경 시)
//   기본 false: 빈 칸만 채움
function autofillVideoEventsFromUplift(opts) {
  if (CURRENT_UPLIFT_TRIAL_EVENTS.length === 0) return;
  const idx = Math.min(CURRENT_UPLIFT_SELECTED_TRIAL, CURRENT_UPLIFT_TRIAL_EVENTS.length - 1);
  const trial = CURRENT_UPLIFT_TRIAL_EVENTS[idx];
  const ev = trial.eventTimes;
  const overwrite = !!(opts && opts.overwrite);
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (overwrite || el.value === '' || el.value == null) {
      if (val != null && !isNaN(val)) el.value = val.toFixed(2);
      else if (overwrite) el.value = '';
    }
  };
  setVal('player-video-fps',  trial.fps);
  setVal('player-video-t-kh', ev.kh_time);
  setVal('player-video-t-fc', ev.fc_time);
  setVal('player-video-t-mer',ev.mer_time);
  setVal('player-video-t-br', ev.br_time);

  const status = document.getElementById('player-video-uplift-status');
  if (!status) return;
  const filled = ['kh','fc','mer','br']
    .filter(k => ev[k + '_time'] != null)
    .map(k => k.toUpperCase());
  if (filled.length === 0) return;
  const trialLabel = CURRENT_UPLIFT_TRIAL_EVENTS.length > 1
    ? `Trial ${idx+1}/${CURRENT_UPLIFT_TRIAL_EVENTS.length} (${trial.filename || 'unknown'})`
    : '단일 trial';
  status.innerHTML = `✓ Uplift CSV에서 이벤트 시점 자동 입력 — <b>${escapeHtmlSafe(trialLabel)}</b> · ${filled.join(' / ')} · fps ${trial.fps.toFixed(0)}`;
  status.classList.remove('hidden');
}

// ── 영상 파일 선택 (input change + drag-drop 공용) ────────────────
function _applyVideoFile(file) {
  if (!file) return;
  if (!file.type.startsWith('video/') && !/\.(mp4|mov|m4v|avi|mkv|webm)$/i.test(file.name)) {
    alert('영상 파일이 아닙니다 (mp4, mov, m4v, avi, mkv, webm 지원)');
    return;
  }
  if (CURRENT_VIDEO_OBJECT_URL) URL.revokeObjectURL(CURRENT_VIDEO_OBJECT_URL);
  CURRENT_VIDEO_FILE = file;
  CURRENT_VIDEO_OBJECT_URL = URL.createObjectURL(file);
  const info = document.getElementById('player-video-info');
  if (info) info.innerHTML = `<span class="font-mono">✓ ${escapeHtmlSafe(file.name)}</span> · ${(file.size / 1024 / 1024).toFixed(1)} MB`;
  if (CURRENT_UPLIFT_TRIAL_EVENTS.length > 0) {
    CURRENT_UPLIFT_SELECTED_TRIAL = _autoMatchTrialByFilename(file.name);
    autofillVideoEventsFromUplift({ overwrite: true });
  }
}

function onVideoFileSelected(event) {
  _applyVideoFile(event.target.files && event.target.files[0]);
}

function clearVideoInput() {
  if (CURRENT_VIDEO_OBJECT_URL) URL.revokeObjectURL(CURRENT_VIDEO_OBJECT_URL);
  CURRENT_VIDEO_OBJECT_URL = null;
  CURRENT_VIDEO_FILE = null;
  ['player-video-file', 'player-video-t-kh', 'player-video-t-fc', 'player-video-t-mer', 'player-video-t-br']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const info   = document.getElementById('player-video-info');
  const fpsEl  = document.getElementById('player-video-fps');
  const status = document.getElementById('player-video-uplift-status');
  if (info)   info.textContent = '';
  if (fpsEl)  fpsEl.value = '240';
  if (status) { status.classList.add('hidden'); status.innerHTML = ''; }
}

// ── 드롭존 셋업 (DOMContentLoaded에서 호출) ────────────────────────
function setupVideoDropZone() {
  const zone = document.getElementById('player-video-drop-zone');
  if (!zone) return;
  ['dragover', 'dragenter'].forEach(evt => zone.addEventListener(evt, (e) => {
    e.preventDefault(); e.stopPropagation();
    zone.classList.add('dragover');
  }));
  ['dragleave', 'dragend'].forEach(evt => zone.addEventListener(evt, (e) => {
    e.preventDefault(); e.stopPropagation();
    zone.classList.remove('dragover');
  }));
  zone.addEventListener('drop', (e) => {
    e.preventDefault(); e.stopPropagation();
    zone.classList.remove('dragover');
    const files = e.dataTransfer && e.dataTransfer.files;
    if (files && files.length > 0) _applyVideoFile(files[0]);
  });
}

// ── frame 캡처 + 자동 crop (모션 영역 union bbox) ──────────────────
//   1) 4 frame 풀 해상도로 캡처
//   2) 다운샘플(320px) 후 픽셀별 최대 변화량으로 motion mask 산출
//   3) motion mask의 bounding box → 8% 패딩 → 모든 frame을 동일 영역으로 crop
//   4) 검출 실패(motion 너무 적거나 너무 많음) 시 원본 frame 유지
async function _captureFramesAt(videoUrl, timestamps) {
  const video = document.createElement('video');
  Object.assign(video, { muted: true, playsInline: true, preload: 'auto', src: videoUrl });

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('영상 메타데이터 로드 타임아웃 (10s)')), 10000);
    video.addEventListener('loadedmetadata', () => { clearTimeout(timer); resolve(); }, { once: true });
    video.addEventListener('error', () => { clearTimeout(timer); reject(new Error('영상 로드 실패')); }, { once: true });
  });

  const W = video.videoWidth, H = video.videoHeight;
  const fullCanvas = document.createElement('canvas');
  fullCanvas.width = W; fullCanvas.height = H;
  const fullCtx = fullCanvas.getContext('2d');

  // 1) 풀 해상도 capture (ImageData 보관)
  const imgData = {};
  for (const [key, t] of Object.entries(timestamps)) {
    const safeT = Math.max(0, Math.min(t, (video.duration || 9999) - 0.001));
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`${key} seek 타임아웃 (5s)`)), 5000);
      video.addEventListener('seeked', () => { clearTimeout(timer); resolve(); }, { once: true });
      video.currentTime = safeT;
    });
    fullCtx.drawImage(video, 0, 0);
    imgData[key] = fullCtx.getImageData(0, 0, W, H);
  }

  // 2) 다운샘플 motion 검출 (320px 폭)
  const DETECT_W = 320;
  const dScale = Math.min(1, DETECT_W / W);
  const dW = Math.max(1, Math.round(W * dScale));
  const dH = Math.max(1, Math.round(H * dScale));
  const dCanvas = document.createElement('canvas');
  dCanvas.width = dW; dCanvas.height = dH;
  const dCtx = dCanvas.getContext('2d');

  const dPixels = {};
  const keys = Object.keys(timestamps);
  for (const key of keys) {
    fullCtx.putImageData(imgData[key], 0, 0);
    dCtx.drawImage(fullCanvas, 0, 0, dW, dH);
    dPixels[key] = dCtx.getImageData(0, 0, dW, dH).data;
  }

  // 3) 픽셀별 최대 변화 (RGB 합 0~765) → 임계 → motion 좌표 모음
  //    percentile bbox: 2nd~98th percentile 좌표 사용 (이상치/노이즈 제외 → 더 타이트)
  const THRESHOLD = 90;  // 평균 채널 30 변화 ≈ 명확한 움직임
  const motionXs = [], motionYs = [];
  for (let y = 0; y < dH; y++) {
    for (let x = 0; x < dW; x++) {
      const i = (y * dW + x) * 4;
      let maxDiff = 0;
      for (let a = 0; a < keys.length; a++) {
        for (let b = a + 1; b < keys.length; b++) {
          const A = dPixels[keys[a]], B = dPixels[keys[b]];
          const d = Math.abs(A[i] - B[i]) + Math.abs(A[i+1] - B[i+1]) + Math.abs(A[i+2] - B[i+2]);
          if (d > maxDiff) { maxDiff = d; if (maxDiff > THRESHOLD) break; }
        }
        if (maxDiff > THRESHOLD) break;
      }
      if (maxDiff > THRESHOLD) {
        motionXs.push(x);
        motionYs.push(y);
      }
    }
  }

  // 4) bbox: 0.5th~99.5th percentile (극단 outlier만 제외, 본체는 보존)
  //    좌우 padding 6%, 상하 padding 5% — 선수 사지가 짤리지 않게 안전 margin
  let cropX = 0, cropY = 0, cropW = W, cropH = H;
  const motionRatio = motionXs.length / (dW * dH);
  if (motionRatio >= 0.01 && motionRatio <= 0.95 && motionXs.length > 50) {
    motionXs.sort((a, b) => a - b);
    motionYs.sort((a, b) => a - b);
    const P = 0.005;  // 0.5th / 99.5th percentile (이전 2% → 너무 공격적이라 좌우 짤림 발생)
    const loX = motionXs[Math.floor(motionXs.length * P)];
    const hiX = motionXs[Math.min(motionXs.length - 1, Math.ceil(motionXs.length * (1 - P)))];
    const loY = motionYs[Math.floor(motionYs.length * P)];
    const hiY = motionYs[Math.min(motionYs.length - 1, Math.ceil(motionYs.length * (1 - P)))];
    const inv = (v) => Math.round(v / dScale);
    let bx = inv(loX), by = inv(loY);
    let bw = inv(hiX + 1) - bx, bh = inv(hiY + 1) - by;
    const padX = Math.round(bw * 0.06);
    const padY = Math.round(bh * 0.05);
    bx -= padX; by -= padY; bw += 2 * padX; bh += 2 * padY;
    // 화면 밖 클램프
    bx = Math.max(0, bx); by = Math.max(0, by);
    bw = Math.min(W - bx, bw); bh = Math.min(H - by, bh);
    if (bw > 50 && bh > 50) { cropX = bx; cropY = by; cropW = bw; cropH = bh; }
  }

  // 5) 각 frame을 동일 bbox로 crop → JPEG data URL
  const outCanvas = document.createElement('canvas');
  outCanvas.width = cropW; outCanvas.height = cropH;
  const outCtx = outCanvas.getContext('2d');
  const frames = {};
  for (const key of keys) {
    fullCtx.putImageData(imgData[key], 0, 0);
    outCtx.clearRect(0, 0, cropW, cropH);
    outCtx.drawImage(fullCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
    frames[key] = outCanvas.toDataURL('image/jpeg', 0.85);
  }
  // crop 정보도 같이 반환 — 영상 player에서 동일 영역 CSS 클리핑에 사용
  return { frames, crop: { x: cropX, y: cropY, w: cropW, h: cropH, originalW: W, originalH: H } };
}

// ── v2 input.video 객체 빌드 (영상 없으면 null) ────────────────────
//   4 이벤트(knee_high/FC/MER/BR) timestamp가 모두 있으면 frame 캡처 진행
async function buildVideoInputForV2() {
  if (!CURRENT_VIDEO_OBJECT_URL) return null;
  const fpsEl = document.getElementById('player-video-fps');
  const fps = parseFloat(fpsEl && fpsEl.value) || 240;
  const ts = {
    knee_high: parseFloat(document.getElementById('player-video-t-kh').value),
    fc:        parseFloat(document.getElementById('player-video-t-fc').value),
    mer:       parseFloat(document.getElementById('player-video-t-mer').value),
    br:        parseFloat(document.getElementById('player-video-t-br').value),
  };
  const videoObj = { src: CURRENT_VIDEO_OBJECT_URL, fps };

  if (!Object.values(ts).some(isNaN)) {
    videoObj.events = ts;
    try {
      const result = await _captureFramesAt(CURRENT_VIDEO_OBJECT_URL, ts);
      videoObj.eventFrames = result.frames;
      // crop 영역(원본 좌표) 보존 — 영상 player CSS 클리핑에 사용
      if (result.crop && result.crop.w < result.crop.originalW * 0.95) {
        videoObj.crop = result.crop;
      }
    } catch (e) {
      console.warn('영상 frame 캡처 실패 — events만 유지:', e.message);
    }
  }
  return videoObj;
}
