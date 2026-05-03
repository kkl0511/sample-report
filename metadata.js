// metadata.js — BBL 신규선수 리포트 데이터 정의
// v31.24 (2026-05-04): 단일 HTML 파일에서 데이터 블록 분리 (가독성 향상)
// 의존: cohort_v29.js (먼저 로드되어야 함)
// 사용: index.html에서 <script src="metadata.js"> 로 로드 (v31.32 파일명 통일)

// ════════════════════════════════════════════════════════════════════
// KINETIC_FAULTS
// (원래 BBL_신규선수_리포트.html line 685~851)
// ════════════════════════════════════════════════════════════════════
// ★ v30.24 키네틱 체인 6단계 결함 패턴 자동 진단 (Step C)
//   m = CURRENT_INPUT.mechanics, hand = 'right'|'left'
//   각 패턴: stage(영향 단계), severity, detect(진단), cause(원인), coaching, drills
const KINETIC_FAULTS = [
  // ── 단계 1 (하체 드라이브) ──
  {
    id: 'WeakDrive', stage: 1, severity: 'medium',
    label: '추진력 약함 (Weak Drive)',
    // ★ v31.19 임계 정합 — 코호트 mean 2.90 m/s, sd 0.51. < 2.0 = 3.9% (medium 미달)
    //   < 2.24 ≈ mean - 1.3σ ≈ 코호트 하위 10% (medium 적정)
    detect: m => m.max_cog_velo != null && m.max_cog_velo < 2.24,
    cause: '뒤다리 push power 부족, hip extension 약함',
    coaching: '드라이브 다리 단단한 push 강조, COG 전진 능동화',
    drills: ['Lateral bound 3×5', 'Single-leg power clean', 'Depth jump 3×4'],
  },
  {
    id: 'SlowDriveHip', stage: 1, severity: 'medium',
    label: '뒷다리 hip 느림 (Slow Drive Hip)',
    detect: m => m.drive_hip_ext_vel_max != null && m.drive_hip_ext_vel_max < 455.05,
    cause: 'drive 다리 hip extension power 부족 또는 hinge 패턴 약함',
    coaching: 'Hip hinge 강조, drive 다리 신전 폭발력',
    drills: ['Hip airplane 3×6', 'Single-leg RDL 3×8', 'Romanian deadlift'],
  },
  {
    id: 'ShortStride', stage: 1, severity: 'low',
    label: '스트라이드 짧음 (Short Stride)',
    detect: m => m.stride_norm_height != null && m.stride_norm_height < 0.7,
    cause: 'drive 종합 약함 또는 부상·균형 두려움',
    coaching: '스트라이드 길이 70~90% 신장 목표, drive 길게',
    drills: ['스트라이드 마커 drill', 'Plyo 점프', 'Sled push'],
  },
  // ── 단계 2 (앞다리 블로킹) ──
  {
    id: 'LeadKneeCollapse', stage: 2, severity: 'high',
    label: '앞무릎 무너짐 ⚠ (Lead Knee Collapse)',
    detect: m => m.lead_knee_ext_change_fc_to_br != null && m.lead_knee_ext_change_fc_to_br < -22.2,
    cause: 'block 다리 quad/glute eccentric 약함 → 에너지 손실',
    coaching: '앞다리 stiff block 만들기, 무릎 펴진 자세 유지',
    drills: ['Eccentric step-down 5초 3×6', 'Single-leg RDL', 'Glute bridge ISO 30s'],
  },
  {
    id: 'SoftBlock', stage: 2, severity: 'high',
    label: '블록 부드러움 (Soft Block)',
    detect: m => m.com_decel_pct != null && m.com_decel_pct < 13.91,
    cause: 'block 다리 ecc 약함 → COG 감속 부족 → 회전 전환 비효율',
    coaching: 'COG 감속 강조, "stop and rotate" 개념',
    drills: ['Heavy single-leg ecc box jump', 'Drop landing 3×5'],
  },
  {
    id: 'LateBlock', stage: 2, severity: 'medium',
    label: '블록 늦음 (Late Block)',
    // ★ v31.19 임계 정합 — 코호트 mean 53ms, sd 114ms (sd가 mean보다 큼). > 106 = 32% (medium 너무 흔함)
    //   > 180ms ≈ 코호트 상위 ~13% (medium 적정), Driveline elite > 150ms와 호환
    detect: m => m.lead_knee_amortization_ms != null && m.lead_knee_amortization_ms > 180,
    cause: 'SSC efficiency 낮음 — 충격 흡수 후 신전이 늦음',
    coaching: '빠른 reactive block, contact 즉시 stiffen',
    drills: ['Plyo 단일 다리 점프', 'Contrast training'],
  },
  // ── 단계 3 (분리 형성) ──
  {
    id: 'FlyingOpen', stage: 3, severity: 'high',
    label: '몸통 일찍 열림 ⚠ (Flying Open)',
    // ★ v31.19 좌·우완 통합 좌표계로 변경 + 임계 합리화 (2026-05-04)
    //   기존: trunk_rotation_at_fc 좌·우완 분기. 통합 stats(bimodal)로 발동율 추정 불가
    //   현재: hip_shoulder_sep_at_fc(좌·우완 정규화된 단일 좌표, signed pelvis-trunk)
    //   코호트 mean 19.5°, sd 11.1° → < -1° = 코호트 하위 ~3% (high severity 적정)
    //   < -1° = trunk이 pelvis보다 1° 이상 먼저 회전 (진정한 분리 부재)
    detect: m => m.hip_shoulder_sep_at_fc != null && m.hip_shoulder_sep_at_fc < -1,
    cause: '하체 드라이브 부족 + hip-trunk 분리 못 만듦',
    coaching: 'FC 시 closed posture 유지, 골반 먼저 분리',
    drills: ['FC 거울 hold drill 3×30s', '비디오 cue', 'Hip dissociation drill'],
  },
  {
    id: 'InsufficientCounterRot', stage: 3, severity: 'medium',
    label: '카운터 로테이션 부족 (Insufficient Counter-Rotation)',
    detect: m => m.peak_torso_counter_rot != null && m.peak_torso_counter_rot < 25,
    cause: 'KH 시 어깨 추가 회전 안 함 → load 부족',
    coaching: 'KH 시 글러브 어깨 추가 비틀림 cue',
    drills: ['Hip-shoulder dissociation 3×8', 'KH pause 3초'],
  },
  {
    id: 'OpenFrontSide', stage: 3, severity: 'low',
    label: '글러브 사이드 열림 (Open Front Side)',
    // ★ v30.27 임계값 재조정 (2026-05-03): 134명 코호트 Q75 기반
    //   v30.26 이전: > 30° (Driveline 외국 표준) → 48.2% 양성 — 한국 코호트에 비현실
    //   v30.27: > 40° (코호트 Q75) → 23.1% 양성 — 상위 25%만 경고
    detect: m => m.shoulder_h_abd_at_fc != null && m.shoulder_h_abd_at_fc > 40,
    cause: 'glove side 약함 또는 cue 부족',
    coaching: 'glove side hold cue, 글러브 안 무너지게',
    drills: ['Glove-side wall throw', 'Anti-rotation press'],
  },
  // ── 단계 4 (트렁크 가속) ──
  {
    id: 'LateTrunkRotation', stage: 4, severity: 'medium',
    label: '몸통 회전 늦음 (Late Trunk Rotation)',
    // ★ v31.19 임계 미세 조정 — 코호트 mean 26ms, sd 53. > 80 = 15.3%, > 90 ≈ 11% (medium 정중앙)
    detect: m => m.pelvis_to_trunk_lag_ms != null && m.pelvis_to_trunk_lag_ms > 90,
    cause: 'trunk 활성화 늦음 → 운동량 사슬 단절',
    coaching: '골반 회전 직후 즉시 trunk 발화',
    drills: ['Rotational med ball throw', 'Slow-fast contrast 3 set'],
  },
  {
    id: 'PelvisTrunkDisconnect', stage: 4, severity: 'medium',
    label: '시퀀스 역순 (Pelvis-Trunk Disconnect)',
    // ★ v31.19 severity high→medium + 임계 < 0 → < -30ms (2026-05-04)
    //   메모리 원칙: 고교 1학년 코호트는 발달 단계 미숙으로 음수 lag 흔함
    //   기존 < 0 = 31% 발동 (high 부적정). < -30ms = 코호트 하위 ~13% (medium 적정)
    //   심각한 시퀀스 역순(elite 표준 대비 분명한 이탈)만 진단
    detect: m => m.pelvis_to_trunk_lag_ms != null && m.pelvis_to_trunk_lag_ms < -30,
    cause: 'trunk가 pelvis보다 30ms 이상 일찍 회전 — 명백한 시퀀스 역순',
    coaching: '"hip first" 강조, KH→FC sequencing 재학습',
    drills: ['KH→FC slow drill', 'Connected throw 3×5', 'Step-throw'],
  },
  // ── 단계 5 (상지 코킹·전달) ──
  {
    id: 'InsufficientLayback', stage: 5, severity: 'medium',
    label: '레이백 부족 (Insufficient Layback)',
    detect: m => m.max_shoulder_ER_deg != null && m.max_shoulder_ER_deg < 165,
    cause: '어깨 ER ROM 부족, scap stability 낮음',
    coaching: 'ER ROM + scap 안정화 보강',
    drills: ['Sleeper stretch 3×30s', 'ER PNF', 'Scap wall slide'],
  },
  {
    id: 'TrunkArmDisconnect', stage: 5, severity: 'high',
    label: '몸통→팔 전달 약함 ⚠ (Trunk→Arm Disconnect)',
    // ★ v31.19 임계 정합 — 코호트 mean 1.94, sd 0.42. < 1.39 = 9.6% (high 부적정)
    //   < 1.15 ≈ mean - 1.9σ ≈ 코호트 하위 ~3% (high severity 적정)
    detect: m => m.arm_trunk_speedup != null && m.arm_trunk_speedup < 1.15,
    cause: 'trunk 회전 에너지가 팔로 전달 안 됨 → 팔꿈치 의존 위험',
    coaching: 'connected throw drill, trunk-arm 시퀀스',
    drills: ['Long toss with intent', 'Plyo ball throw 3×5', 'Connected step-throw'],
  },
  // ── 단계 6 (릴리스 가속) ──
  {
    id: 'ElbowOverload', stage: 6, severity: 'critical',
    label: '팔꿈치 과부하 🚨 (Elbow Overload)',
    // ★ v31.19 — TrunkArmDisconnect와 일관성: speedup < 1.15 (코호트 하위 ~3%)
    detect: m => m.elbow_ext_vel_max != null && m.elbow_ext_vel_max > 2400 &&
                m.arm_trunk_speedup != null && m.arm_trunk_speedup < 1.15,
    cause: '전완에서 에너지 대량 생성 (몸통 전달 부족) → UCL/팔꿈치 부상 위험',
    coaching: '⚠ 즉시 볼륨 감소 + 트렁크 활성화 강화',
    drills: ['Volume reduce 30%', 'Trunk activation drill', 'Connected throw 위주'],
  },
  // ★ v30.29 신규: Elbow Watch list — sub-clinical 부상 위험 모니터링
  //   ElbowOverload(critical) 임계 직전 케이스 (예: 김온세 H2 ev=2380°/s)를 medium severity로 사전 경고
  //   ElbowOverload와 동시 발동 방지: speedup<1.5는 critical 우선, 1.5~1.8은 watch
  {
    id: 'ElbowWatchList', stage: 6, severity: 'medium',
    label: '팔꿈치 모니터링 ⚠ (Elbow Watch List)',
    detect: m => m.elbow_ext_vel_max != null && m.elbow_ext_vel_max > 2300 &&
                m.elbow_ext_vel_max <= 2400 &&  // Overload 임계 미만
                m.arm_trunk_speedup != null && m.arm_trunk_speedup >= 1.5 && m.arm_trunk_speedup < 1.8,
    cause: '팔꿈치 신전 속도 elite 상한 근접 + 몸통 전달 효율 저하 시작',
    coaching: '아직 부상 위험 임계는 아니지만 추적 권장 — 볼륨 모니터링 + 몸통 활성화 점진 강화',
    drills: ['PitchSmart 볼륨 가이드라인 준수', 'Connected throw 비율 증가', '회복 일수 충분 확보'],
  },
  {
    id: 'TrunkFallingForward', stage: 6, severity: 'medium',
    label: '몸통 앞으로 무너짐 (Trunk Falling Forward)',
    // ★ v31.19 임계 정합 — 코호트 mean 33°, sd 22°. abs > 43.6 = 32% (medium 너무 흔함)
    //   abs > 60° ≈ 코호트 양극단 ~12% (medium 적정). Werner 정상 범위 25~50°
    detect: m => m.trunk_forward_tilt_at_br != null && Math.abs(m.trunk_forward_tilt_at_br) > 60,
    cause: '코어 약함, lead leg block 부족',
    coaching: 'tall spine cue, 코어 강화',
    drills: ['Plank-throw 3×6', 'Anti-flexion abs', 'Lead leg block ISO'],
  },
];

