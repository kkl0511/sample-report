/* global React, ReactDOM */
const { useState, useEffect, useRef, useMemo } = React;

/* ---------------- THEME ---------------- */
function useTheme() {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('bbl-theme') || 'dark'; } catch(_) { return 'dark'; }
  });
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('bbl-theme', theme); } catch(_) {}
  }, [theme]);
  return [theme, setTheme];
}

/* ---------------- ICONS ---------------- */
const Ic = {
  home:    <svg className="ic-svg" viewBox="0 0 24 24"><path d="M3 12L12 4l9 8M5 10v10h14V10"/></svg>,
  body:    <svg className="ic-svg" viewBox="0 0 24 24"><circle cx="12" cy="5" r="2.4"/><path d="M12 8v6m-3 7l3-7 3 7M9 11h6"/></svg>,
  motion:  <svg className="ic-svg" viewBox="0 0 24 24"><path d="M3 18l5-10 4 6 5-9 4 8"/></svg>,
  velocity:<svg className="ic-svg" viewBox="0 0 24 24"><path d="M3 12a9 9 0 1118 0M12 12l5-3"/></svg>,
  flag:    <svg className="ic-svg" viewBox="0 0 24 24"><path d="M5 21V4m0 0l10 3-3 4 5 3-12 2"/></svg>,
  dumbbell:<svg className="ic-svg" viewBox="0 0 24 24"><path d="M3 9v6m4-9v12m0-6h10m0-6v12m4-9v6"/></svg>,
  star:    <svg className="ic-svg" viewBox="0 0 24 24"><path d="M12 3l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-6z"/></svg>,
  download:<svg className="ic-svg" viewBox="0 0 24 24"><path d="M12 4v12m0 0l-4-4m4 4l4-4M5 20h14"/></svg>,
  compare: <svg className="ic-svg" viewBox="0 0 24 24"><path d="M8 4v16m8-16v16M3 8h5m8 0h5M3 16h5m8 0h5"/></svg>,
  filter:  <svg className="ic-svg" viewBox="0 0 24 24"><path d="M3 5h18l-7 9v6l-4-2v-4z"/></svg>,
  sun:     <svg className="ic-svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/></svg>,
  moon:    <svg className="ic-svg" viewBox="0 0 24 24"><path d="M20 14A8 8 0 119 4a7 7 0 0011 10z"/></svg>,
  chev:    <svg className="ic-svg" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>,
  menu:    <svg className="ic-svg" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg>,
  printer: <svg className="ic-svg" viewBox="0 0 24 24"><path d="M6 9V3h12v6M6 18H4v-6h16v6h-2M8 14h8v6H8z"/></svg>,
};

