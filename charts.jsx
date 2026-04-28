/* global React */
(function () {
  'use strict';
  const { useState, useEffect, useRef, useMemo } = React;

// ----------------- Radar Chart -----------------
function RadarChart({ data }) {
  const size = 420, pad = 70;
  const cx = size/2, cy = size/2;
  const rMax = size/2 - pad;
  const n = data.length;

  // normalize each value relative to its axis: map [0..lo] to [0..0.5], [lo..hi] to [0.5..1.0], above hi saturates at ~1.15
  const norm = (axis) => {
    if (axis.value == null) return 0.15;
    const { lo, hi, value } = axis;
    if (value <= lo) return Math.max(0.15, (value / lo) * 0.55);
    if (value <= hi) return 0.55 + ((value - lo) / (hi - lo)) * 0.35;
    // above hi
    const over = (value - hi) / hi;
    return Math.min(1.12, 0.90 + over * 0.35);
  };

  const pt = (i, r) => {
    const ang = -Math.PI/2 + (i / n) * Math.PI * 2;
    return [cx + Math.cos(ang) * r * rMax, cy + Math.sin(ang) * r * rMax];
  };

  const polyPoints = data.map((d,i) => pt(i, norm(d)).join(',')).join(' ');
  const ringVals = [0.3, 0.55, 0.78, 1.0];
  const axisLines = data.map((_,i) => pt(i, 1.0));

  return (
    <svg className="chart" viewBox={`0 0 ${size} ${size}`} style={{ maxWidth: 480 }}>
      <defs>
        <radialGradient id="radarFill" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.35"/>
          <stop offset="100%" stopColor="#2563EB" stopOpacity="0.25"/>
        </radialGradient>
      </defs>
      {/* rings */}
      {ringVals.map((r,i) => (
        <circle key={i} cx={cx} cy={cy} r={r*rMax}
          fill={r === 0.55 ? "rgba(148,163,184,0.04)" : "none"}
          stroke={r === 0.55 ? "rgba(239,68,68,0.28)" : r === 0.9 ? "rgba(34,197,94,0.25)" : "rgba(255,255,255,0.06)"}
          strokeDasharray={r === 0.55 || r === 0.9 ? "4 4" : "0"}
          strokeWidth={1}/>
      ))}
      {/* axes */}
      {axisLines.map(([x,y], i) => (
        <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(255,255,255,0.08)" />
      ))}
      {/* polygon */}
      <polygon points={polyPoints}
        fill="url(#radarFill)"
        stroke="#2563EB" strokeWidth="2"
        style={{ filter: 'drop-shadow(0 0 12px rgba(37,99,235,0.4))' }}/>
      {/* dots */}
      {data.map((d, i) => {
        const [x,y] = pt(i, norm(d));
        return d.value != null ? (
          <circle key={i} cx={x} cy={y} r="5" fill="#60a5fa" stroke="#08080c" strokeWidth="2"/>
        ) : null;
      })}
      {/* axis labels */}
      {data.map((d, i) => {
        const [x, y] = pt(i, 1.22);
        return (
          <g key={i}>
            <text x={x} y={y-8} textAnchor="middle" className="label-ko">{d.label}</text>
            <text x={x} y={y+6} textAnchor="middle" className="label-en">({d.sub})</text>
            <text x={x} y={y+22} textAnchor="middle" className="value" style={{ fontSize: 14 }}>{d.display}</text>
          </g>
        );
      })}
      {/* band labels */}
      <text x={cx} y={cy - 0.55*rMax - 4} textAnchor="middle" fill="rgba(239,68,68,0.6)" fontSize="9" fontFamily="Inter">기준 미만</text>
      <text x={cx} y={cy - 0.9*rMax - 4} textAnchor="middle" fill="rgba(34,197,94,0.6)" fontSize="9" fontFamily="Inter">기준 상위</text>
    </svg>
  );
}

// ----------------- Kinematic Sequence (timeline) -----------------
function SequenceChart({ sequence }) {
  const { pelvisMs, trunkMs, armMs, g1, g2 } = sequence;
  const uid = React.useMemo(() => Math.random().toString(36).slice(2, 8), []);

  const tMin = -30, tMax = 150;
  const w = 800, h = 340;
  const padL = 24, padR = 24, padT = 30, padB = 90;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  const toX = (ms) => padL + ((ms - tMin) / (tMax - tMin)) * plotW;
  const toY = (v)  => padT + plotH - v * plotH;

  const segs = [
    { ko: '골반', en: 'Pelvis', peakMs: pelvisMs, amp: 0.42, color: '#4a90c2', sigma: 26 },
    { ko: '몸통', en: 'Trunk',  peakMs: trunkMs,  amp: 0.66, color: '#5db885', sigma: 24 },
    { ko: '상완', en: 'Arm',    peakMs: armMs,    amp: 0.95, color: '#e8965a', sigma: 20 },
  ];

  const sample = (peak, amp, sigma, t) => {
    const z = (t - peak) / sigma;
    return amp * Math.exp(-(z * z) / 2);
  };

  const curvePath = (peak, amp, sigma) => {
    let d = '';
    for (let t = tMin; t <= tMax; t += 2) {
      const x = toX(t).toFixed(2);
      const y = toY(sample(peak, amp, sigma, t)).toFixed(2);
      d += (d === '' ? `M ${x} ${y}` : ` L ${x} ${y}`);
    }
    return d;
  };

  const okG1 = g1 >= 30 && g1 <= 60;
  const okG2 = g2 >= 30 && g2 <= 60;

  // Δt 두 행 (stagger)
  const dtRow1Y = padT + plotH + 26;
  const dtRow2Y = padT + plotH + 58;

  return (
    <div className="energy-silhouette">
      <svg viewBox={`0 0 ${w} ${h}`} className="silhouette-svg" role="img" aria-label="키네매틱 시퀀스">
        <defs>
          <filter id={`curveGlow-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id={`peakGlow-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <linearGradient id={`plotBg-${uid}`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#0a1322"/>
            <stop offset="1" stopColor="#0d182b"/>
          </linearGradient>
          {segs.map((s, i) => (
            <path key={i} id={`seqCurve-${i}-${uid}`} d={curvePath(s.peakMs, s.amp, s.sigma)} fill="none"/>
          ))}
        </defs>

        {/* plot 배경 */}
        <rect x={padL} y={padT} width={plotW} height={plotH} fill={`url(#plotBg-${uid})`} rx="4"/>

        {/* 이상 Δt 띠 (30-60 ms / 60-120 ms 시각적 가이드) */}
        <rect x={toX(30)} y={padT} width={toX(60) - toX(30)} height={plotH} fill="rgba(74,222,128,0.05)"/>
        <rect x={toX(60)} y={padT} width={toX(120) - toX(60)} height={plotH} fill="rgba(74,222,128,0.04)"/>

        {/* 시각용 그리드 (숫자 라벨 없음) */}
        {[-30, 0, 30, 60, 90, 120, 150].map(t => (
          <line key={t} x1={toX(t)} x2={toX(t)} y1={padT} y2={padT + plotH}
                stroke="#1e293b" strokeWidth="1" strokeDasharray="2 4"/>
        ))}

        {/* 0 ms 기준선 (골반 피크) */}
        <line x1={toX(0)} x2={toX(0)} y1={padT} y2={padT + plotH}
              stroke="#475569" strokeWidth="1.5" strokeOpacity="0.6"/>

        {/* 곡선 + 다이나믹 (라벨 없음) */}
        {segs.map((s, i) => {
          const d = curvePath(s.peakMs, s.amp, s.sigma);
          const peakX = toX(s.peakMs);
          const peakY = toY(s.amp);
          const partDur = 2.0;
          const partDelay = -((segs.length - 1 - i) * 0.35).toFixed(2);
          return (
            <g key={i}>
              <path d={`${d} L ${toX(tMax)} ${toY(0)} L ${toX(tMin)} ${toY(0)} Z`}
                    fill={s.color} opacity="0.10"/>
              <path d={d} stroke={s.color} strokeWidth="2.6" fill="none" strokeLinecap="round"
                    style={{ filter: `url(#curveGlow-${uid})` }}/>
              <path d={d} stroke="#ffffff" strokeOpacity="0.5" strokeWidth="1.2" fill="none"
                    strokeDasharray="10 22">
                <animate attributeName="stroke-dashoffset" values="32;0" dur="1.6s" repeatCount="indefinite"/>
              </path>
              {[0, 0.5].map((offset, j) => (
                <circle key={j} r="3.2" fill={s.color} opacity="0.95"
                        style={{ filter: `url(#curveGlow-${uid})` }}>
                  <animateMotion dur={`${partDur}s`} repeatCount="indefinite"
                                 begin={`${(parseFloat(partDelay) - offset * partDur).toFixed(2)}s`}>
                    <mpath href={`#seqCurve-${i}-${uid}`}/>
                  </animateMotion>
                </circle>
              ))}
              <circle cx={peakX} cy={peakY} r="10" fill="none" stroke={s.color} strokeOpacity="0.65" strokeWidth="2">
                <animate attributeName="r" values="8;20;8" dur="1.6s" repeatCount="indefinite" begin={`${i * 0.4}s`}/>
                <animate attributeName="stroke-opacity" values="0.7;0;0.7" dur="1.6s" repeatCount="indefinite" begin={`${i * 0.4}s`}/>
              </circle>
              <circle cx={peakX} cy={peakY} r="6.5" fill={s.color} stroke="#08080c" strokeWidth="2"
                      style={{ filter: `url(#peakGlow-${uid})` }}/>
            </g>
          );
        })}

        {/* Δt 표시 (유일하게 남은 텍스트) - 2 행 stagger */}
        {[
          { x1: toX(pelvisMs), x2: toX(trunkMs), val: g1, ok: okG1, label: '골반→몸통', y: dtRow1Y },
          { x1: toX(trunkMs),  x2: toX(armMs),   val: g2, ok: okG2, label: '몸통→상완', y: dtRow2Y },
        ].map((b, i) => {
          const xmid = (b.x1 + b.x2) / 2;
          const clr = b.ok ? '#4ade80' : '#f87171';
          return (
            <g key={i}>
              <line x1={b.x1} x2={b.x1} y1={b.y - 6} y2={b.y + 6} stroke={clr} strokeWidth="2"/>
              <line x1={b.x2} x2={b.x2} y1={b.y - 6} y2={b.y + 6} stroke={clr} strokeWidth="2"/>
              <line x1={b.x1 + 2} x2={b.x2 - 2} y1={b.y} y2={b.y} stroke={clr} strokeWidth="1.8"/>
              <polygon points={`${b.x1 + 8},${b.y - 4} ${b.x1 + 2},${b.y} ${b.x1 + 8},${b.y + 4}`} fill={clr}/>
              <polygon points={`${b.x2 - 8},${b.y - 4} ${b.x2 - 2},${b.y} ${b.x2 - 8},${b.y + 4}`} fill={clr}/>
              <rect x={xmid - 64} y={b.y - 22} width="128" height="18" rx="3"
                    fill="#0b1220" stroke={clr} strokeOpacity="0.75"/>
              <text x={xmid} y={b.y - 9} textAnchor="middle" fontSize="11" fill={clr} fontWeight="700">
                Δt {b.label} {b.val} ms
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ----------------- Angular Velocity Bars -----------------
function AngularChart({ angular }) {
  const segs = [
    { ko: '골반', en: 'Pelvis', val: angular.pelvis, band: angular.pelvisBand, lo: 580,  hi: 640,  color: '#4a90c2', max: 700  },
    { ko: '몸통', en: 'Trunk',  val: angular.trunk,  band: angular.trunkBand,  lo: 800,  hi: 900,  color: '#5db885', max: 1000 },
    { ko: '상완', en: 'Arm',    val: angular.arm,    band: angular.armBand,    lo: 1450, hi: 1600, color: '#e8965a', max: 1700 },
  ];
  const uid = React.useMemo(() => Math.random().toString(36).slice(2, 8), []);
  const bandLabel = (b) => b === 'high' ? '기준 상위' : b === 'mid' ? '기준 범위' : '기준 미만';
  const bandClr   = (b) => b === 'high' ? '#4ade80' : b === 'mid' ? '#c8c8d8' : '#f87171';

  // 골반을 위로 올린 keypoints (pelvis 264→244, knee 12 위로)
  const K = {
    head:     [470, 100],
    neck:     [478, 138],
    rShoulder:[520, 162],
    lShoulder:[438, 158],
    rElbow:   [572, 108],
    rWrist:   [612, 72],
    ball:     [634, 60],
    lElbow:   [376, 176],
    lWrist:   [424, 220],
    pelvisR:  [506, 280],
    pelvisL:  [446, 280],
    pelvisC:  [476, 280],
    rKnee:    [556, 358],
    rAnkle:   [620, 412],
    lKnee:    [370, 384],
    lAnkle:   [332, 472],
    lToe:     [290, 474],
    rToe:     [658, 420],
  };

  // 회전 호 메타데이터 — 화살표 방향 반대 (반시계방향 sweep, sweep flag 0)
  // start/end가 이전 버전 대비 swap된 형태
  const arcs = [
    { center: [K.pelvisC[0], K.pelvisC[1] - 4], rx: 78, ry: 22, startDeg: 340, endDeg: 200,
      val: segs[0].val, max: segs[0].max, color: segs[0].color, name: 'pelvis' },
    { center: [(K.lShoulder[0]+K.rShoulder[0])/2 + 3, (K.lShoulder[1]+K.rShoulder[1])/2 + 32],
      rx: 92, ry: 28, startDeg: 340, endDeg: 200,
      val: segs[1].val, max: segs[1].max, color: segs[1].color, name: 'trunk' },
    { center: [K.rShoulder[0], K.rShoulder[1]], rx: 108, ry: 108, startDeg: 5, endDeg: 245,
      val: segs[2].val, max: segs[2].max, color: segs[2].color, name: 'arm' },
  ];

  // 반시계방향 ellipse 호 path (sweep flag = 0)
  const arcPath = (cx, cy, rx, ry, startDeg, endDeg) => {
    const sR = startDeg * Math.PI / 180;
    const eR = endDeg * Math.PI / 180;
    const x1 = cx + rx * Math.cos(sR);
    const y1 = cy + ry * Math.sin(sR);
    const x2 = cx + rx * Math.cos(eR);
    const y2 = cy + ry * Math.sin(eR);
    const sweep = ((startDeg - endDeg) + 360) % 360;
    const largeArc = sweep > 180 ? 1 : 0;
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${rx} ${ry} 0 ${largeArc} 0 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  };

  // 호 끝 화살표 (반시계 sweep tangent: tx = +rx*sin(r), ty = -ry*cos(r))
  const arrowHead = (cx, cy, rx, ry, deg, size, color) => {
    const r = deg * Math.PI / 180;
    const x = cx + rx * Math.cos(r);
    const y = cy + ry * Math.sin(r);
    const tx =  rx * Math.sin(r);
    const ty = -ry * Math.cos(r);
    const tl = Math.hypot(tx, ty);
    const ux = tx / tl, uy = ty / tl;
    const nx = -uy, ny = ux;
    const tip = [x + ux * size * 0.6, y + uy * size * 0.6];
    const b1  = [x - ux * size * 0.4 + nx * size * 0.6, y - uy * size * 0.4 + ny * size * 0.6];
    const b2  = [x - ux * size * 0.4 - nx * size * 0.6, y - uy * size * 0.4 - ny * size * 0.6];
    return (
      <polygon points={`${tip[0].toFixed(1)},${tip[1].toFixed(1)} ${b1[0].toFixed(1)},${b1[1].toFixed(1)} ${b2[0].toFixed(1)},${b2[1].toFixed(1)}`} fill={color}/>
    );
  };

  const arcStroke = (val, max) => Math.max(8, Math.min(26, 8 + (val / max) * 18));
  // 빠를수록 짧은 dur (다이나믹: 0.6s ~ 1.6s)
  const animDur = (val, max) => (1.6 - (val / max) * 1.0).toFixed(2) + 's';

  return (
    <div className="energy-silhouette">
      <svg viewBox="0 0 800 520" className="silhouette-svg" role="img" aria-label="투구 실루엣 위의 분절별 최대 회전 속도">
        <defs>
          <linearGradient id={`bg-${uid}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#0b1220" stopOpacity="0"/>
            <stop offset="1" stopColor="#0b1220" stopOpacity="0.35"/>
          </linearGradient>
          {/* 시네마틱 라디얼 라이팅 */}
          <radialGradient id={`spotlight-${uid}`} cx="70%" cy="20%" r="80%">
            <stop offset="0%" stopColor="#1c2748" stopOpacity="0.6"/>
            <stop offset="60%" stopColor="#0a1322" stopOpacity="0"/>
          </radialGradient>
          {/* Mannequin shaders */}
          <radialGradient id={`mSphere-${uid}`} cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#f1f5f9"/>
            <stop offset="45%" stopColor="#cbd5e1"/>
            <stop offset="85%" stopColor="#64748b"/>
            <stop offset="100%" stopColor="#334155"/>
          </radialGradient>
          <linearGradient id={`mLimb-${uid}`} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#e2e8f0"/>
            <stop offset="50%" stopColor="#94a3b8"/>
            <stop offset="100%" stopColor="#475569"/>
          </linearGradient>
          <linearGradient id={`mLimbD-${uid}`} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#94a3b8"/>
            <stop offset="55%" stopColor="#64748b"/>
            <stop offset="100%" stopColor="#1e293b"/>
          </linearGradient>
          <linearGradient id={`mTorso-${uid}`} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#e2e8f0"/>
            <stop offset="40%" stopColor="#94a3b8"/>
            <stop offset="100%" stopColor="#334155"/>
          </linearGradient>
          <radialGradient id={`mJoint-${uid}`} cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#f8fafc"/>
            <stop offset="60%" stopColor="#94a3b8"/>
            <stop offset="100%" stopColor="#334155"/>
          </radialGradient>
          <radialGradient id={`aoShadow-${uid}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#000" stopOpacity="0.45"/>
            <stop offset="100%" stopColor="#000" stopOpacity="0"/>
          </radialGradient>
          {/* 강한 글로우 (다이나믹 강조) */}
          <filter id={`arcGlow-${uid}`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="4.5" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id={`particleGlow-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          {/* 호 path를 mpath용으로 등록 */}
          {arcs.map((a, i) => (
            <path key={i} id={`arcRef-${i}-${uid}`}
                  d={arcPath(a.center[0], a.center[1], a.rx, a.ry, a.startDeg, a.endDeg)}
                  fill="none"/>
          ))}
        </defs>

        {/* ground + 시네마틱 라이팅 */}
        <rect x="0" y="0" width="800" height="520" fill={`url(#spotlight-${uid})`}/>
        <line x1="40" y1="485" x2="760" y2="485" stroke="#2a3a5a" strokeWidth="1.5" strokeDasharray="3 6"/>
        <rect x="0" y="0" width="800" height="520" fill={`url(#bg-${uid})`}/>

        <ellipse cx={(K.lAnkle[0]+K.rAnkle[0])/2} cy="488" rx="180" ry="12" fill={`url(#aoShadow-${uid})`}/>

        {/* ---- Glove-side arm (behind body) ---- */}
        <g>
          <line x1={K.lShoulder[0]} y1={K.lShoulder[1]} x2={K.lElbow[0]} y2={K.lElbow[1]}
                stroke={`url(#mLimbD-${uid})`} strokeWidth="22" strokeLinecap="round"/>
          <circle cx={K.lElbow[0]} cy={K.lElbow[1]} r="12" fill={`url(#mJoint-${uid})`}/>
          <line x1={K.lElbow[0]} y1={K.lElbow[1]} x2={K.lWrist[0]} y2={K.lWrist[1]}
                stroke={`url(#mLimbD-${uid})`} strokeWidth="19" strokeLinecap="round"/>
          <circle cx={K.lWrist[0]} cy={K.lWrist[1]} r="13" fill={`url(#mSphere-${uid})`}/>
        </g>

        {/* ---- Back leg ---- */}
        <g>
          <line x1={K.pelvisR[0]-2} y1={K.pelvisR[1]} x2={K.rKnee[0]} y2={K.rKnee[1]}
                stroke={`url(#mLimb-${uid})`} strokeWidth="32" strokeLinecap="round"/>
          <circle cx={K.rKnee[0]} cy={K.rKnee[1]} r="15" fill={`url(#mJoint-${uid})`}/>
          <line x1={K.rKnee[0]} y1={K.rKnee[1]} x2={K.rAnkle[0]} y2={K.rAnkle[1]}
                stroke={`url(#mLimb-${uid})`} strokeWidth="24" strokeLinecap="round"/>
          <circle cx={K.rAnkle[0]} cy={K.rAnkle[1]} r="11" fill={`url(#mJoint-${uid})`}/>
          <path d={`
            M ${K.rAnkle[0]-8} ${K.rAnkle[1]+4}
            Q ${K.rAnkle[0]-4} ${K.rAnkle[1]+18} ${K.rToe[0]-6} ${K.rToe[1]+10}
            L ${K.rToe[0]+4} ${K.rToe[1]+2}
            Q ${K.rToe[0]-2} ${K.rAnkle[1]-2} ${K.rAnkle[0]+6} ${K.rAnkle[1]-4}
            Z
          `} fill={`url(#mLimb-${uid})`}/>
        </g>

        {/* ---- Front leg ---- */}
        <g>
          <line x1={K.pelvisL[0]+2} y1={K.pelvisL[1]} x2={K.lKnee[0]} y2={K.lKnee[1]}
                stroke={`url(#mLimb-${uid})`} strokeWidth="34" strokeLinecap="round"/>
          <circle cx={K.lKnee[0]} cy={K.lKnee[1]} r="17" fill={`url(#mJoint-${uid})`}/>
          <line x1={K.lKnee[0]} y1={K.lKnee[1]} x2={K.lAnkle[0]} y2={K.lAnkle[1]}
                stroke={`url(#mLimb-${uid})`} strokeWidth="26" strokeLinecap="round"/>
          <circle cx={K.lAnkle[0]} cy={K.lAnkle[1]} r="12" fill={`url(#mJoint-${uid})`}/>
          <path d={`
            M ${K.lAnkle[0]-12} ${K.lAnkle[1]+2}
            Q ${K.lToe[0]-4} ${K.lToe[1]-8} ${K.lToe[0]-12} ${K.lToe[1]+8}
            L ${K.lAnkle[0]-4} ${K.lAnkle[1]+14}
            Z
          `} fill={`url(#mLimb-${uid})`}/>
        </g>

        {/* ---- Torso ---- */}
        <line x1={K.lShoulder[0]+2} y1={K.lShoulder[1]+4}
              x2={K.rShoulder[0]-2} y2={K.rShoulder[1]+4}
              stroke={`url(#mLimb-${uid})`} strokeWidth="34" strokeLinecap="round"/>
        <path d={`
          M ${K.lShoulder[0]+4} ${K.lShoulder[1]+8}
          C ${K.lShoulder[0]-2} ${K.lShoulder[1]+50}, ${K.pelvisL[0]+2} ${K.pelvisL[1]-68}, ${K.pelvisL[0]+6} ${K.pelvisL[1]-20}
          L ${K.pelvisR[0]-6} ${K.pelvisR[1]-20}
          C ${K.pelvisR[0]-2} ${K.pelvisR[1]-68}, ${K.rShoulder[0]+2} ${K.rShoulder[1]+50}, ${K.rShoulder[0]-4} ${K.rShoulder[1]+8}
          Z
        `} fill={`url(#mTorso-${uid})`} stroke="#1e293b" strokeWidth="1.2"/>
        {/* Abdomen + 통합 hip silhouette (별도 pelvis 캡슐 없음 — 하단에서 자연스럽게 hip 폭으로 넓어짐) */}
        <path d={`
          M ${K.pelvisL[0]+6} ${K.pelvisL[1]-22}
          C ${K.pelvisL[0]+2} ${K.pelvisL[1]-12}, ${K.pelvisL[0]-2} ${K.pelvisL[1]-2}, ${K.pelvisL[0]-6} ${K.pelvisL[1]+10}
          L ${K.pelvisR[0]+6} ${K.pelvisR[1]+10}
          C ${K.pelvisR[0]+2} ${K.pelvisR[1]-2}, ${K.pelvisR[0]-2} ${K.pelvisR[1]-12}, ${K.pelvisR[0]-6} ${K.pelvisR[1]-22}
          Z
        `} fill={`url(#mTorso-${uid})`} stroke="#1e293b" strokeWidth="1"/>
        <path d={`M ${(K.lShoulder[0]+K.rShoulder[0])/2} ${(K.lShoulder[1]+K.rShoulder[1])/2 + 12}
                  L ${K.pelvisC[0]+2} ${K.pelvisC[1]-12}`}
              stroke="#334155" strokeWidth="1" strokeOpacity="0.35" fill="none"/>
        <circle cx={K.lShoulder[0]} cy={K.lShoulder[1]} r="15" fill={`url(#mJoint-${uid})`}/>
        <circle cx={K.rShoulder[0]} cy={K.rShoulder[1]} r="16" fill={`url(#mJoint-${uid})`}/>

        {/* ---- Neck + head ---- */}
        <line x1={K.neck[0]-2} y1={K.neck[1]-6} x2={K.neck[0]+2} y2={K.neck[1]+8}
              stroke={`url(#mLimb-${uid})`} strokeWidth="16" strokeLinecap="round"/>
        <circle cx={K.head[0]} cy={K.head[1]} r="28" fill={`url(#mSphere-${uid})`} stroke="#1e293b" strokeWidth="1"/>
        <path d={`M ${K.head[0]-28} ${K.head[1]-4} Q ${K.head[0]-10} ${K.head[1]+10} ${K.head[0]+22} ${K.head[1]+4}`}
              stroke="#475569" strokeWidth="1" strokeOpacity="0.4" fill="none"/>

        {/* ---- Throwing arm ---- */}
        <g>
          <line x1={K.rShoulder[0]} y1={K.rShoulder[1]} x2={K.rElbow[0]} y2={K.rElbow[1]}
                stroke={`url(#mLimb-${uid})`} strokeWidth="26" strokeLinecap="round"/>
          <circle cx={K.rElbow[0]} cy={K.rElbow[1]} r="13" fill={`url(#mJoint-${uid})`}/>
          <line x1={K.rElbow[0]} y1={K.rElbow[1]} x2={K.rWrist[0]} y2={K.rWrist[1]}
                stroke={`url(#mLimb-${uid})`} strokeWidth="20" strokeLinecap="round"/>
          <circle cx={K.rWrist[0]} cy={K.rWrist[1]} r="11" fill={`url(#mJoint-${uid})`}/>
        </g>

        {/* ---- Ball ---- */}
        <circle cx={K.ball[0]} cy={K.ball[1]} r="9" fill="#f8fafc" stroke="#1e293b" strokeWidth="1.2"/>
        <path d={`M ${K.ball[0]-6} ${K.ball[1]-3} Q ${K.ball[0]} ${K.ball[1]-8} ${K.ball[0]+6} ${K.ball[1]-3}`} stroke="#ef4444" strokeWidth="1.2" fill="none"/>
        <path d={`M ${K.ball[0]-6} ${K.ball[1]+3} Q ${K.ball[0]} ${K.ball[1]+8} ${K.ball[0]+6} ${K.ball[1]+3}`} stroke="#ef4444" strokeWidth="1.2" fill="none"/>

        {/* -------- Rotation arcs (다이나믹: 흐르는 빛 + 입자 + 펄스) -------- */}
        {arcs.map((a, i) => {
          const sw = arcStroke(a.val, a.max);
          const dur = animDur(a.val, a.max);
          const durNum = parseFloat(dur);
          const arcRef = `#arcRef-${i}-${uid}`;
          const pathD = arcPath(a.center[0], a.center[1], a.rx, a.ry, a.startDeg, a.endDeg);
          return (
            <g key={i}>
              {/* 외광 헤일로 */}
              <path d={pathD}
                    stroke={a.color} strokeOpacity="0.16" strokeWidth={sw + 14}
                    fill="none" strokeLinecap="round"
                    style={{ filter: `url(#arcGlow-${uid})` }}/>
              {/* 베이스 underlay */}
              <path d={pathD}
                    stroke={a.color} strokeOpacity="0.32" strokeWidth={sw + 4}
                    fill="none" strokeLinecap="round"/>
              {/* 메인 호 (펄스 효과) */}
              <path d={pathD}
                    stroke={a.color} strokeWidth={sw}
                    fill="none" strokeLinecap="round"
                    style={{ filter: `url(#arcGlow-${uid})` }}>
                <animate attributeName="stroke-opacity" values="0.85;1;0.85" dur={`${(durNum*1.5).toFixed(2)}s`} repeatCount="indefinite"/>
              </path>
              {/* 흐르는 빛 (dasharray 애니메이션) - 반시계방향이므로 offset 반대로 */}
              <path d={pathD}
                    stroke="#ffffff" strokeOpacity="0.55" strokeWidth={Math.max(2, sw * 0.35)}
                    fill="none" strokeLinecap="round"
                    strokeDasharray="18 26">
                <animate attributeName="stroke-dashoffset" values="0;44" dur={dur} repeatCount="indefinite"/>
              </path>
              {/* 흐르는 입자 3개 */}
              {[0, 0.33, 0.66].map((offset, j) => (
                <circle key={j} r={2.8} fill="#ffffff" opacity="0.95"
                        style={{ filter: `url(#particleGlow-${uid})` }}>
                  <animateMotion dur={dur} repeatCount="indefinite"
                                 begin={`-${(offset * durNum).toFixed(2)}s`}>
                    <mpath href={arcRef}/>
                  </animateMotion>
                </circle>
              ))}
              {/* 화살표 머리 (반대 방향) - 펄스 */}
              <g style={{ filter: `url(#arcGlow-${uid})` }}>
                {arrowHead(a.center[0], a.center[1], a.rx, a.ry, a.endDeg, sw + 8, a.color)}
                <circle cx={a.center[0] + a.rx * Math.cos(a.endDeg * Math.PI/180)}
                        cy={a.center[1] + a.ry * Math.sin(a.endDeg * Math.PI/180)}
                        r={sw * 0.55} fill={a.color} opacity="0.5">
                  <animate attributeName="r" values={`${sw*0.45};${sw*0.85};${sw*0.45}`} dur={dur} repeatCount="indefinite"/>
                  <animate attributeName="opacity" values="0.5;0.0;0.5" dur={dur} repeatCount="indefinite"/>
                </circle>
              </g>
              {/* 회전 축 점 */}
              <circle cx={a.center[0]} cy={a.center[1]} r="3.5" fill={a.color} opacity="0.9"/>
              <circle cx={a.center[0]} cy={a.center[1]} r="6" fill="none" stroke={a.color} strokeOpacity="0.4" strokeWidth="1"/>
            </g>
          );
        })}

        {/* -------- Left side label panels with leader lines -------- */}
        {segs.map((s, i) => {
          const a = arcs[i];
          const lx = 36, ly = 56 + i * 132, lw = 200, lh = 102;
          // leader: 호의 새 endDeg 근처에서 라벨로
          const lr = (a.endDeg - 25) * Math.PI / 180;
          const px = a.center[0] + a.rx * Math.cos(lr);
          const py = a.center[1] + a.ry * Math.sin(lr);
          const pct = Math.min(1, s.val / s.max);
          const loPct = s.lo / s.max;
          const hiPct = s.hi / s.max;
          const gx0 = lx + 14, gx1 = lx + lw - 14, gw = gx1 - gx0;
          const gy = ly + 64;
          return (
            <g key={i}>
              <line x1={px} y1={py} x2={lx + lw} y2={ly + lh / 2}
                    stroke={s.color} strokeWidth="1.2" strokeOpacity="0.6" strokeDasharray="2 3"/>
              <rect x={lx} y={ly} width={lw} height={lh} rx="8" fill="#0b1220" stroke={s.color} strokeOpacity="0.7"/>
              <text x={lx + 14} y={ly + 22} fontSize="10" fill={s.color} fontFamily="Inter" fontWeight="700" letterSpacing="2">{s.en.toUpperCase()}</text>
              <text x={lx + 14} y={ly + 44} fontSize="17" fill="#e2e8f0" fontWeight="700">{s.ko}</text>
              <text x={lx + lw - 14} y={ly + 44} textAnchor="end" fontSize="22" fill={s.color} fontWeight="800" fontFamily="Inter">
                {s.val}<tspan fontSize="11" fill="#94a3b8" fontWeight="500"> °/s</tspan>
              </text>
              <line x1={gx0} y1={gy} x2={gx1} y2={gy} stroke="#1e293b" strokeWidth="3" strokeLinecap="round"/>
              <line x1={gx0 + loPct * gw} y1={gy} x2={gx0 + hiPct * gw} y2={gy}
                    stroke="rgba(148,163,184,0.5)" strokeWidth="3" strokeLinecap="round"/>
              <circle cx={gx0 + pct * gw} cy={gy} r="5" fill={s.color} stroke="#0b1220" strokeWidth="1.5"/>
              <rect x={lx + 14} y={ly + 76} width="68" height="18" rx="3"
                    fill="rgba(8,8,12,0.6)" stroke={bandClr(s.band)} strokeWidth="1"/>
              <text x={lx + 48} y={ly + 89} textAnchor="middle" fontSize="11" fill={bandClr(s.band)} fontWeight="700">{bandLabel(s.band)}</text>
              <text x={lx + lw - 14} y={ly + 89} textAnchor="end" fontSize="10" fill="#94a3b8" fontFamily="Inter">기준 {s.lo}–{s.hi}</text>
            </g>
          );
        })}
      </svg>

      <div className="silhouette-legend">
        <div className="leg-item"><span className="dot" style={{ background: '#4a90c2' }}/>골반 회전 — 하체 회전 시작점</div>
        <div className="leg-item"><span className="dot" style={{ background: '#5db885' }}/>몸통 회전 — 골반 → 몸통 가속 (이상 ×1.3+)</div>
        <div className="leg-item"><span className="dot" style={{ background: '#e8965a' }}/>상완 회전 — 채찍 끝 가속 (이상 ×1.7+)</div>
        <div className="leg-item note">호의 두께 = 회전 속도 비례 · 흐르는 입자 속도 = 분절 회전 속도 비례 · 화살표 = 회전 방향</div>
      </div>
    </div>
  );
}

// ----------------- Energy flow (pitcher silhouette overlay) -----------------
function EnergyFlow({ energy }) {
  const { etiPT, etiTA, leakPct } = energy;
  const ptLeak = false;
  const taLeak = etiTA < 0.85;
  const uid = React.useMemo(() => Math.random().toString(36).slice(2, 8), []);

  // Silhouette keypoints — 3D mannequin, release-just-before pose
  // RHP viewed from 1루 side. Front foot planted with DEEP knee flexion (~95°).
  const K = {
    head:     [470, 100],
    neck:     [478, 138],
    rShoulder:[520, 162],
    lShoulder:[438, 158],
    rElbow:   [572, 108],
    rWrist:   [612, 72],
    ball:     [634, 60],
    lElbow:   [376, 176],
    lWrist:   [424, 220],
    pelvisR:  [506, 280],
    pelvisL:  [446, 280],
    pelvisC:  [476, 280],
    rKnee:    [556, 358],   // back leg driving
    rAnkle:   [620, 412],
    lKnee:    [370, 384],   // FRONT knee bent more (forward + down)
    lAnkle:   [332, 472],   // front foot planted
    lToe:     [290, 474],
    rToe:     [658, 420],
  };

  const L = (a, b, w=14, stroke='#1b2740') => (
    <line x1={K[a][0]} y1={K[a][1]} x2={K[b][0]} y2={K[b][1]} stroke={stroke} strokeWidth={w} strokeLinecap="round"/>
  );

  // Energy path: FRONT ankle (braced) → front knee → pelvis center → trunk (neck) → shoulder → elbow → wrist → ball
  const energyPath = `
    M ${K.lAnkle[0]} ${K.lAnkle[1]}
    L ${K.lKnee[0]} ${K.lKnee[1]}
    L ${K.pelvisC[0]} ${K.pelvisC[1]}
    L ${K.neck[0]} ${K.neck[1] + 5}
    L ${K.rShoulder[0]} ${K.rShoulder[1]}
    L ${K.rElbow[0]} ${K.rElbow[1]}
    L ${K.rWrist[0]} ${K.rWrist[1]}
    L ${K.ball[0]} ${K.ball[1]}
  `;

  // Approximate path lengths (for color stop placement on the gradient-along-path)
  // We'll split into 3 stages for coloring: leg→pelvis (drive), pelvis→trunk (PT), trunk→ball (TA)
  // Stage stops: ~0–28% drive, 28–55% PT, 55–100% TA

  return (
    <div className="energy-silhouette">
      <svg viewBox="0 0 800 520" className="silhouette-svg" role="img" aria-label="투구 실루엣 위의 에너지 전달 경로">
        <defs>
          {/* Background gradient subtle */}
          <linearGradient id={`bg-${uid}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#0b1220" stopOpacity="0"/>
            <stop offset="1" stopColor="#0b1220" stopOpacity="0.35"/>
          </linearGradient>
          {/* Energy pipe gradient along path */}
          <linearGradient id={`energy-${uid}`} gradientUnits="userSpaceOnUse"
            x1={K.lAnkle[0]} y1={K.lAnkle[1]} x2={K.ball[0]} y2={K.ball[1]}>
            <stop offset="0%"   stopColor="#22d3ee"/>
            <stop offset="28%"  stopColor="#60a5fa"/>
            <stop offset="55%"  stopColor={taLeak ? '#f59e0b' : '#2563EB'}/>
            <stop offset="85%"  stopColor={taLeak ? '#ef4444' : '#1d4ed8'}/>
            <stop offset="100%" stopColor={taLeak ? '#7f1d1d' : '#1e3a8a'}/>
          </linearGradient>
          {/* Glow */}
          <filter id={`glow-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          {/* Leak burst */}
          <radialGradient id={`leak-${uid}`}>
            <stop offset="0%" stopColor="#fee2e2" stopOpacity="0.95"/>
            <stop offset="40%" stopColor="#ef4444" stopOpacity="0.7"/>
            <stop offset="100%" stopColor="#7f1d1d" stopOpacity="0"/>
          </radialGradient>

          {/* ---- 3D Mannequin shaders ---- */}
          {/* Head / sphere shader */}
          <radialGradient id={`mSphere-${uid}`} cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#f1f5f9"/>
            <stop offset="45%" stopColor="#cbd5e1"/>
            <stop offset="85%" stopColor="#64748b"/>
            <stop offset="100%" stopColor="#334155"/>
          </radialGradient>
          {/* Limb shader — linear top-light */}
          <linearGradient id={`mLimb-${uid}`} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#e2e8f0"/>
            <stop offset="50%" stopColor="#94a3b8"/>
            <stop offset="100%" stopColor="#475569"/>
          </linearGradient>
          {/* Limb shader — darker for back/shadow-side limbs */}
          <linearGradient id={`mLimbD-${uid}`} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#94a3b8"/>
            <stop offset="55%" stopColor="#64748b"/>
            <stop offset="100%" stopColor="#1e293b"/>
          </linearGradient>
          {/* Torso shader */}
          <linearGradient id={`mTorso-${uid}`} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#e2e8f0"/>
            <stop offset="40%" stopColor="#94a3b8"/>
            <stop offset="100%" stopColor="#334155"/>
          </linearGradient>
          {/* Joint shader */}
          <radialGradient id={`mJoint-${uid}`} cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#f8fafc"/>
            <stop offset="60%" stopColor="#94a3b8"/>
            <stop offset="100%" stopColor="#334155"/>
          </radialGradient>
          {/* Soft ambient occlusion shadow under figure */}
          <radialGradient id={`aoShadow-${uid}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#000" stopOpacity="0.45"/>
            <stop offset="100%" stopColor="#000" stopOpacity="0"/>
          </radialGradient>
        </defs>

        {/* ground */}
        <line x1="40" y1="485" x2="760" y2="485" stroke="#2a3a5a" strokeWidth="1.5" strokeDasharray="3 6"/>
        <rect x="0" y="0" width="800" height="520" fill={`url(#bg-${uid})`}/>

        {/* -------- 3D Mannequin figure -------- */}
        {/* Ground shadow (AO) */}
        <ellipse cx={(K.lAnkle[0]+K.rAnkle[0])/2} cy="488" rx="180" ry="12" fill={`url(#aoShadow-${uid})`}/>

        {/* ---- Glove-side arm (behind body) ---- */}
        <g>
          {/* upper arm */}
          <line x1={K.lShoulder[0]} y1={K.lShoulder[1]} x2={K.lElbow[0]} y2={K.lElbow[1]}
                stroke={`url(#mLimbD-${uid})`} strokeWidth="22" strokeLinecap="round"/>
          {/* elbow joint */}
          <circle cx={K.lElbow[0]} cy={K.lElbow[1]} r="12" fill={`url(#mJoint-${uid})`}/>
          {/* forearm */}
          <line x1={K.lElbow[0]} y1={K.lElbow[1]} x2={K.lWrist[0]} y2={K.lWrist[1]}
                stroke={`url(#mLimbD-${uid})`} strokeWidth="19" strokeLinecap="round"/>
          {/* wrist/hand sphere (glove-side fist) */}
          <circle cx={K.lWrist[0]} cy={K.lWrist[1]} r="13" fill={`url(#mSphere-${uid})`}/>
        </g>

        {/* ---- Back leg (drive leg) ---- */}
        <g>
          {/* thigh */}
          <line x1={K.pelvisR[0]-2} y1={K.pelvisR[1]} x2={K.rKnee[0]} y2={K.rKnee[1]}
                stroke={`url(#mLimb-${uid})`} strokeWidth="32" strokeLinecap="round"/>
          {/* knee */}
          <circle cx={K.rKnee[0]} cy={K.rKnee[1]} r="15" fill={`url(#mJoint-${uid})`}/>
          {/* shin */}
          <line x1={K.rKnee[0]} y1={K.rKnee[1]} x2={K.rAnkle[0]} y2={K.rAnkle[1]}
                stroke={`url(#mLimb-${uid})`} strokeWidth="24" strokeLinecap="round"/>
          {/* ankle */}
          <circle cx={K.rAnkle[0]} cy={K.rAnkle[1]} r="11" fill={`url(#mJoint-${uid})`}/>
          {/* foot */}
          <path d={`
            M ${K.rAnkle[0]-8} ${K.rAnkle[1]+4}
            Q ${K.rAnkle[0]-4} ${K.rAnkle[1]+18} ${K.rToe[0]-6} ${K.rToe[1]+10}
            L ${K.rToe[0]+4} ${K.rToe[1]+2}
            Q ${K.rToe[0]-2} ${K.rAnkle[1]-2} ${K.rAnkle[0]+6} ${K.rAnkle[1]-4}
            Z
          `} fill={`url(#mLimb-${uid})`}/>
        </g>

        {/* ---- Front leg (braced, DEEP knee flexion) ---- */}
        <g>
          {/* thigh */}
          <line x1={K.pelvisL[0]+2} y1={K.pelvisL[1]} x2={K.lKnee[0]} y2={K.lKnee[1]}
                stroke={`url(#mLimb-${uid})`} strokeWidth="34" strokeLinecap="round"/>
          {/* knee (prominent) */}
          <circle cx={K.lKnee[0]} cy={K.lKnee[1]} r="17" fill={`url(#mJoint-${uid})`}/>
          {/* shin */}
          <line x1={K.lKnee[0]} y1={K.lKnee[1]} x2={K.lAnkle[0]} y2={K.lAnkle[1]}
                stroke={`url(#mLimb-${uid})`} strokeWidth="26" strokeLinecap="round"/>
          {/* ankle */}
          <circle cx={K.lAnkle[0]} cy={K.lAnkle[1]} r="12" fill={`url(#mJoint-${uid})`}/>
          {/* planted foot */}
          <path d={`
            M ${K.lAnkle[0]-12} ${K.lAnkle[1]+2}
            Q ${K.lToe[0]-4} ${K.lToe[1]-8} ${K.lToe[0]-12} ${K.lToe[1]+8}
            L ${K.lAnkle[0]-4} ${K.lAnkle[1]+14}
            Z
          `} fill={`url(#mLimb-${uid})`}/>
        </g>

        {/* ---- Torso (3D mannequin — smooth anatomical shape) ---- */}
        {/* Shoulder yoke: capsule between shoulders to anchor the trapezius line */}
        <line x1={K.lShoulder[0]+2} y1={K.lShoulder[1]+4}
              x2={K.rShoulder[0]-2} y2={K.rShoulder[1]+4}
              stroke={`url(#mLimb-${uid})`} strokeWidth="34" strokeLinecap="round"/>

        {/* Ribcage (chest) — inverted trapezoid, broader at shoulders */}
        <path d={`
          M ${K.lShoulder[0]+4} ${K.lShoulder[1]+8}
          C ${K.lShoulder[0]-2} ${K.lShoulder[1]+50}, ${K.pelvisL[0]+2} ${K.pelvisL[1]-68}, ${K.pelvisL[0]+6} ${K.pelvisL[1]-20}
          L ${K.pelvisR[0]-6} ${K.pelvisR[1]-20}
          C ${K.pelvisR[0]-2} ${K.pelvisR[1]-68}, ${K.rShoulder[0]+2} ${K.rShoulder[1]+50}, ${K.rShoulder[0]-4} ${K.rShoulder[1]+8}
          Z
        `} fill={`url(#mTorso-${uid})`} stroke="#1e293b" strokeWidth="1.2"/>

        {/* Abdomen / waist — narrower band connecting ribcage to pelvis */}
        {/* Abdomen + 통합 hip silhouette (별도 pelvis 캡슐 없음 — 하단에서 자연스럽게 hip 폭으로 넓어짐) */}
        <path d={`
          M ${K.pelvisL[0]+6} ${K.pelvisL[1]-22}
          C ${K.pelvisL[0]+2} ${K.pelvisL[1]-12}, ${K.pelvisL[0]-2} ${K.pelvisL[1]-2}, ${K.pelvisL[0]-6} ${K.pelvisL[1]+10}
          L ${K.pelvisR[0]+6} ${K.pelvisR[1]+10}
          C ${K.pelvisR[0]+2} ${K.pelvisR[1]-2}, ${K.pelvisR[0]-2} ${K.pelvisR[1]-12}, ${K.pelvisR[0]-6} ${K.pelvisR[1]-22}
          Z
        `} fill={`url(#mTorso-${uid})`} stroke="#1e293b" strokeWidth="1"/>

        {/* Pelvis/hip block — rounded capsule */}

        {/* Sternum center-line (subtle 3D split) */}
        <path d={`M ${(K.lShoulder[0]+K.rShoulder[0])/2} ${(K.lShoulder[1]+K.rShoulder[1])/2 + 12}
                  L ${K.pelvisC[0]+2} ${K.pelvisC[1]-12}`}
              stroke="#334155" strokeWidth="1" strokeOpacity="0.35" fill="none"/>

        {/* Shoulder joints (caps) — spheres over the yoke */}
        <circle cx={K.lShoulder[0]} cy={K.lShoulder[1]} r="15" fill={`url(#mJoint-${uid})`}/>
        <circle cx={K.rShoulder[0]} cy={K.rShoulder[1]} r="16" fill={`url(#mJoint-${uid})`}/>

        {/* ---- Neck + head (featureless mannequin sphere) ---- */}
        <line x1={K.neck[0]-2} y1={K.neck[1]-6} x2={K.neck[0]+2} y2={K.neck[1]+8}
              stroke={`url(#mLimb-${uid})`} strokeWidth="16" strokeLinecap="round"/>
        <circle cx={K.head[0]} cy={K.head[1]} r="28" fill={`url(#mSphere-${uid})`} stroke="#1e293b" strokeWidth="1"/>
        {/* subtle head facet line (shows orientation toward batter) */}
        <path d={`M ${K.head[0]-28} ${K.head[1]-4} Q ${K.head[0]-10} ${K.head[1]+10} ${K.head[0]+22} ${K.head[1]+4}`}
              stroke="#475569" strokeWidth="1" strokeOpacity="0.4" fill="none"/>

        {/* ---- Throwing arm (front) ---- */}
        <g>
          {/* upper arm */}
          <line x1={K.rShoulder[0]} y1={K.rShoulder[1]} x2={K.rElbow[0]} y2={K.rElbow[1]}
                stroke={`url(#mLimb-${uid})`} strokeWidth="26" strokeLinecap="round"/>
          {/* elbow */}
          <circle cx={K.rElbow[0]} cy={K.rElbow[1]} r="13" fill={`url(#mJoint-${uid})`}/>
          {/* forearm */}
          <line x1={K.rElbow[0]} y1={K.rElbow[1]} x2={K.rWrist[0]} y2={K.rWrist[1]}
                stroke={`url(#mLimb-${uid})`} strokeWidth="20" strokeLinecap="round"/>
          {/* wrist/hand */}
          <circle cx={K.rWrist[0]} cy={K.rWrist[1]} r="11" fill={`url(#mJoint-${uid})`}/>
        </g>

        {/* ---- Ball ---- */}
        <circle cx={K.ball[0]} cy={K.ball[1]} r="9" fill="#f8fafc" stroke="#1e293b" strokeWidth="1.2"/>
        <path d={`M ${K.ball[0]-6} ${K.ball[1]-3} Q ${K.ball[0]} ${K.ball[1]-8} ${K.ball[0]+6} ${K.ball[1]-3}`} stroke="#ef4444" strokeWidth="1.2" fill="none"/>
        <path d={`M ${K.ball[0]-6} ${K.ball[1]+3} Q ${K.ball[0]} ${K.ball[1]+8} ${K.ball[0]+6} ${K.ball[1]+3}`} stroke="#ef4444" strokeWidth="1.2" fill="none"/>

        {/* -------- Energy pipe overlay -------- */}
        {/* dim underlay */}
        <path d={energyPath} stroke="#0f1a30" strokeOpacity="0.6" strokeWidth="22" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        {/* animated flowing pipe */}
        <path d={energyPath}
              stroke={`url(#energy-${uid})`}
              strokeWidth="14"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter={`url(#glow-${uid})`}
              strokeDasharray="24 14">
          <animate attributeName="stroke-dashoffset" from="0" to="-76" dur="1.6s" repeatCount="indefinite"/>
        </path>

        {/* Leak burst at throwing shoulder if Trunk→Arm leak */}
        {taLeak && (
          <g>
            <circle cx={(K.rShoulder[0]+K.rElbow[0])/2} cy={(K.rShoulder[1]+K.rElbow[1])/2} r="38" fill={`url(#leak-${uid})`}>
              <animate attributeName="r" values="28;44;28" dur="1.2s" repeatCount="indefinite"/>
              <animate attributeName="opacity" values="0.9;0.4;0.9" dur="1.2s" repeatCount="indefinite"/>
            </circle>
            {/* escaping sparks */}
            {[0,1,2,3].map(i => (
              <circle key={i} cx={(K.rShoulder[0]+K.rElbow[0])/2} cy={(K.rShoulder[1]+K.rElbow[1])/2} r="3" fill="#fca5a5">
                <animate attributeName="cx" values={`${(K.rShoulder[0]+K.rElbow[0])/2};${(K.rShoulder[0]+K.rElbow[0])/2 + 30 + i*8}`} dur={`${1.2+i*0.2}s`} repeatCount="indefinite"/>
                <animate attributeName="cy" values={`${(K.rShoulder[1]+K.rElbow[1])/2};${(K.rShoulder[1]+K.rElbow[1])/2 - 20 - i*6}`} dur={`${1.2+i*0.2}s`} repeatCount="indefinite"/>
                <animate attributeName="opacity" values="1;0" dur={`${1.2+i*0.2}s`} repeatCount="indefinite"/>
              </circle>
            ))}
          </g>
        )}

        {/* -------- Annotations -------- */}
        {/* Stage 1: front foot block (energy starts here) */}
        <g className="anno">
          <line x1={K.lAnkle[0]-6} y1={K.lAnkle[1]-14} x2="150" y2="430" stroke="#22d3ee" strokeWidth="1.2" strokeDasharray="2 3"/>
          <rect x="42" y="412" width="176" height="44" rx="6" fill="#0b1220" stroke="#22d3ee" strokeOpacity="0.55"/>
          <text x="130" y="428" fill="#22d3ee" fontSize="10" fontFamily="Inter" fontWeight="700" textAnchor="middle" letterSpacing="1">FRONT-FOOT BLOCK</text>
          <text x="130" y="446" fill="#e2e8f0" fontSize="11" fontFamily="Inter" fontWeight="600" textAnchor="middle">지면 반력 · 에너지 시작</text>
        </g>

        {/* Stage 2: Pelvis→Trunk */}
        <g className="anno">
          <line x1={K.pelvisC[0]-20} y1={K.pelvisC[1]-10} x2="150" y2="280" stroke={ptLeak ? '#ef4444' : '#60a5fa'} strokeWidth="1.2" strokeDasharray="2 3"/>
          <rect x="42" y="252" width="176" height="52" rx="6" fill="#0b1220" stroke={ptLeak ? '#ef4444' : '#60a5fa'} strokeOpacity="0.6"/>
          <text x="130" y="268" fill={ptLeak ? '#ef4444' : '#60a5fa'} fontSize="10" fontFamily="Inter" fontWeight="700" textAnchor="middle" letterSpacing="1">PELVIS → TRUNK</text>
          <text x="130" y="284" fill="#e2e8f0" fontSize="13" fontFamily="Inter" fontWeight="700" textAnchor="middle">ETI {etiPT.toFixed(2)}</text>
          <text x="130" y="298" fill="#94a3b8" fontSize="10" fontFamily="Inter" textAnchor="middle">{ptLeak ? '누수 감지' : '정상 전달'}</text>
        </g>

        {/* Stage 3: Trunk→Arm */}
        <g className="anno">
          <line x1={K.rShoulder[0]+12} y1={K.rShoulder[1]-4} x2="700" y2="140" stroke={taLeak ? '#ef4444' : '#2563EB'} strokeWidth="1.2" strokeDasharray="2 3"/>
          <rect x="592" y="110" width="180" height="60" rx="6" fill="#0b1220" stroke={taLeak ? '#ef4444' : '#2563EB'} strokeOpacity="0.7"/>
          <text x="682" y="126" fill={taLeak ? '#ef4444' : '#2563EB'} fontSize="10" fontFamily="Inter" fontWeight="700" textAnchor="middle" letterSpacing="1">TRUNK → ARM</text>
          <text x="682" y="144" fill="#e2e8f0" fontSize="15" fontFamily="Inter" fontWeight="800" textAnchor="middle">ETI {etiTA.toFixed(2)}</text>
          <text x="682" y="160" fill={taLeak ? '#fca5a5' : '#94a3b8'} fontSize="10" fontFamily="Inter" fontWeight={taLeak ? 700 : 400} textAnchor="middle">
            {taLeak ? `⚠ 누수 ${leakPct}% · 어깨 부하↑` : '정상 전달'}
          </text>
        </g>

      </svg>

      <div className="silhouette-legend">
        <div className="leg-item"><span className="dot" style={{ background: 'linear-gradient(90deg,#22d3ee,#2563EB)' }}/>에너지 흐름 (발 → 골반 → 몸통 → 팔 → 공)</div>
        <div className="leg-item"><span className="dot" style={{ background: '#ef4444' }}/>누수 지점 · 어깨/팔꿈치 부하 증가</div>
        <div className="leg-item note">ETI 1.0 근처 = 거의 전부 전달 · 0.85 미만 = 누수 신호</div>
      </div>
    </div>
  );
}

// ----------------- Integrated Kinetic Diagram (files v8 통합 마네킹) -----------------
// 한 마네킹에 전신 키네틱 체인 에너지 흐름 + 5편 논문 기반 정밀 지표(elbow load eff, cocking arm power,
// transfer KE T→A, leg asymmetry, peak hip vel)를 모두 표시. dashboard에서 EnergyFlow 대체용으로 사용 가능.
// IIFE 닫기 직전에서 window.IntegratedKineticDiagram 으로 export됨.
function IntegratedKineticDiagram({ energy, precision }) {
  if (!energy && !precision) return null;
  const E = energy || {};
  const P = precision || {};
  const { etiPT, etiTA, leakPct } = E;

  // ─── v8 — 파란색(좋음) ↔ 빨간색(나쁨) 그라데이션 ───
  // 사용자 요청: "에너지 흐름이 좋으면 파란색, 안 좋으면 빨간색"
  function stageStatus(eti, eliteThr, midThr) {
    if (eti == null) return { tier: 'none', color: '#475569', dark: '#1e293b', label: '미측정' };
    if (eti >= eliteThr) return { tier: 'elite',  color: '#3b82f6', dark: '#1e40af', label: '우수' };  // 파랑
    if (eti >= midThr)   return { tier: 'mid',    color: '#a78bfa', dark: '#6d28d9', label: '보통' };  // 보라(중간)
    return                       { tier: 'leak',  color: '#ef4444', dark: '#7f1d1d', label: '누수' };  // 빨강
  }
  const ptC = stageStatus(etiPT, 1.5, 1.3);
  const taC = stageStatus(etiTA, 1.7, 1.4);
  const ptLeak = ptC.tier === 'leak';
  const taLeak = taC.tier === 'leak';
  const uid = useMemo(() => Math.random().toString(36).slice(2, 8), []);

  // Precision metrics
  const {
    elbowEff,
    cockPowerWPerKg,
    transferTA_KE,
    legAsymmetry,
    peakPivotHipVel,
    peakStrideHipVel,
    // ⭐ v8 신규 — 사용자 요청 변인 (이전 로직에서 가져옴)
    kneeCollapseDeg,    // 무릎 무너짐 (FC→BR 굴곡 변화량, 양수=무너짐)
    kneeSscMs,          // 무릎 SSC stretch→shortening 전환 시간 (ms)
    flyingOpenDeg,      // 플라잉오픈 (FC 시점 trunk rotation)
    trunkFlexAtBRDeg,   // 릴리즈 시 몸통 전방 굴곡 (°)
    trunkFlexAtFCDeg    // ⭐ v10 — FC 시점 몸통 전방 굴곡 (음수=뒤로 젖힘=좋음, 양수=앞으로 굽힘=나쁨)
  } = P;

  // 파랑 ↔ 빨강 그라데이션 (사용자 요청)
  const toneLowerBetter = (val, [eliteT, normalT, midT]) =>
    val == null ? 'none' : val < eliteT ? 'elite' : val < normalT ? 'good' : val < midT ? 'mid' : 'bad';
  const toneHigherBetter = (val, [eliteT, normalT, midT]) =>
    val == null ? 'none' : val >= eliteT ? 'elite' : val >= normalT ? 'good' : val >= midT ? 'mid' : 'bad';
  // 범위 변인 — 적정 범위 내 = elite, 가까이 = good, 멀리 = mid/bad
  const toneRange = (val, eliteRange, goodRange) => {
    if (val == null) return 'none';
    const [eLo, eHi] = eliteRange;
    if (val >= eLo && val <= eHi) return 'elite';
    const [gLo, gHi] = goodRange;
    if (val >= gLo && val <= gHi) return 'good';
    const off = Math.min(Math.abs(val - gLo), Math.abs(val - gHi));
    return off < (gHi - gLo) ? 'mid' : 'bad';
  };
  const TONES = {
    elite: { color: '#3b82f6', text: '우수' },     // 파랑 — 흐름 좋음
    good:  { color: '#60a5fa', text: '양호' },     // 옅은 파랑
    mid:   { color: '#a78bfa', text: '보통' },     // 보라
    bad:   { color: '#ef4444', text: '부족' },     // 빨강 — 흐름 나쁨
    none:  { color: '#475569', text: '미측정' }
  };
  const elbowTone    = toneLowerBetter(elbowEff,        [2.5, 3.5, 4.0]);
  const shoulderTone = toneHigherBetter(cockPowerWPerKg, [30, 22, 15]);
  const trunkTone    = toneHigherBetter(transferTA_KE,   [2.5, 1.7, 1.0]);
  const asymTone     = legAsymmetry == null ? 'none'
                     : (legAsymmetry >= 1.0 && legAsymmetry <= 2.5) ? 'good'
                     : 'mid';
  // ⭐ v8 신규 변인 톤
  // 무릎 무너짐: -15~-5° = elite(블록), -5~+5° = good, +5~+15° = mid, > +15° = bad
  const kneeCollapseTone = kneeCollapseDeg == null ? 'none'
                         : (kneeCollapseDeg >= -15 && kneeCollapseDeg <= -5) ? 'elite'
                         : (kneeCollapseDeg >= -5 && kneeCollapseDeg <= 5) ? 'good'
                         : (kneeCollapseDeg > 5 && kneeCollapseDeg <= 15) ? 'mid'
                         : 'bad';
  // SSC: < 150ms = elite, 150-200 = good, 200-250 = mid, > 250 = bad
  const kneeSscTone = toneLowerBetter(kneeSscMs, [150, 200, 250]);
  // 플라잉오픈: < 5° = elite, 5-10° = good, 10-15° = mid, > 15° = bad
  const flyingOpenTone = toneLowerBetter(flyingOpenDeg, [5, 10, 15]);
  // 몸통 전방 굴곡 (범위 변인): 35-45° = elite, 25-55° = good
  const trunkFlexTone = toneRange(trunkFlexAtBRDeg, [35, 45], [25, 55]);
  // ⭐ v10 — FC 시점 몸통 전방 굴곡: 직립 또는 약간 뒤로 젖힘이 좋음
  //   ≤ -5° (5°+ 뒤로 젖힘) = elite — 가속거리 충분히 확보
  //   -5° ~ +5° (직립) = good — 정상 자세
  //   +5° ~ +15° (살짝 앞으로) = mid — 가속거리 손실 시작
  //   > +15° (이미 앞으로 무너짐) = bad — FC 시점에 이미 굽혀짐
  const trunkFlexAtFCTone = trunkFlexAtFCDeg == null ? 'none'
    : trunkFlexAtFCDeg <= -5 ? 'elite'
    : trunkFlexAtFCDeg <= 5  ? 'good'
    : trunkFlexAtFCDeg <= 15 ? 'mid'
    : 'bad';

  // Keypoints — EnergyFlow base pose with throwing arm in late-cocking/MER
  // (matches Cornell #22 reference photo): elbow at head height, forearm
  // pointing UP, hand/ball above head with laid-back wrist.
  const K = {
    head:     [470, 115],
    neck:     [478, 153],
    trunkC:   [482, 224],   // v78 — trunk center (mid-spine, between pelvis and shoulders) for energy path
    rShoulder:[520, 177],
    lShoulder:[438, 173],
    rElbow:   [580, 177],   // horizontal upper arm (level with shoulder)
    rWrist:   [565, 100],   // forearm UP from elbow (laid back)
    ball:     [540, 80],    // ball just past wrist, above head
    lElbow:   [410, 215],   // glove arm bent, elbow tucked
    lWrist:   [455, 195],   // glove hand UP near chest level
    pelvisR:  [506, 295],
    pelvisL:  [446, 295],
    pelvisC:  [476, 295],
    rKnee:    [556, 373],
    rAnkle:   [620, 427],
    lKnee:    [370, 399],
    lAnkle:   [310, 487],   // stride foot landed forward (extended)
    lToe:     [268, 489],
    rToe:     [658, 435]
  };

  // v77 — Full kinetic chain energy path with BOTH legs:
  //   Pivot leg (back/push-off foot): rAnkle → rKnee → pelvisC
  //   Stride leg (front/landing foot): lAnkle → lKnee → pelvisC
  //   Both legs contribute to ground reaction force → pelvis rotation.
  //   From pelvis, single path: pelvis → trunk → shoulder → elbow → wrist → ball
  //
  // Biomechanical rationale (Aguinaldo 2007, Howenstein 2019):
  //   - Pivot leg drives initial pelvis rotation via push-off + ground reaction
  //   - Stride leg blocks at FC, decelerating pelvis to drive trunk rotation
  //   - Both feet act as the kinetic chain's primary energy source
  const energyPathPivotLeg = `
    M ${K.rAnkle[0]} ${K.rAnkle[1]}
    L ${K.rKnee[0]} ${K.rKnee[1]}
    L ${K.pelvisC[0]} ${K.pelvisC[1]}
  `;
  const energyPathStrideLeg = `
    M ${K.lAnkle[0]} ${K.lAnkle[1]}
    L ${K.lKnee[0]} ${K.lKnee[1]}
    L ${K.pelvisC[0]} ${K.pelvisC[1]}
  `;
  const energyPathUpperChain = `
    M ${K.pelvisC[0]} ${K.pelvisC[1]}
    L ${K.trunkC[0]} ${K.trunkC[1]}
    L ${K.rShoulder[0]} ${K.rShoulder[1]}
    L ${K.rElbow[0]} ${K.rElbow[1]}
    L ${K.rWrist[0]} ${K.rWrist[1]}
    L ${K.ball[0]} ${K.ball[1]}
  `;

  return (
    <div className="energy-silhouette">
      <svg viewBox="-210 0 1150 560" className="silhouette-svg" role="img" aria-label="키네틱 체인 통합 마네킹">
        <defs>
          <linearGradient id={`ik-bg-${uid}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#0b1220" stopOpacity="0"/>
            <stop offset="1" stopColor="#0b1220" stopOpacity="0.35"/>
          </linearGradient>
          <linearGradient id={`ik-energy-${uid}`} gradientUnits="userSpaceOnUse"
            x1={K.lAnkle[0]} y1={K.lAnkle[1]} x2={K.ball[0]} y2={K.ball[1]}>
            <stop offset="0%"   stopColor="#22d3ee"/>
            <stop offset="28%"  stopColor={ptC.color}/>
            <stop offset="55%"  stopColor={taC.color}/>
            <stop offset="85%"  stopColor={taC.color}/>
            <stop offset="100%" stopColor={taC.dark}/>
          </linearGradient>
          {/* v77 — Pivot leg gradient (back foot → pelvis): cyan ground reaction → ptC color at pelvis */}
          <linearGradient id={`ik-energy-pivot-${uid}`} gradientUnits="userSpaceOnUse"
            x1={K.rAnkle[0]} y1={K.rAnkle[1]} x2={K.pelvisC[0]} y2={K.pelvisC[1]}>
            <stop offset="0%"   stopColor="#22d3ee"/>
            <stop offset="100%" stopColor={ptC.color}/>
          </linearGradient>
          {/* v77 — Stride leg gradient (front foot → pelvis): cyan ground reaction → ptC color */}
          <linearGradient id={`ik-energy-stride-${uid}`} gradientUnits="userSpaceOnUse"
            x1={K.lAnkle[0]} y1={K.lAnkle[1]} x2={K.pelvisC[0]} y2={K.pelvisC[1]}>
            <stop offset="0%"   stopColor="#22d3ee"/>
            <stop offset="100%" stopColor={ptC.color}/>
          </linearGradient>
          {/* v77 — Upper chain gradient (pelvis → ball): ptC at pelvis through taC at arm */}
          <linearGradient id={`ik-energy-upper-${uid}`} gradientUnits="userSpaceOnUse"
            x1={K.pelvisC[0]} y1={K.pelvisC[1]} x2={K.ball[0]} y2={K.ball[1]}>
            <stop offset="0%"   stopColor={ptC.color}/>
            <stop offset="40%"  stopColor={taC.color}/>
            <stop offset="85%"  stopColor={taC.color}/>
            <stop offset="100%" stopColor={taC.dark}/>
          </linearGradient>
          <filter id={`ik-glow-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <radialGradient id={`ik-leak-${uid}`}>
            <stop offset="0%" stopColor="#fee2e2" stopOpacity="0.95"/>
            <stop offset="40%" stopColor="#ef4444" stopOpacity="0.7"/>
            <stop offset="100%" stopColor="#7f1d1d" stopOpacity="0"/>
          </radialGradient>
          <radialGradient id={`ik-mSphere-${uid}`} cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#f1f5f9"/>
            <stop offset="45%" stopColor="#cbd5e1"/>
            <stop offset="85%" stopColor="#64748b"/>
            <stop offset="100%" stopColor="#334155"/>
          </radialGradient>
          <linearGradient id={`ik-mLimb-${uid}`} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#e2e8f0"/>
            <stop offset="50%" stopColor="#94a3b8"/>
            <stop offset="100%" stopColor="#475569"/>
          </linearGradient>
          <linearGradient id={`ik-mLimbD-${uid}`} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#94a3b8"/>
            <stop offset="55%" stopColor="#64748b"/>
            <stop offset="100%" stopColor="#1e293b"/>
          </linearGradient>
          <linearGradient id={`ik-mTorso-${uid}`} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#e2e8f0"/>
            <stop offset="40%" stopColor="#94a3b8"/>
            <stop offset="100%" stopColor="#334155"/>
          </linearGradient>
          <radialGradient id={`ik-mJoint-${uid}`} cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#f8fafc"/>
            <stop offset="60%" stopColor="#94a3b8"/>
            <stop offset="100%" stopColor="#334155"/>
          </radialGradient>
          <radialGradient id={`ik-aoShadow-${uid}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#000" stopOpacity="0.45"/>
            <stop offset="100%" stopColor="#000" stopOpacity="0"/>
          </radialGradient>
          <marker id={`ik-arrow-${uid}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 Z" fill="currentColor"/>
          </marker>
          <path id={`ik-armPath-${uid}`}
                d={`M ${K.rShoulder[0]} ${K.rShoulder[1]} L ${K.rElbow[0]} ${K.rElbow[1]} L ${K.rWrist[0]} ${K.rWrist[1]} L ${K.ball[0]} ${K.ball[1]}`}/>
        </defs>

        {/* Background + ground + foot shadow */}
        <rect x="0" y="0" width="800" height="560" fill={`url(#ik-bg-${uid})`}/>
        <line x1="40" y1="498" x2="760" y2="498" stroke="#2a3a5a" strokeWidth="1.5" strokeDasharray="3 6"/>
        <ellipse cx={(K.lAnkle[0] + K.rAnkle[0]) / 2} cy="508" rx="180" ry="12" fill={`url(#ik-aoShadow-${uid})`}/>

        {/* === BODY SILHOUETTE === */}
        {/* Glove-side arm (left, dark) */}
        <g>
          <line x1={K.lShoulder[0]} y1={K.lShoulder[1]} x2={K.lElbow[0]} y2={K.lElbow[1]}
                stroke={`url(#ik-mLimbD-${uid})`} strokeWidth="22" strokeLinecap="round"/>
          <circle cx={K.lElbow[0]} cy={K.lElbow[1]} r="12" fill={`url(#ik-mJoint-${uid})`}/>
          <line x1={K.lElbow[0]} y1={K.lElbow[1]} x2={K.lWrist[0]} y2={K.lWrist[1]}
                stroke={`url(#ik-mLimbD-${uid})`} strokeWidth="19" strokeLinecap="round"/>
          <circle cx={K.lWrist[0]} cy={K.lWrist[1]} r="13" fill={`url(#ik-mSphere-${uid})`}/>
        </g>

        {/* Pivot leg (right, back, dark) */}
        <g>
          <line x1={K.pelvisR[0] - 2} y1={K.pelvisR[1]} x2={K.rKnee[0]} y2={K.rKnee[1]}
                stroke={`url(#ik-mLimbD-${uid})`} strokeWidth="34" strokeLinecap="round"/>
          <circle cx={K.rKnee[0]} cy={K.rKnee[1]} r="17" fill={`url(#ik-mJoint-${uid})`}/>
          <line x1={K.rKnee[0]} y1={K.rKnee[1]} x2={K.rAnkle[0]} y2={K.rAnkle[1]}
                stroke={`url(#ik-mLimbD-${uid})`} strokeWidth="26" strokeLinecap="round"/>
          <circle cx={K.rAnkle[0]} cy={K.rAnkle[1]} r="12" fill={`url(#ik-mJoint-${uid})`}/>
        </g>

        {/* Stride leg (left, front, light) */}
        <g>
          <line x1={K.pelvisL[0] + 2} y1={K.pelvisL[1]} x2={K.lKnee[0]} y2={K.lKnee[1]}
                stroke={`url(#ik-mLimb-${uid})`} strokeWidth="34" strokeLinecap="round"/>
          <circle cx={K.lKnee[0]} cy={K.lKnee[1]} r="17" fill={`url(#ik-mJoint-${uid})`}/>
          <line x1={K.lKnee[0]} y1={K.lKnee[1]} x2={K.lAnkle[0]} y2={K.lAnkle[1]}
                stroke={`url(#ik-mLimb-${uid})`} strokeWidth="26" strokeLinecap="round"/>
          <circle cx={K.lAnkle[0]} cy={K.lAnkle[1]} r="12" fill={`url(#ik-mJoint-${uid})`}/>
        </g>

        {/* Torso */}
        <line x1={K.lShoulder[0] + 2} y1={K.lShoulder[1] + 4}
              x2={K.rShoulder[0] - 2} y2={K.rShoulder[1] + 4}
              stroke={`url(#ik-mLimb-${uid})`} strokeWidth="34" strokeLinecap="round"/>
        <path d={`
          M ${K.lShoulder[0] + 4} ${K.lShoulder[1] + 8}
          C ${K.lShoulder[0] - 2} ${K.lShoulder[1] + 50}, ${K.pelvisL[0] + 2} ${K.pelvisL[1] - 68}, ${K.pelvisL[0] + 6} ${K.pelvisL[1] - 20}
          L ${K.pelvisR[0] - 6} ${K.pelvisR[1] - 20}
          C ${K.pelvisR[0] - 2} ${K.pelvisR[1] - 68}, ${K.rShoulder[0] + 2} ${K.rShoulder[1] + 50}, ${K.rShoulder[0] - 4} ${K.rShoulder[1] + 8}
          Z
        `} fill={`url(#ik-mTorso-${uid})`} stroke="#1e293b" strokeWidth="1.2"/>
        <path d={`
          M ${K.pelvisL[0] + 6} ${K.pelvisL[1] - 22}
          C ${K.pelvisL[0] + 2} ${K.pelvisL[1] - 12}, ${K.pelvisL[0] - 2} ${K.pelvisL[1] - 2}, ${K.pelvisL[0] - 6} ${K.pelvisL[1] + 10}
          L ${K.pelvisR[0] + 6} ${K.pelvisR[1] + 10}
          C ${K.pelvisR[0] + 2} ${K.pelvisR[1] - 2}, ${K.pelvisR[0] - 2} ${K.pelvisR[1] - 12}, ${K.pelvisR[0] - 6} ${K.pelvisR[1] - 22}
          Z
        `} fill={`url(#ik-mTorso-${uid})`} stroke="#1e293b" strokeWidth="1"/>
        <circle cx={K.lShoulder[0]} cy={K.lShoulder[1]} r="15" fill={`url(#ik-mJoint-${uid})`}/>
        <circle cx={K.rShoulder[0]} cy={K.rShoulder[1]} r="16" fill={`url(#ik-mJoint-${uid})`}/>

        {/* Neck + head */}
        <line x1={K.neck[0] - 2} y1={K.neck[1] - 6} x2={K.neck[0] + 2} y2={K.neck[1] + 8}
              stroke={`url(#ik-mLimb-${uid})`} strokeWidth="16" strokeLinecap="round"/>
        <circle cx={K.head[0]} cy={K.head[1]} r="28" fill={`url(#ik-mSphere-${uid})`} stroke="#1e293b" strokeWidth="1"/>
        <path d={`M ${K.head[0] - 28} ${K.head[1] - 4} Q ${K.head[0] - 10} ${K.head[1] + 10} ${K.head[0] + 22} ${K.head[1] + 4}`}
              stroke="#475569" strokeWidth="1" strokeOpacity="0.4" fill="none"/>

        {/* Throwing arm (right) — Cornell late-cocking pose */}
        <g>
          <line x1={K.rShoulder[0]} y1={K.rShoulder[1]} x2={K.rElbow[0]} y2={K.rElbow[1]}
                stroke={`url(#ik-mLimb-${uid})`} strokeWidth="26" strokeLinecap="round"/>
          <circle cx={K.rElbow[0]} cy={K.rElbow[1]} r="13" fill={`url(#ik-mJoint-${uid})`}/>
          <line x1={K.rElbow[0]} y1={K.rElbow[1]} x2={K.rWrist[0]} y2={K.rWrist[1]}
                stroke={`url(#ik-mLimb-${uid})`} strokeWidth="20" strokeLinecap="round"/>
          <circle cx={K.rWrist[0]} cy={K.rWrist[1]} r="11" fill={`url(#ik-mJoint-${uid})`}/>
        </g>

        {/* === FULL KINETIC CHAIN ENERGY PATH === */}
        {/* v77 — Both legs + upper chain */}
        {/*   Pivot leg (back/push-off): rAnkle → rKnee → pelvis */}
        {/*   Stride leg (front/landing): lAnkle → lKnee → pelvis */}
        {/*   Upper chain: pelvis → trunk → shoulder → elbow → wrist → ball */}
        {energy && (
          <>
            {/* Underlay shadows for all three paths */}
            <path d={energyPathPivotLeg} stroke="#0f1a30" strokeOpacity="0.55" strokeWidth="14"
                  fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            <path d={energyPathStrideLeg} stroke="#0f1a30" strokeOpacity="0.55" strokeWidth="14"
                  fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            <path d={energyPathUpperChain} stroke="#0f1a30" strokeOpacity="0.55" strokeWidth="14"
                  fill="none" strokeLinecap="round" strokeLinejoin="round"/>

            {/* Pivot leg energy stream (back foot pushes off → drives pelvis rotation) */}
            <path d={energyPathPivotLeg} stroke={`url(#ik-energy-pivot-${uid})`} strokeWidth="9"
                  fill="none" strokeLinecap="round" strokeLinejoin="round"
                  strokeDasharray="20 12" opacity="0.95"
                  filter={`url(#ik-glow-${uid})`}>
              <animate attributeName="stroke-dashoffset" from="32" to="0" dur="1.4s" repeatCount="indefinite"/>
            </path>

            {/* Stride leg energy stream (front foot blocks → pelvis decelerates → trunk accelerates) */}
            <path d={energyPathStrideLeg} stroke={`url(#ik-energy-stride-${uid})`} strokeWidth="9"
                  fill="none" strokeLinecap="round" strokeLinejoin="round"
                  strokeDasharray="20 12" opacity="0.95"
                  filter={`url(#ik-glow-${uid})`}>
              <animate attributeName="stroke-dashoffset" from="32" to="0" dur="1.4s" repeatCount="indefinite"/>
            </path>

            {/* Upper chain energy stream (pelvis → trunk → arm → ball) */}
            <path d={energyPathUpperChain} stroke={`url(#ik-energy-upper-${uid})`} strokeWidth="9"
                  fill="none" strokeLinecap="round" strokeLinejoin="round"
                  strokeDasharray="20 12" opacity="0.95"
                  filter={`url(#ik-glow-${uid})`}>
              <animate attributeName="stroke-dashoffset" from="32" to="0" dur="1.4s" repeatCount="indefinite"/>
            </path>

            {/* Pelvis convergence point — visualize where both legs' energy combines */}
            <circle cx={K.pelvisC[0]} cy={K.pelvisC[1]} r="11" fill={ptC.color} opacity="0.4"
                    filter={`url(#ik-glow-${uid})`}>
              <animate attributeName="r" values="9;13;9" dur="1.4s" repeatCount="indefinite"/>
              <animate attributeName="opacity" values="0.3;0.6;0.3" dur="1.4s" repeatCount="indefinite"/>
            </circle>

            {/* Leak indicators on stages with weak transfer */}
            {ptLeak && (
              <g>
                <circle cx={(K.pelvisC[0] + K.trunkC[0]) / 2} cy={(K.pelvisC[1] + K.trunkC[1]) / 2} r="38" fill={`url(#ik-leak-${uid})`}>
                  <animate attributeName="r" values="32;42;32" dur="1.4s" repeatCount="indefinite"/>
                  <animate attributeName="opacity" values="0.85;0.45;0.85" dur="1.4s" repeatCount="indefinite"/>
                </circle>
                <text x={(K.pelvisC[0] + K.trunkC[0]) / 2}
                      y={(K.pelvisC[1] + K.trunkC[1]) / 2 + 4}
                      fill="#fef2f2" fontSize="10" fontWeight="700" textAnchor="middle">⚠ 누수</text>
              </g>
            )}
            {taLeak && (
              <g>
                <circle cx={(K.rShoulder[0] + K.rElbow[0]) / 2} cy={(K.rShoulder[1] + K.rElbow[1]) / 2} r="38" fill={`url(#ik-leak-${uid})`}>
                  <animate attributeName="r" values="32;42;32" dur="1.4s" repeatCount="indefinite"/>
                  <animate attributeName="opacity" values="0.85;0.45;0.85" dur="1.4s" repeatCount="indefinite"/>
                </circle>
              </g>
            )}
          </>
        )}

        {/* === ④ de Swart leg-asymmetry rings (drawn under indicators) === */}
        {legAsymmetry != null && (() => {
          const pivotR  = Math.min(28, 10 + (peakPivotHipVel  || 0) / 35);
          const strideR = Math.min(28, 10 + (peakStrideHipVel || 0) / 35);
          return (
            <g>
              <circle cx={K.rKnee[0]} cy={K.rKnee[1]} r={pivotR + 4} fill="none" stroke="#3b82f6" strokeWidth="2.5" opacity="0.85"/>
              <circle cx={K.rKnee[0]} cy={K.rKnee[1]} r={pivotR} fill="#3b82f6" opacity="0.4"/>
              <circle cx={K.lKnee[0]} cy={K.lKnee[1]} r={strideR + 4} fill="none" stroke="#a855f7" strokeWidth="2.5" opacity="0.85"/>
              <circle cx={K.lKnee[0]} cy={K.lKnee[1]} r={strideR} fill="#a855f7" opacity="0.4"/>
            </g>
          );
        })()}

        {/* === ③ Aguinaldo trunk → arm amplification arrow === */}
        {transferTA_KE != null && (() => {
          const arrowWidth = Math.min(14, 4 + transferTA_KE * 2.5);
          const startX = K.pelvisC[0] + 10, startY = K.pelvisC[1] - 30;
          const endX   = K.rShoulder[0] - 10, endY = K.rShoulder[1] + 12;
          return (
            <g style={{ color: TONES[trunkTone].color }}>
              <line x1={startX} y1={startY} x2={endX} y2={endY}
                    stroke="currentColor" strokeWidth={arrowWidth} strokeLinecap="round" opacity="0.55"
                    markerEnd={`url(#ik-arrow-${uid})`}/>
            </g>
          );
        })()}

        {/* === ② Wasserberger cocking-phase shoulder power (pulse ring) === */}
        {cockPowerWPerKg != null && (
          <g style={{ color: TONES[shoulderTone].color }}>
            <circle cx={K.rShoulder[0]} cy={K.rShoulder[1]} r="36" fill="none" stroke="currentColor" strokeWidth="2.5" opacity="0.55">
              <animate attributeName="r" values="28;48;28" dur="1.6s" repeatCount="indefinite"/>
              <animate attributeName="opacity" values="0.7;0;0.7" dur="1.6s" repeatCount="indefinite"/>
            </circle>
            <circle cx={K.rShoulder[0]} cy={K.rShoulder[1]} r="28" fill="none" stroke="currentColor" strokeWidth="3.5" opacity="0.9"/>
          </g>
        )}

        {/* === ① Howenstein elbow load (pulse) === */}
        {elbowEff != null && (
          <g style={{ color: TONES[elbowTone].color }}>
            <circle cx={K.rElbow[0]} cy={K.rElbow[1]} r="30" fill="none" stroke="currentColor" strokeWidth="2.5" opacity="0.6">
              <animate attributeName="r" values="22;36;22" dur="1.8s" repeatCount="indefinite"/>
              <animate attributeName="opacity" values="0.85;0.15;0.85" dur="1.8s" repeatCount="indefinite"/>
            </circle>
            <circle cx={K.rElbow[0]} cy={K.rElbow[1]} r="13" fill="currentColor" opacity="0.95"/>
          </g>
        )}

        {/* Ball at release point */}
        <circle cx={K.ball[0]} cy={K.ball[1]} r="9" fill="#f8fafc" stroke="#1e293b" strokeWidth="1.2"/>
        <path d={`M ${K.ball[0] - 6} ${K.ball[1] - 3} Q ${K.ball[0]} ${K.ball[1] - 8} ${K.ball[0] + 6} ${K.ball[1] - 3}`} stroke="#ef4444" strokeWidth="1.2" fill="none"/>
        <path d={`M ${K.ball[0] - 6} ${K.ball[1] + 3} Q ${K.ball[0]} ${K.ball[1] + 8} ${K.ball[0] + 6} ${K.ball[1] + 3}`} stroke="#ef4444" strokeWidth="1.2" fill="none"/>

        {/* === ANNOTATIONS / LABEL CARDS === */}
        {/* ① 팔꿈치 부담 — top right */}
        {elbowEff != null && (
          <g>
            <line x1={K.rElbow[0] + 14} y1={K.rElbow[1] - 4} x2="612" y2="78" stroke={TONES[elbowTone].color} strokeWidth="1.2" strokeDasharray="2 3" opacity="0.7"/>
            <rect x="588" y="44" width="184" height="62" rx="6" fill="#0b1220" stroke={TONES[elbowTone].color} strokeOpacity="0.7"/>
            <text x="680" y="60" fill={TONES[elbowTone].color} fontSize="11" fontWeight="700" textAnchor="middle" letterSpacing="0.4">① 팔꿈치 부담</text>
            <text x="680" y="80" fill={TONES[elbowTone].color} fontSize="15" fontWeight="800" textAnchor="middle">{elbowEff.toFixed(2)} N·m/(m/s)</text>
            <text x="680" y="98" fill={TONES[elbowTone].color} fontSize="10" textAnchor="middle">{TONES[elbowTone].text} · 낮을수록 좋음</text>
          </g>
        )}

        {/* ② 어깨 폭발력 — top left (사용자 요청: 위로) */}
        {cockPowerWPerKg != null && (
          <g>
            <line x1={K.rShoulder[0] - 22} y1={K.rShoulder[1] - 4} x2="226" y2="78" stroke={TONES[shoulderTone].color} strokeWidth="1.2" strokeDasharray="2 3" opacity="0.7"/>
            <rect x="40" y="44" width="184" height="62" rx="6" fill="#0b1220" stroke={TONES[shoulderTone].color} strokeOpacity="0.7"/>
            <text x="132" y="60" fill={TONES[shoulderTone].color} fontSize="11" fontWeight="700" textAnchor="middle" letterSpacing="0.4">② 어깨 폭발력</text>
            <text x="132" y="80" fill={TONES[shoulderTone].color} fontSize="15" fontWeight="800" textAnchor="middle">{cockPowerWPerKg.toFixed(1)} W/kg</text>
            <text x="132" y="98" fill={TONES[shoulderTone].color} fontSize="10" textAnchor="middle">{TONES[shoulderTone].text} · 높을수록 좋음</text>
          </g>
        )}

        {/* ETI(T→A) — Trunk→Arm energy transfer (right of shoulder, between shoulder and elbow card) */}
        {etiTA != null && (
          <g>
            <line x1={K.rShoulder[0] + 22} y1={K.rShoulder[1] + 6} x2="612" y2="178" stroke={taC.color} strokeWidth="1.2" strokeDasharray="2 3" opacity="0.7"/>
            <rect x="588" y="144" width="184" height="62" rx="6" fill="#0b1220" stroke={taC.color} strokeOpacity="0.7"/>
            <text x="680" y="160" fill={taC.color} fontSize="11" fontWeight="700" textAnchor="middle" letterSpacing="0.4">몸통→팔 전달 (T→A)</text>
            <text x="680" y="180" fill={taC.color} fontSize="15" fontWeight="800" textAnchor="middle">ETI {etiTA.toFixed(2)}</text>
            <text x="680" y="198" fill={taC.color} fontSize="10" fontWeight={taLeak ? 700 : 500} textAnchor="middle">
              {taC.label}
            </text>
          </g>
        )}

        {/* ③ 몸통→팔 힘 배율 — middle right (Aguinaldo) */}
        {transferTA_KE != null && (
          <g>
            <line x1={K.pelvisC[0] + 60} y1={K.pelvisC[1] - 60} x2="612" y2="266" stroke={TONES[trunkTone].color} strokeWidth="1.2" strokeDasharray="2 3" opacity="0.7"/>
            <rect x="588" y="232" width="184" height="62" rx="6" fill="#0b1220" stroke={TONES[trunkTone].color} strokeOpacity="0.7"/>
            <text x="680" y="248" fill={TONES[trunkTone].color} fontSize="11" fontWeight="700" textAnchor="middle" letterSpacing="0.4">③ 몸통→팔 힘 배율</text>
            <text x="680" y="268" fill={TONES[trunkTone].color} fontSize="15" fontWeight="800" textAnchor="middle">{transferTA_KE.toFixed(2)} 배</text>
            <text x="680" y="286" fill={TONES[trunkTone].color} fontSize="10" textAnchor="middle">{TONES[trunkTone].text} · 클수록 좋음</text>
          </g>
        )}

        {/* ETI(P→T) — Pelvis→Trunk transfer (사용자 요청: 위로 - 어깨 폭발력 바로 아래) */}
        {etiPT != null && (
          <g>
            <line x1={K.pelvisC[0] - 30} y1={K.pelvisC[1] - 30} x2="226" y2="158" stroke={ptC.color} strokeWidth="1.2" strokeDasharray="2 3" opacity="0.7"/>
            <rect x="40" y="124" width="184" height="62" rx="6" fill="#0b1220" stroke={ptC.color} strokeOpacity="0.7"/>
            <text x="132" y="140" fill={ptC.color} fontSize="11" fontWeight="700" textAnchor="middle" letterSpacing="0.4">골반→몸통 전달 (P→T)</text>
            <text x="132" y="160" fill={ptC.color} fontSize="15" fontWeight="800" textAnchor="middle">ETI {etiPT.toFixed(2)}</text>
            <text x="132" y="178" fill={ptC.color} fontSize="10" fontWeight={ptLeak ? 700 : 500} textAnchor="middle">
              {ptC.label}
            </text>
          </g>
        )}

        {/* v79 — REMOVED: ④ 두 다리 균형 (legAsymmetry) box was here.
            The asymmetry is still rendered as the colored rings around feet via de Swart visualization below. */}

        {/* v80 — STRIDE FOOT BLOCK — 회전 에너지 시작점 (with braking-GRF subtitle)
            Stride foot uses BRAKING ground reaction force to amplify rotational energy:
            the front foot decelerates the pelvis at FC, transferring momentum to trunk rotation. */}
        <g>
          <line x1={K.lAnkle[0] - 8} y1={K.lAnkle[1] + 4} x2="240" y2="500" stroke="#a78bfa" strokeWidth="1.2" strokeDasharray="2 3" opacity="0.7"/>
          <rect x="40" y="480" width="218" height="68" rx="6" fill="#0b1220" stroke="#a78bfa" strokeOpacity="0.7"/>
          <text x="149" y="498" fill="#a78bfa" fontSize="10.5" fontWeight="700" textAnchor="middle" letterSpacing="0.4">디딤발 블록</text>
          <text x="149" y="516" fill="#e2e8f0" fontSize="11.5" fontWeight="700" textAnchor="middle">회전 에너지 시작점</text>
          <text x="149" y="535" fill="#94a3b8" fontSize="9.5" textAnchor="middle">제동 지면반력 이용 회전 에너지 증폭</text>
        </g>

        {/* v80 — PIVOT FOOT BLOCK — 전진 에너지 시작점 (with propulsive-GRF subtitle)
            Pivot foot uses PROPULSIVE ground reaction force to generate linear stride energy:
            push-off from rubber drives forward translation toward the plate. */}
        <g>
          <line x1={K.rAnkle[0] + 14} y1={K.rAnkle[1] + 6} x2="660" y2="472" stroke="#3b82f6" strokeWidth="1.2" strokeDasharray="2 3" opacity="0.7"/>
          <rect x="540" y="472" width="232" height="68" rx="6" fill="#0b1220" stroke="#3b82f6" strokeOpacity="0.7"/>
          <text x="656" y="490" fill="#3b82f6" fontSize="10.5" fontWeight="700" textAnchor="middle" letterSpacing="0.4">축발 추진</text>
          <text x="656" y="508" fill="#e2e8f0" fontSize="11.5" fontWeight="700" textAnchor="middle">전진 에너지 시작점</text>
          <text x="656" y="527" fill="#94a3b8" fontSize="9.5" textAnchor="middle">추진 지면반력으로 스트라이드 에너지 생성</text>
        </g>

        {/* ⭐ v9 — 무릎 무너짐 카드 (디딤발 블록 위 · 사용자 요청) */}
        {kneeCollapseDeg != null && (
          <g>
            <line x1={K.lKnee[0] - 8} y1={K.lKnee[1] - 4} x2="240" y2="350" stroke={TONES[kneeCollapseTone].color} strokeWidth="1.2" strokeDasharray="2 3" opacity="0.7"/>
            <rect x="40" y="320" width="218" height="62" rx="6" fill="#0b1220" stroke={TONES[kneeCollapseTone].color} strokeOpacity="0.7"/>
            <text x="149" y="336" fill={TONES[kneeCollapseTone].color} fontSize="11" fontWeight="700" textAnchor="middle" letterSpacing="0.4">무릎 무너짐</text>
            <text x="149" y="356" fill={TONES[kneeCollapseTone].color} fontSize="15" fontWeight="800" textAnchor="middle">
              {kneeCollapseDeg > 0 ? '+' : ''}{kneeCollapseDeg.toFixed(1)}°
            </text>
            <text x="149" y="374" fill={TONES[kneeCollapseTone].color} fontSize="10" textAnchor="middle">
              {kneeCollapseDeg > 5 ? '주저앉음 · 보강 필요'
                : kneeCollapseDeg > -5 ? '뻣뻣 · 흡수 부족'
                : kneeCollapseDeg >= -20 ? '정상 블록'
                : '과도한 신전'}
            </text>
          </g>
        )}

        {/* ⭐ v9 — 무릎 SSC 활용 카드 (디딤발 블록 위 · 무릎 무너짐 카드 아래) */}
        {kneeSscMs != null && (
          <g>
            <line x1={K.lKnee[0] - 4} y1={K.lKnee[1] + 4} x2="258" y2="430" stroke={TONES[kneeSscTone].color} strokeWidth="1.2" strokeDasharray="2 3" opacity="0.7"/>
            <rect x="40" y="398" width="218" height="62" rx="6" fill="#0b1220" stroke={TONES[kneeSscTone].color} strokeOpacity="0.7"/>
            <text x="149" y="414" fill={TONES[kneeSscTone].color} fontSize="11" fontWeight="700" textAnchor="middle" letterSpacing="0.4">무릎 SSC 활용</text>
            <text x="149" y="434" fill={TONES[kneeSscTone].color} fontSize="15" fontWeight="800" textAnchor="middle">
              {kneeSscMs.toFixed(0)} ms
            </text>
            <text x="149" y="452" fill={TONES[kneeSscTone].color} fontSize="10" textAnchor="middle">
              {TONES[kneeSscTone].text} · 짧을수록 좋음 (탄성 회수)
            </text>
          </g>
        )}

        {/* SSC 측정 불가 시 안내 카드 (RSI-mod로 추정 가능) */}
        {kneeSscMs == null && kneeCollapseDeg != null && (
          <g>
            <rect x="40" y="398" width="218" height="62" rx="6" fill="#0b1220" stroke="#475569" strokeOpacity="0.7" strokeDasharray="3 3"/>
            <text x="149" y="414" fill="#94a3b8" fontSize="11" fontWeight="700" textAnchor="middle" letterSpacing="0.4">무릎 SSC 활용</text>
            <text x="149" y="434" fill="#94a3b8" fontSize="13" fontWeight="700" textAnchor="middle">측정 불가</text>
            <text x="149" y="452" fill="#64748b" fontSize="9" textAnchor="middle">CMJ RSI-mod로 간접 평가</text>
          </g>
        )}

        {/* ⭐ v15 — LEFT-OUTER: 플라잉오픈 (사용자 요청: 더 왼쪽으로 이동) */}
        {flyingOpenDeg != null && (
          <g>
            <line x1={K.pelvisC[0] - 30} y1={K.pelvisC[1] - 10} x2="0" y2="240" stroke={TONES[flyingOpenTone].color} strokeWidth="1.2" strokeDasharray="2 3" opacity="0.7"/>
            <rect x="-200" y="220" width="200" height="64" rx="6" fill="#0b1220" stroke={TONES[flyingOpenTone].color} strokeOpacity="0.7"/>
            <text x="-100" y="238" fill={TONES[flyingOpenTone].color} fontSize="10.5" fontWeight="700" textAnchor="middle" letterSpacing="0.4">플라잉오픈 (FC)</text>
            <text x="-100" y="258" fill={TONES[flyingOpenTone].color} fontSize="14" fontWeight="800" textAnchor="middle">
              {flyingOpenDeg.toFixed(1)}°
            </text>
            <text x="-100" y="276" fill={TONES[flyingOpenTone].color} fontSize="9.5" textAnchor="middle">
              {TONES[flyingOpenTone].text} · 작을수록 ↑
            </text>
          </g>
        )}

        {/* ⭐ v15 — LEFT-OUTER (플라잉오픈 바로 밑): 몸통 굴곡 @FC (사용자 요청: 이름 변경 + 좌측으로 이동)
            직립 또는 약간 뒤로 젖힌 상태(음수)가 좋음 */}
        {trunkFlexAtFCDeg != null && (
          <g>
            <line x1={K.pelvisC[0] - 30} y1={K.pelvisC[1]} x2="0" y2="336" stroke={TONES[trunkFlexAtFCTone].color} strokeWidth="1.2" strokeDasharray="2 3" opacity="0.7"/>
            <rect x="-200" y="298" width="200" height="76" rx="6" fill="#0b1220" stroke={TONES[trunkFlexAtFCTone].color} strokeOpacity="0.7"/>
            <text x="-100" y="316" fill={TONES[trunkFlexAtFCTone].color} fontSize="10.5" fontWeight="700" textAnchor="middle" letterSpacing="0.4">몸통 굴곡 @FC</text>
            <text x="-100" y="337" fill={TONES[trunkFlexAtFCTone].color} fontSize="15" fontWeight="800" textAnchor="middle">
              {trunkFlexAtFCDeg > 0 ? '+' : ''}{trunkFlexAtFCDeg.toFixed(1)}°
            </text>
            <text x="-100" y="354" fill={TONES[trunkFlexAtFCTone].color} fontSize="9.5" textAnchor="middle">
              {trunkFlexAtFCDeg <= -5 ? '뒤로 젖힘 · 우수'
                : trunkFlexAtFCDeg <= 5  ? '직립 · 양호'
                : trunkFlexAtFCDeg <= 15 ? '약간 앞으로'
                : '이미 앞으로 무너짐'}
            </text>
            <text x="-100" y="367" fill="#64748b" fontSize="8.5" textAnchor="middle">앞발 착지 · 직립~음수 이상적</text>
          </g>
        )}

        {/* v15 — 릴리즈 몸통 굴곡 카드 삭제됨 (사용자 요청) */}

        {/* === Joint markers (key kinematic points) === */}
        <g style={{ pointerEvents: 'none' }}>
          {[
            { p: K.rShoulder, c: '#fbbf24', big: true },
            { p: K.rElbow,    c: '#fbbf24', big: true },
            { p: K.rWrist,    c: '#fbbf24', big: true },
            { p: K.lShoulder, c: '#22d3ee' },
            { p: K.lElbow,    c: '#22d3ee' },
            { p: K.lWrist,    c: '#22d3ee' },
            { p: K.pelvisC,   c: '#a78bfa', big: true },
            { p: K.rKnee,     c: '#22d3ee' },
            { p: K.rAnkle,    c: '#22d3ee' },
            { p: K.lKnee,     c: '#22d3ee' },
            { p: K.lAnkle,    c: '#22d3ee' }
          ].map((j, i) => (
            <g key={`jm-${i}`}>
              <circle cx={j.p[0]} cy={j.p[1]} r={j.big ? 6.5 : 6} fill="#0b1220" stroke="#ffffff" strokeWidth={j.big ? 2 : 1.6} opacity={j.big ? 0.95 : 0.9}/>
              <circle cx={j.p[0]} cy={j.p[1]} r={j.big ? 3.5 : 3} fill={j.c}/>
            </g>
          ))}
        </g>
      </svg>
      {/* v15 — 마네킹 하단 범례 모두 제거 (사용자 요청) */}
    </div>
  );
}

// ----------------- Layback meter -----------------
function LaybackMeter({ deg }) {
  // 3시 위치(오른쪽 수평) = 0°, 반시계방향 → 12시 = 90°, 9시 = 180°, 6시 = 270°
  // 상단 반원 (0° → 90° → 180°) 형태로 220°까지 표시
  const size = 300;
  const cx = size/2, cy = size * 0.78;
  const r = size * 0.38;
  const angle = Math.min(220, Math.max(0, deg));
  const toRad = (a) => (a * Math.PI) / 180;
  // 눈금 각도(degree)를 SVG 좌표 각도로. SVG 좌표에서 3시=0°, 반시계방향은 음수 방향(y축 뒤집힘)
  // 즉, 수학 좌표계 그대로 쓰되 y에 마이너스를 붙여야 반시계방향이 위쪽으로 가게 됨
  const angleToPos = (a) => {
    return [cx + Math.cos(toRad(a)) * r, cy - Math.sin(toRad(a)) * r];
  };
  const arc = (from, to, color, w = 6) => {
    const [x1,y1] = angleToPos(from), [x2,y2] = angleToPos(to);
    const large = Math.abs(to - from) > 180 ? 1 : 0;
    // 화면상 반시계방향으로 호를 그림 (SVG y축 뒤집힘 때문에 sweep=0)
    return <path d={`M ${x1} ${y1} A ${r} ${r} 0 ${large} 0 ${x2} ${y2}`} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round"/>;
  };

  const [needle, setNeedle] = useState(0);
  useEffect(() => {
    const t0 = performance.now();
    const dur = 1400;
    let raf;
    const tick = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - k, 3);
      setNeedle(angle * eased);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [angle]);

  const [nx, ny] = angleToPos(needle);

  return (
    <svg width={size} height={size * 1.15} viewBox={`0 0 ${size} ${size * 1.15}`}>
      <defs>
        <linearGradient id="laybackG" x1="0" x2="1">
          <stop offset="0" stopColor="#2563EB"/>
          <stop offset="1" stopColor="#60a5fa"/>
        </linearGradient>
      </defs>
      {/* track */}
      {arc(0, 220, 'rgba(255,255,255,0.08)', 10)}
      {/* pro band 160-180 */}
      {arc(160, 180, 'rgba(34,197,94,0.7)', 10)}
      {/* needle arc up to current */}
      {arc(0, Math.max(1, needle), 'url(#laybackG)', 10)}
      {/* tick marks */}
      {[0,60,120,180,220].map(t => {
        const [x,y] = angleToPos(t);
        const rOut = r + 16;
        const [xo,yo] = [cx + Math.cos(toRad(t)) * rOut, cy - Math.sin(toRad(t)) * rOut];
        const [xi,yi] = [cx + Math.cos(toRad(t)) * (r-8), cy - Math.sin(toRad(t)) * (r-8)];
        return <g key={t}>
          <line x1={x} y1={y} x2={xi} y2={yi} stroke="rgba(255,255,255,0.18)"/>
          <text x={xo} y={yo + 4} textAnchor="middle" fontSize="12" fontWeight="600" fill="#cbd5e1" fontFamily="Inter">{t}°</text>
        </g>;
      })}
      {/* needle */}
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx={cx} cy={cy} r="6" fill="#fff"/>
    </svg>
  );
}

// ═════════════════════════════════════════════════════════════════
// MechanicsV24Panel — v24 7그룹 변인 카테고리화 표시 (사용자 요청)
//   각 그룹의 가중치, 변인, 측정값, 점수, 학술 근거 표시
// ═════════════════════════════════════════════════════════════════

// ⭐ 변인 사전 (Variable Dictionary)
// 선수가 이해하기 쉬운 개조식 설명 — 정의 · 산출 · 해석 + 학술 근거
const VAR_INFO = {
  // ═════ 구속 메카닉스 (v24 7그룹 — 17 변인) ═════
  etiPT: {
    title: 'ETI P→T (골반→몸통 에너지 효율)',
    definition: [
      '· 골반의 빠른 회전이 몸통으로 얼마나 잘 옮겨지는지를 보는 비율',
      '· 1.0 = 같은 속도 / 1.5 = 몸통이 1.5배 더 빠르게 회전 (에너지 증폭됨)'
    ],
    calculation: [
      '· 몸통 최고 회전속도 ÷ 골반 최고 회전속도',
      '· 매 투구마다 BBLAnalysis가 자동 계산 (10구 평균)'
    ],
    interpretation: [
      '✅ 1.5 이상 — 우수 (몸통이 골반 회전을 잘 받아 가속)',
      '⚠️ 1.0 ~ 1.5 — 보통',
      '❌ 1.0 미만 — 에너지 누수 (코어 약하거나 타이밍 어긋남)'
    ],
    source: 'Aguinaldo & Escamilla 2019'
  },
  etiTA: {
    title: 'ETI T→A (몸통→상완 에너지 효율)',
    definition: [
      '· 몸통의 회전이 팔(상완)로 얼마나 잘 옮겨지는지의 비율',
      '· 던지기에서 가장 중요한 마지막 가속 단계'
    ],
    calculation: [
      '· 상완 최고 회전속도 ÷ 몸통 최고 회전속도',
      '· 10구 평균값'
    ],
    interpretation: [
      '✅ 1.5 이상 — 우수한 채찍 효과',
      '⚠️ 1.0 ~ 1.5 — 보통',
      '❌ 1.0 미만 — 어깨/팔 가속 부족 (어깨 외회전 부족 가능)'
    ],
    source: 'Aguinaldo & Escamilla 2019'
  },
  leakPct: {
    title: '에너지 누수율 (%)',
    definition: [
      '· 몸 전체의 에너지 중 단계별로 손실되는 비율',
      '· 낮을수록 효율적인 키네틱 체인'
    ],
    calculation: [
      '· 골반→몸통→상완 단계별 효율 손실 합산',
      '· 누수가 적을수록 같은 힘으로 더 빠른 공'
    ],
    interpretation: [
      '✅ 15% 미만 — 매우 효율적',
      '⚠️ 15 ~ 30% — 보통',
      '❌ 30% 초과 — 누수 큼, 코어 안정성·타이밍 점검'
    ],
    source: '키네틱 체인 효율 분석 (자체 산출)'
  },
  sequencing: {
    title: '시퀀싱 타이밍 (P→T·T→A)',
    definition: [
      '· 골반 → 몸통 → 팔 순서로 정확한 시간 간격으로 회전하는지',
      '· 너무 빠르면 분리 부족, 너무 느리면 에너지 손실'
    ],
    calculation: [
      '· P→T = 몸통 피크 시점 − 골반 피크 시점',
      '· T→A = 상완 피크 시점 − 몸통 피크 시점'
    ],
    interpretation: [
      '✅ P→T 25~65ms · T→A 15~45ms — 엘리트 범위',
      '⚠️ 범위 벗어남 — 분리 부족 또는 늦은 가속',
      '❌ 순서 어긋남 (역방향) — 메카닉 큰 문제'
    ],
    source: 'Howenstein 2019'
  },
  layback: {
    title: 'Layback (어깨 외회전 / MER)',
    definition: [
      '· 공을 던지기 직전 팔이 뒤로 젖혀지는 최대 각도',
      '· 클수록 공 가속 거리(채찍의 길이)가 길어짐'
    ],
    calculation: [
      '· 풋컨택트 후 어깨가 가장 많이 외회전된 시점의 각도',
      '· 어깨 가동성 + 코어 안정성으로 결정됨'
    ],
    interpretation: [
      '✅ 185° 이상 — 우수 (드라이브라인 엘리트 평균 190°)',
      '⚠️ 165 ~ 185° — 보통',
      '❌ 165° 미만 — 어깨 가동성 부족',
      '※ 200°+ 과도한 경우 부상 위험 ↑'
    ],
    source: 'Driveline 0.86 (가장 강한 단일 변인) · Per 1mph 5°'
  },
  shoulderAbdFP: {
    title: 'Shoulder Abduction at FP (풋컨택트 시 어깨 외전)',
    definition: [
      '· 앞발이 땅에 닿는 순간 던지는 팔이 들어올려진 각도',
      '· 90°에 가까울수록 어깨 부담 적고 효율적'
    ],
    calculation: [
      '· 풋컨택트 시점 어깨와 몸통 사이 각도',
      '· 너무 낮으면 사이드암 / 너무 높으면 부상 위험'
    ],
    interpretation: [
      '✅ 약 84° (드라이브라인 엘리트 평균)',
      '⚠️ 60~80° 또는 100°+',
      '❌ 60° 미만 — 사이드암 (구속 손실)'
    ],
    source: 'Driveline 0.51 · Per 1mph 10°'
  },
  scapLoadFP: {
    title: 'Scap Load at FP (풋컨택트 시 견갑 장전)',
    definition: [
      '· 던지기 직전 견갑골(어깨뼈)이 뒤로 모이는 정도',
      '· 어깨 가속 거리를 추가로 늘려주는 변인'
    ],
    calculation: [
      '· 풋컨택트 시점 견갑골 후방 각도',
      '· 어깨 자세 + 가슴 가동성으로 결정'
    ],
    interpretation: [
      '✅ 51° 이상 — 우수',
      '⚠️ 30 ~ 50° — 보통',
      '❌ 30° 미만 — 어깨 장전 부족'
    ],
    source: 'Driveline 0.37 · Per 1mph 16°'
  },
  hipShoulderSep: {
    title: 'Hip-Shoulder Separation at FP (고관절-어깨 분리각)',
    definition: [
      '· 풋컨택트 시점 골반과 어깨 사이 비틀림 각도',
      '· 클수록 코어에 저장되는 회전 에너지가 큼'
    ],
    calculation: [
      '· 풋컨택트 시 골반 회전각 − 어깨 회전각',
      '· 30~40°가 일반적'
    ],
    interpretation: [
      '✅ 약 31° (드라이브라인 엘리트 평균)',
      '⚠️ 20 ~ 30°',
      '❌ 20° 미만 — 분리 부족 (조기 회전)'
    ],
    source: 'Driveline 0.44 · Per 1mph 3°'
  },
  trunkFwdTiltFP: {
    title: 'Trunk Forward Tilt at FP (풋컨택트 시 몸통 전방 기울기)',
    definition: [
      '· 풋컨택트 순간 몸통이 앞으로 기울어진 정도',
      '· 4° 정도 약간 기운 자세가 이상적'
    ],
    calculation: [
      '· 풋컨택트 시점 몸통-수직선 각도',
      '· 양수 = 앞으로 기움 / 음수 = 뒤로 젖혀짐'
    ],
    interpretation: [
      '✅ 약 4° (엘리트 평균)',
      '⚠️ -5 ~ 15° — 허용 범위',
      '❌ 너무 직립(-10°+) 또는 과도하게 기울음(20°+)'
    ],
    source: 'Driveline 0.36 · Per 1mph 6°'
  },
  counterRot: {
    title: 'Peak Torso Counter Rotation (몸통 반대 꼬임)',
    definition: [
      '· 와인드업 단계에서 몸통이 던지는 방향과 반대로 가장 많이 꼬이는 각도',
      '· 더 많이 꼬일수록 풀어내는 에너지가 큼 (음수가 클수록 좋음)'
    ],
    calculation: [
      '· 와인드업~풋컨택트 사이 몸통 회전각의 최저점',
      '· 부호: 음수 = 반대 방향 꼬임'
    ],
    interpretation: [
      '✅ -37° 이상 (절댓값) — 우수',
      '⚠️ -20 ~ -37°',
      '❌ -20° 미만 — 와인드업 부족'
    ],
    source: 'Driveline 0.38 · Per 1mph 13°'
  },
  trunkRotFP: {
    title: 'Trunk Rotation at FP (풋컨택트 시 몸통 회전)',
    definition: [
      '· 앞발 착지 순간 몸통이 타자 방향으로 얼마나 회전되었는지',
      '· 작을수록 늦은 회전 = 좋음 (가속 거리 확보)'
    ],
    calculation: [
      '· 풋컨택트 시점 몸통의 좌우 회전각',
      '· 0° = 정면 향함 / 양수 = 타자 방향 회전'
    ],
    interpretation: [
      '✅ 약 2° (엘리트) — 늦은 회전, 분리 우수',
      '⚠️ 5 ~ 15°',
      '❌ 15° 초과 — 조기 회전 (분리 부족)'
    ],
    source: 'Driveline 0.35 · Per 1mph 10°'
  },
  trunkRotVel: {
    title: 'Torso Rotation Velocity (몸통 회전 속도)',
    definition: [
      '· 던지기 동작 중 몸통이 가장 빠르게 회전하는 속도',
      '· 모든 메카닉 변인 중 가장 강한 단일 구속 예측 변인'
    ],
    calculation: [
      '· 몸통 분절 회전 각속도의 최댓값 (°/초)',
      '· 코어 파워 + 시퀀싱 타이밍의 결과물'
    ],
    interpretation: [
      '✅ 969°/초 이상 (드라이브라인 엘리트 중간값)',
      '⚠️ 750 ~ 900°/초',
      '❌ 750°/초 미만 — 회전 파워 부족'
    ],
    source: 'Driveline 1.00 (기준 변인) · Per 1mph 40°/s'
  },
  leadKneeExtBR: {
    title: 'Lead Knee Extension at BR (릴리즈 시 앞다리 신전)',
    definition: [
      '· 공을 놓는 순간 앞다리 무릎이 펴진 정도',
      '· 클수록(곧을수록) 앞다리가 강한 brake 역할'
    ],
    calculation: [
      '· 풋컨택트→릴리즈 사이 무릎 각도 변화',
      '· 양수 = 신전(폄) / 음수 = 굴곡(꺾임)'
    ],
    interpretation: [
      '✅ 11° 이상 (드라이브라인 엘리트)',
      '⚠️ 0 ~ 10°',
      '❌ 음수 (무릎 더 꺾임) — 앞다리 약함'
    ],
    source: 'Driveline 0.58 · Per 1mph 5°'
  },
  strideRatio: {
    title: 'Stride Ratio (스트라이드 비율)',
    definition: [
      '· 스트라이드 길이를 키로 나눈 값',
      '· 키 대비 얼마나 멀리 디뎠는지'
    ],
    calculation: [
      '· 스트라이드 길이 ÷ 키',
      '· 일반적으로 0.8~0.9가 이상적'
    ],
    interpretation: [
      '✅ 0.83 ~ 0.87 (드라이브라인 엘리트, 키 ~178cm 기준)',
      '⚠️ 0.7 ~ 0.85',
      '❌ 0.7 미만 — 짧은 스트라이드 (가속 거리 부족)'
    ],
    source: 'Driveline 0.58 · markerless 정확도 가장 높음 (CCC > 0.85)'
  },
  cogDecel: {
    title: 'CoG Decel (무게중심 감속)',
    definition: [
      '· 풋컨택트 후 몸 전체 무게중심이 얼마나 빨리 감속되는지',
      '· 빠른 감속 = 강한 앞다리 brace = 더 많은 에너지 팔로 전달'
    ],
    calculation: [
      '· 풋컨택트~릴리즈 구간 무게중심 속도 감소량 (m/s)',
      '· 앞다리 근력의 직접 지표'
    ],
    interpretation: [
      '✅ 1.61 m/s 이상 (드라이브라인 엘리트 중간값)',
      '⚠️ 1.0 ~ 1.5 m/s',
      '❌ 1.0 m/s 미만 — 앞다리 brace 약함'
    ],
    source: 'Driveline 0.70 (4번째 영향력) · Per 1mph 0.15 m/s'
  },
  peakPowerArm: {
    title: 'Peak Power Arm (상완 최고 파워)',
    definition: [
      '· 던지기 중 상완이 발생시키는 최대 파워 (와트)',
      '· 메카닉 효율 + 절대 근력의 결과물'
    ],
    calculation: [
      '· 회전 운동량 × 각속도의 최댓값 (W)',
      '· 마커리스 추정 (체중 + 신체분절 모델)'
    ],
    interpretation: [
      '✅ 3500W 이상 — 엘리트',
      '⚠️ 1500 ~ 3500W',
      '❌ 1500W 미만 — 절대 파워 부족 (체격·근력 발달 필요)'
    ],
    source: 'Naito 2014 + 4명 데이터 검증 (한국 고교 baseline)'
  },
  keArm: {
    title: 'KE_arm (상완 절대 운동에너지)',
    definition: [
      '· 상완에 저장된 최대 운동 에너지 (J)',
      '· 공으로 전달되는 에너지의 직전 단계'
    ],
    calculation: [
      '· 1/2 × I × ω² (관성모멘트 × 각속도²)',
      '· 신체분절 모델로 추정'
    ],
    interpretation: [
      '✅ 160J 이상 — 엘리트',
      '⚠️ 80 ~ 160J',
      '❌ 80J 미만 — 가속 부족'
    ],
    source: 'Aguinaldo 2019 · 가장 distal 운동에너지'
  },

  // ═════ 제구 변인 (v26 4그룹 — 13 변인) ═════
  strideLengthCv: {
    title: '스트라이드 길이 일관성 (CV%)',
    definition: [
      '· 10구 동안 앞발이 닿는 거리가 얼마나 일정한지',
      '· CV% = 변동 폭을 평균으로 나눈 비율 (낮을수록 일관됨)'
    ],
    calculation: [
      '· 10구 스트라이드 길이의 표준편차 ÷ 평균 × 100',
      '· 마커리스 추적의 정확도가 가장 높은 변인 중 하나'
    ],
    interpretation: [
      '✅ 3% 미만 — 엘리트 수준',
      '⚠️ 3 ~ 8%',
      '❌ 8% 초과 — 일관성 부족 (Drives/Fleisig 청소년 vs 엘리트 핵심 차이)'
    ],
    source: 'Drives/Fleisig 2009 · 청소년 변동성 가장 큰 변인'
  },
  kneeFcSd: {
    title: 'FC 무릎 굴곡각 변동성 (° SD)',
    definition: [
      '· 풋컨택트 순간 앞다리 무릎이 굽혀진 각도가 매번 얼마나 다른지',
      '· SD(표준편차) — 평균에서 얼마나 벗어나는지'
    ],
    calculation: [
      '· 10구 풋컨택트 시점 무릎 굴곡각의 표준편차',
      '· 동일한 자세로 착지하는지의 직접 지표'
    ],
    interpretation: [
      '✅ 3° 미만 — 엘리트',
      '⚠️ 3 ~ 8°',
      '❌ 8° 초과 — 착지 자세 불안정 (Manzi 2021 정확도 #2 예측 인자)'
    ],
    source: 'Manzi 2021 (n=322 프로) · 정확도 #2 예측 (4.2% MSE)'
  },
  leadKneeExtSd: {
    title: 'FC→BR 무릎 신전 일관성 (° SD)',
    definition: [
      '· 풋컨택트~릴리즈 구간 무릎이 펴지는 각도가 매번 얼마나 일정한지',
      '· "굴곡 후 폭발적 신전" 패턴의 재현성'
    ],
    calculation: [
      '· 10구 모두에서 (BR 무릎 각도 − FC 무릎 각도)의 표준편차',
      '· lead leg block 효과의 일관성 지표'
    ],
    interpretation: [
      '✅ 3° 미만 — 매번 동일한 brace 패턴',
      '⚠️ 3 ~ 8°',
      '❌ 8° 초과 — block 일관성 부족 → 회전축 흔들림'
    ],
    source: '⭐ 사용자 핵심 가설 (lead leg block + Solomito 2022 종합)'
  },
  kneeBrSd: {
    title: 'BR 무릎 굴곡 일관성 (° SD)',
    definition: [
      '· 공을 놓는 순간 앞다리 무릎의 각도가 매번 얼마나 일정한지',
      '· 회전축의 안정성 = 모든 후속 동작의 기준'
    ],
    calculation: [
      '· 10구 릴리즈 시점 무릎 굴곡각의 표준편차',
      '· brace 마무리의 일관성 지표'
    ],
    interpretation: [
      '✅ 3° 미만 — 엘리트',
      '⚠️ 3 ~ 8°',
      '❌ 8° 초과 — 회전축 흔들림 → 릴리즈 포인트 불안정'
    ],
    source: 'Lead leg block 안정성 — 회전축 흔들림 방지'
  },
  ptLagCv: {
    title: 'P→T lag 일관성 (CV%)',
    definition: [
      '· 골반→몸통 회전 시간차가 매번 얼마나 일정한지',
      '· 회전 타이밍의 재현성 — 시퀀싱 일관성의 핵심'
    ],
    calculation: [
      '· 10구 P→T lag (ms)의 변동계수 (SD/평균 × 100)',
      '· lag 자체보다 "일관성"이 제구의 핵심'
    ],
    interpretation: [
      '✅ 15% 미만 — 엘리트',
      '⚠️ 15 ~ 25%',
      '❌ 25% 초과 — 시퀀싱 매번 다름'
    ],
    source: 'Howenstein 2021 · 11개 KS 패턴 중 PDS 일관성'
  },
  taLagCv: {
    title: 'T→A lag 일관성 (CV%)',
    definition: [
      '· 몸통→상완 회전 시간차가 매번 얼마나 일정한지',
      '· 상완 가속 타이밍의 재현성'
    ],
    calculation: [
      '· 10구 T→A lag (ms)의 변동계수',
      '· 상완 catch-up 타이밍 안정성'
    ],
    interpretation: [
      '✅ 15% 미만 — 엘리트',
      '⚠️ 15 ~ 25%',
      '❌ 25% 초과 — 상완 가속 시점 매번 다름'
    ],
    source: 'Howenstein 2019/2021'
  },
  pelvisVelCv: {
    title: '골반 회전속도 변동성 (CV%)',
    definition: [
      '· 10구 동안 골반의 최고 회전속도가 매번 얼마나 일정한지',
      '· ⭐ 모든 변인 중 가장 강한 변동성 예측 (Wang 2025 r=−0.78)'
    ],
    calculation: [
      '· 10구 peak pelvis angular velocity의 변동계수',
      '· 골반 회전 자체의 안정성'
    ],
    interpretation: [
      '✅ 5% 미만 — 엘리트 수준',
      '⚠️ 5 ~ 15%',
      '❌ 15% 초과 — 코어 안정성 부족'
    ],
    source: '⭐ Wang 2025 (r=−0.78 · 가장 강한 변동성 예측)'
  },
  trunkVelCv: {
    title: '몸통 회전속도 변동성 (CV%)',
    definition: [
      '· 10구 동안 몸통의 최고 회전속도가 매번 얼마나 일정한지',
      '· 몸통 가속의 시기간 안정성'
    ],
    calculation: [
      '· 10구 peak trunk angular velocity의 변동계수',
      '· 몸통-팔 가속 패턴 일관성의 1차 지표'
    ],
    interpretation: [
      '✅ 5% 미만 — 엘리트',
      '⚠️ 5 ~ 15%',
      '❌ 15% 초과 — 몸통 가속 일관성 부족'
    ],
    source: '시퀀싱 안정성 학술 일치'
  },
  trunkFcSd: {
    title: 'FC 몸통 전방 기울기 변동성 (° SD)',
    definition: [
      '· ⭐ Manzi 2021 정확도 #1 예측 변인 (6.6% MSE)',
      '· 풋컨택트 시 몸통 자세가 매번 얼마나 일정한지'
    ],
    calculation: [
      '· 10구 풋컨택트 시점 몸통 전방 기울기의 표준편차',
      '· FC 시점 = MER 시점이나 BR 시점보다 정확도 예측력 큼'
    ],
    interpretation: [
      '✅ 2° 미만 — 엘리트 (정확도 1위 예측 인자)',
      '⚠️ 2 ~ 6°',
      '❌ 6° 초과 — 자세 불안정 → 모든 후속 동작 흔들림'
    ],
    source: '⭐ Manzi 2021 (n=322 프로) · 정확도 #1 예측 (6.6% MSE)'
  },
  trunkRotFcSd: {
    title: 'FC 몸통 회전각 변동성 (° SD)',
    definition: [
      '· 풋컨택트 시 몸통 회전 자세가 매번 얼마나 일정한지',
      '· 분리 자세의 안정성'
    ],
    calculation: [
      '· 10구 풋컨택트 시점 몸통 회전각의 표준편차',
      '· 자세 + 시퀀싱 결합 지표'
    ],
    interpretation: [
      '✅ 4° 미만 — 엘리트',
      '⚠️ 4 ~ 11°',
      '❌ 11° 초과 — 분리 자세 매번 다름'
    ],
    source: 'Manzi 2019 5변인 모델 (shoulder horizontal abduction at FC)'
  },
  armSlotSd: {
    title: 'Arm slot 변동성 (° SD)',
    definition: [
      '· 코칭 현장 직관 핵심 지표 — 눈으로 보이는 결과',
      '· 매 투구마다 팔의 각도(슬롯)가 일정한지'
    ],
    calculation: [
      '· 10구 릴리즈 시점 팔 각도의 표준편차',
      '· 어깨 + 팔꿈치 자세 결합'
    ],
    interpretation: [
      '✅ 3° 미만 — 엘리트',
      '⚠️ 3 ~ 8°',
      '❌ 8° 초과 — 슬롯 매번 다름 (근본 원인 = 착지 또는 자세 불안정)'
    ],
    source: 'Wakamiya 2024 · 사용자 언급 결과 변인'
  },
  wristSdCm: {
    title: '손목 높이 변동성 (cm SD)',
    definition: [
      '· 릴리즈 포인트의 수직 위치가 매번 얼마나 일정한지',
      '· Wakamiya 2024: 이 변동성이 BB/9 · xFIP 개선에 직결'
    ],
    calculation: [
      '· 10구 릴리즈 시점 손목 y좌표의 표준편차 (cm)',
      '· 95% 신뢰 타원의 vertical 폭'
    ],
    interpretation: [
      '✅ 2cm 미만 — MLB 평균 수준',
      '⚠️ 2 ~ 6cm',
      '❌ 6cm 초과 — 릴리즈 포인트 불안정'
    ],
    source: 'Wakamiya 2024 (n=344 MLB starters)'
  },
  fcBrCv: {
    title: 'FC→릴리스 시간 일관성 (CV%)',
    definition: [
      '· 풋컨택트~릴리즈 사이 소요 시간의 변동',
      '· 총체 timing의 결과 지표 (개별 단계 합산)'
    ],
    calculation: [
      '· 10구 풋컨택트→릴리즈 시간 (ms)의 변동계수',
      '· FC와 BR 시점 정확 검출 필요'
    ],
    interpretation: [
      '✅ 2% 미만 — 엘리트',
      '⚠️ 2 ~ 10%',
      '❌ 10% 초과 — 동작 시간 매번 다름'
    ],
    source: '총체 timing의 결과'
  }
};

// ⭐ FolderInfo — 폴더형 변인 설명 (펼치기/접기)
//   변인 옆 ⓘ 버튼 클릭 시 정의 / 산출방법 / 해석 표시
function FolderInfo({ varKey, accent }) {
  const [open, setOpen] = React.useState(false);
  const info = VAR_INFO[varKey];
  if (!info) return null;
  const accentColor = accent || '#60a5fa';
  return (
    <div style={{ marginTop: 4 }}>
      <button onClick={() => setOpen(!open)} style={{
        background: 'transparent',
        border: `1px solid ${accentColor}40`,
        borderRadius: 4,
        padding: '2px 8px',
        fontSize: 10,
        color: accentColor,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4
      }}>
        {open ? '▼' : '▶'} {open ? '설명 닫기' : '자세히 (정의·산출·해석)'}
      </button>
      {open && (
        <div style={{
          marginTop: 6,
          padding: '10px 12px',
          background: 'rgba(0,0,0,0.35)',
          border: `1px solid ${accentColor}30`,
          borderRadius: 5,
          fontSize: 11,
          lineHeight: 1.7
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: accentColor, letterSpacing: '0.5px', marginBottom: 4 }}>
            📖 정의
          </div>
          {info.definition.map((d, i) => (
            <div key={i} style={{ color: 'var(--d-fg2)', marginLeft: 4 }}>{d}</div>
          ))}

          <div style={{ fontSize: 10, fontWeight: 700, color: accentColor, letterSpacing: '0.5px', marginTop: 8, marginBottom: 4 }}>
            🔬 산출 방법
          </div>
          {info.calculation.map((d, i) => (
            <div key={i} style={{ color: 'var(--d-fg2)', marginLeft: 4 }}>{d}</div>
          ))}

          <div style={{ fontSize: 10, fontWeight: 700, color: accentColor, letterSpacing: '0.5px', marginTop: 8, marginBottom: 4 }}>
            💡 해석 방법
          </div>
          {info.interpretation.map((d, i) => (
            <div key={i} style={{ color: 'var(--d-fg2)', marginLeft: 4 }}>{d}</div>
          ))}

          {info.source && (
            <div style={{ fontSize: 10, color: 'var(--d-fg3)', marginTop: 8, paddingTop: 6, borderTop: '1px dashed var(--d-border)' }}>
              📚 출처: {info.source}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ⭐ v26 — 무릎 굴곡-신장 패턴 다이어그램 (사용자 핵심 가설 시각화)
//   FC 시점 무릎 굴곡 → 짧은 추가 굴곡(흡수) → 폭발적 신전 (block)
function KneeFlexExtDiagram({ kneeFcMean, kneeBrMean, leadKneeExtMean }) {
  const W = 480, H = 200;
  const padX = 50, padY = 30;
  const innerW = W - padX * 2, innerH = H - padY * 2;
  const fcAngle  = kneeFcMean ?? 45;
  const peakAngle = kneeFcMean != null ? kneeFcMean + 8 : 53;
  const brAngle  = kneeBrMean != null ? kneeBrMean : (leadKneeExtMean != null ? -leadKneeExtMean + 45 : 30);
  const yMax = Math.max(70, peakAngle + 5);
  const yMin = Math.min(0, brAngle - 10);
  const yScale = v => padY + innerH - ((v - yMin) / (yMax - yMin)) * innerH;
  const xFC = padX + innerW * 0.15;
  const xPeak = padX + innerW * 0.35;
  const xBR = padX + innerW * 0.85;
  const path = `M ${xFC} ${yScale(fcAngle)} Q ${(xFC+xPeak)/2} ${yScale(peakAngle - 2)} ${xPeak} ${yScale(peakAngle)} Q ${(xPeak+xBR)/2} ${yScale((peakAngle+brAngle)/2)} ${xBR} ${yScale(brAngle)}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: 480, display: 'block' }}>
      {/* 배경 */}
      <rect x="0" y="0" width={W} height={H} fill="rgba(0,0,0,0.15)" rx="6"/>
      {/* y축 라벨 */}
      <text x={padX-8} y={yScale(20)} fontSize="9" fill="#94a3b8" textAnchor="end">신전</text>
      <text x={padX-8} y={yScale(50)} fontSize="9" fill="#94a3b8" textAnchor="end">중간</text>
      <text x={padX-8} y={yScale(70)} fontSize="9" fill="#94a3b8" textAnchor="end">굴곡</text>
      {/* 가이드 라인 */}
      <line x1={padX} y1={yScale(0)} x2={W-padX} y2={yScale(0)} stroke="rgba(148,163,184,0.2)" strokeDasharray="3,3"/>
      {/* x축 시점 */}
      <line x1={xFC} y1={padY} x2={xFC} y2={padY+innerH} stroke="rgba(96,165,250,0.4)" strokeDasharray="2,3"/>
      <line x1={xPeak} y1={padY} x2={xPeak} y2={padY+innerH} stroke="rgba(251,191,36,0.4)" strokeDasharray="2,3"/>
      <line x1={xBR} y1={padY} x2={xBR} y2={padY+innerH} stroke="rgba(167,139,250,0.4)" strokeDasharray="2,3"/>
      {/* 곡선 */}
      <path d={path} stroke="#fbbf24" strokeWidth="3" fill="none" strokeLinecap="round"/>
      {/* 시점 마커 */}
      <circle cx={xFC} cy={yScale(fcAngle)} r="6" fill="#60a5fa"/>
      <circle cx={xPeak} cy={yScale(peakAngle)} r="6" fill="#fbbf24"/>
      <circle cx={xBR} cy={yScale(brAngle)} r="6" fill="#a78bfa"/>
      {/* 시점 라벨 */}
      <text x={xFC} y={H-8} fontSize="11" fontWeight="700" fill="#60a5fa" textAnchor="middle">FC (착지)</text>
      <text x={xPeak} y={H-8} fontSize="11" fontWeight="700" fill="#fbbf24" textAnchor="middle">Peak (흡수)</text>
      <text x={xBR} y={H-8} fontSize="11" fontWeight="700" fill="#a78bfa" textAnchor="middle">BR (릴리스)</text>
      {/* 값 라벨 */}
      <text x={xFC} y={yScale(fcAngle)-10} fontSize="11" fill="#cbd5e1" textAnchor="middle">{Number(fcAngle).toFixed(0)}°</text>
      <text x={xPeak} y={yScale(peakAngle)-10} fontSize="11" fill="#cbd5e1" textAnchor="middle">{Number(peakAngle).toFixed(0)}°</text>
      <text x={xBR} y={yScale(brAngle)-10} fontSize="11" fill="#cbd5e1" textAnchor="middle">{Number(brAngle).toFixed(0)}°</text>
      {/* 단계 캡션 */}
      <text x={(xFC+xPeak)/2} y={padY-10} fontSize="9.5" fill="#fb923c" textAnchor="middle" fontStyle="italic">짧은 추가 굴곡 (흡수)</text>
      <text x={(xPeak+xBR)/2} y={padY-10} fontSize="9.5" fill="#34d399" textAnchor="middle" fontStyle="italic">폭발적 신전 (block)</text>
    </svg>
  );
}

// ⭐ v26 — 릴리즈 포인트 분산도 (Wakamiya 2024 95% confidence ellipse 형식)
function ReleasePointScatter({ wristSdCm, armSlotSd }) {
  const W = 280, H = 220;
  const cx = W/2, cy = H/2 + 10;
  const wristCm = wristSdCm ?? 4;
  const armSd = armSlotSd ?? 5;
  // 시각화: 손목 SD를 vertical, arm slot SD를 horizontal로 (스케일 변환)
  const ellipseRy = Math.min(60, wristCm * 5);
  const ellipseRx = Math.min(50, armSd * 5);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: 280, display: 'block' }}>
      <rect x="0" y="0" width={W} height={H} fill="rgba(0,0,0,0.15)" rx="6"/>
      <text x={W/2} y="18" fontSize="11" fontWeight="700" fill="#cbd5e1" textAnchor="middle">95% 릴리즈 포인트 신뢰 타원</text>
      <text x={W/2} y="32" fontSize="9" fill="#94a3b8" textAnchor="middle">· 작은 타원 = 일관된 릴리즈 (Wakamiya 2024)</text>
      {/* 십자가 — 평균 점 */}
      <line x1={cx-70} y1={cy} x2={cx+70} y2={cy} stroke="rgba(148,163,184,0.3)" strokeDasharray="3,3"/>
      <line x1={cx} y1={cy-70} x2={cx} y2={cy+70} stroke="rgba(148,163,184,0.3)" strokeDasharray="3,3"/>
      {/* 엘리트 기준 타원 (작음) */}
      <ellipse cx={cx} cy={cy} rx="18" ry="12" fill="none" stroke="rgba(52,211,153,0.4)" strokeWidth="1.5" strokeDasharray="3,2"/>
      <text x={cx+22} y={cy-13} fontSize="9" fill="#34d399">엘리트</text>
      {/* 선수 타원 */}
      <ellipse cx={cx} cy={cy} rx={ellipseRx} ry={ellipseRy} fill="rgba(251,191,36,0.15)" stroke="#fbbf24" strokeWidth="2"/>
      {/* 평균점 */}
      <circle cx={cx} cy={cy} r="4" fill="#fff"/>
      {/* 축 라벨 */}
      <text x={cx} y={H-6} fontSize="10" fill="#94a3b8" textAnchor="middle">← Arm slot SD ({Number(armSd).toFixed(1)}°) →</text>
      <text x="14" y={cy} fontSize="10" fill="#94a3b8" transform={`rotate(-90 14 ${cy})`} textAnchor="middle">손목 SD ({Number(wristCm).toFixed(1)} cm)</text>
    </svg>
  );
}

window.RadarChart = RadarChart;
window.SequenceChart = SequenceChart;
window.AngularChart = AngularChart;
window.EnergyFlow = EnergyFlow;
window.LaybackMeter = LaybackMeter;
window.IntegratedKineticDiagram = IntegratedKineticDiagram;
window.VAR_INFO = VAR_INFO;
window.FolderInfo = FolderInfo;
window.KneeFlexExtDiagram = KneeFlexExtDiagram;
window.ReleasePointScatter = ReleasePointScatter;
})();