// ════════════════════════════════════════════════════════════════════
// FAULT_VISUAL_GUIDE
// (원래 BBL_신규선수_리포트.html line 853~911)
// ════════════════════════════════════════════════════════════════════
// ★ v31.23 — 결함 변인 설명 + 시각화 (홍주환.pdf 4-5페이지 마네킹 그림 매칭)
//   각 KINETIC_FAULTS의 id를 PDF의 7개 결함 시각화에 매핑
//   접이식 카드(details/summary)로 결함 카드 안에 표시
const FAULT_VISUAL_GUIDE = {
  WeakDrive: {
    title: 'Sway',
    image: 'assets/fault_images/Sway.png',
    desc: '뒷다리에 힘을 모으는 구간(Wind Up)에서 몸이 홈플레이트 반대 방향으로 움직이는 경우. 몸의 전진을 방해하여 에너지 손실 발생.',
    physical: '하체·코어 근력/안정성, 고관절 근력/가동범위',
  },
  LeadKneeCollapse: {
    title: 'Knee Collapse',
    image: 'assets/fault_images/KneeCollapse.png',
    desc: '앞발착지(FC)~볼릴리즈(BR) 구간에서 무릎이 구부러지는(무너지는) 경우. 지면으로부터 오는 에너지를 상체에 충분히 전달하지 못함. 구속과의 연관성이 매우 높음.',
    physical: '앞다리 근력 (둔부·허벅지·햄스트링), 코어 안정성',
  },
  SoftBlock: {
    title: 'Knee Collapse (블록 약함)',
    image: 'assets/fault_images/KneeCollapse.png',
    desc: '앞다리 block이 부드러워(eccentric 약함) COG 감속이 부족한 상태. 회전 전환이 비효율적이 됨.',
    physical: '앞다리 eccentric 근력, 코어 안정성',
  },
  LateBlock: {
    title: 'Knee Collapse (블록 늦음)',
    image: 'assets/fault_images/KneeCollapse.png',
    desc: 'SSC 효율이 낮아 충격 흡수 후 신전이 늦은 경우. 빠른 reactive block이 안 됨.',
    physical: 'Plyometric reactive 능력, 앞다리 SSC',
  },
  FlyingOpen: {
    title: 'Flying Open',
    image: 'assets/fault_images/FlyingOpen.png',
    desc: '스트라이드 구간에서 몸통이 일찍 열리는 경우. 골반과 몸통의 꼬임을 통한 에너지 생성을 저하. 하체에서 몸통으로 에너지가 충분히 전달되기 전 몸통을 사용하여 비효율적.',
    physical: '몸통·어깨 가동범위, 코어·견갑 근력',
  },
  TrunkFallingForward: {
    title: 'Getting Out in Front',
    image: 'assets/fault_images/GettingOutFront.png',
    desc: '앞발착지(FC) 시 몸통이 골반보다 앞서는 경우(몸통이 일찍 나감). 신체 전면 근육의 늘어남을 통한 에너지 생성 감소.',
    physical: '코어·앞다리 근력/안정성, 전면 근육(가슴·복부) 유연성',
  },
  InsufficientLayback: {
    title: 'Late Rise',
    image: 'assets/fault_images/LateRise.png',
    desc: '앞발착지(FC) 시 손이 팔꿈치보다 낮은 경우. 몸통의 에너지가 전달되는 타이밍에 팔이 힘을 쓰지 못하는 위치에 있어 팔로 충분하게 에너지를 전달하지 못함.',
    physical: '주로 기술적 능력 (어깨 회전 타이밍)',
  },
  TrunkArmDisconnect: {
    title: 'Forearm Flyout',
    image: 'assets/fault_images/ForearmFlyout.png',
    desc: '백스윙 시 팔꿈치가 펴져 있는 경우(Arm Cocking 구간). 팔을 회전하기 위해 더 많은 힘이 필요하므로 비효율적. 몸통→팔 전달 효율 저하 → 팔꿈치 의존.',
    physical: '주로 기술적 능력 (어깨 외회전 타이밍)',
  },
  ElbowOverload: {
    title: 'Forearm Flyout (팔꿈치 과부하)',
    image: 'assets/fault_images/ForearmFlyout.png',
    desc: '몸통→팔 전달이 약한 상태에서 전완 자체가 과도하게 빠르게 신전 — UCL/팔꿈치 부상 위험. PitchSmart 볼륨 가이드라인 준수 필수.',
    physical: '몸통 활성화 강화 + 볼륨 모니터링',
  },
};

