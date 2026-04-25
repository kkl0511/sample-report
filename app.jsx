/* global React, ReactDOM */
const { useState, useEffect, useRef } = React;

function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    document.documentElement.classList.add('js-reveal');
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.05, rootMargin: '0px 0px -40px 0px' });
    const nodes = el.querySelectorAll('.reveal, .reveal-stagger');
    nodes.forEach(n => io.observe(n));
    // safety: if any node is already in viewport, reveal immediately
    requestAnimationFrame(() => {
      nodes.forEach(n => {
        const r = n.getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > 0) n.classList.add('in');
      });
    });
    return () => io.disconnect();
  }, []);
  return ref;
}

function TopBar({ pitchers, activeId, onSelect }) {
  return (
    <div className="topbar">
      <div className="topbar-inner">
        <div className="brand-lockup">
          <img src="assets/logo-bbl.png" alt="BBL"/>
          <div className="brand-text">
            <div className="name">BioMotion Baseball Lab</div>
            <div className="sub">Pitcher Integrated Report · v4</div>
          </div>
        </div>
        <div className="topbar-nav">
          {pitchers.map(p => (
            <button key={p.id}
              className={`pitcher-pill ${p.id === activeId ? 'active' : ''}`}
              onClick={() => onSelect(p.id)}>
              {p.name}
              <span className="v">{p.velocity.toFixed(1)} km/h</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Cover({ p }) {
  return (
    <section className="cover">
      <div className="container">
        <div className="cover-kicker">BBL · Pitcher Integrated Analysis · 2026</div>
        <div className="cover-grid">
          <div>
            <h1 className="cover-title">
              투수 통합<br/>분석 리포트
              <span className="en">Pitcher Integrated Analysis Report</span>
            </h1>
            <div className="cover-subject">
              <div className="cover-name">{p.name}</div>
              <div className="cover-archetype">
                <span>체력 유형: {p.archetype}</span>
                <span className="en"> · {p.archetypeEn}</span>
              </div>
              <div className="cover-tags">
                {p.tags.map(t => <span key={t} className="tag-chip">{t}</span>)}
              </div>
            </div>
            <div className="core-issue">
              <span className={`sev sev-${p.severity}`}>{p.severity === 'NONE' ? 'BALANCED' : p.severity}</span>
              <div>
                <div style={{ fontSize: 11, color: 'var(--bbl-fg3)', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4, fontFamily: 'Inter' }}>Core Issue</div>
                <div className="text">{p.coreIssue}</div>
              </div>
            </div>
          </div>
          <div className="cover-velocity-card">
            <div className="cv-label">Measured Peak Velocity</div>
            <div className="cv-value">
              {p.velocity.toFixed(1)}
              <span className="unit">KM/H</span>
            </div>
            <div className="cv-meta">
              <div>Avg <b>{p.velocityAvg.toFixed(1)}</b></div>
              <div>Trials <b>10</b></div>
              <div>Date <b>{p.date}</b></div>
            </div>
          </div>
        </div>
      </div>
      <div className="scroll-hint">
        <span>Scroll</span>
        <div className="line"></div>
      </div>
    </section>
  );
}

function SectionHead({ num, kicker, title, lead }) {
  return (
    <div className="section-head reveal">
      <div>
        <div className="section-kicker"><span className="num">{num}</span>{kicker}</div>
        <h2 className="section-title">{title}</h2>
      </div>
      {lead && <p className="section-lead">{lead}</p>}
    </div>
  );
}

function PhysicalSection({ p }) {
  const rows = [
    { k: '점프 파워 (체중당)', sub: 'Peak Power ÷ 체중 (W/kg)', val: `CMJ ${p.physical.cmjPower.cmj} | SJ ${p.physical.cmjPower.sj} W/kg`, band: p.physical.cmjPower.band },
    { k: '전신 최대근력 (IMTP)', sub: 'IMTP Peak Force 절대값 | 체중당 값',
      val: p.physical.maxStrength.abs == null ? '미측정' : `${p.physical.maxStrength.abs} N | ${p.physical.maxStrength.perKg} N/kg`,
      band: p.physical.maxStrength.band },
    { k: '점프 반응성 (RSI)', sub: 'Reactive strength index', val: `CMJ ${p.physical.reactive.cmj} | SJ ${p.physical.reactive.sj} m/s`, band: p.physical.reactive.band },
    { k: '반동 활용도 (EUR)', sub: 'EUR = CMJ 높이 ÷ SJ 높이', val: `${p.physical.ssc.value}`, band: p.physical.ssc.band },
    { k: '악력', sub: 'Grip strength', val: `${p.physical.release.value} kg`, band: p.physical.release.band },
  ];
  const bandLabel = { low: '기준 미만', mid: '기준 범위', high: '기준 상위', na: '미측정' };
  return (
    <section className="section">
      <div className="container">
        <SectionHead num="01" kicker="Physical Profile"
          title="체력 프로파일: 5개 핵심 역량 종합 평가"
          lead="· 점프(CMJ / SJ) · 등척성 최대근력 · 반응성 · SSC 활용 · 악력 통합 평가"/>
        <div className="physical-grid reveal">
          <div className="card card-stripe" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <RadarChart data={p.radar}/>
          </div>
          <div className="card card-stripe">
            <div className="card-head">
              <div>
                <h3 className="card-title">세부 측정값</h3>
                <div className="card-sub">안쪽 띠 = 기준 미만 · 바깥 띠 = 기준 상위</div>
              </div>
            </div>
            <div>
              {rows.map((r,i) => (
                <div className="metric-row" key={i}>
                  <div className="lbl">{r.k}<small>{r.sub}</small></div>
                  <div className="val">{r.val}</div>
                  <div className={`band band-${r.band}`}>{bandLabel[r.band]}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function VideoCard({ src }) {
  const videoRef = useRef(null);
  const [rate, setRate] = useState(0.1);
  const [isPaused, setIsPaused] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const rates = [0.1, 1];
  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = rate;
  }, [rate]);
  // Frame step — uses requestVideoFrameCallback if available, else fixed 30fps delta
  const FRAME = 1 / 30;
  const step = async (dir) => {
    const v = videoRef.current;
    if (!v) return;
    try { await v.pause(); } catch(_) {}
    const dur = isFinite(v.duration) ? v.duration : Infinity;
    const next = Math.max(0, Math.min(dur, v.currentTime + dir * FRAME));
    // Seek and wait for frame to actually render
    v.currentTime = next;
  };
  const toggle = async () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { try { await v.play(); } catch(_) {} }
    else v.pause();
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
    <div className="card card-stripe reveal video-card" style={{ marginBottom: 24 }}>
      <div className="card-head">
        <div>
          <div className="section-kicker" style={{ fontSize: 10 }}>2.0 · Motion Capture</div>
          <h3 className="card-title" style={{ marginTop: 4 }}>투구 영상 — 측정 시퀀스</h3>
          <div className="card-sub">· Uplift Labs 마커리스 캡처 · 기본 0.1× · ← → 프레임 단위 · Space 재생/정지</div>
        </div>
        <div className="rate-switch">
          {rates.map(r => (
            <button
              key={r}
              className={`rate-btn ${rate === r ? 'active' : ''}`}
              onClick={() => setRate(r)}>
              {r}×
            </button>
          ))}
        </div>
      </div>
      <div className="video-wrap" tabIndex={0} onKeyDown={onKey}>
        <video
          ref={videoRef}
          src={src}
          playsInline
          preload="auto"
          onPlay={() => setIsPaused(false)}
          onPause={() => setIsPaused(true)}
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => {
            e.currentTarget.playbackRate = rate;
            setDuration(e.currentTarget.duration || 0);
          }}
          onClick={toggle}
          style={{ width: '100%', display: 'block', borderRadius: 12, background: '#000', cursor: 'pointer' }}
        />
        {/* 큰 중앙 오버레이 Play/Pause 버튼 */}
        <button
          className="video-overlay-btn"
          onClick={toggle}
          aria-label={isPaused ? '재생' : '일시정지'}
          title={isPaused ? '재생 (Space)' : '일시정지 (Space)'}>
          {isPaused
            ? (
              <svg viewBox="0 0 64 64" width="40" height="40" aria-hidden="true">
                <polygon points="20,14 50,32 20,50" fill="currentColor"/>
              </svg>
            )
            : (
              <svg viewBox="0 0 64 64" width="40" height="40" aria-hidden="true">
                <rect x="18" y="14" width="10" height="36" rx="2" fill="currentColor"/>
                <rect x="36" y="14" width="10" height="36" rx="2" fill="currentColor"/>
              </svg>
            )
          }
        </button>
        {/* 시크 바 (Scrubber) */}
        <div className="seek-bar">
          <span className="seek-time">{formatTime(currentTime)}</span>
          <input
            type="range"
            className="seek-slider"
            min={0}
            max={duration || 0}
            step={FRAME}
            value={currentTime}
            onChange={onSeek}
            onMouseDown={() => { try { videoRef.current && videoRef.current.pause(); } catch(_) {} }}
            style={{ '--seek-progress': `${duration ? (currentTime / duration) * 100 : 0}%` }}
            aria-label="동영상 시점 이동"
          />
          <span className="seek-time">{formatTime(duration)}</span>
        </div>
        <div className="frame-controls">
          <button className="frame-btn" onClick={() => step(-1)} title="이전 프레임 (←)">
            <span>◀ −1 frame</span>
          </button>
          <button className="frame-btn play" onClick={toggle} title="재생 / 정지 (Space)">
            {isPaused ? '▶  재생' : '❚❚ 정지'}
          </button>
          <button className="frame-btn" onClick={() => step(1)} title="다음 프레임 (→)">
            <span>+1 frame ▶</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function MechanicsSection({ p }) {
  return (
    <section className="section">
      <div className="container">
        <SectionHead num="02" kicker="Pitching Mechanics"
          title="투구 메카닉스 — 에너지 흐름과 키네매틱 시퀀스"
          lead={<>■ 투구 = 채찍질 동작 (하체 → 몸통 → 팔 → 손 순차 전달)<br/>■ 구속 결정 요인: 분절 순서 정확성 + 단계별 에너지 손실 최소화</>}/>

        {p.video && <VideoCard src={p.video}/>}

        <div className="card card-stripe reveal" style={{ marginBottom: 24 }}>
          <div className="card-head">
            <div>
              <div className="section-kicker" style={{ fontSize: 10 }}>2.1 · Energy Transfer & Leak</div>
              <h3 className="card-title" style={{ marginTop: 4 }}>에너지 전달과 누수 — 하체에서 팔까지의 흐름</h3>
              <div className="card-sub">· ETI = 분절 간 에너지 전달 비율<br/>· 몸통 → 상완 ETI ≈ 1.0 → 에너지 거의 전부 전달<br/>· ETI &lt; 0.85 → 해당 구간 에너지 리크 발생</div>
            </div>
          </div>
          <EnergyFlow energy={p.energy}/>
          <div className="chart-caption">{p.energy.comment}</div>
        </div>

        <div className="card card-stripe reveal" style={{ marginBottom: 24 }}>
          <div className="card-head">
            <div>
              <div className="section-kicker" style={{ fontSize: 10 }}>2.2 · Sequence Timing</div>
              <h3 className="card-title" style={{ marginTop: 4 }}>키네매틱 시퀀스 — 분절 피크 회전 속도의 순서</h3>
              <div className="card-sub">· 이상적인 순서: 골반 → 몸통 → 상완 (proximal-to-distal)<br/>· 인접 분절 피크 회전 속도 시점 간격: 약 30–60 ms</div>
            </div>
          </div>
          <SequenceChart sequence={p.sequence}/>
          <div className="chart-caption">{p.sequence.comment}</div>
        </div>

        <div className="card card-stripe reveal" style={{ marginBottom: 24 }}>
          <div className="card-head">
            <div>
              <div className="section-kicker" style={{ fontSize: 10 }}>2.3 · Peak Angular Velocity</div>
              <h3 className="card-title" style={{ marginTop: 4 }}>분절별 최대 회전 속도</h3>
              <div className="card-sub">· 측정: 분절별 최대 회전 속도<br/>· 프로 범위: 골반 580–640°/s · 몸통 800–900°/s · 상완 1450–1600°/s<br/>· 막대가 회색 띠(기준 범위) 초과 → 강점</div>
            </div>
          </div>
          <AngularChart angular={p.angular}/>
          <div className="chart-caption">{p.angular.comment}</div>
          <div className="chip-row">
            <div className="gain-chip">Speed Gain · 골반→몸통 <b>×{p.angular.gainPT.toFixed(2)}</b></div>
            <div className="gain-chip">Speed Gain · 몸통→상완 <b>×{p.angular.gainTA.toFixed(2)}</b></div>
          </div>
        </div>

        <div className="card card-stripe layback-card reveal">
          <div className="layback-copy">
            <div className="section-kicker" style={{ fontSize: 10 }}>2.4 · Max Layback</div>
            <h3 className="card-title" style={{ marginTop: 4 }}>팔 뒤로 젖힘 — 공이 가속되는 거리</h3>
            <div className="card-sub" style={{ maxWidth: 440, marginTop: 8 }}>
              · 팔을 가장 뒤로 젖힌 각도 · 클수록 가속 거리 확보 · 프로 범위 160°–180°
            </div>
            <div style={{ marginTop: 20, display: 'flex', alignItems: 'baseline', gap: 16 }}>
              <div className="layback-value">{p.layback.deg.toFixed(1)}<span className="deg">°</span></div>
              <div className={`band band-${p.layback.band}`} style={{ fontSize: 11 }}>
                {p.layback.band === 'high' ? '기준 상위' : p.layback.band === 'mid' ? '기준 범위' : '기준 미만'}
              </div>
            </div>
            <div style={{ color: 'var(--bbl-fg2)', marginTop: 12, fontSize: 14 }}>{p.layback.note}</div>
          </div>
          <div>
            <div className="layback-photo">
              <img src="assets/max-layback.png" alt="Max Layback reference"/>
            </div>
            <div className="layback-photo-caption">Reference · Max Layback</div>
          </div>
          <LaybackMeter deg={p.layback.deg}/>
        </div>
      </div>
    </section>
  );
}

function StorySection({ p }) {
  const taLeak = p.energy.etiTA < 0.85;
  return (
    <section className="section">
      <div className="container">
        <SectionHead num="03" kicker="Velocity Story"
          title="구속 스토리 — 어디서 만들어지고 어디서 잃는가"
          lead={`· 실측 ${p.velocity.toFixed(1)} km/h 생성·손실 구간 요약`}/>
        <div className="card card-stripe story-card reveal">
          <div className="story-list">
            <div className="story-row">
              <span className="seg">하체 → 몸통</span>
              <span className="metric">ETI {p.energy.etiPT.toFixed(2)}</span>
              <span className="note">· 하체 회전 → 몸통 정상 전달</span>
            </div>
            <div className="story-row">
              <span className="seg">몸통 → 상완</span>
              <span className="metric" style={{ color: taLeak ? '#f87171' : '#4ade80' }}>ETI {p.energy.etiTA.toFixed(2)}</span>
              <span className="note">
                {taLeak
                  ? `· 약 ${p.energy.leakPct}% 에너지 손실 · 구속 상승의 가장 큰 걸림돌`
                  : '· 효율적 전달 · 구속 핵심 엔진'}
              </span>
            </div>
            <div className="story-row">
              <span className="seg">Max Layback</span>
              <span className="metric">{p.layback.deg.toFixed(1)}°</span>
              <span className="note">{p.layback.note}</span>
            </div>
          </div>
          <div className="story-conclusion">
            <b>핵심 과제</b> — {p.coreIssue}
          </div>
        </div>
      </div>
    </section>
  );
}

function SWSection({ p }) {
  return (
    <section className="section">
      <div className="container">
        <SectionHead num="04" kicker="Strengths & Weaknesses"
          title="강점과 약점"
          lead="· 통합 판정 기반 강점 · 개선 과제 정리"/>
        <div className="sw-grid reveal-stagger">
          <div className="card card-stripe">
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
          <div className="card card-stripe">
            <div className="sw-title neg">
              <svg width="14" height="14" viewBox="0 0 16 16"><path d="M4 4l8 8M12 4l-8 8" stroke="#f87171" strokeWidth="2.5" fill="none" strokeLinecap="round"/></svg>
              약점 · Improvement Areas
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
      </div>
    </section>
  );
}

function FlagsSection({ p }) {
  if (!p.flags.length) return null;
  return (
    <section className="section">
      <div className="container">
        <SectionHead num="05" kicker="Diagnostic Flags"
          title="진단 플래그"
          lead="· 자동 규칙 엔진 감지 주의·경계 신호 · 훈련 우선순위 근거"/>
        <div className="reveal-stagger">
          {p.flags.map((f,i) => (
            <div className={`flag-item ${f.severity}`} key={i}>
              <div className="head">
                <span className={`sev sev-${f.severity}`} style={{ padding: '4px 8px', fontSize: 10 }}>{f.severity}</span>
                <span className="t">{f.title}</span>
              </div>
              <ul>{f.evidence.map((e,j) => <li key={j}>{e}</li>)}</ul>
              <div className="impl">{f.implication}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TrainingSection({ p }) {
  return (
    <section className="section">
      <div className="container">
        <SectionHead num={p.flags.length ? '06' : '05'} kicker="Training Priorities"
          title="훈련 우선순위"
          lead="· 진단 기반 4–12주 블록 우선순위 · 실제 적용은 트레이너·지도자 상의"/>
        <div className="training-list reveal-stagger">
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
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div><b>BioMotion Baseball Lab</b> · Kookmin University · <a href="https://biomotion.kr" style={{ color: 'var(--bbl-primary)' }}>biomotion.kr</a></div>
        <div style={{ marginTop: 6 }}>· BBL 통합 분석 파이프라인 자동 생성 · 측정 · Uplift Labs 마커리스 모션캡처 · VALD ForceDecks · 랩소도</div>
        <div style={{ marginTop: 6, opacity: 0.6 }}>· 훈련 권고 참고용 · 실제 적용은 트레이너·지도자 상의</div>
      </div>
    </footer>
  );
}

function App() {
  const pitchers = window.BBL_PITCHERS;
  const [activeId, setActiveId] = useState(pitchers[0].id);
  const active = pitchers.find(p => p.id === activeId);
  const pageRef = useReveal();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeId]);

  return (
    <>
      <div className="scene" aria-hidden="true"/>
      <TopBar pitchers={pitchers} activeId={activeId} onSelect={setActiveId}/>
      <div className="page page-switch" key={activeId} ref={pageRef} data-screen-label={active.name}>
        <Cover p={active}/>
        <PhysicalSection p={active}/>
        <MechanicsSection p={active}/>
        <StorySection p={active}/>
        <SWSection p={active}/>
        <FlagsSection p={active}/>
        <TrainingSection p={active}/>
        <Footer/>
      </div>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