/* ---------------- PITCHER SELECT (combobox) ---------------- */
function PitcherSelect({ pitchers, activeId, onSelect }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef(null);
  const active = pitchers.find(p => p.id === activeId) || pitchers[0];

  useEffect(() => {
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const filtered = pitchers.filter(p =>
    !q || p.name.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="ps-wrap" ref={ref}>
      <button className="ps-trigger" onClick={() => setOpen(o => !o)}>
        <div className="ps-avatar">{active.name[0]}</div>
        <div className="ps-info">
          <div className="ps-name">{active.name}</div>
        </div>
        <svg className="ic-svg ps-chev" viewBox="0 0 24 24" style={{ transform: open ? 'rotate(180deg)' : 'none' }}>
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>

      {open && (
        <div className="ps-dropdown">
          <input
            className="ps-search"
            type="text"
            placeholder="선수 검색..."
            value={q}
            onChange={e => setQ(e.target.value)}
            autoFocus
          />
          <div className="ps-list">
            {filtered.length === 0 ? (
              <div className="ps-empty">검색 결과 없음</div>
            ) : filtered.map(p => (
              <button key={p.id}
                className={`ps-item ${p.id === activeId ? 'active' : ''}`}
                onClick={() => { onSelect(p.id); setOpen(false); setQ(''); }}>
                <div className="ps-avatar sm">{p.name[0]}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="ps-name">{p.name}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- SIDEBAR ---------------- */
function Sidebar({ pitchers, activeId, onSelect, mode, onMode, navItems, activeNav, onNavSelect, isOpen, onClose }) {
  return (
    <>
      {isOpen && <div className="sb-overlay show" onClick={onClose}/>}
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sb-brand">
        <img src="assets/logo-bbl.png" alt="BBL"/>
        <div>
          <div className="name">BioMotion Lab</div>
          <div className="sub">Pitcher Dashboard</div>
        </div>
        <button className="sb-close" onClick={onClose} aria-label="닫기">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 6l12 12M18 6L6 18"/>
          </svg>
        </button>
      </div>

      <div className="sb-section-title">Pitcher</div>
      <PitcherSelect pitchers={pitchers} activeId={activeId} onSelect={(id) => { onSelect(id); onClose && onClose(); }}/>

      <div className="sb-section-title">Sections</div>
      <div className="sb-nav">
        {navItems.map(n => (
          <button key={n.id}
            className={`sb-nav-item ${activeNav === n.id ? 'active' : ''}`}
            onClick={() => { onNavSelect(n.id); onClose && onClose(); }}>
            <span className="ic">{n.icon}</span>
            {n.label}
            <span className="num">{n.num}</span>
          </button>
        ))}
      </div>

      <div className="sb-section-title">View Mode</div>
      <div className="sb-nav">
        <button className={`sb-nav-item ${mode === 'single' ? 'active' : ''}`} onClick={() => onMode('single')}>
          <span className="ic">{Ic.home}</span>
          개별 분석
        </button>
        <button className={`sb-nav-item ${mode === 'compare' ? 'active' : ''}`} onClick={() => onMode('compare')}>
          <span className="ic">{Ic.compare}</span>
          선수 비교
        </button>
      </div>

      <div className="sb-foot">
        <button className="sb-foot-btn" onClick={() => window.print()}>
          {Ic.printer}
          <span>PDF</span>
        </button>
      </div>
      </aside>
    </>
  );
}

/* ---------------- TOP BAR ---------------- */
function DashTopBar({ pitcher, mode, theme, onTheme, onMenu }) {
  return (
    <div className="topbar2">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="menu-toggle" onClick={onMenu}>{Ic.menu}</button>
        <div className="tb-crumbs">
          <span>BBL</span><span className="sep">/</span>
          <span>{mode === 'compare' ? 'Compare Mode' : '개별 분석'}</span>
          {mode !== 'compare' && pitcher && <>
            <span className="sep">/</span>
            <span className="now">{pitcher.name}</span>
          </>}
        </div>
      </div>
      <div className="tb-actions">
        <span className="tb-filter">
          {Ic.filter}
          측정일&nbsp;<b>{pitcher?.date || '2026-04-24'}</b>
        </span>
        <div className="seg-toggle">
          <button className={theme === 'light' ? 'active' : ''} onClick={() => onTheme('light')} title="Light">
            {Ic.sun}
          </button>
          <button className={theme === 'dark' ? 'active' : ''} onClick={() => onTheme('dark')} title="Dark">
            {Ic.moon}
          </button>
        </div>
        <button className="tb-btn primary" onClick={() => window.print()}>
          {Ic.download} <span>PDF</span>
        </button>
      </div>
    </div>
  );
}

/* ---------------- KPI CARDS ---------------- */
function KPI({ hero, label, value, unit, deg, band, foot, sparkData }) {
  const bandLabel = { high: '기준 상위', mid: '기준 범위', low: '기준 미만', na: '미측정' };
  return (
    <div className={`kpi ${hero ? 'kpi-hero' : ''}`}>
      <div className="kpi-label"><span className="dot"/>{label}</div>
      <div className="kpi-value">
        {value}
        {deg && <span className="deg">°</span>}
        {unit && <span className="unit">{unit}</span>}
      </div>
      <div className="kpi-foot">
        {band && <span className={`kpi-band ${band}`}>{bandLabel[band]}</span>}
        {foot && <span className="kpi-trend">{foot}</span>}
      </div>
      {sparkData && <Spark data={sparkData}/>}
    </div>
  );
}

function Spark({ data }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v,i) => `${(i / (data.length-1)) * 100},${100 - ((v-min)/range)*90}`).join(' ');
  return (
    <svg className="spark" viewBox="0 0 100 100" preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke="var(--bbl-primary)" strokeWidth="2" vectorEffect="non-scaling-stroke"/>
    </svg>
  );
}

/* ---------------- OVERVIEW PANELS ---------------- */
function VelocityPanel({ p }) {
  const trials = useMemo(() => {
    // synth 10 trials with peak = velocity, avg = velocityAvg
    const base = p.velocityAvg;
    const peak = p.velocity;
    const arr = [];
    for (let i = 0; i < 10; i++) {
      arr.push(base - 1.5 + Math.sin(i * 0.7) * 1.2 + (Math.random() * 0.6));
    }
    arr[Math.floor(Math.random() * 10)] = peak;
    return arr;
  }, [p.id]);
  const max = Math.max(...trials, peak(p));
  const min = Math.min(...trials) - 1;
  function peak(p) { return p.velocity; }
  return (
    <div className="panel" style={{ minHeight: 280 }}>
      <div className="panel-head">
        <div>
          <div className="kicker">Velocity Profile</div>
          <h3>구속 추이 — 10회 시기별</h3>
          <div className="sub">· 피크 {p.velocity.toFixed(1)} · 평균 {p.velocityAvg.toFixed(1)} km/h</div>
        </div>
        <div className="panel-toolbar">
          <span className="panel-pill">10 trials</span>
        </div>
      </div>
      <svg viewBox="0 0 600 200" style={{ width: '100%', height: 200 }}>
        <defs>
          <linearGradient id="velgrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2563EB" stopOpacity="0.3"/>
            <stop offset="1" stopColor="#2563EB" stopOpacity="0"/>
          </linearGradient>
        </defs>
        {/* horizontal grid */}
        {[0, 1, 2, 3].map(i => (
          <line key={i} x1="40" x2="580" y1={20 + i * 40} y2={20 + i * 40}
            stroke="var(--d-border)" strokeWidth="1"/>
        ))}
        {/* Y labels */}
        {[max, min + (max-min)*0.66, min + (max-min)*0.33, min].map((v,i) => (
          <text key={i} x="34" y={24 + i * 40} fill="var(--d-fg3)" fontSize="10"
            fontFamily="Inter" textAnchor="end" fontWeight="600">{v.toFixed(0)}</text>
        ))}
        {/* avg line */}
        <line x1="40" x2="580" y1={20 + (1 - (p.velocityAvg-min)/(max-min)) * 160}
          y2={20 + (1 - (p.velocityAvg-min)/(max-min)) * 160}
          stroke="#60a5fa" strokeWidth="1" strokeDasharray="4 3" opacity="0.5"/>
        <text x="576" y={20 + (1 - (p.velocityAvg-min)/(max-min)) * 160 - 4}
          fill="#60a5fa" fontSize="9" fontFamily="Inter" textAnchor="end" fontWeight="700">
          AVG {p.velocityAvg.toFixed(1)}
        </text>
        {/* area + line */}
        {(() => {
          const xs = trials.map((_, i) => 40 + (i / 9) * 540);
          const ys = trials.map(v => 20 + (1 - (v-min)/(max-min)) * 160);
          const path = xs.map((x,i) => `${i===0?'M':'L'}${x},${ys[i]}`).join('');
          const area = path + `L${xs[xs.length-1]},180 L${xs[0]},180 Z`;
          return (<g>
            <path d={area} fill="url(#velgrad)"/>
            <path d={path} fill="none" stroke="#2563EB" strokeWidth="2.5"/>
            {xs.map((x,i) => {
              const isPeak = trials[i] === Math.max(...trials);
              return (
                <g key={i}>
                  <circle cx={x} cy={ys[i]} r={isPeak ? 5 : 3.5} fill={isPeak ? '#fff' : '#2563EB'}
                    stroke="#2563EB" strokeWidth="2"/>
                  {isPeak && <text x={x} y={ys[i]-12} fill="var(--d-fg1)"
                    fontSize="11" fontFamily="Inter" fontWeight="800" textAnchor="middle">
                    {trials[i].toFixed(1)} <tspan fill="var(--d-fg3)" fontSize="8">km/h</tspan>
                  </text>}
                </g>
              );
            })}
          </g>);
        })()}
      </svg>
    </div>
  );
}

function usePinchZoom() {
  const ref = useRef(null);
  const stateRef = useRef({ scale: 1, tx: 0, ty: 0, pinchDist: 0, pinchCx: 0, pinchCy: 0, startScale: 1, startTx: 0, startTy: 0, panX: 0, panY: 0, isPanning: false });
  const [trans, setTrans] = useState({ scale: 1, tx: 0, ty: 0 });

  const apply = (s, tx, ty) => {
    stateRef.current.scale = s;
    stateRef.current.tx = tx;
    stateRef.current.ty = ty;
    setTrans({ scale: s, tx, ty });
  };

  const reset = () => apply(1, 0, 0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const dist = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    const mid = (a, b) => ({ x: (a.clientX + b.clientX)/2, y: (a.clientY + b.clientY)/2 });

    const onTouchStart = (e) => {
      const s = stateRef.current;
      if (e.touches.length === 2) {
        e.preventDefault();
        const [t1, t2] = e.touches;
        s.pinchDist = dist(t1, t2);
        const m = mid(t1, t2);
        const rect = el.getBoundingClientRect();
        s.pinchCx = m.x - rect.left;
        s.pinchCy = m.y - rect.top;
        s.startScale = s.scale;
        s.startTx = s.tx;
        s.startTy = s.ty;
      } else if (e.touches.length === 1 && s.scale > 1) {
        s.isPanning = true;
        s.panX = e.touches[0].clientX - s.tx;
        s.panY = e.touches[0].clientY - s.ty;
      }
    };

    const onTouchMove = (e) => {
      const s = stateRef.current;
      if (e.touches.length === 2) {
        e.preventDefault();
        const [t1, t2] = e.touches;
        const newDist = dist(t1, t2);
        const ratio = newDist / (s.pinchDist || 1);
        const newScale = Math.max(1, Math.min(5, s.startScale * ratio));
        // 핀치 중심 기준 확대/축소
        const dx = s.pinchCx - (el.clientWidth/2);
        const dy = s.pinchCy - (el.clientHeight/2);
        const newTx = s.startTx - dx * (newScale - s.startScale);
        const newTy = s.startTy - dy * (newScale - s.startScale);
        apply(newScale, newTx, newTy);
      } else if (e.touches.length === 1 && s.isPanning && s.scale > 1) {
        e.preventDefault();
        const newTx = e.touches[0].clientX - s.panX;
        const newTy = e.touches[0].clientY - s.panY;
        apply(s.scale, newTx, newTy);
      }
    };

    const onTouchEnd = (e) => {
      const s = stateRef.current;
      if (e.touches.length === 0) {
        s.isPanning = false;
        if (s.scale < 1.05) reset();
      }
    };

    const onDblClick = (e) => {
      // 버튼/컨트롤 클릭은 zoom 토글에서 제외 (프레임 스텝 연타 오작동 방지)
      if (e.target.closest && e.target.closest('button, .frame-controls, .rate-switch')) return;
      const s = stateRef.current;
      if (s.scale > 1) reset();
      else {
        const rect = el.getBoundingClientRect();
        const dx = (e.clientX - rect.left) - el.clientWidth/2;
        const dy = (e.clientY - rect.top) - el.clientHeight/2;
        apply(2, -dx, -dy);
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    el.addEventListener('dblclick', onDblClick);
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('dblclick', onDblClick);
    };
  }, []);

  return { ref, trans, reset };
}

function VideoPanel({ p }) {
  const videoRef = useRef(null);
  const [rate, setRate] = useState(1);
  const [isPaused, setIsPaused] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const rates = [1, 0.25, 0.1];
  const src = p.mocapUrl || p.video || p.videoUrl;
  const isYouTube = src && /youtu\.?be/.test(src);
  let ytEmbed = null;
  if (isYouTube) {
    const m = src.match(/(?:youtu\.be\/|v=)([\w-]{11})/);
    if (m) ytEmbed = `https://www.youtube.com/embed/${m[1]}?rel=0&modestbranding=1`;
  }

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = rate;
  }, [rate]);

  const FRAME = 1 / 30;
  const step = async (dir) => {
    const v = videoRef.current;
    if (!v) return;
    try { await v.pause(); } catch(_) {}
    const dur = isFinite(v.duration) ? v.duration : Infinity;
    v.currentTime = Math.max(0, Math.min(dur, v.currentTime + dir * FRAME));
  };
  const toggle = async () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { try { await v.play(); } catch(_) {} } else v.pause();
  };
  const onSeek = (e) => {
    const v = videoRef.current;
    if (!v || !isFinite(v.duration)) return;
    const t = parseFloat(e.target.value);
    v.currentTime = t;
    setCurrentTime(t);
  };
  const formatTime = (t) => {
    if (!isFinite(t) || t < 0) return '0:00.00';
    const m = Math.floor(t / 60);
    const s = (t % 60).toFixed(2).padStart(5, '0');
    return `${m}:${s}`;
  };
  const onKey = (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    else if (e.key === ' ') { e.preventDefault(); toggle(); }
  };

  const showScrubber = !!src && !ytEmbed;
  const { ref: zoomRef, trans, reset: resetZoom } = usePinchZoom();
  const zoomed = trans.scale > 1.05;

  return (
    <div className="panel" style={{ minHeight: 280, display: 'flex', flexDirection: 'column' }}>
      <div className="panel-head">
        <div>
          <div className="kicker">Motion Capture</div>
          <h3>투구 영상 시퀀스</h3>
          <div className="sub">· {p.name} {showScrubber ? '· ← → 프레임 · Space 재생/정지 · 핀치 줌' : '· 3D 스켈레톤 트래킹'}</div>
        </div>
        {showScrubber ? (
          <div className="rate-switch">
            {rates.map(r => (
              <button key={r}
                className={`rate-btn ${rate === r ? 'active' : ''}`}
                onClick={() => setRate(r)}>{r}×</button>
            ))}
          </div>
        ) : (
          <div className="mocap-badge">
            <span className="mocap-dot"/> LIVE
          </div>
        )}
      </div>

      <div className="video-wrap" tabIndex={0} onKeyDown={onKey} ref={zoomRef}
           style={{ touchAction: zoomed ? 'none' : 'auto', overflow: 'hidden' }}>
        <div style={{
          width: '100%', height: '100%',
          transform: `translate(${trans.tx}px, ${trans.ty}px) scale(${trans.scale})`,
          transformOrigin: 'center center',
          transition: zoomed ? 'none' : 'transform .25s ease',
        }}>
          {ytEmbed ? (
            <iframe src={ytEmbed} title={`${p.name} mocap`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen/>
          ) : src ? (
            <video ref={videoRef} src={src} playsInline preload="auto" muted controls={false} disablePictureInPicture
              onPlay={() => setIsPaused(false)}
              onPause={() => setIsPaused(true)}
              onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
              onLoadedMetadata={(e) => {
                const v = e.currentTarget;
                v.playbackRate = rate;
                setDuration(v.duration || 0);
                // 첫 프레임 강제 표시 (검은 화면 방지)
                try { v.currentTime = 0.001; } catch(_) {}
              }}/>
          ) : (
            <MocapPlaceholder p={p}/>
          )}
        </div>
        {zoomed && (
          <button onClick={resetZoom} style={{
            position: 'absolute', top: 12, right: 12,
            padding: '6px 12px', borderRadius: 6,
            background: 'rgba(0,0,0,.75)', color: '#fff',
            border: '1px solid rgba(255,255,255,.2)',
            fontSize: 11, fontWeight: 600, cursor: 'pointer', zIndex: 5,
          }}>
            {trans.scale.toFixed(1)}× · Reset
          </button>
        )}
      </div>
      {showScrubber && (
        <div className="seek-bar">
          <span className="seek-time">{formatTime(currentTime)}</span>
          <input type="range" className="seek-slider"
                 min={0} max={duration || 0} step={FRAME} value={currentTime}
                 onChange={onSeek}
                 onInput={onSeek}
                 onPointerDown={() => { try { videoRef.current && videoRef.current.pause(); } catch(_) {} }}
                 onTouchStart={() => { try { videoRef.current && videoRef.current.pause(); } catch(_) {} }}
                 style={{ '--seek-progress': `${duration ? (currentTime / duration) * 100 : 0}%` }}
                 aria-label="동영상 시점 이동"/>
          <span className="seek-time">{formatTime(duration)}</span>
        </div>
      )}
      {showScrubber && (
        <div className="frame-controls">
          <button className="frame-btn" onClick={() => step(-1)}>◀ −1f</button>
          <button className="frame-btn play" onClick={toggle}>{isPaused ? '▶ 재생' : '❚❚ 정지'}</button>
          <button className="frame-btn" onClick={() => step(1)}>+1f ▶</button>
        </div>
      )}

      <div className="video-tags">
        <span className="video-tag">{p.archetype}</span>
        <span className="video-tag">{p.velocity.toFixed(0)} km/h</span>
        <span className="video-tag">{p.pitchType || 'Fastball'}</span>
        <span className="video-tag">측정 · {p.date}</span>
      </div>
    </div>
  );
}

/* Motion Capture Placeholder — 3D-스켈레톤 애니메이션 */
function MocapPlaceholder({ p }) {
  return (
    <div className="mocap-stage">
      {/* 그리드 바닥 */}
      <svg className="mocap-grid" viewBox="0 0 400 225" preserveAspectRatio="none">
        <defs>
          <linearGradient id="grid-fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(96,165,250,0)" />
            <stop offset="100%" stopColor="rgba(96,165,250,0.25)" />
          </linearGradient>
        </defs>
        {/* 원근 그리드 */}
        {[...Array(8)].map((_, i) => {
          const y = 140 + i * 12;
          const inset = i * 14;
          return <line key={'h'+i} x1={inset} y1={y} x2={400-inset} y2={y} stroke="url(#grid-fade)" strokeWidth="0.5"/>;
        })}
        {[...Array(11)].map((_, i) => {
          const x1 = 40 + i * 32;
          const x2 = 100 + i * 20;
          return <line key={'v'+i} x1={x1} y1={140} x2={x2} y2={225} stroke="url(#grid-fade)" strokeWidth="0.5"/>;
        })}
      </svg>

      {/* 스켈레톤 (애니메이션 SVG) */}
      <svg className="mocap-skeleton" viewBox="0 0 400 225" preserveAspectRatio="xMidYMid meet">
        <defs>
          <radialGradient id="joint-glow">
            <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.9"/>
            <stop offset="100%" stopColor="#60a5fa" stopOpacity="0"/>
          </radialGradient>
        </defs>

        {/* 본 (라인) */}
        <g className="bones" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" fill="none">
          {/* 척추 */}
          <line x1="200" y1="60" x2="200" y2="130" className="bone"/>
          {/* 어깨 라인 */}
          <line x1="170" y1="80" x2="230" y2="80" className="bone"/>
          {/* 좌측 팔 (글러브) */}
          <line x1="170" y1="80" x2="145" y2="105" className="bone"/>
          <line x1="145" y1="105" x2="125" y2="125" className="bone"/>
          {/* 우측 팔 (투구) — 동적 */}
          <line x1="230" y1="80" x2="265" y2="65" className="bone arm-up"/>
          <line x1="265" y1="65" x2="295" y2="55" className="bone arm-up"/>
          {/* 골반 */}
          <line x1="180" y1="130" x2="220" y2="130" className="bone"/>
          {/* 좌측 다리 (앞발) */}
          <line x1="180" y1="130" x2="165" y2="170" className="bone"/>
          <line x1="165" y1="170" x2="155" y2="205" className="bone"/>
          {/* 우측 다리 (축발) */}
          <line x1="220" y1="130" x2="235" y2="170" className="bone"/>
          <line x1="235" y1="170" x2="225" y2="205" className="bone"/>
        </g>

        {/* 관절 (점) */}
        <g className="joints" fill="#60a5fa">
          {[
            [200,55,3.5,'head'],
            [200,60,2.5,'neck'],
            [170,80,2.5,'sh-l'],
            [230,80,2.5,'sh-r'],
            [145,105,2,'el-l'],
            [125,125,2,'wr-l'],
            [265,65,2,'el-r'],
            [295,55,2.5,'wr-r'],
            [200,130,2.5,'pelvis'],
            [180,130,2,'hip-l'],
            [220,130,2,'hip-r'],
            [165,170,2,'kn-l'],
            [155,205,2,'an-l'],
            [235,170,2,'kn-r'],
            [225,205,2,'an-r'],
          ].map(([x,y,r,k]) => (
            <g key={k}>
              <circle cx={x} cy={y} r={r*2.5} fill="url(#joint-glow)"/>
              <circle cx={x} cy={y} r={r}/>
            </g>
          ))}
        </g>

        {/* 머리 */}
        <circle cx="200" cy="48" r="10" fill="none" stroke="#60a5fa" strokeWidth="1.5"/>

        {/* 공 궤적 */}
        <g className="ball-trace">
          <path d="M 295 55 Q 340 40 380 30" stroke="#fbbf24" strokeWidth="1" strokeDasharray="2 3" fill="none" opacity="0.5"/>
          <circle cx="295" cy="55" r="3" fill="#fbbf24" className="ball"/>
        </g>

        {/* 측정 라벨 */}
        <g className="mocap-labels" fontSize="7" fontFamily="ui-monospace, monospace" fill="#60a5fa" opacity="0.7">
          <text x="305" y="48">WR · {(p.velocity * 0.27).toFixed(1)} m/s</text>
          <text x="100" y="138">PEL · {p.layback?.deg.toFixed(0) || 90}°</text>
          <text x="155" y="220">FT · stride</text>
        </g>
      </svg>

      {/* HUD */}
      <div className="mocap-hud">
        <div className="hud-l">
          <div className="hud-row"><span>SUBJECT</span><b>{p.name}</b></div>
          <div className="hud-row"><span>FRAME</span><b className="frame-counter">000 / 240</b></div>
          <div className="hud-row"><span>FPS</span><b>240</b></div>
        </div>
        <div className="hud-r">
          <div className="hud-row"><span>BALL VEL</span><b>{p.velocity.toFixed(1)} km/h</b></div>
          <div className="hud-row"><span>MAX LAYBACK</span><b>{p.layback?.deg.toFixed(1) || '—'}°</b></div>
          <div className="hud-row"><span>STATUS</span><b style={{color:'#4ade80'}}>● TRACKING</b></div>
        </div>
      </div>
    </div>
  );
}

function CoreIssuePanel({ p }) {
  const sevLabel = p.severity === 'NONE' ? 'BALANCED' : p.severity;
  const sevDesc = {
    'HIGH':     '즉시 개입 권장',
    'MEDIUM':   '교정 우선순위 높음',
    'LOW':      '점진적 개선',
    'BALANCED': '균형 잡힌 상태',
    'NONE':     '균형 잡힌 상태',
  }[sevLabel] || '평가 진행 중';

  const Stat = ({ label, value, color, accent }) => (
    <div style={{
      flex: 1,
      padding: '14px 12px',
      background: 'rgba(8, 8, 12, 0.35)',
      border: `1px solid ${accent || 'var(--d-border)'}`,
      borderRadius: 10,
      textAlign: 'center',
      minWidth: 0,
    }}>
      <div style={{ fontSize: 26, fontWeight: 800, color: color, fontFamily: 'Inter', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--d-fg3)', marginTop: 6, fontWeight: 600, letterSpacing: '0.5px' }}>{label}</div>
    </div>
  );

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <div className="kicker">Core Issue</div>
          <h3>핵심 진단</h3>
          <div className="sub">· 한눈 요약 · 자세한 내용은 아래 섹션 참조</div>
        </div>
      </div>

      {/* 종합 평가 1줄 */}
      <div className="diag-row" style={{ marginTop: 12 }}>
        <span className={`sev sev-${p.severity}`}>{sevLabel}</span>
        <div style={{ fontSize: 13, color: 'var(--d-fg1)', lineHeight: 1.5, fontWeight: 600 }}>
          {p.coreIssue}
        </div>
      </div>

      {/* 카운트 3개 */}
      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        <Stat label="강점 · STRENGTHS"  value={p.strengths.length}  color="#4ade80" accent="rgba(74,222,128,0.35)"/>
        <Stat label="약점 · WEAKNESS"   value={p.weaknesses.length} color="#f87171" accent="rgba(248,113,113,0.35)"/>
        <Stat label="체크 · CHECKPOINT" value={p.flags.length}      color="#fbbf24" accent="rgba(251,191,36,0.35)"/>
      </div>

      {/* 아치타입 강조 */}
      <div style={{
        marginTop: 14,
        padding: '12px 14px',
        background: 'linear-gradient(135deg, rgba(37,99,235,0.12), rgba(37,99,235,0.04))',
        border: '1px solid rgba(37,99,235,0.3)',
        borderRadius: 10,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <svg width="20" height="20" viewBox="0 0 24 24" style={{ color: '#60a5fa', flexShrink: 0 }}>
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 9, color: '#60a5fa', fontWeight: 700, letterSpacing: '1.2px' }}>ARCHETYPE</div>
          <div style={{ fontSize: 14, color: 'var(--d-fg1)', fontWeight: 700, marginTop: 2 }}>{p.archetype}</div>
        </div>
        <div style={{
          marginLeft: 'auto',
          fontSize: 11,
          color: 'var(--d-fg3)',
          fontWeight: 500,
          textAlign: 'right',
          flexShrink: 0,
        }}>
          {sevDesc}
        </div>
      </div>

      <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--d-border)', fontSize: 11, color: 'var(--d-fg3)', display: 'flex', justifyContent: 'space-between' }}>
        <span>측정일 · {p.date}</span>
        <span>아래 섹션에서 상세 분석 →</span>
      </div>
    </div>
  );
}

/* ---------------- EXPECTED VELOCITY (Hybrid model) ----------------
 * Driveline (2021) "Predicted Velocity Through Jump and Strength Testing" 방법론을 차용하여
 * BBL 한국 대학생 투수 표본 분포 기반으로 계수 보정한 hybrid 모델.
 * - Physical: CMJ 단위파워 / RSI-mod / SJ peak power 기반
 * - Mechanical: ETI(T→A) / 상완 회전속도 / max layback / 누수% 기반
 * - 절대 예측이 아닌 "with all other variables equal" 기대값 → 실제 vs 기대 gap으로 lowest hanging fruit 식별
 * - 참고: Driveline (2021), Werner (2008), Stodden (2005), Lehman et al. (2013) 등
 */
function expectedVelocity(p) {
  const BASE = 134.7; // BBL 4인 평균 km/h (한국 대학생 투수 baseline)
  const CAP = 10;     // ±10 km/h cap (소표본 outlier 흡수)

  // Physical Expected — 체력 기반
  const physContrib = {
    'CMJ 단위파워':   (p.physical.cmjPower.cmj - 50) * 0.18,
    'RSI 반응성':    (p.physical.reactive.cmj - 0.5) * 12.0,
    'SJ 절대파워':    (p.physical.cmjPower.sj - 44) * 0.10,
  };
  let physPred = BASE + Object.values(physContrib).reduce((a,b)=>a+b, 0);
  physPred = Math.max(BASE - CAP, Math.min(BASE + CAP, physPred));

  // Mechanical Expected — 메카닉스 기반
  const mechContrib = {
    'ETI 상완 전달':   (p.energy.etiTA - 0.77) * 18.0,
    '상완 회전 속도':  (p.angular.arm - 1463) / 50 * 1.2,
    'Max layback':    (p.layback.deg - 184) * 0.10,
    '에너지 누수':    -p.energy.leakPct * 0.10,
  };
  let mechPred = BASE + Object.values(mechContrib).reduce((a,b)=>a+b, 0);
  mechPred = Math.max(BASE - CAP, Math.min(BASE + CAP, mechPred));

  return { physPred, mechPred, physContrib, mechContrib, base: BASE };
}

function ExpectedVelocityPanel({ p }) {
  const { physPred, mechPred, physContrib, mechContrib } = expectedVelocity(p);
  const actual = p.velocity;
  const gapP = actual - physPred;  // + → 체력 ceiling 위로 outperforming
  const gapM = actual - mechPred;  // + → 메카닉스 ceiling 위로 outperforming
  const ceiling = Math.max(physPred, mechPred);
  const ceilingHeadroom = ceiling - actual;

  // 시나리오 분류 (gap 기준 ±2 km/h를 같음으로 처리)
  // 우리 분석과 모순 방지: 누수 35%↑면 무조건 메카닉스 lagging 우선
  const TOL = 2.0;
  const physLag = gapP < -TOL;  // actual < physPred → 체력 잠재가 더 큼 (체력에 비해 못 던짐)
  const mechLag = gapM < -TOL;  // actual < mechPred → 메카닉스 잠재가 더 큼
  // 단, 실제 누수 35%+면 메카닉스 lagging이 항상 우세
  const heavyLeak = p.energy.leakPct >= 35;

  let scenario, primary, secondary, advice;
  if (physLag && mechLag) {
    scenario = '체력·메카닉스 모두 잠재력 > 실제';
    primary = heavyLeak ? '메카닉스 효율 회복' : '체력 베이스라인 활용';
    secondary = heavyLeak ? '체력 우위 활용' : '메카닉스 다듬기';
    advice = heavyLeak
      ? '누수 우선 차단 → 체력은 이미 충분 · 에너지 전달이 막혀 잠재 미발현'
      : '체력·메카닉 양쪽 모두 보강 시 큰 폭 상승 가능';
  } else if (physLag) {
    scenario = '체력 잠재력 > 실제 (메카닉스 lagging)';
    primary = '메카닉스 다듬기';
    secondary = '체력 유지';
    advice = '체력은 이미 ceiling — 동작 효율(에너지 전달, 시퀀스, layback) 보강이 lowest hanging fruit';
  } else if (mechLag) {
    scenario = '메카닉스 잠재력 > 실제 (체력 lagging)';
    primary = '체력 보강';
    secondary = '메카닉스 유지';
    advice = '메카닉스는 이미 효율적 — 절대 근력·파워 증가가 가장 큰 상승 여력';
  } else if (gapP > TOL && gapM > TOL) {
    scenario = '실제 > 기대 (skill outperforming)';
    primary = '재능 활용 + 미세 보강';
    secondary = '부상 관리';
    advice = '체력·메카닉스 기대치 대비 더 잘 던지는 케이스 — 워크로드 관리하며 양쪽 보강 시 추가 상승';
  } else {
    scenario = '실제 ≈ 기대 (균형형)';
    primary = '전반 동시 향상';
    secondary = '약점 보강';
    advice = '체력·메카닉스 모두 현재 수준으로 ceiling에 근접 — 둘 다 1 SD 향상 시 +2~3 km/h 가능';
  }

  // 시각화: 3개 막대 (실제 / 체력 기대 / 메카닉스 기대)
  const allVals = [actual, physPred, mechPred];
  const maxV = Math.max(...allVals) + 5;
  const minV = Math.min(...allVals) - 5;
  const range = maxV - minV;
  const w = 100; // %
  const toPct = (v) => ((v - minV) / range) * w;

  const Bar = ({ label, en, val, gap, color, isActual }) => {
    const pct = toPct(val);
    const sign = gap > 0 ? '+' : '';
    return (
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6, fontSize: 12 }}>
          <span style={{ fontWeight: 700, color: 'var(--d-fg1)' }}>
            {label} <span style={{ color: 'var(--d-fg3)', fontSize: 10, fontWeight: 500, marginLeft: 4 }}>{en}</span>
          </span>
          <span>
            <b style={{ color: color, fontSize: 16, fontFamily: 'Inter' }}>{val.toFixed(1)}</b>
            <span style={{ color: 'var(--d-fg3)', fontSize: 10, marginLeft: 3 }}>km/h</span>
            {!isActual && (
              <span style={{
                marginLeft: 8,
                padding: '2px 6px',
                borderRadius: 3,
                fontSize: 10,
                fontWeight: 700,
                background: gap > 1 ? 'rgba(74,222,128,0.15)' : gap < -1 ? 'rgba(248,113,113,0.15)' : 'rgba(148,163,184,0.15)',
                color: gap > 1 ? '#4ade80' : gap < -1 ? '#f87171' : '#94a3b8',
              }}>
                실제 {sign}{gap.toFixed(1)}
              </span>
            )}
          </span>
        </div>
        <div style={{ position: 'relative', height: 8, background: 'rgba(8,8,12,0.4)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0,
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${color}88, ${color})`,
            borderRadius: 4,
          }}/>
        </div>
      </div>
    );
  };

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <div className="kicker" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            Expected Velocity · 기대 구속 모델
            <span style={{
              padding: '2px 7px', borderRadius: 4, fontSize: 9, fontWeight: 700, letterSpacing: '0.5px',
              background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.4)', color: '#fbbf24',
            }}>v0.1 · PROTOTYPE</span>
            <span style={{
              padding: '2px 7px', borderRadius: 4, fontSize: 9, fontWeight: 600, letterSpacing: '0.3px',
              background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.3)', color: '#93c5fd',
            }}>v1.0 (n=600) 작업 예정</span>
          </div>
          <h3>체력 vs 메카닉스 기대 구속</h3>
          <div className="sub">· 두 ceiling 비교로 가장 효과적인 훈련 방향 자동 추출</div>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <Bar label="실제 구속"          en="Actual"             val={actual}   gap={0}     color="#60a5fa" isActual/>
        <Bar label="체력 기반 기대 구속"   en="Physical Expected"  val={physPred} gap={gapP} color="#4ade80"/>
        <Bar label="메카닉스 기반 기대 구속" en="Mechanical Expected" val={mechPred} gap={gapM} color="#e8965a"/>
      </div>

      {/* 시나리오 + 훈련 방향 */}
      <div style={{
        marginTop: 18,
        padding: '14px 16px',
        background: 'linear-gradient(135deg, rgba(37,99,235,0.10), rgba(37,99,235,0.03))',
        border: '1px solid rgba(37,99,235,0.3)',
        borderRadius: 10,
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#60a5fa', letterSpacing: '1.2px', marginBottom: 6 }}>
          TRAINING DIRECTION · 훈련 방향
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--d-fg1)', marginBottom: 8 }}>
          {scenario}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
          <div style={{
            padding: '6px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
            background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.4)', color: '#4ade80',
          }}>
            우선순위 1 · {primary}
          </div>
          <div style={{
            padding: '6px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
            background: 'rgba(148,163,184,0.1)', border: '1px solid rgba(148,163,184,0.3)', color: 'var(--d-fg2)',
          }}>
            보조 · {secondary}
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--d-fg2)', lineHeight: 1.6 }}>
          · {advice}
        </div>
        {ceilingHeadroom > 1 && (
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--d-fg3)' }}>
            · 추정 잠재력 천장: <b style={{ color: '#fbbf24' }}>{ceiling.toFixed(1)} km/h</b>
            <span style={{ marginLeft: 6 }}>(현재 대비 +{ceilingHeadroom.toFixed(1)} km/h 여력)</span>
          </div>
        )}
      </div>

      {/* 모델 설명 (작게) */}
      <details style={{ marginTop: 12, fontSize: 11, color: 'var(--d-fg3)' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>모델 상세 · 계수 기여도 보기</summary>
        <div style={{ marginTop: 10, padding: 12, background: 'rgba(0,0,0,0.25)', borderRadius: 6, lineHeight: 1.7 }}>
          <div style={{ fontWeight: 700, color: '#4ade80', marginBottom: 4 }}>체력 기반 기여도 (km/h)</div>
          {Object.entries(physContrib).map(([k,v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed rgba(148,163,184,0.15)', padding: '2px 0' }}>
              <span>· {k}</span>
              <span style={{ color: v >= 0 ? '#4ade80' : '#f87171', fontFamily: 'Inter', fontWeight: 600 }}>{v >= 0 ? '+' : ''}{v.toFixed(2)}</span>
            </div>
          ))}
          <div style={{ fontWeight: 700, color: '#e8965a', margin: '10px 0 4px' }}>메카닉스 기반 기여도 (km/h)</div>
          {Object.entries(mechContrib).map(([k,v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed rgba(148,163,184,0.15)', padding: '2px 0' }}>
              <span>· {k}</span>
              <span style={{ color: v >= 0 ? '#4ade80' : '#f87171', fontFamily: 'Inter', fontWeight: 600 }}>{v >= 0 ? '+' : ''}{v.toFixed(2)}</span>
            </div>
          ))}
          <div style={{ marginTop: 10, padding: 8, borderTop: '1px solid var(--d-border)', fontSize: 10, color: 'var(--d-fg3)', lineHeight: 1.6 }}>
            <b>방법론 출처</b> · Driveline Baseball (2021) <i>"Predicted Velocity Through Jump and Strength Testing"</i> 모델 차용,
            BBL 한국 대학생 투수 4인 baseline(평균 134.7 km/h)에 맞춰 계수 보정.
            선행 연구: Werner (2008), Stodden et al. (2005), Lehman et al. (2013).
            <br/><b>주의</b> · "with all other variables equal" 기대값 — 절대 예측 아님.
            ±10 km/h cap 적용. 표본 4명 기반이므로 추가 표본 누적 시 정확도 향상 예정.
          </div>

          {/* v1.0 업그레이드 로드맵 */}
          <div style={{ marginTop: 14, padding: 12, background: 'rgba(96,165,250,0.05)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: 6 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#93c5fd', letterSpacing: '1px', marginBottom: 8 }}>
              v1.0 UPGRADE ROADMAP · 정식 모델 작업 계획
            </div>
            <div style={{ fontSize: 11, color: 'var(--d-fg2)', lineHeight: 1.7, marginBottom: 10 }}>
              BBL 보유 <b style={{ color: '#93c5fd' }}>약 600명 투수 데이터셋</b>(Uplift Labs 마커리스 모션캡처 + Rapsodo 트래킹 + ForceDecks 포스플레이트 통합)을 활용해
              v0.1 prototype을 검증된 회귀 모델로 업그레이드 예정.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 10, lineHeight: 1.6 }}>
              <div style={{ padding: 8, background: 'rgba(8,8,12,0.3)', borderRadius: 4, border: '1px solid var(--d-border)' }}>
                <div style={{ fontWeight: 700, color: '#fbbf24', marginBottom: 4 }}>Phase 1 · 데이터 통합</div>
                <div style={{ color: 'var(--d-fg3)' }}>· 세 시스템 측정 매칭<br/>· 결측·이상치 처리<br/>· 수준별 표본 분포 검증</div>
              </div>
              <div style={{ padding: 8, background: 'rgba(8,8,12,0.3)', borderRadius: 4, border: '1px solid var(--d-border)' }}>
                <div style={{ fontWeight: 700, color: '#fbbf24', marginBottom: 4 }}>Phase 2 · 회귀 모델 fit</div>
                <div style={{ color: 'var(--d-fg3)' }}>· 75:25 split · 5-fold CV<br/>· R²·MAE·VIF·잔차 진단<br/>· 95% CI 산출</div>
              </div>
              <div style={{ padding: 8, background: 'rgba(8,8,12,0.3)', borderRadius: 4, border: '1px solid var(--d-border)' }}>
                <div style={{ fontWeight: 700, color: '#93c5fd', marginBottom: 4 }}>Phase 3 · 수준별 baseline</div>
                <div style={{ color: 'var(--d-fg3)' }}>· 고교/대학/실업/프로 분리<br/>· 변수별 percentile 산출<br/>· "프로 상위 N%" 절대 기준</div>
              </div>
              <div style={{ padding: 8, background: 'rgba(8,8,12,0.3)', borderRadius: 4, border: '1px solid var(--d-border)' }}>
                <div style={{ fontWeight: 700, color: '#93c5fd', marginBottom: 4 }}>Phase 4 · 하위 모델 확장</div>
                <div style={{ color: 'var(--d-fg3)' }}>· 부상 위험 모델<br/>· 선발/불펜 분리<br/>· 연령별 발달 곡선</div>
              </div>
            </div>

            <div style={{ marginTop: 10, fontSize: 10, color: 'var(--d-fg3)', lineHeight: 1.6 }}>
              <b>예상 산출물</b> · 한국 대학생 투수 코호트 회귀 모델 (R² 0.55+ 예상) ·
              수준별 percentile 자동 산출 시스템 · 학술 논문화 가능
              ("한국 야구 투수 force plate metrics와 fastball velocity의 관계: 600인 코호트 분석")
            </div>
          </div>
        </div>
      </details>
    </div>
  );
}

/* ---------------- COLLAPSIBLE SECTION ---------------- */
function SectionBlock({ num, title, sub, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  const ref = useRef(null);

  // 외부 네비게이션에서 이 섹션으로 이동할 때 자동 open
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = () => setOpen(true);
    el.addEventListener('__open', handler);
    return () => el.removeEventListener('__open', handler);
  }, []);

  return (
    <div ref={ref} className={`section-block ${open ? 'open' : ''}`} data-section-num={num}>
      <button className="section-bar" onClick={() => setOpen(o => !o)}>
        <div className="num">{num}</div>
        <div>
          <h2>{title}</h2>
          {sub && <div className="sub">{sub}</div>}
        </div>
        <span className="chev">{Ic.chev}</span>
      </button>
      <div className="section-body">
        {children}
      </div>
    </div>
  );
}

/* ---------------- VIDEO CARD (reused) ---------------- */
function VideoCard({ src }) {
  const videoRef = useRef(null);
  const [rate, setRate] = useState(1);
  const [isPaused, setIsPaused] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const rates = [1, 0.25, 0.1];
  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = rate;
  }, [rate]);
  const FRAME = 1 / 30;
  const step = async (dir) => {
    const v = videoRef.current;
    if (!v) return;
    try { await v.pause(); } catch(_) {}
    const dur = isFinite(v.duration) ? v.duration : Infinity;
    v.currentTime = Math.max(0, Math.min(dur, v.currentTime + dir * FRAME));
  };
  const toggle = async () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { try { await v.play(); } catch(_) {} } else v.pause();
  };
  const onSeek = (e) => {
    const v = videoRef.current;
    if (!v || !isFinite(v.duration)) return;
    const t = parseFloat(e.target.value);
    v.currentTime = t;
    setCurrentTime(t);
  };
  const formatTime = (t) => {
    if (!isFinite(t) || t < 0) return '0:00.00';
    const m = Math.floor(t / 60);
    const s = (t % 60).toFixed(2).padStart(5, '0');
    return `${m}:${s}`;
  };
  const onKey = (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    else if (e.key === ' ') { e.preventDefault(); toggle(); }
  };
  return (
    <div className="video-card">
      <div className="card-head" style={{ marginBottom: 12 }}>
        <div>
          <div className="section-kicker" style={{ fontSize: 10 }}>Motion Capture</div>
          <h3 className="card-title" style={{ marginTop: 4, fontSize: 14 }}>투구 영상 시퀀스</h3>
          <div className="card-sub" style={{ fontSize: 11 }}>← → 프레임 · Space 재생/정지</div>
        </div>
        <div className="rate-switch">
          {rates.map(r => (
            <button key={r}
              className={`rate-btn ${rate === r ? 'active' : ''}`}
              onClick={() => setRate(r)}>{r}×</button>
          ))}
        </div>
      </div>
      <div className="video-wrap" tabIndex={0} onKeyDown={onKey} style={{ position: 'relative' }}>
        <video ref={videoRef} src={src} playsInline preload="auto" muted controls={false} disablePictureInPicture
          onPlay={() => setIsPaused(false)}
          onPause={() => setIsPaused(true)}
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => {
            const v = e.currentTarget;
            v.playbackRate = rate;
            setDuration(v.duration || 0);
            try { v.currentTime = 0.001; } catch(_) {}
          }}
          style={{ width: '100%', display: 'block', borderRadius: 12, background: '#000' }}/>
      </div>
      <div className="seek-bar">
        <span className="seek-time">{formatTime(currentTime)}</span>
        <input type="range" className="seek-slider"
               min={0} max={duration || 0} step={FRAME} value={currentTime}
               onChange={onSeek}
               onInput={onSeek}
               onPointerDown={() => { try { videoRef.current && videoRef.current.pause(); } catch(_) {} }}
               onTouchStart={() => { try { videoRef.current && videoRef.current.pause(); } catch(_) {} }}
               style={{ '--seek-progress': `${duration ? (currentTime / duration) * 100 : 0}%` }}
               aria-label="동영상 시점 이동"/>
        <span className="seek-time">{formatTime(duration)}</span>
      </div>
      <div className="frame-controls">
        <button className="frame-btn" onClick={() => step(-1)}>◀ −1f</button>
        <button className="frame-btn play" onClick={toggle}>{isPaused ? '▶ 재생' : '❚❚ 정지'}</button>
        <button className="frame-btn" onClick={() => step(1)}>+1f ▶</button>
      </div>
    </div>
  );
}

/* ---------------- SINGLE PITCHER VIEW ---------------- */
function SinglePitcherView({ p }) {
  const physRows = [
    { k: 'CMJ 단위파워', sub: 'W/kg', val: p.physical.cmjPower.cmj, band: p.physical.cmjPower.band },
    { k: '절대근력 IMTP', sub: 'N/kg', val: p.physical.maxStrength.perKg ?? '—', band: p.physical.maxStrength.band },
    { k: '반응성 RSI-mod', sub: 'm/s', val: p.physical.reactive.cmj, band: p.physical.reactive.band },
    { k: '반동 활용 EUR', sub: '비율', val: p.physical.ssc.value, band: p.physical.ssc.band },
    { k: '악력', sub: 'kg', val: p.physical.release.value, band: p.physical.release.band },
  ];
  const bandLabel = { high: '상위', mid: '범위', low: '미만', na: '미측정' };
  const taLeak = p.energy.etiTA < 0.85;

  return (
    <>
      {/* Page head */}
      <div className="page-head">
        <div>
          <h1 className="page-title">{p.name}</h1>
          <div className="pitcher-meta" style={{ marginTop: 8 }}>
            <div>유형<b>{p.archetype}</b></div>
            <div>측정일<b>{p.date}</b></div>
            <div>태그<b>{p.tags.join(' · ') || '—'}</b></div>
          </div>
        </div>
        <span className={`sev sev-${p.severity}`} style={{ fontSize: 11, padding: '6px 12px' }}>
          {p.severity === 'NONE' ? 'BALANCED' : p.severity + ' PRIORITY'}
        </span>
      </div>

      {/* Hero — Video (full width) */}
      <div style={{ marginBottom: 20 }}>
        <VideoPanel p={p}/>
      </div>

      {/* KPI grid */}
      <div className="kpi-grid">
        <KPI hero label="Peak Velocity" value={p.velocity.toFixed(1)} unit="km/h"
          foot={`평균 ${p.velocityAvg.toFixed(1)}`}/>
        <KPI label="Max Layback" value={p.layback.deg.toFixed(1)} deg
          band={p.layback.band}
          foot="프로 160°–180°"/>
        <KPI label="Trunk → Arm ETI" value={p.energy.etiTA.toFixed(2)}
          band={taLeak ? 'low' : 'high'}
          foot={taLeak ? `${p.energy.leakPct}% 손실` : '효율 전달'}/>
        <KPI label="CMJ 단위파워" value={p.physical.cmjPower.cmj} unit="W/kg"
          band={p.physical.cmjPower.band}
          foot="기준 50+"/>
      </div>

      {/* Core Issue — KPI와 체력 프로파일 사이 */}
      <div style={{ marginBottom: 24 }}>
        <CoreIssuePanel p={p}/>
      </div>

      {/* Expected Velocity — 체력/메카닉스 기대 구속 + 훈련 방향 */}
      <div style={{ marginBottom: 24 }}>
        <ExpectedVelocityPanel p={p}/>
      </div>

      {/* Section: Physical */}
      <SectionBlock num="01" title="Physical Profile · 체력 프로파일"
        sub="· 5개 핵심 역량 종합 평가">
        <div className="dash-grid">
          <div className="panel" style={{ background: 'transparent', border: '1px solid var(--d-border)' }}>
            <div className="panel-head">
              <div>
                <div className="kicker">Physical Radar</div>
                <h3>5축 역량 레이더</h3>
                <div className="sub">· 안쪽 · 기준 미만 / 바깥 · 기준 상위</div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
              <RadarChart data={p.radar}/>
            </div>
          </div>
          <div className="panel">
            <div className="panel-head">
              <div>
                <div className="kicker">Detailed Metrics</div>
                <h3>세부 측정값</h3>
              </div>
            </div>
            <div>
              {physRows.map((r,i) => (
                <div className="metric-row" key={i}>
                  <div className="lbl">{r.k}<small>{r.sub}</small></div>
                  <div className="val">{r.val}</div>
                  <div className={`band band-${r.band}`}>{bandLabel[r.band]}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SectionBlock>

      {/* Section: Mechanics */}
      <SectionBlock num="02" title="Pitching Mechanics · 투구 메카닉스"
        sub="· 에너지 전달 · 키네매틱 시퀀스 · 분절 회전 속도">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="panel">
            <div className="panel-head">
              <div>
                <div className="kicker">Energy Transfer</div>
                <h3>에너지 전달과 누수</h3>
                <div className="sub">· ETI = 분절 간 에너지 전달 비율 · 1.0이면 손실 없음</div>
              </div>
            </div>
            <EnergyFlow energy={p.energy}/>
            <div className="chart-caption">{p.energy.comment}</div>
          </div>
          <div className="panel">
            <div className="panel-head">
              <div>
                <div className="kicker">Sequence Timing</div>
                <h3>키네매틱 시퀀스 — 분절 피크 회전 속도의 순서</h3>
                <div className="sub">· 이상적: 골반 → 몸통 → 상완 (proximal-to-distal) · 인접 분절 피크 시점 간격 30–60 ms</div>
              </div>
            </div>
            <SequenceChart sequence={p.sequence}/>
            <div className="chart-caption">{p.sequence.comment}</div>
          </div>
          <div className="panel">
            <div className="panel-head">
              <div>
                <div className="kicker">Peak Angular Velocity</div>
                <h3>분절별 최대 회전 속도</h3>
                <div className="sub">· 프로 범위: 골반 580–640 · 몸통 800–900 · 상완 1450–1600 °/s</div>
              </div>
            </div>
            <AngularChart angular={p.angular}/>
            <div className="chart-caption">{p.angular.comment}</div>
            <div className="chip-row">
              <div className="gain-chip">골반→몸통 <b>×{p.angular.gainPT.toFixed(2)}</b></div>
              <div className="gain-chip">몸통→상완 <b>×{p.angular.gainTA.toFixed(2)}</b></div>
            </div>
          </div>
          <div className="panel">
            <div className="panel-head">
              <div>
                <div className="kicker">Max Layback</div>
                <h3>팔 뒤로 젖힘 — 가속 거리</h3>
                <div className="sub">· 프로 범위 160°–180°</div>
              </div>
            </div>
            <div className="layback-card" style={{ padding: 0, background: 'transparent', border: 'none', display: 'grid', gridTemplateColumns: '1fr auto', gap: 32, alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
                  <div className="layback-value">{p.layback.deg.toFixed(1)}<span className="deg">°</span></div>
                  <div className={`band band-${p.layback.band}`} style={{ fontSize: 11 }}>
                    {bandLabel[p.layback.band]}
                  </div>
                </div>
                <div style={{ color: 'var(--d-fg2)', marginTop: 12, fontSize: 13 }}>{p.layback.note}</div>
                <div className="layback-photo" style={{ maxWidth: 220, marginTop: 16 }}>
                  <img src="assets/max-layback.png" alt="Max Layback reference"/>
                </div>
                <div className="layback-photo-caption" style={{ marginTop: 6 }}>Reference</div>
              </div>
              <div style={{ flexShrink: 0 }}>
                <LaybackMeter deg={p.layback.deg}/>
              </div>
            </div>
          </div>
        </div>
      </SectionBlock>

      {/* Section: SW */}
      <SectionBlock num="03" title="Strengths & Weaknesses · 강점·약점"
        sub="· 통합 판정 기반">
        <div className="sw-grid">
          <div>
            <div className="sw-title pos">
              <svg width="14" height="14" viewBox="0 0 16 16"><path d="M3 8l4 4 6-8" stroke="#4ade80" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
              강점 · Strengths
            </div>
            <div className="sw-list">
              {p.strengths.map((s,i) => (
                <div className="sw-item pos" key={i}>
                  <div className="t">{s.title}</div>
                  <div className="d">{s.detail}</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="sw-title neg">
              <svg width="14" height="14" viewBox="0 0 16 16"><path d="M4 4l8 8M12 4l-8 8" stroke="#f87171" strokeWidth="2.5" fill="none" strokeLinecap="round"/></svg>
              약점 · Improvement
            </div>
            <div className="sw-list">
              {p.weaknesses.map((w,i) => (
                <div className="sw-item neg" key={i}>
                  <div className="t">{w.title}</div>
                  <div className="d">{w.detail}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SectionBlock>

      {/* Section: Flags — 항상 표시 (빈 경우 '특이사항 없음' 메시지) */}
      <SectionBlock num="04" title="Check Points · 체크 포인트"
        sub="· 자동 규칙 엔진이 감지한 확인 필요 항목">
        {p.flags.length > 0 ? p.flags.map((f,i) => (
          <div className={`flag-item ${f.severity}`} key={i}>
            <div className="head">
              <span className={`sev sev-${f.severity}`} style={{ padding: '4px 8px', fontSize: 10 }}>{f.severity}</span>
              <span className="t">{f.title}</span>
            </div>
            <ul>{f.evidence.map((e,j) => <li key={j}>{e}</li>)}</ul>
            <div className="impl">{f.implication}</div>
          </div>
        )) : (
          <div style={{
            padding: '32px 24px',
            borderRadius: 12,
            border: '1px dashed var(--d-border)',
            background: 'rgba(74, 222, 128, 0.04)',
            textAlign: 'center',
          }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 44, height: 44, borderRadius: '50%',
              background: 'rgba(74, 222, 128, 0.15)',
              border: '1px solid rgba(74, 222, 128, 0.4)',
              marginBottom: 14,
            }}>
              <svg width="22" height="22" viewBox="0 0 16 16">
                <path d="M3 8l4 4 6-8" stroke="#4ade80" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--d-fg1)', marginBottom: 6 }}>
              특이사항 없음
            </div>
            <div style={{ fontSize: 12, color: 'var(--d-fg3)', lineHeight: 1.6 }}>
              · 측정 전 영역에서 주의·경계 신호 미감지<br/>
              · 현재 수준 유지 + 보강 여력 확보 차원의 트레이닝 권장
            </div>
          </div>
        )}
      </SectionBlock>

      {/* Section: Training */}
      <SectionBlock num="05"
        title="Physical Training Guide · 피지컬 트레이닝 가이드"
        sub="· 선수가 혼자 수행하는 자기주도 프로그램 · 최소 장비 · 4–12주 블록">
        <div className="training-list">
          {p.training.map((t,i) => (
            <div className="training-card" data-idx={`0${i+1}`} key={i}>
              <div className="tc-head">
                <span className="tc-cat">{t.cat}</span>
                <h3 className="tc-title">{t.title}</h3>
                <span className="tc-weeks">{t.weeks}</span>
              </div>
              <div className="tc-reason">{t.rationale}</div>
              <ul className="tc-drills">
                {t.drills.map((d,j) => <li key={j}>{d}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </SectionBlock>

      {/* Section: Mechanic Drills */}
      <SectionBlock num="06"
        title="Movement Correction Drills · 동작 교정 드릴"
        sub="· 선수가 혼자서도 수행할 수 있는 자기주도 드릴">
        <MechanicDrills p={p}/>
      </SectionBlock>

      <div style={{ marginTop: 24, padding: 20, borderRadius: 14, background: 'var(--d-surface)', border: '1px solid var(--d-border)', fontSize: 11, color: 'var(--d-fg3)', textAlign: 'center' }}>
        <b style={{ color: 'var(--d-fg1)' }}>BioMotion Baseball Lab</b> · Kookmin University · 
        <a href="https://biomotion.kr" style={{ color: 'var(--bbl-primary)', marginLeft: 4 }}>biomotion.kr</a>
        <div style={{ marginTop: 4 }}>· Uplift Labs 마커리스 모션캡처 · VALD ForceDecks · 랩소도 통합 분석</div>
      </div>
    </>
  );
}

/* ---------------- MECHANIC DRILLS ---------------- */
const DRILL_CATALOG = [
  {
    id: 'hip-shoulder',
    tag: '분리',
    title: 'Hip-Shoulder Separation · 골반-어깨 분리 드릴',
    target: '몸통-골반 분리각 부족 · 시퀀스 동기화 불량',
    triggers: ['시퀀스', '몸통', '골반', 'ETI', '분리'],
    level: '기본',
    equipment: '긴 막대(PVC·배트·수건 묶음) 1개',
    duration: '10분',
    cue: '"골반 먼저, 가슴은 늦게 — 고무줄을 비틀어 감는 느낌"',
    steps: [
      { t: '거울 세팅', d: '전신 거울 앞 또는 휴대폰을 삼각대/벽에 기대 측면에서 촬영. 앞발 착지 자세로 시작.' },
      { t: '막대 올리기', d: '막대를 어깨 위에 수평으로 얹는다. 양손으로 잡고 어깨와 평행 유지.' },
      { t: '골반 선행', d: '골반을 타겟 쪽으로 먼저 돌린다. 이때 어깨(막대)는 측방(1·3루 방향)을 유지 — 스스로 "골반 1박, 어깨 2박" 카운트.' },
      { t: '지연 회전', d: '골반이 완전히 열렸다는 감각이 온 뒤에 어깨를 던진다. 스냅 없이 풀리듯.' },
      { t: '셀프 체크', d: '영상을 보며 골반 라인과 어깨 라인 각도가 엇갈리는 순간이 한 프레임 이상 유지되는지 확인.' },
    ],
    reps: '3세트 × 6회 (던지는 쪽만)',
    fail: [
      '골반과 어깨가 동시에 회전 → 분리각 0°',
      '상체가 먼저 열림 → 팔이 끌려나옴',
    ],
    selfCheck: '측면 영상에서 골반 라인과 어깨 라인의 교차 각도가 30–45°로 0.05초 이상 유지되는지. 스마트폰 슬로우모션(240fps)으로 찍으면 프레임 단위로 확인 가능.',
  },
  {
    id: 'layback',
    tag: '레이백',
    title: 'External Rotation Layback · 최대 외회전 드릴',
    target: '최대 외회전(Layback) 부족 · 경직된 어깨',
    triggers: ['레이백', 'layback', '외회전', 'ER', '어깨'],
    level: '기본 → 중급',
    equipment: '야구공 1개 · 벽',
    duration: '8분',
    cue: '"공을 뒤로 던지듯 눕혀라 — 손목이 귀 뒤에 위치"',
    steps: [
      { t: '벽 터치 세팅', d: '투구측 옆면을 벽에 대고 선다. 앞발 착지 자세(스트라이드 상태)까지 만든다.' },
      { t: '공 젖히기', d: '공을 든 손을 뒤로 눕혀 손등이 벽에 닿도록. 팔꿈치 높이는 어깨와 같은 높이(90°).' },
      { t: '정지 유지', d: '그 자세로 2초 정지. 통증 없이 자연스러운 젖힘 범위에서 멈춘다.' },
      { t: '리듬 추가', d: '정지 없이 "하나-눕혀-둘-앞으로" 리듬으로 반복. 릴리스는 공을 멀리 안 보내도 OK.' },
      { t: '셀프 체크', d: '정면 셀카 동영상으로 공을 든 손이 귀 뒤쪽 위치까지 눕는지, 팔꿈치가 어깨 높이와 같은지 확인.' },
    ],
    reps: '3세트 × 5회',
    fail: [
      '팔꿈치가 어깨보다 낮음 → 회전근개 부담 ↑',
      '상체가 과도하게 측굴 → 진짜 레이백이 아닌 몸통 기울임',
    ],
    selfCheck: '정면에서 찍은 영상에서 공이 최대로 젖혀진 순간, 팔꿈치가 어깨 라인과 수평이면 OK. 팔꿈치가 아래로 처지면 힘을 뺀 후 다시 시도.',
  },
  {
    id: 'stride',
    tag: '스트라이드',
    title: 'Directional Stride · 스트라이드 방향 드릴',
    target: '스트라이드 방향 이탈 · 앞발 착지 불안정',
    triggers: ['스트라이드', 'stride', '방향', '앞발', '착지'],
    level: '기본',
    equipment: '마스킹 테이프 또는 분필 · 콘 1개(없으면 신발)',
    duration: '10분',
    cue: '"타겟과 앞발 발가락을 한 줄로 — 수평으로 눕히듯"',
    steps: [
      { t: '라인 그리기', d: '평지에서 타겟(콘 또는 신발)까지 직선을 테이프로 표시. 양 옆 5cm 지점에도 허용선을 그린다.' },
      { t: '쉐도우 투구', d: '공 없이 와인드업 → 앞발 착지. 앞발이 라인 위 또는 허용선 안에 정확히 떨어지는지 눈으로 확인.' },
      { t: '느린 속도 투구', d: '공 들고 50% 강도로 실제 투구. 매 투구 후 본인이 앞발 위치 바로 체크.' },
      { t: '점진 증가', d: '80% → 100%로 올리면서 10구 중 8구 이상 허용선 내 성공 시 다음 단계.' },
      { t: '셀프 체크', d: '휴대폰으로 마운드 뒤 상단 각도에서 촬영. 앞발 착지점과 타겟이 같은 수직선상인지.' },
    ],
    reps: '4세트 × 10구 (정확도 > 속도)',
    fail: [
      '앞발이 타겟 라인 안쪽으로 교차(크로스파이어) → 몸통 회전 차단',
      '앞발이 바깥쪽 이탈 → 몸통 조기 열림',
    ],
    selfCheck: '정면 상단(등 뒤에 카메라 높이 세우고) 영상에서 앞발 착지점이 타겟과 한 직선상에 있는지. 벗어나면 허용선 안에 들 때까지 반복.',
  },
  {
    id: 'front-block',
    tag: '차단',
    title: 'Front Leg Block · 앞다리 차단 드릴',
    target: '앞다리 차단(브레이싱) 부족 · 체중 이동 누수',
    triggers: ['차단', '브레이싱', '앞다리', '앞발', 'block', 'front leg', '체중'],
    level: '중급',
    equipment: '박스 또는 낮은 계단(15cm) · (선택) 2kg 공 또는 물통',
    duration: '12분',
    cue: '"앞무릎을 잠그고 몸통을 튕겨라 — 기둥처럼 서라"',
    steps: [
      { t: '스텝업 홀드', d: '앞발을 박스/계단 위에 올리고 축각으로 체중을 앞으로 이동. 앞무릎이 발끝을 넘지 않게 잠근다. 5초 × 5회.' },
      { t: '메디볼 슬램', d: '공(또는 물통)을 머리 위에서 앞발 직전 바닥으로 내려찍기. 앞다리가 "벽" 역할. 3세트 × 6회.' },
      { t: '쉐도우 피치', d: '박스 없이 평지에서 투구 동작. 착지 순간 앞무릎을 "탁" 하고 펴지는 감각에 집중.' },
      { t: '셀프 체크', d: '측면 촬영 후 앞발 착지 프레임 → 릴리스 프레임을 비교. 무릎 각도가 넓어지는(펴지는) 방향이어야 정상.' },
    ],
    reps: '3세트 × 6회 (스텝업) + 3세트 × 6회 (슬램)',
    fail: [
      '착지 후 앞무릎이 계속 굽음 → 에너지 누수',
      '무릎이 안쪽으로 무너짐(발생 시 즉시 중단, 통증 여부 확인)',
    ],
    selfCheck: '측면 슬로우모션 영상에서 앞발 착지 → 릴리스 사이 무릎 각도 변화를 확인. 각도가 40–50° 정도 "펴지면" 정상 블로킹.',
  },
  {
    id: 'arm-path',
    tag: '팔궤도',
    title: 'Clean Arm Path · 팔 궤적 정리 드릴',
    target: '팔 궤적 비효율 · 릴리스 포인트 불안정',
    triggers: ['팔', '궤도', 'arm', 'path', '릴리스', 'release'],
    level: '기본',
    equipment: '수건 1장 · 야구공',
    duration: '10분',
    cue: '"엄지 아래로 → 공은 위로 — W가 아닌 반원"',
    steps: [
      { t: '타월 드릴', d: '공 대신 수건을 쥐고 투구 동작. 팔을 뒤로 보낼 때 엄지가 아래(thumbs down)로 향하는지 스스로 확인.' },
      { t: '피봇 픽오프', d: '축각만으로 회전해 공 없이 릴리스. 팔꿈치가 어깨보다 아래로 떨어지지 않도록 한다.' },
      { t: '리버스 스로우', d: '타겟을 등지고 선 상태에서 공을 머리 위 방향으로 가볍게 던진다(4m). 팔 궤도 리듬 회복용.' },
      { t: '실투 통합', d: '캐치볼로 교정된 팔 궤도를 실제 투구에 적용. 20m × 15개, 힘 70%.' },
      { t: '셀프 체크', d: '후면 영상으로 팔이 "큰 원"을 그리는지 확인. 팔꿈치가 어깨 아래로 떨어지면 타월 드릴 재반복.' },
    ],
    reps: '3세트 × 8회 (타월) + 캐치볼 15구',
    fail: [
      '팔꿈치가 어깨보다 낮음 (elbow drop / inverted W)',
      '릴리스 포인트가 매번 바뀜 → 제구 흔들림',
    ],
    selfCheck: '후면에서 슬로우모션으로 팔 궤적을 찍어 팔꿈치 높이를 프레임별로 본다. 어깨 라인 아래로 내려가면 OUT, 같거나 높으면 OK.',
  },
  {
    id: 'tempo',
    tag: '템포',
    title: 'Tempo Reset · 동작 타이밍 드릴',
    target: '동작 타이밍 붕괴 · 에너지 전달 지연',
    triggers: ['템포', 'tempo', '타이밍', '시퀀스', '에너지', '전달'],
    level: '기본',
    equipment: '스마트폰 메트로놈 앱 · 거울 또는 셀카 영상',
    duration: '10분',
    cue: '"1-2-3 리듬 — 들어, 모아, 던져"',
    steps: [
      { t: '메트로놈 60bpm', d: '앱 실행(60bpm). "1박: 와인드업, 2박: 핸드브레이크, 3박: 릴리스". 박자에 맞춰 천천히 반복.' },
      { t: '가속 구간 강조', d: '앞발 착지 → 릴리스까지는 반박(0.5박)에 빠르게. 앞은 느리게, 뒤는 폭발적으로.' },
      { t: '거울/셀카 피드백', d: '거울 앞에서 동작. 각 구간 정지 포지션에서 자세 점검. 또는 셀카 영상으로 확인.' },
      { t: '실투 전환', d: '메트로놈 없이 캐치볼 20개. 몸으로 익힌 리듬을 유지하는지 스스로 느낀다.' },
      { t: '셀프 체크', d: '영상 스톱워치로 핸드브레이크 → 릴리스 구간을 측정. 0.4–0.5초가 이상적.' },
    ],
    reps: '3세트 × 10회 (리듬 드릴) + 캐치볼 20구',
    fail: [
      '전반이 너무 빠름 → 후반 가속 불가',
      '핸드브레이크에서 멈춤이 길어 리듬 붕괴',
    ],
    selfCheck: '스마트폰 스톱워치/영상 플레이어로 앞발 착지 프레임과 릴리스 프레임을 찍어 시간차 계산. 0.4–0.5초 범위면 정상.',
  },
];

function pickDrills(p) {
  // 선수 약점 + 코어이슈 + 플래그 텍스트를 매칭에 사용
  const haystack = [
    p.coreIssue || '',
    ...(p.weaknesses||[]).map(w => w.title + ' ' + (w.detail||'')),
    ...(p.flags||[]).map(f => f.title + ' ' + (f.detail||'')),
  ].join(' ').toLowerCase();

  const scored = DRILL_CATALOG.map(d => {
    const hits = d.triggers.filter(tr => haystack.includes(tr.toLowerCase())).length;
    return { d, hits };
  }).sort((a,b) => b.hits - a.hits);

  const picked = scored.filter(s => s.hits > 0).map(s => s.d);
  if (picked.length < 3) {
    DRILL_CATALOG.forEach(d => {
      if (picked.length < 3 && !picked.includes(d)) picked.push(d);
    });
  }
  return picked.slice(0, 4);
}

function MechanicDrills({ p }) {
  const drills = pickDrills(p);
  const [activeIdx, setActiveIdx] = useState(0);
  const active = drills[activeIdx] || drills[0];

  return (
    <div className="drills-wrap">
      {/* 상단 인트로 */}
      <div className="drills-intro">
        <div className="drills-intro-head">
          <div className="drills-intro-kicker">For Athletes · 선수용</div>
          <h3 className="drills-intro-title">혼자서 수행하는 교정 드릴 {drills.length}개</h3>
          <div className="drills-intro-sub">
            {p.name} 선수의 <b>진단 결과</b>에 따라 자동 선별된 드릴입니다.
            모든 드릴은 <b>최소 장비 · 셀프 체크 방법 · 단계별 지시</b>를 포함해
            혼자서도 안전하게 진행할 수 있도록 구성했습니다.
          </div>
        </div>
        <div className="drills-legend">
          <div className="dl-item"><span className="dl-dot" style={{background:'#60a5fa'}}/>타겟</div>
          <div className="dl-item"><span className="dl-dot" style={{background:'#fbbf24'}}/>단계</div>
          <div className="dl-item"><span className="dl-dot" style={{background:'#f87171'}}/>주의</div>
          <div className="dl-item"><span className="dl-dot" style={{background:'#4ade80'}}/>셀프 체크</div>
        </div>
      </div>

      {/* 탭 */}
      <div className="drills-tabs">
        {drills.map((d, i) => (
          <button key={d.id}
            className={`drill-tab ${i === activeIdx ? 'active' : ''}`}
            onClick={() => setActiveIdx(i)}>
            <span className="dt-num">0{i+1}</span>
            <div className="dt-txt">
              <div className="dt-tag">{d.tag}</div>
              <div className="dt-title">{d.title}</div>
            </div>
          </button>
        ))}
      </div>

      {/* 드릴 상세 */}
      {active && (
        <div className="drill-card" key={active.id}>
          <div className="dc-head">
            <div>
              <div className="dc-tag">{active.tag} · {active.level}</div>
              <h3 className="dc-title">{active.title}</h3>
              <div className="dc-target">🎯 <b>타겟</b> · {active.target}</div>
            </div>
            <div className="dc-meta">
              <div className="dcm-row"><span>장비</span><b>{active.equipment}</b></div>
              <div className="dcm-row"><span>소요</span><b>{active.duration}</b></div>
              <div className="dcm-row"><span>세트</span><b>{active.reps}</b></div>
            </div>
          </div>

          <div className="dc-cue">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
            <span>{active.cue}</span>
          </div>

          <div className="dc-body">
            <div className="dc-col">
              <div className="dc-col-title">
                <span className="dl-dot" style={{background:'#fbbf24'}}/>
                단계별 실행
              </div>
              <ol className="dc-steps">
                {active.steps.map((s, i) => (
                  <li key={i}>
                    <span className="ds-num">{i+1}</span>
                    <div>
                      <b>{s.t}</b>
                      <p>{s.d}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="dc-col">
              <div className="dc-col-title">
                <span className="dl-dot" style={{background:'#f87171'}}/>
                주의할 실수
              </div>
              <ul className="dc-fails">
                {active.fail.map((f, i) => <li key={i}>⚠️ {f}</li>)}
              </ul>

              <div className="dc-col-title" style={{ marginTop: 20 }}>
                <span className="dl-dot" style={{background:'#4ade80'}}/>
                셀프 체크 방법
              </div>
              <div className="dc-coach">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></svg>
                <span>{active.selfCheck}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- COMPARE VIEW ---------------- */
function CompareCol({ p }) {
  const bandLabel = { high: '상위', mid: '범위', low: '미만', na: '—' };
  const taLeak = p.energy.etiTA < 0.85;
  return (
    <div className="compare-col">
      <div className="col-head">
        <div className="av">{p.name[0]}</div>
        <div>
          <div className="nm">{p.name}</div>
          <div className="meta">{p.archetype} · {p.date}</div>
        </div>
      </div>
      <div className="col-body">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 16 }}>
          <div style={{ fontFamily: 'Inter', fontSize: 36, fontWeight: 900, color: 'var(--d-fg1)', letterSpacing: '-0.02em', lineHeight: 1 }}>
            {p.velocity.toFixed(1)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--d-fg3)', fontWeight: 600 }}>km/h · peak</div>
          <span className={`sev sev-${p.severity}`} style={{ marginLeft: 'auto', fontSize: 10, padding: '4px 8px' }}>
            {p.severity === 'NONE' ? 'BAL' : p.severity}
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
          <RadarChart data={p.radar}/>
        </div>

        <div style={{ marginTop: 16 }}>
          <div className="compare-stat">
            <span className="lbl">CMJ 단위파워</span>
            <span className="val">{p.physical.cmjPower.cmj}</span>
            <span className={`band ${p.physical.cmjPower.band}`}>{bandLabel[p.physical.cmjPower.band]}</span>
          </div>
          <div className="compare-stat">
            <span className="lbl">절대근력 (N/kg)</span>
            <span className="val">{p.physical.maxStrength.perKg ?? '—'}</span>
            <span className={`band ${p.physical.maxStrength.band}`}>{bandLabel[p.physical.maxStrength.band]}</span>
          </div>
          <div className="compare-stat">
            <span className="lbl">RSI-mod</span>
            <span className="val">{p.physical.reactive.cmj}</span>
            <span className={`band ${p.physical.reactive.band}`}>{bandLabel[p.physical.reactive.band]}</span>
          </div>
          <div className="compare-stat">
            <span className="lbl">EUR</span>
            <span className="val">{p.physical.ssc.value}</span>
            <span className={`band ${p.physical.ssc.band}`}>{bandLabel[p.physical.ssc.band]}</span>
          </div>
          <div className="compare-stat">
            <span className="lbl">악력 (kg)</span>
            <span className="val">{p.physical.release.value}</span>
            <span className={`band ${p.physical.release.band}`}>{bandLabel[p.physical.release.band]}</span>
          </div>
          <div className="compare-stat">
            <span className="lbl">Max Layback</span>
            <span className="val">{p.layback.deg.toFixed(1)}°</span>
            <span className={`band ${p.layback.band}`}>{bandLabel[p.layback.band]}</span>
          </div>
          <div className="compare-stat">
            <span className="lbl">Trunk→Arm ETI</span>
            <span className="val">{p.energy.etiTA.toFixed(2)}</span>
            <span className={`band ${taLeak ? 'low' : 'high'}`}>{taLeak ? '미만' : '상위'}</span>
          </div>
          <div className="compare-stat">
            <span className="lbl">상완 회전속도</span>
            <span className="val">{p.angular.arm}<span style={{fontSize:10,color:'var(--d-fg3)',marginLeft:2}}>°/s</span></span>
            <span className={`band ${p.angular.armBand}`}>{bandLabel[p.angular.armBand]}</span>
          </div>
        </div>

        <div style={{ marginTop: 16, padding: 12, borderRadius: 8, background: 'var(--d-surface-3)', border: '1px solid var(--d-border)' }}>
          <div style={{ fontSize: 10, color: 'var(--d-fg3)', fontFamily: 'Inter', letterSpacing: 1.5, fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>Core Issue</div>
          <div style={{ fontSize: 13, color: 'var(--d-fg1)', fontWeight: 600, lineHeight: 1.5 }}>{p.coreIssue}</div>
        </div>
      </div>
    </div>
  );
}

function CompareView({ pitchers, leftId, rightId, onLeft, onRight }) {
  const left = pitchers.find(p => p.id === leftId);
  const right = pitchers.find(p => p.id === rightId);
  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Compare Mode</h1>
          <div className="page-sub">선수 간 동일 지표 비교 · 색상 띠로 기준 대비 위치 확인</div>
        </div>
      </div>
      <div className="compare-bar">
        <span className="label">A</span>
        <div className="compare-slot">
          <select value={leftId} onChange={(e) => onLeft(e.target.value)}>
            {pitchers.map(p => <option key={p.id} value={p.id}>{p.name} · {p.velocity.toFixed(1)} km/h</option>)}
          </select>
        </div>
        <span className="label" style={{ marginLeft: 12 }}>vs</span>
        <span className="label">B</span>
        <div className="compare-slot">
          <select value={rightId} onChange={(e) => onRight(e.target.value)}>
            {pitchers.map(p => <option key={p.id} value={p.id}>{p.name} · {p.velocity.toFixed(1)} km/h</option>)}
          </select>
        </div>
      </div>
      <div className="compare-grid">
        {left && <CompareCol p={left}/>}
        {right && <CompareCol p={right}/>}
      </div>
    </>
  );
}

/* ---------------- APP ---------------- */
function App() {
  const pitchers = window.BBL_PITCHERS;
  const [activeId, setActiveId] = useState(pitchers[0].id);
  const [mode, setMode] = useState('single');
  const [leftId, setLeftId] = useState(pitchers[0].id);
  const [rightId, setRightId] = useState(pitchers[1].id);
  const [theme, setTheme] = useTheme();
  const [activeNav, setActiveNav] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const active = pitchers.find(p => p.id === activeId);

  const navItems = [
    { id: 'overview', label: 'Overview',     icon: Ic.home,     num: '00' },
    { id: 'physical', label: '체력 프로파일', icon: Ic.body,     num: '01' },
    { id: 'mech',     label: '투구 메카닉스', icon: Ic.motion,   num: '02' },
    { id: 'sw',       label: '강점·약점',     icon: Ic.star,     num: '03' },
    { id: 'flags',    label: '체크 포인트',   icon: Ic.flag,     num: '04' },
    { id: 'training', label: '피지컬 트레이닝', icon: Ic.dumbbell, num: '05' },
    { id: 'drills',   label: '동작 교정 드릴', icon: Ic.motion,   num: '06' },
  ];

  // Smooth scroll to section
  const onNavSelect = (id) => {
    setActiveNav(id);
    if (id === 'overview') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const numMap = { physical: '01', mech: '02', sw: '03', flags: '04', training: '05', drills: '06' };
    const targetNum = numMap[id];
    setTimeout(() => {
      const block = document.querySelector(`.section-block[data-section-num="${targetNum}"]`);
      if (block) {
        // React 내부 state도 변경되도록 커스텀 이벤트 발송
        block.dispatchEvent(new Event('__open'));
        // open 클래스 적용 대기 후 스크롤
        setTimeout(() => {
          const y = block.getBoundingClientRect().top + window.pageYOffset - 16;
          window.scrollTo({ top: y, behavior: 'smooth' });
        }, 80);
      }
    }, 50);
  };

  return (
    <>
      <div className="scene" aria-hidden="true"/>
      <div className="dash">
        <Sidebar pitchers={pitchers} activeId={activeId} onSelect={setActiveId}
          mode={mode} onMode={setMode}
          navItems={navItems} activeNav={activeNav} onNavSelect={onNavSelect}
          isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)}/>
        <div className="main">
          <DashTopBar pitcher={active} mode={mode} theme={theme} onTheme={setTheme}
            onMenu={() => setSidebarOpen(o => !o)}/>
          <div className="content">
            {mode === 'single' && active && <SinglePitcherView p={active} key={activeId}/>}
            {mode === 'compare' && (
              <CompareView pitchers={pitchers}
                leftId={leftId} rightId={rightId}
                onLeft={setLeftId} onRight={setRightId}/>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