// ════════════════════════════════════════════════════════════════════
// CATEGORY_TRAINING_RECS
// (원래 BBL_신규선수_리포트.html line 926~996)
// ════════════════════════════════════════════════════════════════════
// ★ v30.21 옵션 E: 카테고리별 훈련 추천 (Phase 5 코칭 솔루션)
//   약점 카테고리 식별 시 priorityHtml에서 자동 표시
const CATEGORY_TRAINING_RECS = {
  // ── 체력 (4 카테고리) ──
  'F1_Strength': {
    exercises: ['Trap Bar Deadlift 3×5', 'Back Squat 4×5', 'Romanian Deadlift 3×8', 'IMTP holds 3×5s'],
    target: 'IMTP Peak Force +200 N',
  },
  'F2_Power': {
    exercises: ['Jump Squat 4×5', 'Box Jump 3×5', 'Med Ball Slam 3×6', 'CMJ depth jumps 3×4'],
    target: 'CMJ Peak Power/BM +5 W/kg',
  },
  'F3_Reactivity': {
    exercises: ['Depth Jump (drop 30~40cm) 3×5', 'Plyo Push-up 3×6', 'Rebound CMJ 4×4', 'Pogo Hops 3×10'],
    target: 'CMJ RSI-mod +0.10 m/s',
  },
  'F4_Body': {
    exercises: ['단백질 1.6~2.0 g/kg', 'Compound 리프트 3회/주', '수면 8h+'],
    target: 'BMI 22~24 (lean mass 위주)',
  },
  'F5_Flexibility': {
    exercises: ['Sleeper Stretch 3×30s', 'ER PNF stretch 3×8', 'Hip 90/90 stretch 3×30s', 'Hip Airplane 3×6', 'Cross-body stretch'],
    target: '어깨 ER 145°+ · IR 60°+ · Hip ER 45°+ · Hip IR 40°+ (MLB pitcher 표준)',
  },
  // ── 메카닉 6단계 (v30.25 코칭 친화 라벨) ──
  'C1_LowerBodyDrive': {
    exercises: ['Lateral Bound 3×5', 'Single-leg power clean', 'Hip airplane 3×6', 'Sled push'],
    target: '뒷다리 hip 신전속도 600+ °/s, COG 전진 2.5+ m/s',
  },
  'C2_FrontLegBlock': {
    exercises: ['Eccentric Step-down 5초 3×6', 'Drop landing 3×5', 'Single-leg ISO 30s', 'Glute Bridge'],
    target: '앞무릎 무너짐 없음 (FC→BR Δ ≥ 0°), COG 감속 50%+',
  },
  'C3_SeparationFormation': {
    exercises: ['거울 앞 FC closed-hold 3×30s', 'Hip-shoulder dissociation 3×8', '메디신볼 회전 던지기 3×6'],
    target: '꼬임 50°+ · 몸통 닫힘(-67° 부근) · 앞 기울기 -10°~+5° · 골반 속도 550°/s+ · lag 40~50ms (MLB 표준)',
  },
  'C4_TrunkAcceleration': {
    exercises: ['Rotational Med Ball Throw 3×6', 'Med Ball Slam 3×6', 'Cable Wood Chop 3×8', 'Anti-rotation Press'],
    target: '몸통 회전 속도 950°/s+ · 몸통 굴곡 속도 850°/s+ (MLB 표준)',
  },
  'C5_UpperBodyTransfer': {
    exercises: ['Connected Throw drill 3×5', 'Sleeper Stretch 3×30s', 'ER PNF stretch', 'Long toss with intent', 'IR power throw'],
    target: '레이백 185°+ · 전달율 1.88+ · lag 40~50ms · 어깨 IR 4500°/s+ (MLB 표준)',
  },
  'C6_ReleaseAcceleration': {
    exercises: ['Volume monitoring (PitchSmart)', 'Trunk activation drill', 'Plyo ball throw 3×5', '⚠ 부상 시 즉시 휴식'],
    target: '팔꿈치 신전속도 < 2400°/s (부상 안전 한계)',
  },
  // ── 제구 (6 카테고리) — Mode B 변동성 감점에 직결 ──
  'P1_ReleaseConsistency': {
    exercises: ['Bullpen 30구 low-intensity', 'Target throw 3×10 (4 spots)', 'Mirror release feedback'],
    target: 'Release point SD < 5 cm',
  },
  'P2_ArmSlot': {
    exercises: ['Marker drill (high 3/4 angle)', 'Scap clock 3×8', 'Rotator cuff 3×12'],
    target: 'Arm slot SD < 8°',
  },
  'P3_ReleaseHeight': {
    exercises: ['Stride 길이 일정화 drill', 'Tall posture cue', 'Box throw'],
    target: '릴리스 높이 SD < 6 cm',
  },
  'P4_TimingConsistency': {
    exercises: ['Metronome throw drill', 'Slow-fast contrast 3 set', 'Pause drills (KH 1초)'],
    target: 'MER→BR Time SD < 10 ms',
  },
  'P5_StrideConsistency': {
    exercises: ['Tape measure mark practice', 'Stride length holds', 'Heel touch reps'],
    target: 'Stride length SD < 3 cm',
  },
  'P6_TrunkConsistency': {
    exercises: ['Mirror trunk position drill', 'Same-direction throw 3×10', 'Body alignment cue'],
    target: 'Trunk forward tilt SD < 4°',
  },
};

// ════════════════════════════════════════════════════════════════════
// PLAYER_MODE_TARGETS
// (원래 BBL_신규선수_리포트.html line 998~1031)
// ════════════════════════════════════════════════════════════════════
const PLAYER_MODE_TARGETS = {
  // 변수별 4-cell { hand: { mode: { optimal, sigma } } }
  trunk_rotation_at_fc: {
    right: { sub_elite: { optimal: -67, sigma: 33 }, elite: { optimal: -95, sigma: 23 } },
    left:  { sub_elite: { optimal: -67, sigma: 30 }, elite: { optimal: -60, sigma: 22 } },
  },
  hip_shoulder_sep_at_fc: {
    // 양쪽 동일 — 부호 보정 후 통합 표준
    right: { sub_elite: { optimal: 21, sigma: 13 }, elite: { optimal: 25, sigma: 10 } },
    left:  { sub_elite: { optimal: 21, sigma: 13 }, elite: { optimal: 25, sigma: 10 } },
  },
  // ★ v30.21 옵션 B: 변동성 SD 변수 — Mode B에서 좁은 sigma로 정밀 평가
  //   Sub-elite는 안정성 평가가 부차적, Elite는 trial 일관성이 핵심 차별 요소
  hip_shoulder_sep_sd_deg: {
    right: { sub_elite: { optimal: 0, sigma: 8 }, elite: { optimal: 0, sigma: 5 } },
    left:  { sub_elite: { optimal: 0, sigma: 8 }, elite: { optimal: 0, sigma: 5 } },
  },
  mer_to_br_sd_ms: {
    right: { sub_elite: { optimal: 0, sigma: 20 }, elite: { optimal: 0, sigma: 10 } },
    left:  { sub_elite: { optimal: 0, sigma: 20 }, elite: { optimal: 0, sigma: 10 } },
  },
  trunk_tilt_sd_deg: {
    right: { sub_elite: { optimal: 0, sigma: 6 }, elite: { optimal: 0, sigma: 4 } },
    left:  { sub_elite: { optimal: 0, sigma: 6 }, elite: { optimal: 0, sigma: 4 } },
  },
  arm_slot_sd_deg: {
    right: { sub_elite: { optimal: 0, sigma: 8 }, elite: { optimal: 0, sigma: 5 } },
    left:  { sub_elite: { optimal: 0, sigma: 8 }, elite: { optimal: 0, sigma: 5 } },
  },
  release_height_sd_cm: {
    right: { sub_elite: { optimal: 0, sigma: 10 }, elite: { optimal: 0, sigma: 6 } },
    left:  { sub_elite: { optimal: 0, sigma: 10 }, elite: { optimal: 0, sigma: 6 } },
  },
};

// ════════════════════════════════════════════════════════════════════
// LAG_OPTIMAL_VARS
// (원래 BBL_신규선수_리포트.html line 1093~1102)
// ════════════════════════════════════════════════════════════════════
// ── Lag 변수 가우시안 스코어링 (양극단 페널티) ──
// proximal-to-distal 시퀀싱에서 lag이 너무 짧으면 동시 발화·전달 비효율
// 너무 길면 운동량 손실 → 40~50ms가 sweet spot (Aguinaldo 2007, Driveline)
const LAG_OPTIMAL_VARS = {
  // sigma 확장 2026-05-03 — elite 투수의 30~60ms 범위에서 적정 점수 받도록
  // 기존 sigma=15: lag=30ms→78점, 60ms→37점 (너무 좁음)
  // 새 sigma=25:   lag=30ms→90점, 60ms→73점 (현실적)
  'pelvis_to_trunk_lag_ms': { optimal: 45, sigma: 25 },
  'trunk_to_arm_lag_ms':    { optimal: 45, sigma: 25 },
};

// ════════════════════════════════════════════════════════════════════
// EXTRA_VAR_SCORING
// (원래 BBL_신규선수_리포트.html line 1104~1174)
// ════════════════════════════════════════════════════════════════════
// ── ★Phase2 변수 점수화 (코호트 분포 없는 변수의 문헌 기반 정규 범위) ──
// linear: { min, max, polarity } | gaussian: { optimal, sigma } | useAbs: 절대값 사용
// 출처: Driveline OBP, Stodden 2001, Aguinaldo 2007, Werner 2008, Kageyama 2014, Wood-Smith 2019
const EXTRA_VAR_SCORING = {
  // C2 하체 드라이브
  // C3 몸통 파워
  'peak_x_factor':                { optimal: 50, sigma: 15, useAbs: true },                  // ° — HS 표준 + Driveline elite 기준 (Stodden 2001, Aguinaldo 2007). LITERATURE 우선
  'max_trunk_twist_vel_dps':      { optimal: 950, sigma: 200 },                       // °/s — HS 평균 800, elite 950+ (Werner 2008, Wood-Smith 2019). LITERATURE 우선
  'peak_pelvis_av':               { optimal: 550, sigma: 130 },                       // °/s — HS-pro 350~700, elite 550+ (Aguinaldo 2007)
  'peak_pelvis_rot_vel':          { optimal: 550, sigma: 130 },                       // °/s — alias
  'max_pelvis_rot_vel_dps':       { optimal: 550, sigma: 130 },                       // °/s — alias
  // ★ 운동량 전달 효율 (2026-05-03 신규) — 정예준 같은 효율 타입 elite 평가
  'arm_trunk_speedup':            { optimal: 1.88, sigma: 0.2 },                      // ratio — 20명 elite 표준 1.88 (v30.13 정밀화)
  'pelvis_trunk_speedup':         { optimal: 1.5, sigma: 0.3 },                       // ratio — peak_trunk_av / peak_pelvis_av (참고용)
  // ★ 메카닉 각도/속도 — 문헌 기반 점수화 (2026-05-03 라운드 2)
  //   기존엔 코호트 percentile만 사용했으나, 문헌에 풍부한 standard 있는 변수들
  // ★ 2026-05-03 v30.11 후속 — 11명 elite 통계 검증 결과 반영
  //   trunk_rotation_at_fc: optimal -60° (적정 닫힘), sigma 30 (-30~-90 범위가 elite)
  //     너무 0 근처(Flying Open)도 너무 -100° 미만(과도한 비틀림)도 비효율
  //   hip_shoulder_sep_at_fc: optimal 0 (작을수록 좋음), Gaussian + useAbs
  //     elite 11명 통계: hip_sep H2 절대값 r=-0.539 (작을수록 ΔV 큼)
  'trunk_rotation_at_fc':         { optimal: -67, sigma: 30 },                        // ° — v30.14: 우완(n=59) -67±33 + 좌완(n=157) 우완등가 -67±27, 통합 sigma 30
  'hip_shoulder_sep_at_fc':       { optimal: 21, sigma: 13 },                         // ° — v30.14: 우완 +19±15 + 좌완(부호 보정) +22±11 통합 표준
  // ★ hip_shoulder_sep_sd_deg 신규 (2026-05-03 v30.11) — trial 간 hip-sep 변동성
  //   메카닉 안정성 + 제구 일관성 양쪽에 영향. elite |Δ| r=-0.709 (★★★★★)
  'hip_shoulder_sep_sd_deg':      { optimal: 0, sigma: 8 },                           // ° — trial 간 SD, 작을수록 안정
  'max_shoulder_ER_deg':          { optimal: 185, sigma: 12 },                        // ° — Driveline elite 175~200
  'shoulder_h_abd_at_fc':         { optimal: 10, sigma: 15 },                         // ° — Driveline standard (수평 외전 약간 양수)
  'arm_slot_mean_deg':            { optimal: 45, sigma: 20 },                         // ° — High 3/4 (BBL HS 표준)
  'trunk_flex_vel_max':           { optimal: 850, sigma: 200 },                       // °/s — Stodden 2001, Wood-Smith 2019
  'lead_knee_ext_vel_max':        { optimal: 750, sigma: 200 },                       // °/s — Driveline lead leg drive
  'com_decel_pct':                { optimal: 55, sigma: 15 },                         // % — Driveline Block phase (기존 min/max → Gaussian)
  'lead_knee_amortization_ms':    { optimal: 60, sigma: 30 },                         // ms — SSC 효율 (기존 min/max → Gaussian, 30~90ms 범위)
  'max_cog_velo':                 { optimal: 3.2, sigma: 0.7 },                       // m/s — Pro/college 표준 (기존 min/max → Gaussian)
  'hip_ir_vel_max_drive':         { optimal: 750, sigma: 200 },                       // °/s — Driveline drive leg (기존 min/max → Gaussian)
  // C4 앞다리 블로킹 — 무릎 신전량은 음수(무너짐)부터 양수(정상)까지 polarity higher
  'lead_knee_ext_change_fc_to_br':{ min: -10, max: 0, polarity: 'higher' },   // ° — 0° 이상(굴곡 유지/신전)=100점, -10°에서 0점, -10°↓=무릎 무너짐. 2026-05-03 step 변경
  // C1 — Phase2 자세 변수
  'stride_norm_height':           { min: 0.55, max: 0.95, polarity: 'higher' }, // 신장 정규화 (HS 더 짧음)
  'trunk_forward_tilt_at_fc':     { optimal: -5, sigma: 15 },                   // ° — 직립(0°) ~ 약간 뒤(-15°) 이상적, 앞으로 굽는 건 페널티 (2026-05-03 보정)
  // ── Driveline 5각형 추가 변수 — HS 한국 현실 반영 ──
  'elbow_ext_vel_max':            { min: 1200, max: 2800, polarity: 'higher' }, // °/s — Driveline elite 2630, HS는 더 낮음
  'shoulder_ir_vel_max':          { min: 1500, max: 4500, polarity: 'higher' }, // °/s — HS elite 4700, 평균 2500-3500
  'peak_torso_counter_rot':       { min: 15,   max: 60,   polarity: 'higher', useAbs: true }, // ° — elite -37
  'torso_side_bend_at_mer':       { optimal: 25, sigma: 12, useAbs: true },    // ° — elite 25
  'torso_rotation_at_br':         { optimal: 100, sigma: 30, useAbs: true },   // ° — elite 111 (HS 더 짧음)
  // 'elbow_flexion_at_fp' 제거 (v31.25, 사용자 요청)
  // ★ v30.21 옵션 B: SD 변수들 — Mode B에서 좁은 sigma로 정밀 평가
  'mer_to_br_sd_ms':              { optimal: 0, sigma: 20 },                   // ms — elite 5~15 SD
  'trunk_tilt_sd_deg':            { optimal: 0, sigma: 6 },                    // ° — trial 간 forward tilt 변동성
  'arm_slot_sd_deg':              { optimal: 0, sigma: 8 },                    // ° — arm slot 변동성
  'release_height_sd_cm':         { optimal: 0, sigma: 10 },                   // cm — release height 변동성
  // ★ v30.22 키네틱 체인 6단계 신규 변인 (Step A)
  'stride_time_ms':               { optimal: 250, sigma: 60 },                 // ms — KH→FC 시간 (Driveline elite 약 250 ms)
  'drive_hip_ext_vel_max':        { optimal: 600, sigma: 200 },                // °/s — drive leg hip 신전 peak
  'lead_hip_flex_at_fc':          { optimal: 80, sigma: 20 },                  // ° — lead hip 굴곡 (정상 자세)
  'lead_hip_ext_vel_max':         { optimal: 700, sigma: 200 },                // °/s — lead leg hip 신전 peak (FC→BR)
  // ★ v31.41 VALD Normative Data Report (Baseball v2, 2024) 50th 기반 정교화
  //   기존 sigma가 너무 커서 변별력 약했음. VALD 25~75 percentile로 sigma 산출
  //   참고: VALD Baseball 50th = optimal, (75th-25th)/2 ≈ sigma
  'IMTP Peak Vertical Force / BM [N/kg]': { optimal: 36, sigma: 6 },          // N/kg — VALD 50th 36.3, 25~75: 32.5~41.1
  'CMJ Peak Power / BM [W/kg]':           { optimal: 60, sigma: 6 },          // W/kg — VALD 50th 60, 25~75: 56~65
  'SJ Peak Power / BM [W/kg]':            { optimal: 59, sigma: 6 },          // W/kg — VALD 50th 59, 25~75: 54~64
  // ★ v31.3 CMJ Concentric Impulse 제거 — Peak Power와 정보 중복 (사용자 도메인 결정)
  'CMJ RSI-modified [m/s]':               { optimal: 0.65, sigma: 0.10 },     // m/s — VALD 50th 0.65, 25~75: 0.56~0.74
  'SJ RSI-modified [m/s]':                { optimal: 0.96, sigma: 0.13 },     // m/s — VALD 50th 0.96, 25~75: 0.79~1.15
  'EUR':                                  { optimal: 1.20, sigma: 0.15 },     // ratio — 1.1~1.3 적정 (VALD 직접 데이터 없음, 유지)
  'Height[M]':                            { optimal: 1.85, sigma: 0.10 },     // m — MLB pitcher 평균 1.88
  'Weight[KG]':                           { optimal: 90, sigma: 12 },         // kg — MLB pitcher 평균 95
  'BMI':                                  { optimal: 25, sigma: 3.5 },        // — MLB pitcher 평균 26
  // ★ v31.40 유연성 ROM (Wilk 2014, Reinold 2014, Driveline)
  'Shoulder ER':                          { optimal: 145, sigma: 15 },        // ° — pitcher passive ER 130~165 (throwing arm)
  'Shoulder IR':                          { optimal: 60,  sigma: 15 },        // ° — 60~80° 정상
  'Hip ER L':                             { optimal: 45,  sigma: 10 },        // ° — drive/lead 양쪽 동일 평가
  'Hip ER R':                             { optimal: 45,  sigma: 10 },        // °
  'Hip IR L':                             { optimal: 40,  sigma: 10 },        // °
  'Hip IR R':                             { optimal: 40,  sigma: 10 },        // °
};

// ════════════════════════════════════════════════════════════════════
// LITERATURE_OVERRIDE
// (원래 BBL_신규선수_리포트.html line 1179~1236)
// ════════════════════════════════════════════════════════════════════
const LITERATURE_OVERRIDE = new Set([
  // 회전 속도 (Werner 2008, Wood-Smith 2019, Aguinaldo 2007)
  'peak_x_factor',
  'max_trunk_twist_vel_dps',
  'peak_trunk_av',
  'peak_pelvis_av',
  'max_pelvis_rot_vel_dps',
  'trunk_flex_vel_max',
  // 자세/각도 (Stodden 2001, Driveline)
  'trunk_forward_tilt_at_fc',
  'trunk_rotation_at_fc',
  'hip_shoulder_sep_at_fc',
  'max_shoulder_ER_deg',
  'shoulder_h_abd_at_fc',
  'arm_slot_mean_deg',
  // 에너지 전달/효율 (BBL 2026-05-03 정의)
  'arm_trunk_speedup',
  'pelvis_trunk_speedup',
  // 하체 드라이브 (Driveline)
  'lead_knee_ext_vel_max',
  'hip_ir_vel_max_drive',
  'max_cog_velo',
  'com_decel_pct',
  'lead_knee_amortization_ms',
  // ★ 2026-05-03 v30.11 메카닉 안정성
  'hip_shoulder_sep_sd_deg',
  // ★ v30.21 옵션 B: 추가 SD 변수 (Mode B 변동성 감점)
  'mer_to_br_sd_ms',
  'trunk_tilt_sd_deg',
  'arm_slot_sd_deg',
  'release_height_sd_cm',
  // ★ v30.22 키네틱 체인 6단계 신규 변인 (Step A)
  'stride_time_ms',
  'drive_hip_ext_vel_max',
  'lead_hip_flex_at_fc',
  'lead_hip_ext_vel_max',
  // ★ v31.0 점수 시스템 전환 — MLB/문헌 표준 기반 (코호트 의존 제거)
  'lead_knee_ext_change_fc_to_br',  // Driveline lead leg block
  'peak_torso_counter_rot',          // Wood-Smith 2019
  'torso_side_bend_at_mer',          // Wood-Smith 2019
  'torso_rotation_at_br',            // Driveline elite
  // 'elbow_flexion_at_fp' 제거 (v31.25, 사용자 요청)
  'elbow_ext_vel_max',               // Driveline elite 2400-2700
  'shoulder_ir_vel_max',             // Driveline elite 4500+
  'peak_arm_av',                     // Pitching mechanics standard
  'stride_norm_height',              // Driveline standard 0.85-1.0
  // ── 체력 변수 (MLB R&D 기반 표준 — v31.21 체중당만 유지) ──
  'IMTP Peak Vertical Force / BM [N/kg]',
  'CMJ Peak Power / BM [W/kg]',
  'SJ Peak Power / BM [W/kg]',
  // 'CMJ Concentric Impulse [N s]', ← v31.3 제거 (Peak Power 정보 중복)
  'CMJ RSI-modified [m/s]',
  'SJ RSI-modified [m/s]',
  'EUR',
  'Height[M]',
  'Weight[KG]',
  'BMI',
  // ★ v31.40 유연성 ROM
  'Shoulder ER', 'Shoulder IR',
  'Hip ER L', 'Hip ER R', 'Hip IR L', 'Hip IR R',
]);

// ════════════════════════════════════════════════════════════════════
// PLAUSIBLE_RANGES
// (원래 BBL_신규선수_리포트.html line 1240~1288)
// ════════════════════════════════════════════════════════════════════
//   여기를 벗어나면 Uplift 이벤트 검출 오류 또는 계산 오류로 간주 → 결측 보정(50점)
//   * 점수화 min/max보다 넓되, 명백히 비상식적인 값은 배제
//   * SD 변수는 max만 사용 (낮을수록 좋은 일관성 변수)
// ════════════════════════════════════════════════════════════════════
const PLAUSIBLE_RANGES = {
  // ── 거리/길이
  'stride_norm_height':           { min: 0.30, max: 1.10 },     // 신장 정규화
  'stride_mean_m':                { min: 0.5,  max: 2.5 },      // m
  'release_height_m':             { min: 1.0,  max: 2.5 },      // m
  // ── 일관성 SD 변수 (max만 — 이보다 크면 측정 오류)
  'stride_sd_cm':                 { max: 30 },                  // cm
  'mer_to_br_sd_ms':              { max: 50 },                  // ms (elite 5–15)
  'trunk_tilt_sd_deg':            { max: 15 },                  // °
  'trunk_lateral_sd_deg':         { max: 15 },                  // ° (보조)
  'arm_slot_sd_deg':              { max: 20 },                  // °
  'release_height_sd_cm':         { max: 25 },                  // cm
  'wrist_3d_sd_cm':               { max: 100 },                 // cm
  // ── 메카닉 각도
  'lead_knee_ext_change_fc_to_br':{ min: -45, max: 60 },        // ° (음수=무릎 무너짐, 60°↑=오류)
  'peak_x_factor':                { min: 5,   max: 90 },        // °
  'trunk_forward_tilt_at_fc':     { min: -90, max: 30 },        // °
  'com_decel_pct':                { min: 0,   max: 100 },       // %
  'lead_knee_amortization_ms':    { min: 5,   max: 500 },       // ms
  'torso_side_bend_at_mer':       { min: -10, max: 70 },        // °
  'torso_rotation_at_br':         { min: 0,   max: 200 },       // °
  // 'elbow_flexion_at_fp' 제거 (v31.25, 사용자 요청)
  'peak_torso_counter_rot':       { min: 0,   max: 90 },        // ° (절댓값)
  'arm_slot_mean_deg':            { min: 0,   max: 90 },        // °
  'max_shoulder_ER_deg':          { min: 100, max: 200 },       // °
  'shoulder_h_abd_at_fc':         { min: -30, max: 60 },        // °
  // ── 메카닉 속도
  'hip_ir_vel_max_drive':         { min: 50,  max: 1500 },      // °/s
  'max_cog_velo':                 { min: 0.3, max: 6 },         // m/s
  'elbow_ext_vel_max':            { min: 500, max: 4500 },      // °/s
  // ★ v30.22 키네틱 체인 6단계 신규 변인
  'stride_time_ms':               { min: 80,  max: 600 },        // ms (KH→FC)
  'drive_hip_ext_vel_max':        { min: 50,  max: 1500 },       // °/s
  'lead_hip_flex_at_fc':          { min: 20,  max: 160 },        // °
  'lead_hip_ext_vel_max':         { min: 50,  max: 1500 },       // °/s
  'shoulder_ir_vel_max':          { min: 800, max: 7000 },      // °/s
  // ── Lag (음수 가능, 측정 오류 한계 ±200ms)
  'pelvis_to_trunk_lag_ms':       { min: -100, max: 250 },      // ms
  'trunk_to_arm_lag_ms':          { min: -100, max: 250 },      // ms
  // ── 시퀀스 비율
  'proper_sequence_pct':          { min: 0,   max: 100 },       // %
  // ── 운동량 전달 효율 (2026-05-03)
  'arm_trunk_speedup':            { min: 0.8, max: 4.0 },       // ratio
  'pelvis_trunk_speedup':         { min: 0.8, max: 3.0 },       // ratio
};

// ════════════════════════════════════════════════════════════════════
// CATEGORY_DETAILS
// (원래 BBL_신규선수_리포트.html line 3461~3484)
// ════════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════
// 카테고리 메타 (v29 META.category_details 그대로 — 18 카테고리)
// 의미·산출·점수 해석·코칭·학술 근거 + (C 카테고리는) 변수별 설명
// ════════════════════════════════════════════════════════════════════
const CATEGORY_DETAILS = {
  "F1_Strength": {"name":"체중당 근력","short_desc":"체중 정규화 최대 근력 (N/kg)","meaning":"체중당 발휘 가능한 최대 수직력. 절대값이 아닌 단위 체중당 수치이므로 체격이 작아도 효율적 근력 발현이 가능한지 평가. (절대 근력은 체격 카테고리에서 이미 평가됨)","method":"IMTP Peak Vertical Force / BM (N/kg) 백분위","interpretation":[["75-100","체중당 근력 우수 — 폭발적 동작 기반 충분"],["50-75","평균 — 강화 여지 있음"],["25-50","체중당 근력 부족 — 보조 운동 우선"],["0-25","매우 부족 — 우선 보강 필요"]],"coaching":"데드리프트, 스쿼트, IMTP 트레이닝, 체구성 관리","reference":"Sakurai (2024), Driveline Strength Standards"},
  "F2_Power": {"name":"체중당 파워","short_desc":"체중 정규화 폭발력 (W/kg)","meaning":"CMJ·SJ로 측정되는 체중당 폭발 출력. 구속과 가장 직접적 연관 체력 요소. 절대값이 아닌 단위 체중당 수치이므로 효율적 파워 발현이 평가됨.","method":"CMJ Peak Power/BM, SJ Peak Power/BM (W/kg) 백분위 평균","interpretation":[["75-100","체중당 파워 우수 — 투구 폭발력 기반 충분"],["50-75","평균 — 플라이오메트릭 강화"],["25-50","파워 부족 — SSC 활용 훈련"],["0-25","매우 부족 — 점프 트레이닝 우선"]],"coaching":"점프 스쿼트, 박스 점프, 메디신볼 던지기, 올림픽 리프트","reference":"Lehman et al. (2013), Driveline KineticArm"},
  "F3_Reactivity": {"name":"반응성 (SSC)","short_desc":"신축단축주기 효율","meaning":"근육이 빠르게 늘어났다가 즉시 수축하는 SSC(Stretch-Shortening Cycle) 효율. 투구의 앞다리 블로킹·몸통 회전과 직결.","method":"CMJ/SJ RSI-modified와 EUR (CMJ/SJ 비율)의 백분위 평균","interpretation":[["75-100","SSC 활용 우수 — 효율적 에너지 전달"],["50-75","평균적 SSC, 반응성 향상 여지"],["25-50","SSC 효율 낮음 — concentric만 의존"],["0-25","SSC 매우 낮음 — 단순 근력→반응적 전환 훈련"]],"coaching":"드롭 점프, 데모스 짧은 접지 시간 점프, 플라이오메트릭","reference":"McMahon (2017), Komi (2003)"},
  "F4_Body": {"name":"체격","short_desc":"신체 구성","meaning":"구속과 관련된 신체 크기. 신장은 릴리스 높이·레버 길이, 체중은 운동량과 관련.","method":"신장·체중·BMI의 백분위 평균","interpretation":[["—","신체 크기는 직접 향상 어려움 — 다른 카테고리에 더 집중"],["","체중 증가는 근육량·체지방 비율 함께 고려"]],"coaching":"영양 섭취, 근육량 증가 (체지방 < 15%)","reference":"Werner et al. (2008)"},
  "F5_Flexibility": {"name":"유연성","short_desc":"어깨·고관절 ROM (Range of Motion)","meaning":"투구 시 가동범위 한계가 메카닉 표현을 제약. 어깨 외회전 ROM은 레이백 깊이의 기반, 어깨 내회전은 follow-through, 고관절 ROM은 골반 회전·X-Factor 형성의 기반. ROM이 부족하면 회전 가속 단계에서 압박 증가 + 부상 위험.","method":"Shoulder ER (Gaussian optimal 145°, sigma 15°) + Shoulder IR (optimal 60°, sigma 15°) + Hip ER L/R (optimal 45°, sigma 10°) + Hip IR L/R (optimal 40°, sigma 10°). MLB pitcher 평균·문헌 표준 (Wilk 2014, Reinold 2014).","interpretation":[["75-100","ROM 우수 — 모든 부위 elite 가동범위"],["50-75","평균 — 한두 부위 ROM 향상 여지"],["25-50","ROM 부족 — 주요 부위 모빌리티 트레이닝 필요"],["0-25","ROM 매우 부족 — 부상 위험 + 즉시 모빌리티 강화"]],"coaching":"어깨 sleeper stretch, ER PNF, hip 90/90 stretch, hip airplane. ROM 회복 후 안정성 강화로 연결","reference":"Wilk et al. (2014), Reinold et al. (2014), Driveline R&D"},
  "F5_LowerBody": {"name":"체중당 파워","short_desc":"체중 정규화 출력 (W/kg·N/kg)","meaning":"체중당 출력 파워. 작은 체격이라도 효율적으로 파워를 낼 수 있는지 평가.","method":"CMJ·SJ Peak Power/BM, IMTP/BM의 백분위 평균","interpretation":[["75-100","체중당 파워 우수 — 효율적 운동 능력"],["50-75","평균 — 하체 강화 또는 체중 조절"],["25-50","체중 대비 파워 부족"],["0-25","심각한 부족 — 체구성 개선 + 파워 훈련"]],"coaching":"스피드 스쿼트, 점프 트레이닝, 체지방 관리","reference":"Driveline체중 정규화 표준"},
  "F6_VelocityIndex": {"name":"복합 폭발력","short_desc":"임펄스·반응성·근력 통합","meaning":"학술 연구에서 구속과 가장 강하게 연관되는 체력 변수 셋. 종합 진단용.","method":"CMJ Concentric Impulse, CMJ RSI-mod, IMTP 절대치의 백분위 평균","interpretation":[["75-100","구속 잠재력 매우 높음"],["50-75","평균적 구속 잠재력"],["25-50","구속 향상 위해 핵심 변수 강화 필요"]],"coaching":"Concentric impulse 향상 훈련, Reactive 점프","reference":"Sakurai (2024), Driveline KineticArm"},
  "C1_LowerBodyDrive": {"name":"하체 추진","short_desc":"뒷다리로 강하게 밀어 추진력 만들기 (KH→FC)","meaning":"키네틱 체인의 첫 단계. 뒷다리(드라이브)에서 만든 추진력이 전체 운동 사슬의 시작점이 됨. 추진력이 약하면 X-Factor 형성, 트렁크 회전, 팔 가속 모두 약해짐.","method":"스트라이드 길이·시간, 뒷다리 hip 신전속도, 뒷다리 hip 회전속도, COG 전진속도의 백분위 평균","interpretation":[["75-100","하체 추진 우수 — 뒷다리 폭발력 좋음, 추진 단단"],["50-75","평균 추진 — 뒷다리 폭발력 향상 여지"],["25-50","추진 부족 — 뒷다리 power 보강 필요"],["0-25","추진 심각 — 단일 다리 power 우선 강화"]],"coaching":"뒷다리를 단단히 밀어내고 골반을 능동적으로 보내라 — '한 발로 폭발적으로 밀어 보내기' cue","reference":"Driveline drive leg, Matsuo (2001)"},
  "C2_FrontLegBlock": {"name":"앞다리 버팀 (Block)","short_desc":"FC→BR 무릎 무너짐 여부 — 각도 유지가 핵심","meaning":"앞다리(블록)가 추진력을 받아 회전 에너지로 전환하는 핵심 단계. 핵심은 'FC 시점 무릎 각도가 BR까지 유지되는가' — 더 펴거나 굽힘이 아닌 '무너지지 않음'이 평가 기준. 무릎 각도 유지하면서 좋은 메카닉으로 빠른 공 던지는 투수가 elite에 흔함.","method":"앞무릎 무너짐 여부(FC→BR Δ각도, 음수=무너짐만 감점, 0 이상은 만점), 몸 감속도(블록 강도), SSC 시간, 앞 hip 굴곡·신전속도의 백분위 평균","interpretation":[["75-100","Block 우수 — 무릎 각도 유지·블록 단단"],["50-75","평균 Block — 약한 무너짐 경향"],["25-50","Block 부족 — 무릎 무너짐 가능성 ⚠"],["0-25","Block 심각 — 명백한 무너짐, 즉시 ecc 강화"]],"coaching":"FC 순간 앞다리 각도를 BR까지 유지하라 — 더 펴려 하기보다 무너지지 않게 단단히 버텨라","reference":"Driveline lead leg, Wood-Smith (2019)"},
  "C3_SeparationFormation": {"name":"몸통 에너지 로딩","short_desc":"꼬임·닫힘·기울기·골반속도·lag으로 트렁크 에너지 저장·전달","meaning":"FC 시점에 몸통이 회전 가속을 위한 에너지를 충분히 '저장'하고 골반→몸통 전달 타이밍이 적정한가. 다섯 가지 동시 평가: ① 골반-몸통 최대 꼬임 크게 형성, ② FC 시점 몸통이 일찍 열리지 않음(Flying Open 방지), ③ FC 시점 몸통 앞 기울기 적정, ④ 골반 회전 속도 elite 수준, ⑤ 골반→몸통 시간차(lag) 적정(40~50ms). 다섯 요소 통합 평가로 로딩 단계 전반 진단.","method":"peak_x_factor (Gaussian optimal 50°, sigma 15°) + trunk_rotation_at_fc (optimal -67°, sigma 30°, 정규화) + trunk_forward_tilt_at_fc (optimal -5°, sigma 15°) + max_pelvis_rot_vel_dps (optimal 550°/s, sigma 130) + pelvis_to_trunk_lag_ms (optimal 45ms, sigma 25) — 모두 MLB/문헌 표준 직접 평가","interpretation":[["75-100","로딩·전달 우수 — 5요소 모두 양호"],["50-75","평균 — 한두 요소 향상 여지"],["25-50","로딩 부족 — Flying Open·꼬임·lag 점검"],["0-25","로딩 심각 부족 — 와인드업·분리 시퀀스 재학습"]],"coaching":"'hip first' — 골반은 먼저 빠르게 회전하고 몸통은 적정 시간차(40~50ms) 후 따라와라. FC 직전 거울 hold drill로 꼬임·닫힘 감각 학습","reference":"Stodden (2001), Aguinaldo (2007), Driveline R&D"},
  "C4_TrunkAcceleration": {"name":"몸통 에너지 발현","short_desc":"몸통 회전·굴곡 속도로 에너지 발현 (FC→MER→BR)","meaning":"C3에서 로딩된 에너지가 몸통의 폭발적 회전·굴곡으로 발현되는 단계. 두 가지 핵심 출력: ① 몸통 축회전 속도(twist) — 골반-몸통 분리에서 풀려나는 회전 토크, ② 몸통 굴곡 속도(flex, FC→BR) — 앞으로 굽혀지며 팔에 직선 가속 부여. 두 속도가 동시에 elite 수준이어야 빠른 구속.","method":"max_trunk_twist_vel_dps (Gaussian optimal 950°/s, sigma 200 — Werner 2008, Wood-Smith 2019) + trunk_flex_vel_max (Gaussian optimal 850°/s, sigma 200 — Stodden 2001) — 모두 MLB/문헌 표준 직접 평가","interpretation":[["75-100","발현 우수 — 회전·굴곡 속도 모두 elite 수준"],["50-75","평균 — 한 속도 향상 여지"],["25-50","발현 부족 — 코어 폭발력·회전 가속 강화"],["0-25","발현 심각 — 시퀀스 재학습 + 코어 강화 우선"]],"coaching":"몸통을 채찍처럼 폭발 회전 + FC→BR 동안 앞으로 빠르게 굽혀라. 메디신볼 회전 던지기, 슬램 throw, anti-rotation 코어","reference":"Werner (2008), Wood-Smith (2019), Stodden (2001), Driveline"},
  "C5_UpperBodyTransfer": {"name":"팔 에너지","short_desc":"레이백·전달율·lag·어깨 IR 속도 통합 평가","meaning":"몸통에서 팔로 에너지가 어떻게 전달·증폭되어 공으로 가속되는가. 네 가지 통합 평가: ① 레이백(어깨 외회전 max) — 몸통 에너지 흡수 ROM, ② 몸통→팔 전달 효율(arm_trunk_speedup) — 팔이 몸통보다 얼마나 빨리 회전하는지의 비율, ③ 몸통→팔 시간차(lag) — 전달 타이밍, ④ 어깨 내회전 최대 속도 — 최종 공 가속 단계의 폭발력. 네 요소 모두 양호해야 효율적이고 부상 없는 팔 에너지 발현.","method":"max_shoulder_ER_deg (Gaussian optimal 185°, sigma 12 — Driveline elite) + arm_trunk_speedup (Gaussian optimal 1.88, sigma 0.2 — 20명 elite) + trunk_to_arm_lag_ms (LAG optimal 45ms, sigma 25) + shoulder_ir_vel_max (Linear 1500~4500°/s, Driveline elite 4500+)","interpretation":[["75-100","팔 에너지 우수 — 4요소 모두 elite 수준"],["50-75","평균 — 한두 요소 향상 여지"],["25-50","전달 부족 — 팔꿈치 의존 위험 ⚠"],["0-25","전달 심각 — 부상 위험 + 트렁크 활성화 우선"]],"coaching":"몸통 에너지를 어깨로 받고 팔로 넘겨라. Connected throw drill, 메디신볼 던지기, 어깨 ER ROM·IR 속도 강화","reference":"Werner (2008), Wood-Smith (2019), Driveline OnBaseU"},
  "C6_ReleaseAcceleration": {"name":"팔 가속·릴리스","short_desc":"팔을 폭발적으로 가속해 공에 에너지 전달 (MER→BR)","meaning":"마지막 단계 — 팔 회전속도와 팔꿈치 신전속도로 공에 가속. ★사용자 통찰: 몸통 약하면 전완에서 추가 에너지 생성 = 팔꿈치 과부하(UCL 부상 위험). 부상 진단의 핵심.","method":"팔 회전속도 peak, 팔꿈치 신전속도 max, 몸통 굴곡속도, arm slot, 릴리스 높이의 백분위 평균","interpretation":[["75-100","릴리스 가속 우수 — 정상 범위"],["50-75","평균 — 부상 위험 모니터링"],["25-50","주의 — 팔 출력만으로 의존 가능"],["0-25","위험 ⚠ 팔꿈치 과부하 진단 필요"]],"coaching":"몸통 에너지로 팔을 가속하라 — 팔만 휘두르면 팔꿈치 부상. 볼륨 관리 + 트렁크 강화","reference":"Whiteley (2018), Werner (2008), MLB Pitch Smart"},
  "P1_ReleaseConsistency": {"name":"릴리스 점 일관성 (3D)","short_desc":"손목 X·Y·Z 결합 SD","meaning":"여러 trial에서 릴리스 시점 손목의 3차원 위치가 얼마나 일관된지. 제구의 가장 직접적 지표.","method":"Trial-to-trial 손목 X·Y·Z SD를 결합한 3D SD (cm). 작을수록 좋음.","interpretation":[["75-100","릴리스 매우 일관 — 제구 우수"],["50-75","평균적 일관성"],["25-50","릴리스 변동 — 제구 불안정"],["0-25","릴리스 매우 변동 — 폼 안정화 우선"]],"coaching":"반복 폼 연습, 거울·비디오 피드백, 셋업 일관성","reference":"Whiteley (2018), Driveline Pitch Design"},
  "P2_ArmSlot": {"name":"팔 슬롯 안정성","short_desc":"팔 각도 일관성","meaning":"Trial마다 팔 슬롯(어깨-팔꿈치 각도)이 얼마나 일관된지. 다른 슬롯에서 던지면 구질이 달라짐.","method":"팔 슬롯 각도의 trial-to-trial SD (degrees)","interpretation":[["75-100","슬롯 매우 일관"],["50-75","평균"],["25-50","슬롯 변동"],["0-25","슬롯 매우 변동 — 일관 폼 우선"]],"coaching":"같은 슬롯 반복 연습, Tilt drill","reference":"Whiteley (2018)"},
  "P3_ReleaseHeight": {"name":"릴리스 높이 안정성","short_desc":"수직 위치만 (Y SD)","meaning":"릴리스 시 손의 높이가 일관된지. 변동이 크면 공이 위/아래로 벗어남.","method":"손목 Y 좌표의 trial-to-trial SD (cm)","interpretation":[["75-100","릴리스 높이 매우 일관"],["50-75","평균"],["25-50","높이 변동"],["0-25","높이 매우 변동"]],"coaching":"릴리스 포인트 표시판, 일관 폼 훈련","reference":"Whiteley (2018)"},
  "P4_TimingConsistency": {"name":"타이밍 일관성","short_desc":"운동사슬 타이밍 안정성","meaning":"운동 사슬 순서(Pelvis-Trunk-Arm)가 매번 동일한지 + MER→BR 시간 일관성.","method":"proper_sequence 비율(%) + MER→BR 시간 SD (ms)","interpretation":[["75-100","타이밍 매우 일관"],["50-75","평균"],["25-50","타이밍 변동"],["0-25","타이밍 매우 불안정"]],"coaching":"템포 메트로놈 드릴, 메디신볼 타이밍","reference":"Aguinaldo (2007)"},
  "P5_StrideConsistency": {"name":"스트라이드 일관성","short_desc":"발 위치 일관성","meaning":"매 trial 앞발 착지 위치(stride 길이)가 일관된지. 변동이 크면 모든 후속 단계가 무너짐.","method":"Stride 길이의 trial-to-trial SD (cm)","interpretation":[["75-100","발 위치 매우 일관"],["50-75","평균"],["25-50","발 위치 변동"],["0-25","발 위치 매우 변동"]],"coaching":"착지 마크 훈련, 일관 셋업","reference":"Driveline Stride 표준"},
  "P6_TrunkConsistency": {"name":"몸통 자세 일관성","short_desc":"몸통 기울기 안정성","meaning":"BR 시점 몸통 전방 기울기가 일관된지. 변동이 크면 공이 높낮이 차이.","method":"몸통 전방 기울기의 trial-to-trial SD (degrees)","interpretation":[["75-100","몸통 자세 매우 일관"],["50-75","평균"],["25-50","몸통 변동"],["0-25","몸통 매우 변동"]],"coaching":"몸통 안정성 훈련, 코어","reference":"Werner (2008)"}
};
