// app.js — BBL 피칭 리포트 메인 로직
// v33.4 (2026-05-04): index.html 인라인 script에서 외부 파일로 분리
// 의존: cohort_v29.js, metadata.js (먼저 로드되어야 함)

// ════════════════════════════════════════════════════════════════════
// 코호트 데이터 (v29 134명 export)
// ════════════════════════════════════════════════════════════════════
// COHORT 데이터는 외부 파일 cohort_v29.js에서 로드 (window.COHORT)

// ★ 알고리즘 버전 (2026-05-04) — 산식 변경 시 갱신
//   저장된 리포트의 algorithm_version과 비교해 자동 재계산 + UI 알림
//   v32.0 — 134명 코호트 효과크기 반영 + IPS(향상 잠재력 점수) 도입
//   v32.1 — F1_Strength에 악력(Grip Strength) 통합 (cross d=+1.18)
//   v32.2 — C5 가중치 절충 (1.5 → 1.0): Driveline literature와 134코호트 d=+0.09 사이 절충
//   v32.3 — IPS "부분 측정" 경고 FP 비교 버그 수정 (0.9999... < 1.0 → 999 임계)
//   v32.4 — F2_Power(CMJ_BM·SJ_BM) LITERATURE_OVERRIDE 해제 → percentile 산식
//   v32.5 — "more is better" 변수 10개 추가 percentile 전환 (IMTP/BM, RSI×2, EUR,
//           회전속도 3개, lead_knee_ext_vel_max, Height, Weight). 16개 분포 미보유 변수는 Phase 2.
//   v32.6 — 비교표 칼럼 정렬 수정 (헤더 우측 정렬 + tabular-nums 자릿수 정렬)
//   v32.7 — narrative 점수차 소수점 1자리 통일 (FP 정밀도) + 좌완 시퀀스 차트 누락 수정
//   v32.8 — v32.7 음수 lag "발달 미성숙" 해석 정정. lag은 biomechanically 항상 양수 →
//           음수 = 이벤트 검출 오류. abs() 보정 + 검출 오류 경고로 변경
//   v32.9 — 마네킹 누수-only 재설계 (정상 단계 라벨 숨김) + ARM→FOREARM 신규 변수·라벨
//           (arm_to_forearm_speedup = elbow_ext_vel_max / shoulder_ir_vel_max, elite 0.50~0.65)
//           스토리 순서 재배치: 투수 유형 진단을 결함 직후(5.5)로, 코칭 우선순위는 종합 평가 다음(7)
//   v33.0 — 마네킹 착지다리 경로 변경(앞 hip 경유) + 팔꿈치·손목 노드 시각화 추가
//           레이더 라벨을 카드 라벨과 일치시킴 (CATEGORY_DETAILS.name 우선 사용)
//           5각 Driveline Block 카테고리: stride_norm_height Height[M] 부재 시 근사값 산출
//   v33.1 — Throwing arm 자동검출 신뢰성 가드 (박명균 우완 케이스 해결)
//           v31.12 버그: 양 팔 0°/s 시 `>=` 비교가 'left' 잘못 선택 → 시퀀스 차트 누락
//           수정: 임계 800°/s 미만이면 handedness label 사용, strict `>` 비교, tie 시 label 우선
//   v33.2 — Uplift CSV event placeholder 0을 null로 처리
//           박명균 케이스 발견: max_external_rotation_frame 값이 9/10 trial에서 0 (Uplift 미검출 플레이스홀더)
//           기존 버그: getFrameAbs(0)이 events.mer = 0 (frame 0) 잘못 사용 → arm peak 윈도우 깨짐
//           수정: raw frame value === 0이면 null 반환 → rawMER fallback 사용 → 정상 윈도우
//   v33.3 — Uplift 사전계산 peak frame 우선 사용 (peakPelvis/peakTrunk/peakArm)
//           박명균 검증으로 발견: Uplift peak 정확(54/63ms) 인데 BBL 자체 detection이 잘못된 peak 잡아
//           lag 114/49ms로 부풀려 표시 → "명확한 누수" 잘못 진단
//           수정: upEvents.peakX ?? detectPeakRotVel(...) — Uplift 우선, 없을 때만 자체 검출
//   v33.4 — index.html 인라인 script 6,414라인을 app.js로 분리 (로직 변경 0)
//           index.html 7,074 → 661라인 (90% 축소). GitHub 편집·diff 가독성 대폭 개선
//   v33.5 — Phase 2: 16개 메카닉 변수 134 코호트 분포 산출 + LITERATURE_OVERRIDE 해제
//           1810 trial Python 일괄 처리 → 186 세션 분포 → cohort_v29.js 갱신
//           발달 코호트 평균 선수도 50점(중앙값) 받게 점수 산식 정상화
//   v33.6 — Phase 3: Output(출력) vs Transfer(전달) vs Injury(부상) 분리 분석 7변수 추가
//           wrist_release_speed, elbow_to_wrist_speedup, angular_chain_amplification,
//           elbow_valgus_torque_proxy, stride_to_pelvis_lag_ms, x_factor_to_peak_pelvis_lag_ms,
//           knee_varus_max_drive + metadata.js OUTPUT_VS_TRANSFER 카테고리 신설
//   v33.7 — Phase 3 UI: 출력 vs 전달 사분면 진단 카드 + 자동 코칭 메시지
//           KINETIC_FAULTS 부상 위험 항목 2개 추가 (HighElbowValgus, DriveKneeVarus)
//           polarity 'absolute' 점수 반전 보정 (lag 변수 의미 정확화)
//   v33.7.1 — hotfix: applyMultiTrialUplift meanFields에 v33.6 신규 7변수 누락
//             → 사분면 카드가 항상 빈 상태였음. 신규 trial CSV 업로드 시점부터 정상 산출
//   v33.7.2 — hotfix #2: calculateScores return에 mechanics raw 객체 누락
//             → 사분면 카드가 r.mechanics를 참조하지만 result에 해당 키 없어 항상 null
//             → result.mechanics = input.mechanics 추가로 raw 값 접근 가능
//   v33.7.3 — 사용자 피드백: 사분면 차트 한 장만으로 코치가 이해 어려움
//             → 차트 위 "이 차트 읽는 법" 안내 박스 (사분면 의미·점 색상 풀어 설명)
//             → 차트 아래 OUTPUT/TRANSFER/INJURY 3개 폴더 카드 (변수별 한글명·raw·percentile·해석)
//             → metadata.js에 OUTPUT_VS_TRANSFER_VAR_META 추가 (29개 변수 한글명·단위·코칭 hint)
//   v33.7.4 — 사용자 피드백 #2 두 가지:
//             (A) 부상 위험 — 코호트 ranking + 문헌 절대 임계 동시 표시
//                 INJURY_LITERATURE_THRESHOLDS 신설 (Werner 2008·Davis 2013·Pollard 2017)
//                 shoulder_ir_vel >7000°/s, max_shoulder_ER >200°, knee_varus >25° 절대 임계
//                 elbow_valgus_torque_proxy는 markerless proxy라 ranking only (한계 명시)
//             (B) 매번 trial CSV 재입력 부담 → 두 가지로 해결:
//                 1) DOMContentLoaded 시 신규 7변수 누락 saved 자동 감지 + 토스트 안내
//                 2) trial CSV 분석 후 자동 저장 (silent autoSaveReport는 이미 작동) + 명시적 토스트
//   v33.7.5 — 좌·우투 평가 통일: 모든 선수를 우투 기준 단일 임계로 평가
//             (사용자 요청 + 메모리 원칙 "좌·우완은 같은 조건 데이터")
//             ELITE_THRESHOLD_KMH = { left: 140, right: 140 } 단일화 (UNIFIED_ELITE_THRESHOLD)
//             getPlayerMode·getModeTarget이 armSide 매개변수 무시 → 항상 우투 target lookup
//             modeCoachingHtml·헤더에서 "좌투/우투" 라벨 제거, "Elite 임계 140 km/h" 단일 표현
//             (좌투수의 좌표계 정규화 — LEFT_TRUNK_REF, peak_x_factor swap 등 — 모두 유지)
//   v33.8 — master_fitness Height 매핑으로 stride_norm_height 정확도 향상 (사용자 요청 옵션 C)
//           (A) Python 코호트: master_fitness.xlsx 268행 Lab_ID→Height 매핑 → 1810 trial 재처리
//                → cohort_v29.js stride_norm_height 분포 갱신 (1.80m fallback 기반 → 선수별 정확)
//                → 1790 trial Lab_ID 정확 매칭, 20 trial ID fallback (kwonjunseo·leetaehoon)
//           (B) BBL 사이트 매칭 로직 강화:
//                → extractScalarsFromUplift에서 sessionFolder(Lab_ID 형식) 자동 산출
//                  athlete_name + capture_time(unix/ISO) → "{id}_{yyyyMMdd}"
//                → master_fitness 매칭 키에 Lab_ID(0차 우선) + ID 부분일치 fuzzy 추가
//                → 정예준 같은 매칭 실패 케이스 해결 (기존 ID 정확 비교만 → Lab_ID 우선)
//   v33.9 — OUTPUT·TRANSFER·INJURY 카테고리별 종합 점수 (사용자 요청 옵션 E)
//           computeCategoryScore: variables percentile 평균 (단일 변수 outlier 영향 감소)
//           사분면 차트 점 위치 = 카테고리 종합 점수 (이전: 통합 지표 단일 변수)
//           폴더 카드 헤더에 "종합 N pt (n/total변수)" 표시
//           세부 표에 통합 지표 + 카테고리 종합 둘 다 표시 (참고 비교용)
//           정예준·박명균 사례 검증: 단일 변수 outlier (예: shoulder_ir 17347°/s)에 흔들리지 않고 카테고리 평균이 안정적 진단 제공
//   v33.10 — Theia/Qualisys 비교 검증 기반 산식 보정 + 신뢰 어려운 D등급 변수 제거
//           [근거] Theia_BBL_비교분석_보고서_v2.docx — 23명 매칭 12변수 ICC + Bland-Altman + "Theia 산식을 BBL raw에 적용한 산식차 vs 측정차 분리"
//           ICC 0.5 이상 = max_shoulder_ER 1개뿐 (0.722). 단순 변수명 매칭으로는 시스템 일치도 거의 불가능.
//           B-1. trunk_forward_tilt_at_fc wrap-around 처리 (line 990~)
//                  좌·우투 통일: ((flex+180)%360+360)%360-180 → 180-|flex|
//                  효과: 23명 mean BBL 81° → 6.7° (Theia -5°와 일치)
//           B-2. Lag signal-based detection (line 700~)
//                  events.peakPelvis = detectPeakRotVel(...) — Uplift 사전 frame 무시, signal-based만
//                  효과: P→T lag mean 32.6→65.7ms, T→A 32.6→67.0ms (Theia 평균 방향)
//           B-3. shoulder_ir_vel_max 95-percentile robust (line 1184~)
//                  raw abs max → sorted 95-percentile (noise spike 제거)
//                  효과: 코호트 평균 4868→2721 °/s (elite 4000~7000 humerus IR vel 범위 부합)
//           D등급 변수 제거 (3건): KINETIC_FAULTS · EXTRA_VAR_SCORING · LITERATURE_OVERRIDE · PLAUSIBLE_RANGES · OUTPUT_VS_TRANSFER ·
//                                 OUTPUT_VS_TRANSFER_VAR_META · DRIVELINE_5_CATS · DRIVELINE_5_WEIGHTS · CATEGORY_WEIGHTS C1 · meanFields
//             - stride_norm_height: 4 정의 후보 모두 ICC <0.13. KH→FC ankle 3D 거리 vs Theia stride 정의 본질 차이
//             - peak_torso_counter_rot: BBL [KH-50,FC] 70° vs Theia 38°. 윈도우·정의 차이 매칭 불가
//             - shoulder_h_abd_at_fc: BBL -horizontal_adduction(횡단면) vs Theia 어깨 외전(전두면) — 평면 자체 다름
//           Phase 2 raw 산출 코드(line 998, 1228, 2095)는 보존 — 추후 분석용. 점수 평가에서만 제외.
//           stride_mean_m / stride_sd_cm은 P5 trial-to-trial 변동성 지표로 유지 (제구 카테고리 SD만 사용).
//           코호트 분포 갱신 (cohort_v29.js): pelvis_to_trunk_lag_ms 26.18→65.70 / trunk_to_arm_lag_ms 27.67→67.02 / shoulder_ir_vel_max 4868→2721
//           Python(extract_uplift_scalars.py)도 동일 변경 (BBL JS 1:1 매핑 원칙)
//   v33.11 — Theia 리포트 v0.98 디자인·포맷 이식 (점수 산식 변경 없음, UX·가독성 개선만)
//           [근거] Theia_Pitching_Report v0.92~v0.98 인계 문서 (2026-05-06)
//           Phase A. v0.97 모바일 가로 스크롤 + v0.98 KPI 유닛 overflow fix (index.html + app.js)
//                  - .scroll-x-mobile · .svg-min-mannequin(720px) · .svg-min-sequence(560px) 클래스 신설
//                  - .kpi-row + .kpi-num(clamp 22-36px) + .kpi-unit(0.4em, white-space:nowrap)
//                  - 헤더 KPI 4종(measuredVelo / ceiling_F100 / ceiling_M100 / ceiling) kpi-row 패턴 통일
//           Phase B. v0.92 인과 구조 — 4단계 SummaryBar (Cause↔Result↔Coaching 3카드)
//                  - 가장 심각한 fault 1건 추출 → cause-result-grid 3카드로 즉시 진단 노출
//                  - 톤 정리: '🚨 매우 위험 (즉시 조치)' → '⚠ 우선 보강', '즉시 조치 필요' → '점검 권장'
//                  - 변수별 상세는 details 펼침으로 격리 (메인 가독성 확보)
//           Phase C. v0.93 P3 패턴 — 3단계 에너지 흐름 단순화
//                  - 메인: Primary Leak 1문장 (가장 심각 fault) + 3 KPI (C2 앞다리·C3 몸통 로딩·C5 팔/UCL)
//                  - 6단계별 누수 상세는 details 펼침으로 격리
//                  - .primary-leak-line · cohort cat_scores 색상 매핑(75/50/25 임계)
//           Phase D. v0.94 P2 패턴 — 키네틱 체인 GIF + 모드별 코칭을 details 펼침으로 격리
//                  - 메인: 출력 vs 전달 사분면 (outputTransferCardHtml) + 마네킹·단계 진단으로 즉시 결론
//                  - 보조 컨텐츠는 사용자가 필요할 때만 펼쳐 보도록 격리
//           Phase F. Theia v0.98 Day 라이트 톤 통째 전환 (KBO 의사결정자 시연용)
//                  - :root 교체: --bg-primary #f5f7fa, --bg-card #fff, --accent #1F3864 navy
//                    카테고리 5색 신설 — output #C00000 / transfer #0070C0 / leak #7030A0 / injury #D97706 / control #2E7D32
//                    상태 강도 조정 — good #16a34a / warn #d97706 / bad #dc2626 + soft elevation shadow
//                  - Google Fonts 로드: Inter + Space Grotesk + JetBrains Mono
//                  - Theia 신규 컴포넌트: .kbo-page-head · .kbo-plain · .kbo-pill · .kbo-conf · .cat-card 5색
//                  - .card box-shadow var(--shadow) 추가
//                  - SVG 어두운 배경 일괄 교체: #0b1220·#0a1322 → #ffffff, gradient stop → #f5f7fa·#e8eef5
//                  - 마네킹 label rect fill #0b1220 → #ffffff, Chart point border #0a0b0d → #ffffff
//                  - export body bg #0a0b0d → #f5f7fa, toast shadow rgba(0,0,0,0.5) → rgba(15,42,74,0.15)
//                  - Tailwind bg-black/70 → rgba(255,255,255,0.92) backdrop-filter
//           산식·점수·코호트 분포 변경 없음 (D등급 변수 추가 제거 검토 결과: 진단 가치 큰 핵심 변수라 유지)
//   v33.12 — 사용자 피드백 (김강연 리포트 검토, 2026-05-06): 모순 표현 제거 + 코칭 표현 정리 + Athlete Card 신설
//           [근거] 메시지 우선순위 흔들림 + 표현 모순 (정상↔손실 / 우수↔Late Block / SSC 92↔SSC efficiency 낮음)
//           G1. 모순 표현 제거 — KINETIC_FAULTS·FAULT_VISUAL_GUIDE·KPI 라벨 정리
//                  - LeadKneeCollapse 라벨: '앞무릎 무너짐' → '앞다리 신전 약함 (Block Extension Weak)'
//                  - LateBlock cause: 'SSC efficiency 낮음' → '투구 동작 내 앞다리 반응 타이밍 지연 (체력 SSC와 별개)'
//                  - C2_FrontLegBlock name: '앞다리 버팀 (Block)' → '앞다리 형태/각도 유지 (Block Form)' (형태 평가임 명시)
//                  - SVG 마네킹 텍스트: '🚨 무릎 무너짐' → '⚠ 신전 약함', '✅ 키네틱 체인 정상 / 누수 미감지' → '✓ 전체 회전 순서 정상 / 시퀀스 누수 미감지 — 미세 조정은 4단계 진단 참조'
//                  - 3단계 KPI 카드 hint: 'FC→BR 무릎 무너짐 여부' → '무릎 각도 유지력 평가 — 형태. 반응 타이밍은 4단계 fault에서 별도'
//           G2. 코칭 목표값 현실화 — 레이백 185°+ → 현재 수준 유지 (이미 elite), 어깨 IR 4500°/s+ → 코호트 q75 단계적
//                  - C5_UpperBodyTransfer target: '레이백 185°+ · 어깨 IR 4500°/s+ (MLB 표준)' → '레이백 180°+ 현재 수준 유지 · lag 40~60ms 안정화 · 어깨 IR 코호트 q75 도달 (단계적)'
//                  - method/coaching에 변수별 분기 안내 추가 (이미 elite면 추가 증대 X, lag·IR 우선)
//           G3. 단위·해석 명확화 — Stride·릴리스·손목 속도
//                  - wrist_release_speed hint: '⚠ 공 속도 아님 — 손목 관절 markerless proxy. 측정 구속(km/h)과 별개의 메카닉 출력 지표' 추가
//                  - cohort 변수 라벨: 'Stride 평균 길이' → '...KH→FC ankle 3D 거리·m, 신장 비율 아님', '릴리스 평균 높이' → '...지면→손목 m, ⚠ 단위 검증 권고'
//                  - stride 2.04m vs cohort q값 0.96~1.06 / release 1.17m vs q값 0.40~0.53 단위 의심 → 별도 검증 task #18로 추가
//           G4. Athlete Card — 선수·코치 전달용 4섹션 카드 신설 (Theia v0.98 패턴)
//                  - 위치: renderReportHtml 마지막. 잘되는 점·가장 먼저 볼 점·선수 큐·오늘 할 훈련·6주 KPI 자동 생성
//                  - 통일 cue: "앞발이 닿으면 빨리 버티고, 몸통 다음에 팔이 나오게 하자."
//                  - cat_scores ≥ 75 강점 자동 추출, faults[0] focus, drills 3개 노출. .kbo-page-head + .kbo-plain + .cat-card 5색 활용
//   v33.13 — 거리·위치 변수 PLAUSIBLE_RANGES 코호트 기반 재설정 (사용자 피드백 2026-05-06)
//           [근거] Uplift는 스마트폰 카메라 기반 markerless pose estimation 시스템 (IMU 아님 — 사용자 정정 2026-05-06)
//                  → 절대 거리·위치 정확도 한계: 단일/dual 카메라 깊이(z) 추정 한계 + 신장 스케일링 한계 + 키포인트 검출 노이즈
//                  Theia 비교: stride_length BBL 190cm vs Theia 146cm (30% 차이) — 측정 정확도 한계
//                  김강연 케이스: stride 2.04m vs 코호트 mean 1.01m (2배), release 1.17m vs 코호트 mean 0.46m (2.5배)
//                  기존 release_height_m PLAUSIBLE {min:1.0, max:2.5}는 코호트 mean 0.46m와 어긋난 잘못된 설정
//           조치: PLAUSIBLE_RANGES 코호트 mean ± 5σ 기반으로 재설정
//                  - stride_mean_m: 신규 추가 {min:0.5, max:1.6} (v33.10에서 제거된 plausible을 코호트 기반으로 재추가)
//                  - release_height_m: {min:1.0, max:2.5} → fallback {min:-0.2, max:1.8} (실제는 dynamic — v33.13.1 참조)
//   v33.13.1 — release_height_m을 arm_slot 기반 dynamic plausible로 분기 (사용자 피드백 2026-05-06 후속)
//           [근거] release 절대 높이는 arm_slot(투구 각도)에 따라 합리적 범위가 크게 다름
//                  오버핸드 1.0~1.8m / 쓰리쿼터 0.6~1.4m / 사이드암 0.3~0.8m / 언더암 0~0.4m
//                  단일 plausible 범위로 잡으면 정통 오버핸드 큰 신장 또는 사이드암·언더암이 잘못 결측 처리됨
//           조치: PLAUSIBLE_RANGES_DYNAMIC 신규 객체 (metadata.js) — arm_slot_mean_deg에 따라 함수로 분기
//                  isImplausible() 함수 확장 — dynamic 우선, 없으면 정적 fallback
//                  arm_slot 미측정 시 fallback {min:-0.2, max:1.8} 광범위 (모든 arm_slot 포용)
//           효과: 사이드암 release 0.5m·언더암 release 0.2m도 정상 통과, 오버핸드 release 1.5m도 정상 통과
//                  arm_slot 별 비상식 outlier만 결측 처리 (예: 사이드암인데 release 1.2m면 markerless 깊이 추정 오류 의심 → 결측)
//   v33.13.2 — Uplift "IMU" 잘못 언급 정정 (사용자 정정 2026-05-06)
//           [정정] v33.13/v33.13.1 패치노트와 코멘트에 "Uplift IMU 가속도 적분 누적 drift"로 잘못 기술된 것을 정정
//                  실제: Uplift는 스마트폰 카메라 기반 markerless pose estimation 시스템 (IMU 아님)
//                  결론(거리 절대값 정확도 떨어짐)은 동일하지만 근거는 다름:
//                  - 단일/dual 카메라의 3D 깊이(z) 추정 한계
//                  - 신장 스케일링 한계 (알려진/추정 신장으로 픽셀→미터 변환 시 오차)
//                  - 키포인트 검출 노이즈 (가려짐·블러·조명·복장)
//                  - frame rate (보통 30~120fps) × 미분 → 각속도 노이즈 민감
//           영향: app.js 헤더 + metadata.js PLAUSIBLE_RANGES 코멘트 + README v33.13/v33.13.1 섹션 + 메모리 모두 정정
//                 plausible 범위 자체는 동일 (코호트 분포 기반 산출이라 시스템 종류 무관)
//   v33.14 — 회전 속도 4변수 LITERATURE_OVERRIDE 재등록 + stride PLAUSIBLE 재조정 (사용자 제안 2026-05-06)
//           [근거] 사용자 제안: "골반 몸통 팔 회전 속도는 업리프트 리포트에 제시한 프로 레인지를 기준으로"
//                  Exponent 2022 KinaTrax 비교 결과: Uplift는 pelvis rot vel을 KinaTrax 대비 ~2배 과대측정 (MAPE 78~137%)
//                  → 외부 시스템 기준(MLB 550°/s) 비교 시 시스템 차이가 점수에 그대로 반영
//                  → Uplift 자체 Pro 레인지는 Uplift 시스템에서 측정된 분포라 시스템 차이 자동 흡수 = 시스템 일관성 확보
//                  김강연 Uplift 리포트(2025-11-21) 검증: peak_pelvis 488/peak_trunk 821/peak_arm 1427/speedup 1.68 — 모두 Pro 레인지 안
//           조치 1: LITERATURE_OVERRIDE에 회전 속도 4종 + alias 재등록
//           조치 2: stride_mean_m PLAUSIBLE {0.5, 1.6} → {0.5, 2.2} 재조정 (Uplift % of height 단위 부합)
//   v33.15 — 회전 속도·speedup oneSided 'open_is_good' 제거 — 양방향 Gaussian으로 전환 (사용자 4선수 검증 2026-05-06)
//           [근거] 4선수 Uplift 공식 리포트 비교 검증:
//                  - 정예준 (S36, 우투, 2025-10-23, 메카닉스 최고수준): pelvis 483 Pro 정중앙 / arm 1328 Pro 정중앙 / X-Factor 40° elite
//                  - 김강연 (S07, 우투, 2025-11-21): pelvis 488 / arm 1427 / speedup 1.68 — 균형 elite
//                  - 정원진 (좌투, 2026-03-21): pelvis 612 ↑Pro / arm 1475 ≈Pro / speedup 1.37 ↓Pro 미달 — 폭주형
//                  - 홍주환 (좌투, 2026-03-21): pelvis 635 ↑↑Pro / arm 1578 ↑Pro / speedup 1.33 ↓Pro 미달 — 더 심한 폭주
//           결론: Uplift Pro range는 elite 분포의 양방향 한계. 메카닉 최고수준조차 Pro 정중앙.
//                 Pro range 초과 = elite의 elite가 아니라 "trunk·arm sync 못 한 폭주" 신호 (Speed Gain 미달이 직접 증거)
//           조치: peak_pelvis_av·peak_trunk_av·peak_arm_av·pelvis_trunk_speedup 및 alias의 oneSided 'open_is_good' 모두 제거
//                  - peak_pelvis_rot_vel·max_pelvis_rot_vel_dps·max_trunk_twist_vel_dps·arm_trunk_speedup 모두 양방향 Gaussian
//           효과 (시뮬레이션):
//                  - 홍주환 pelvis 635 → 100점 (cap) → 47점 (Pro 580 초과 페널티 정확히 반영)
//                  - 홍주환 arm 1578 → 100점 → 48점 (Pro 1480 초과 + 부상 위험 감지)
//                  - 정예준·김강연 (Pro 정중앙) → 90+점 elite 점수 유지
//           v33.14 LITERATURE_OVERRIDE 재등록은 그대로 유지. 이번엔 Gaussian 함수 형태만 변경.
const ALGORITHM_VERSION = 'v33.15';
const ALGORITHM_DATE    = '2026-05-06';

let CURRENT_AGE = '고교';
let CURRENT_INPUT = { fitness: {}, mechanics: {} };

// ★ v30.14 좌완 좌표계 보정 헬퍼 (2026-05-03)
//   좌완 trunk_rot/pelvis_rot은 우완과 별개 좌표 영역(circular wrap-around).
//   - circular normalize: ±360° wrap 처리
//   - 좌완 → 우완 등가 매핑: 점수제·UI에서 단일 target(-67°) 적용 가능
//   데이터 근거: 우완 6명 59 trial(-67.1°±33), 좌완 8명 157 trial(+173.8°±26.6)
function normalizeAngle(angle, ref) {
  if (angle == null || isNaN(angle)) return null;
  return ((angle - ref + 180) % 360) - 180 + ref;
}
const LEFT_TRUNK_REF  = 174;  // 좌완 trunk_rot@FC circular mean (n=157)
const LEFT_PELVIS_REF = 152;  // 좌완 pelvis_rot@FC circular mean (n=157)
const LEFT_TO_RIGHT_TRUNK_OFFSET  = 241;  // 좌완 normalized → 우완 등가 변환 (174 → -67)
const LEFT_TO_RIGHT_PELVIS_OFFSET = 200;  // 좌완 normalized → 우완 등가 변환 (152 → -48)

// ★ v30.15 Phase 2 — 4-cell 점수제 (handedness × dev/elite mode) (2026-05-03)
//   Mode A (sub-elite, gap to elite target): MaxV 미달 선수, target은 elite settled mean
//   Mode B (elite, refinement): MaxV 충족 선수, 좁은 sigma로 within-elite 차별화
//   데이터 근거 (216 trial):
//     R sub-elite (n=29 H1): -67±33 / R elite (n=30 H2): -95±23
//     L sub-elite (n=80 H1): -67±30 / L elite 135+ (n=60 H2): -60±22
//   좌완 elite는 우완보다 덜 닫힘(target -60° vs -95°) — 운동학적 천장 차이
// ★ v33.7.5 (2026-05-05) — 좌·우투 평가 통일: 모두 우투 기준 임계 사용
//   기존: { right: 140, left: 135 } — 좌투에 더 낮은 임계 적용 (관행적 보정)
//   변경: 좌투수의 좌표 정규화 후에는 우투와 동일 평가가 메모리 원칙("좌·우완은 같은 조건 데이터")
//        평가 임계 분리는 모순 → 단일 임계로 통일
const ELITE_THRESHOLD_KMH = { right: 140, left: 140 };  // 좌·우 모두 우투 기준 140 km/h
const UNIFIED_ELITE_THRESHOLD = 140;  // 단일 임계 (모든 모드 표시·임계 산식에서 사용)
// ★ v31.24 — 다음 데이터들은 metadata.js로 분리됨 (가독성 향상):
//   KINETIC_FAULTS, FAULT_VISUAL_GUIDE, CATEGORY_TRAINING_RECS,
//   PLAYER_MODE_TARGETS, LAG_OPTIMAL_VARS, EXTRA_VAR_SCORING,
//   LITERATURE_OVERRIDE, PLAUSIBLE_RANGES, CATEGORY_DETAILS
// 참고: <script src="metadata.js"> 가 cohort_v29.js 다음에 로드되어야 함


// 결함 자동 식별
function detectKineticFaults(mechanics, measuredVelo, armSide) {
  const faults = [];
  for (const f of KINETIC_FAULTS) {
    try {
      if (f.detect(mechanics, measuredVelo, armSide)) {
        faults.push(f);
      }
    } catch (e) { /* skip on error */ }
  }
  return faults;
}



// 현재 분석 컨텍스트 (calculateScores 진입 시 set, percentileOfCohort에서 read)
let CURRENT_ARM_SIDE = null;  // 'right' | 'left' | null
let CURRENT_MODE     = null;  // 'sub_elite' | 'elite' | null

// ★ v33.7.5 — 좌·우투 평가 통일: armSide 무시, 항상 단일 임계 + 우투 target 사용
function getPlayerMode(armSide, maxV) {
  if (!maxV) return 'sub_elite';
  // armSide 매개변수는 무시 — 모든 선수 동일 임계 (좌투수의 좌표는 이미 우투로 정규화됨)
  return maxV >= UNIFIED_ELITE_THRESHOLD ? 'elite' : 'sub_elite';
}

// 변수별 mode-aware target lookup — armSide 무시, 항상 'right' lookup 사용
function getModeTarget(varKey, armSide, mode) {
  const byHand = PLAYER_MODE_TARGETS[varKey];
  if (!byHand) return null;
  const byMode = byHand['right'];  // ★ v33.7.5 — 좌·우 통일: 좌투도 우투 target 사용
  if (!byMode) return null;
  return byMode[mode] || byMode['sub_elite'];
}

// ════════════════════════════════════════════════════════════════════
// 유틸리티
// ════════════════════════════════════════════════════════════════════
function scoreColor(score) {
  if (score == null) return 'var(--text-muted)';
  if (score >= 75) return '#4ade80';
  if (score >= 50) return '#60a5fa';
  if (score >= 25) return '#fbbf24';
  return '#f87171';
}

// ★ 점수에 코호트 컨텍스트 라벨 추가 (2026-05-03 UX)
//   점수가 곧 코호트 백분위임 — 직관적 의미 부여
function scoreContext(score) {
  if (score == null) return '';
  if (score >= 90) return '최상위';
  if (score >= 75) return '우수';
  if (score >= 60) return '상위 평균';
  if (score >= 40) return '평균 수준 — 발달 여지 큼';
  if (score >= 25) return '발달 필요';
  return '집중 보강 필요';
}
// 짧은 버전 (변수 행에 inline 표시용)
function scoreContextShort(score) {
  if (score == null) return '';
  if (score >= 90) return '최상위';
  if (score >= 75) return '우수';
  if (score >= 60) return '상위';
  if (score >= 40) return '평균';
  if (score >= 25) return '아쉬움';
  return '보강';
}

function scoreToWord(s) {
  if (s == null) return '—';
  if (s >= 75) return '매우 우수';
  if (s >= 60) return '양호';
  if (s >= 40) return '평균적';
  if (s >= 25) return '부족';
  return '심각하게 부족';
}



// ★ LITERATURE_OVERRIDE (2026-05-03) — 외부 표준 데이터(연구 문헌)가 풍부한 변수
//   코호트 percentile 대신 EXTRA_VAR_SCORING 우선 적용. HS/Pro elite 기준 부합도 평가
//   X-factor: Stodden 2001, Aguinaldo 2007 / 트렁크 회전속도: Werner 2008, Wood-Smith 2019

// ════════════════════════════════════════════════════════════════════
// PLAUSIBLE_RANGES — 물리적/측정학적으로 가능한 값의 한계 (2026-05-03 추가)

// 현재 평가에서 결측 보정된 변수들 (UI 배지용) — 평가 시작 시 reset
const IMPLAUSIBLE_VARS = new Set();
function resetImplausibleFlags() { IMPLAUSIBLE_VARS.clear(); }
function isImplausible(varKey, value) {
  if (value == null || isNaN(value)) return false;
  // ★ v33.13.1 — PLAUSIBLE_RANGES_DYNAMIC 우선 (arm_slot 등 다른 변수 의존 변수)
  //   arm_slot 측정값 기준으로 동적 plausible 산출 → 미측정 시 null 반환되어 정적 fallback 사용
  let p = PLAUSIBLE_RANGES[varKey];
  if (typeof PLAUSIBLE_RANGES_DYNAMIC !== 'undefined' && PLAUSIBLE_RANGES_DYNAMIC[varKey]) {
    const mechanics = (typeof CURRENT_INPUT !== 'undefined' && CURRENT_INPUT) ? (CURRENT_INPUT.mechanics || {}) : {};
    const dyn = PLAUSIBLE_RANGES_DYNAMIC[varKey](mechanics);
    if (dyn) p = dyn;  // dynamic 산출 성공 시 정적 대신 사용
  }
  if (!p) return false;
  // ★ v31.46 useAbs 변수는 절댓값으로 체크 (좌투수 raw 부호 차이 흡수)
  //   예: peak_x_factor 좌투수 raw -40.4° → |40.4| = 40.4°가 PLAUSIBLE 범위 안인지 체크
  const scoring = (typeof EXTRA_VAR_SCORING !== 'undefined') ? EXTRA_VAR_SCORING[varKey] : null;
  const v = (scoring && scoring.useAbs) ? Math.abs(value) : value;
  if (p.min != null && v < p.min) return true;
  if (p.max != null && v > p.max) return true;
  return false;
}

// 백분위 계산: raw 값 → 코호트 안에서 N백분위
function percentileOfCohort(varKey, value, polarity) {
  if (value == null || isNaN(value)) return null;

  // ★ Plausibility 체크 (2026-05-03) — 비상식적 값은 결측 보정 50점
  if (isImplausible(varKey, value)) {
    IMPLAUSIBLE_VARS.add(varKey);
    return 50;
  }

  // ★ LITERATURE_OVERRIDE (2026-05-03) — 외부 기준 우선 변수는 코호트 무시하고 Gaussian 점수
  if (LITERATURE_OVERRIDE.has(varKey) && EXTRA_VAR_SCORING[varKey]) {
    // ★ v30.15: 4-cell mode-aware target 우선 적용 (handedness × dev/elite)
    const modeTarget = (CURRENT_ARM_SIDE && CURRENT_MODE) ? getModeTarget(varKey, CURRENT_ARM_SIDE, CURRENT_MODE) : null;
    const x = modeTarget || EXTRA_VAR_SCORING[varKey];
    let v = x.useAbs ? Math.abs(value) : value;
    if (x.optimal != null) {
      // ★ v31.46 one-sided Gaussian 지원
      //   oneSided: 'closed_is_good' — optimal보다 더 음수(닫힘) 방향은 100점 cap (예: trunk_rotation_at_fc)
      //   oneSided: 'open_is_good'   — optimal보다 더 양수(열림) 방향은 100점 cap
      //   기본 (양방향) — 표준 Gaussian
      if (x.oneSided === 'closed_is_good' && v <= x.optimal) return 100;
      if (x.oneSided === 'open_is_good'   && v >= x.optimal) return 100;
      return Math.round(100 * Math.exp(-((v - x.optimal) ** 2) / (2 * x.sigma * x.sigma)));
    }
    if (x.min != null && x.max != null) {
      let s = ((v - x.min) / (x.max - x.min)) * 100;
      if (x.polarity === 'lower') s = 100 - s;
      return Math.round(Math.max(0, Math.min(100, s)));
    }
  }

  // Lag 변수는 가우시안 (45ms 최적, ±15ms 평균)
  if (LAG_OPTIMAL_VARS[varKey]) {
    const { optimal, sigma } = LAG_OPTIMAL_VARS[varKey];
    return Math.round(100 * Math.exp(-((value - optimal) ** 2) / (2 * sigma * sigma)));
  }

  // proper_sequence는 binary 변수 — raw × 100
  if (COHORT.binary_vars && COHORT.binary_vars.includes(varKey)) {
    return Math.max(0, Math.min(100, value * 100));
  }

  // 코호트 분포가 없는 ★Phase2 변수 → 문헌 기반 정규 범위로 점수
  const sortedCheck = COHORT.var_sorted_lookup[varKey];
  if (!sortedCheck || sortedCheck.length < 30) {
    const x = EXTRA_VAR_SCORING[varKey];
    if (x) {
      let v = x.useAbs ? Math.abs(value) : value;
      if (x.optimal != null) {
        // Gaussian
        return Math.round(100 * Math.exp(-((v - x.optimal) ** 2) / (2 * x.sigma * x.sigma)));
      }
      if (x.min != null && x.max != null) {
        // Linear
        let s = ((v - x.min) / (x.max - x.min)) * 100;
        if (x.polarity === 'lower') s = 100 - s;
        return Math.round(Math.max(0, Math.min(100, s)));
      }
    }
    return null;  // 코호트도 없고 EXTRA도 없으면 점수 산출 불가
  }
  
  const sorted = COHORT.var_sorted_lookup[varKey];
  if (!sorted || sorted.length < 30) return null;
  
  if (polarity === 'absolute') {
    // ★ v33.7 (2026-05-05) — 'absolute' = "절댓값 작을수록 좋음" 의미로 통일
    //   Phase 3 lag 변수(stride_to_pelvis_lag_ms, x_factor_to_peak_pelvis_lag_ms)는
    //   0에 가까울수록 양호 (양/음 모두 비효율) → 점수 반전 필요
    const absSorted = sorted.map(v => Math.abs(v)).sort((a,b) => a-b);
    const absVal = Math.abs(value);
    let rank = 0;
    for (let i = 0; i < absSorted.length; i++) {
      if (absSorted[i] <= absVal) rank++;
      else break;
    }
    // 절댓값이 작을수록 좋음 → percentile 반전 (rank 작으면 점수 높음)
    return Math.round(100 * (1 - rank / absSorted.length));
  }
  
  let rank = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i] <= value) rank++;
    else break;
  }
  let pct = Math.round(100 * rank / sorted.length);
  
  // polarity가 'lower'면 점수 반전 (작을수록 좋음)
  if (polarity === 'lower') pct = 100 - pct;
  
  return pct;
}

// ════════════════════════════════════════════════════════════════════
// 폼 렌더링
// ════════════════════════════════════════════════════════════════════
function renderInputs() {
  // 모든 입력 폼은 CSV 전용 UI로 대체됨. 코호트 정보 헤더만 갱신.
  document.getElementById('cohort-info').textContent =
    `코호트: ${COHORT.meta.cohort_n_players}명 / ${COHORT.meta.cohort_size}회 측정 · 18 카테고리 / ${Object.keys(COHORT.var_distributions).length} 변수`;
}

function selectAge(age) {
  CURRENT_AGE = age;
  document.querySelectorAll('.age-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.age === age);
  });
  const adj = COHORT.age_group_adjustment[age];
  document.getElementById('age-desc').textContent = `${age}: ${adj.desc}`;
}

// ════════════════════════════════════════════════════════════════════
// CSV 업로드 / 다운로드
// ════════════════════════════════════════════════════════════════════
function downloadTemplate(type) {
  let csv = 'field_key,field_name,unit,polarity,value\n';
  let cats;
  if (type === 'fitness') cats = [...COHORT.fitness_cats, ...COHORT.control_cats];
  else cats = COHORT.mechanics_cats;
  
  const seen = new Set();
  for (const catId of cats) {
    for (const v of (COHORT.category_vars[catId] || [])) {
      const [key, name, unit, dec, polarity] = v;
      if (seen.has(key)) continue;
      seen.add(key);
      const inCohort = COHORT.var_distributions[key] ? '' : ' (★Phase2-점수산출불가)';
      csv += `${key},"${name}${inCohort}",${unit || ''},${polarity || 'higher'},\n`;
    }
  }
  
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `BBL_${type}_template.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── CSV 파싱 유틸 ─────────────────────────────────────────────────
// 따옴표 안의 콤마를 보존하는 안전한 한 줄 파서
function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i+1] === '"') { cur += '"'; i++; }
      else if (ch === '"') { inQ = false; }
      else cur += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === ',') { out.push(cur); cur = ''; }
      else cur += ch;
    }
  }
  out.push(cur);
  return out.map(s => s.trim());
}

// 컬럼명 정규화: 소문자 + 모든 공백 제거 (브래킷·괄호는 유지하면 코호트 키와 더 잘 매칭됨)
function normalizeColName(s) {
  return (s || '').toLowerCase().replace(/\s+/g, '');
}

// 와이드 CSV 컬럼명 → 코호트 변수 키 alias (정규화된 키 기준)
const FITNESS_KEY_ALIASES = {
  'bw[kg]':       'Weight[KG]',
  'bw':           'Weight[KG]',
  'weight':       'Weight[KG]',
  'weight[kg]':   'Weight[KG]',
  'bodyweight':   'Weight[KG]',
  'height':       'Height[M]',
  'height[m]':    'Height[M]',
  'bodyheight':   'Height[M]',
};

// 메타 컬럼: Step 1 입력 필드로 자동 채움
const META_COL_MAP = {
  'name':          'name',
  'playername':    'name',
  'date':          'date',
  'measurementdate': 'date',
  'maxvelocity':   'velocity',
  'maxvelo':       'velocity',
  'velocity':      'velocity',
  'topvelocity':   'velocity',
};

// 코호트 변수 키 정규화 → 원본 키 lookup (alias 적용) — type별 캐시
const _COHORT_KEY_LOOKUP = { fitness: null, mechanics: null };
function getCohortKeyLookup(type) {
  if (_COHORT_KEY_LOOKUP[type]) return _COHORT_KEY_LOOKUP[type];
  const lookup = {};
  let cats;
  if (type === 'fitness') cats = [...COHORT.fitness_cats, ...COHORT.control_cats];
  else cats = COHORT.mechanics_cats;
  for (const cat of cats) {
    for (const v of (COHORT.category_vars[cat] || [])) {
      lookup[normalizeColName(v[0])] = v[0];
    }
  }
  if (type === 'fitness') Object.assign(lookup, FITNESS_KEY_ALIASES);
  _COHORT_KEY_LOOKUP[type] = lookup;
  return lookup;
}

// 날짜 유연 파싱: YYYY-MM-DD / YYYY/MM/DD / DD/MM/YYYY / DD-MM-YYYY
function parseDateFlex(s) {
  if (!s) return '';
  s = String(s).trim();
  let m = s.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
  m = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  return s;
}

// ── CSV 업로드 (자동 포맷 감지) ─────────────────────────────────
const WIDE_CSV_CACHE = { fitness: null, mechanics: null };

function handleCsvUpload(event, type) {
  const files = event.target.files;
  if (!files || files.length === 0) return;

  // 다중 파일 — 메카닉 영역에서만 다중 trial 처리 지원
  if (files.length > 1) {
    if (type !== 'mechanics') {
      alert('체력+구속 영역에는 한 번에 한 파일만 업로드해주세요.');
      event.target.value = '';
      return;
    }
    handleMultipleUpliftFiles(Array.from(files));
    event.target.value = '';
    return;
  }

  const file = files[0];
  const reader = new FileReader();
  reader.onerror = () => alert('파일을 읽지 못했습니다. 다른 파일로 다시 시도해주세요.');
  reader.onload = (e) => {
    try {
      let text = e.target.result;
      if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) { alert('CSV가 비어 있습니다.'); return; }

      const header = parseCsvLine(lines[0]);
      const headerNorm = header.map(h => normalizeColName(h));

      const isLongFormat =
        headerNorm.some(h => h === 'field_key' || h === 'fieldkey' || h === 'key') &&
        headerNorm.some(h => h === 'value');

      // Uplift Capture raw 시계열 CSV — athlete_name/frame/fps 컬럼이 모두 있을 때
      const isUpliftFormat =
        headerNorm.includes('athlete_name') &&
        headerNorm.includes('frame') &&
        headerNorm.includes('fps');

      if (isUpliftFormat) processUpliftCsv(header, headerNorm, lines, type);
      else if (isLongFormat) processLongCsv(header, headerNorm, lines, type);
      else processWideCsv(header, headerNorm, lines, type);
    } catch (err) {
      console.error('CSV 처리 오류:', err);
      alert('CSV 처리 중 오류가 발생했습니다:\n' + (err && err.message ? err.message : err)
            + '\n\n브라우저 개발자 콘솔(F12)에 자세한 내용이 출력됩니다.');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

// ── Uplift 파싱: 텍스트 → 구조 ──
function parseUpliftFile(text) {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return null;
  const header = parseCsvLine(lines[0]);
  const headerNorm = header.map(h => normalizeColName(h));
  if (!headerNorm.includes('athlete_name') || !headerNorm.includes('frame') || !headerNorm.includes('fps')) return null;
  const idx = {};
  header.forEach((h, i) => { idx[h] = i; });
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length < 5) continue;
    rows.push(cols);
  }
  if (rows.length === 0) return null;
  return { idx, rows };
}

// ── 한 trial에서 모든 scalar 추출 ──
function extractScalarsFromUplift(parsed) {
  const { idx, rows } = parsed;
  const r0 = rows[0];

  const athleteName = r0[idx['athlete_name']] || '';
  // ★ v33.2 (2026-05-04) Uplift CSV 컬럼명 다양성: capture_datetime 또는 capture_time
  const captureDate = r0[idx['capture_datetime']] || r0[idx['capture_time']] || '';
  const fps         = parseFloat(r0[idx['fps']]) || 240;
  const handedness  = (r0[idx['handedness']] || '').toLowerCase();
  const armSide     = handedness === 'left' ? 'left' : 'right';
  const kinSeq      = r0[idx['kinematic_sequence_order']] || '';

  // ★ v33.8 — sessionFolder 산출 (master_fitness Lab_ID 매칭용)
  //   형식: "{id}_{yyyyMMdd}" — 예: "jeongyejun_20250429"
  //   athlete_name "S36 jeongyejun" → "jeongyejun" (s번호 제거)
  //   capture_time이 unix timestamp(숫자) 또는 ISO 문자열 둘 다 처리
  let sessionFolder = null;
  try {
    const idStr = athleteName.toLowerCase().replace(/^s\d+\s+/i, '').trim();
    let dateStr = '';
    if (/^\d{10,}$/.test(String(captureDate))) {
      // unix timestamp (초 또는 밀리초)
      const ts = parseInt(captureDate, 10);
      const d = new Date(ts < 1e12 ? ts * 1000 : ts);
      dateStr = d.toISOString().slice(0, 10).replace(/-/g, '');
    } else {
      // ISO 또는 날짜 문자열
      const m = String(captureDate).match(/(\d{4})[-/.]?(\d{2})[-/.]?(\d{2})/);
      if (m) dateStr = m[1] + m[2] + m[3];
    }
    if (idStr && dateStr) sessionFolder = idStr + '_' + dateStr;
  } catch (e) { /* sessionFolder=null */ }

  // 이벤트 프레임 절대값
  // ★ v33.2 (2026-05-04) — Uplift CSV의 "0" 값을 placeholder(검출 실패)로 인식하여 null 처리
  //   박명균 케이스 발견: Uplift CSV에서 max_external_rotation_frame 값이 0인 trial 9/10개
  //   (다른 이벤트는 -381, -811 같은 큰 음수 / MER만 0). 0은 "MER 미검출" 의미.
  //   기존 버그: 0을 valid offset으로 처리 → events.mer = 0 (frame 0) → arm peak 윈도우가 시퀀스 시작점으로 깨짐
  //   수정: raw 값이 0이면 null 반환 → rawMER fallback 사용 → 정상 윈도우
  const cur0 = parseFloat(r0[idx['frame']]) || 0;
  const getFrameAbs = (key) => {
    const ci = idx[key]; if (ci == null) return null;
    const v = parseFloat(r0[ci]);
    if (isNaN(v) || v === 0) return null;  // 0 = Uplift "not detected" placeholder
    return cur0 - v;
  };
  // 이벤트 1차 추출 — Uplift 사전계산 컬럼 (참고용)
  const upEvents = {
    fc:  getFrameAbs('foot_contact_frame'),
    br:  getFrameAbs('ball_release_frame'),
    mer: getFrameAbs('max_external_rotation_frame'),
    kh:  getFrameAbs('max_knee_raise_frame'),
    peakPelvis: getFrameAbs('peak_pelvis_angular_velocity_frame')
                ?? getFrameAbs('max_pelvis_rotational_velocity_with_respect_to_ground_frame'),
    peakTrunk:  getFrameAbs('peak_trunk_angular_velocity_frame')
                ?? getFrameAbs('max_trunk_rotational_velocity_with_respect_to_ground_frame'),
    peakArm:    getFrameAbs('peak_arm_angular_velocity_frame')
                ?? getFrameAbs(`max_${armSide}_arm_rotational_velocity_with_respect_to_ground_frame`),
  };

  const frameMap = {};
  rows.forEach((r, i) => {
    const f = parseInt(r[idx['frame']], 10);
    if (!isNaN(f)) frameMap[f] = i;
  });

  // ════════════════════════════════════════════════════════════════════
  // ★ 이벤트 자동 검출 (2026-05-03) — Uplift 의존 제거, raw 시계열에서 직접 산출
  //   각 이벤트는 윈도우 제약 + 적절한 신호로 검출
  //   front leg (stride leg) = 던지기 팔 반대쪽
  //   - 우투(armSide=right) → front=left, drive=right
  //   - 좌투(armSide=left)  → front=right, drive=left
  // ════════════════════════════════════════════════════════════════════
  const frontSide = (armSide === 'left') ? 'right' : 'left';
  const totalFrames = rows.length;

  // 윈도우 내 컬럼 argmax/argmin 헬퍼
  const _argExtreme = (colName, fromIdx, toIdx, mode /* 'max' | 'min' | 'absMax' */) => {
    const ci = idx[colName]; if (ci == null) return null;
    const lo = Math.max(0, fromIdx), hi = Math.min(totalFrames - 1, toIdx);
    let best = null, bestRow = null;
    for (let r = lo; r <= hi; r++) {
      const v = parseFloat(rows[r][ci]);
      if (isNaN(v)) continue;
      const x = (mode === 'absMax') ? Math.abs(v) : v;
      if (best == null) { best = x; bestRow = r; continue; }
      if (mode === 'min' && x < best) { best = x; bestRow = r; }
      else if ((mode === 'max' || mode === 'absMax') && x > best) { best = x; bestRow = r; }
    }
    if (bestRow == null) return null;
    // bestRow → frame 변환
    const f = parseInt(rows[bestRow][idx['frame']], 10);
    return isNaN(f) ? null : f;
  };

  // KH: front knee 최고 y (트라이얼 first 60% 윈도우)
  const detectKH = () => _argExtreme(frontSide + '_knee_jc_3d_y', 0, Math.floor(totalFrames * 0.6), 'max');

  // FC: front ankle y minimum AFTER KH (KH+30 ~ KH+200, 240fps 기준 125ms~833ms)
  const detectFC = (khFrame) => {
    if (khFrame == null) return null;
    const khRow = frameMap[khFrame]; if (khRow == null) return null;
    return _argExtreme(frontSide + '_ankle_jc_3d_y', khRow + 30, khRow + 200, 'min');
  };

  // MER: throwing arm shoulder ER 절대값 max in [FC, FC+30] (또는 FC~BR)
  const detectMER = (fcFrame, brFrame) => {
    if (fcFrame == null) return null;
    const fcRow = frameMap[fcFrame]; if (fcRow == null) return null;
    const brRow = brFrame != null ? frameMap[brFrame] : null;
    const hi = brRow != null ? brRow : fcRow + 30;
    return _argExtreme(armSide + '_shoulder_external_rotation', fcRow, hi, 'absMax');
  };

  // BR: peak arm rotational velocity (절대값) in [FC+5, FC+50]
  //   peak arm AV가 BR과 거의 동시 또는 직전에 발생
  // ★ v31.12 throwing arm 자동 검출 — 양 팔 비교
  const detectBR = (fcFrame) => {
    if (fcFrame == null) return null;
    const fcRow = frameMap[fcFrame]; if (fcRow == null) return null;
    const lArmF = _argExtreme('left_arm_rotational_velocity_with_respect_to_ground',  fcRow + 5, fcRow + 50, 'absMax');
    const rArmF = _argExtreme('right_arm_rotational_velocity_with_respect_to_ground', fcRow + 5, fcRow + 50, 'absMax');
    // 두 팔 중 abs velocity가 더 큰 시점 선택
    const ci_l = idx['left_arm_rotational_velocity_with_respect_to_ground'];
    const ci_r = idx['right_arm_rotational_velocity_with_respect_to_ground'];
    const lVal = (lArmF != null && ci_l != null) ? Math.abs(parseFloat(rows[frameMap[lArmF]][ci_l]) || 0) : 0;
    const rVal = (rArmF != null && ci_r != null) ? Math.abs(parseFloat(rows[frameMap[rArmF]][ci_r]) || 0) : 0;
    return lVal >= rVal ? lArmF : rArmF;
  };

  // peak rotational velocity 검출 (시퀀스 lag 용) — 윈도우 보수적 fallback (2026-05-03)
  //   기존 버그: toF=null일 때 시리즈 끝까지 검사 → 던지기 후 noise spike를 peak로 오검출
  //   수정: toF=null이면 fromF+200 frame 한계 (240fps에서 약 833ms — 던지기 모션 끝나는 시점)
  const detectPeakRotVel = (col, fromF, toF) => {
    const fromRow = fromF != null ? frameMap[fromF] : 0;
    let toRow;
    if (toF != null) {
      toRow = frameMap[toF];
    } else if (fromRow != null) {
      // 보수적 fallback — fromF + 200 frame
      toRow = Math.min(fromRow + 200, totalFrames - 1);
    } else {
      toRow = totalFrames - 1;
    }
    return _argExtreme(col, fromRow != null ? fromRow : 0, toRow != null ? toRow : totalFrames - 1, 'absMax');
  };

  // 이벤트 통합: Uplift 우선, raw 검출 fallback. 검출 실패 시 null.
  //   추후 검증: Uplift vs raw 차이가 크면 _event_qc 플래그 (TODO)
  const rawKH  = detectKH();
  const rawFC  = detectFC(rawKH);
  const rawBR  = detectBR(rawFC);
  const rawMER = detectMER(rawFC, rawBR);

  const events = {
    kh:  upEvents.kh  != null ? upEvents.kh  : rawKH,
    fc:  upEvents.fc  != null ? upEvents.fc  : rawFC,
    br:  upEvents.br  != null ? upEvents.br  : rawBR,
    mer: upEvents.mer != null ? upEvents.mer : rawMER,
  };
  // ★ v31.12 throwing arm 자동 검출 + windowed peak detection
  //   사용자 가설: Uplift 좌완 데이터에서 left_arm이 글러브 손이고 throwing arm이 right_arm일 가능성
  //   해결: 양 팔의 max angular velocity 비교 → 큰 쪽이 throwing arm

  // ★ v33.10 (2026-05-05) — Theia 비교 결과: Uplift 사전 peak frame 사용 시 lag mean diff +30~60ms.
  //   Uplift의 peak_*_angular_velocity_frame은 BBL과 다른 알고리즘으로 산출되어 raw signal max와 불일치.
  //   signal-based windowed detection만 사용(Uplift 사전 frame 무시) → mean diff 30→6ms로 개선 검증됨.
  //   v33.3 박명균 우려는 Uplift 의존 자체보다 detectPeakRotVel 윈도우 정확도가 더 본질이라 결론.
  // pelvis peak: signal-based [KH, MER] 윈도우 단일 적용
  const _pelvisLo = rawKH ?? events.fc;
  const _pelvisHi = events.mer ?? events.br ?? rawBR;
  events.peakPelvis = detectPeakRotVel('pelvis_rotational_velocity_with_respect_to_ground', _pelvisLo, _pelvisHi);

  // trunk peak: signal-based [FC, MER+10] 윈도우 단일 적용
  const _trunkLo = events.fc ?? rawFC;
  const _trunkHi = (events.mer != null) ? events.mer + 10 : (events.br ?? rawBR);
  events.peakTrunk = detectPeakRotVel('trunk_rotational_velocity_with_respect_to_ground', _trunkLo, _trunkHi);

  // arm peak: throwing arm 자동 검출 (handedness 컨벤션 의존 X)
  const _armLo = (events.mer != null) ? events.mer + 3 : (events.fc ?? rawFC);
  const _armHi = (events.br != null) ? events.br + 10 : rawBR;
  // 양 팔의 max abs velocity 비교
  const _getMaxAbsInWin = (col, lo, hi) => {
    const ci = idx[col]; if (ci == null) return 0;
    const loRow = frameMap[lo]; const hiRow = frameMap[hi];
    if (loRow == null || hiRow == null) return 0;
    let mx = 0;
    for (let i = loRow; i <= hiRow; i++) {
      const v = parseFloat(rows[i][ci]);
      if (!isNaN(v) && Math.abs(v) > mx) mx = Math.abs(v);
    }
    return mx;
  };
  const _leftMaxAv  = _getMaxAbsInWin('left_arm_rotational_velocity_with_respect_to_ground',  _armLo, _armHi);
  const _rightMaxAv = _getMaxAbsInWin('right_arm_rotational_velocity_with_respect_to_ground', _armLo, _armHi);
  // ★ v33.1 — 자동 검출 신뢰성 가드 (2026-05-04 박명균 케이스 해결)
  //   기존 v31.12 버그: `_leftMaxAv >= _rightMaxAv`가 0 >= 0 케이스에서 true → 'left' 잘못 선택
  //   → label='right', detected=left(0°/s)인 채로 left arm을 throwing arm으로 사용 → 모든 peak null
  //   수정:
  //   (a) 둘 다 신뢰 임계(800°/s) 미만이면 detection 거부, label 사용
  //   (b) `>=` → `>` 로 strict 비교 (tie 시 label 우선)
  const _ARM_DETECT_THRESHOLD = 800;  // °/s — peak arm AV는 대개 1000+, 이 미만이면 윈도우 오류 가능
  let _throwingArmDetected;
  if (_leftMaxAv < _ARM_DETECT_THRESHOLD && _rightMaxAv < _ARM_DETECT_THRESHOLD) {
    _throwingArmDetected = armSide;
    console.warn(`⚠ Throwing arm 자동검출 신뢰 임계 미만 (L:${_leftMaxAv.toFixed(0)}°/s, R:${_rightMaxAv.toFixed(0)}°/s) — handedness label '${armSide}' 사용`);
  } else if (_leftMaxAv > _rightMaxAv) {
    _throwingArmDetected = 'left';
  } else if (_rightMaxAv > _leftMaxAv) {
    _throwingArmDetected = 'right';
  } else {
    _throwingArmDetected = armSide;  // tie → label 우선
  }
  const armVelCol = _throwingArmDetected + '_arm_rotational_velocity_with_respect_to_ground';
  if (_throwingArmDetected !== armSide) {
    console.warn(`⚠ Throwing arm detected (${_throwingArmDetected}, max ${Math.max(_leftMaxAv,_rightMaxAv).toFixed(0)}°/s) differs from handedness label (${armSide}). Using detected.`);
  }
  // ★ v33.10 — Theia 비교 결과: Uplift 사전 peak_arm frame 무시. signal-based detection만 사용.
  //   pelvis/trunk와 동일한 정책 — Uplift 사전 컬럼은 BBL signal max와 다른 알고리즘.
  events.peakArm = detectPeakRotVel(armVelCol, _armLo, _armHi);

  // ★ v31.11 음수 lag 자동 보정 — 시퀀싱 정합성 강제 (proximal-to-distal)
  if (events.peakArm != null && events.peakTrunk != null && events.peakArm < events.peakTrunk + 5) {
    const _armLo2 = events.peakTrunk + 5;
    const _armHi2 = (events.br != null) ? events.br + 10 : rawBR;
    if (_armLo2 < _armHi2) {
      const retried = detectPeakRotVel(armVelCol, _armLo2, _armHi2);
      if (retried != null) events.peakArm = retried;
    }
  }
  if (events.peakTrunk != null && events.peakPelvis != null && events.peakTrunk < events.peakPelvis + 5) {
    const _trunkLo2 = events.peakPelvis + 5;
    const _trunkHi2 = (events.mer != null) ? events.mer + 10 : (events.br ?? rawBR);
    if (_trunkLo2 < _trunkHi2) {
      const retried = detectPeakRotVel('trunk_rotational_velocity_with_respect_to_ground', _trunkLo2, _trunkHi2);
      if (retried != null) events.peakTrunk = retried;
    }
  }

  // 이벤트 검출 메타 (추후 UI 표시 — Uplift vs raw 일치도)
  const _eventMeta = {
    kh:  { uplift: upEvents.kh,  raw: rawKH,  used: events.kh },
    fc:  { uplift: upEvents.fc,  raw: rawFC,  used: events.fc },
    br:  { uplift: upEvents.br,  raw: rawBR,  used: events.br },
    mer: { uplift: upEvents.mer, raw: rawMER, used: events.mer },
  };
  const valAt = (frame, col) => {
    if (frame == null) return null;
    const ci = idx[col]; if (ci == null) return null;
    const ri = frameMap[frame]; if (ri == null) return null;
    const v = parseFloat(rows[ri][ci]); return isNaN(v) ? null : v;
  };
  const colMaxBetween = (col, fromF, toF) => {
    const ci = idx[col]; if (ci == null || fromF == null || toF == null) return null;
    let max = null;
    const lo = Math.min(fromF, toF), hi = Math.max(fromF, toF);
    for (let f = lo; f <= hi; f++) {
      const ri = frameMap[f]; if (ri == null) continue;
      const v = parseFloat(rows[ri][ci]);
      if (!isNaN(v) && (max == null || v > max)) max = v;
    }
    return max;
  };
  // ★ v30.22: raw 시계열 min (음수 max) — extension velocity (= -flexion vel) 산출용
  const colMinBetween = (col, fromF, toF) => {
    const ci = idx[col]; if (ci == null || fromF == null || toF == null) return null;
    let min = null;
    const lo = Math.min(fromF, toF), hi = Math.max(fromF, toF);
    for (let f = lo; f <= hi; f++) {
      const ri = frameMap[f]; if (ri == null) continue;
      const v = parseFloat(rows[ri][ci]);
      if (!isNaN(v) && (min == null || v < min)) min = v;
    }
    return min;
  };
  // ★ raw 시계열 max|값| (절댓값 기준) — 부호 변동 회전속도 등에 사용 (2026-05-03)
  const colMaxAbsBetween = (col, fromF, toF) => {
    const ci = idx[col]; if (ci == null || fromF == null || toF == null) return null;
    let max = null;
    const lo = Math.min(fromF, toF), hi = Math.max(fromF, toF);
    for (let f = lo; f <= hi; f++) {
      const ri = frameMap[f]; if (ri == null) continue;
      const v = parseFloat(rows[ri][ci]);
      if (!isNaN(v)) {
        const abs = Math.abs(v);
        if (max == null || abs > max) max = abs;
      }
    }
    return max;
  };
  // ★ 두 컬럼 차이 시계열의 max|값| — X-factor 등에 사용
  const colDiffMaxAbsBetween = (colA, colB, fromF, toF) => {
    const cA = idx[colA], cB = idx[colB];
    if (cA == null || cB == null || fromF == null || toF == null) return null;
    let max = null;
    const lo = Math.min(fromF, toF), hi = Math.max(fromF, toF);
    for (let f = lo; f <= hi; f++) {
      const ri = frameMap[f]; if (ri == null) continue;
      const a = parseFloat(rows[ri][cA]), b = parseFloat(rows[ri][cB]);
      if (!isNaN(a) && !isNaN(b)) {
        const d = Math.abs(a - b);
        if (max == null || d > max) max = d;
      }
    }
    return max;
  };
  // ★ 두 컬럼 차이 시계열의 signed max (A - B의 최댓값) — X-factor 부호 일관성 (2026-05-03)
  //   X-factor는 FC 전후로 부호가 뒤집힘. abs max는 잘못된 peak를 잡을 수 있음
  const colDiffSignedMaxBetween = (colA, colB, fromF, toF) => {
    const cA = idx[colA], cB = idx[colB];
    if (cA == null || cB == null || fromF == null || toF == null) return null;
    let max = null;
    const lo = Math.min(fromF, toF), hi = Math.max(fromF, toF);
    for (let f = lo; f <= hi; f++) {
      const ri = frameMap[f]; if (ri == null) continue;
      const a = parseFloat(rows[ri][cA]), b = parseFloat(rows[ri][cB]);
      if (!isNaN(a) && !isNaN(b)) {
        const d = a - b;
        if (max == null || d > max) max = d;
      }
    }
    return max;
  };
  // ★ 1차 미분(중앙차분) max|값|
  const colDerivMaxAbsBetween = (col, fromF, toF) => {
    const ci = idx[col]; if (ci == null || fromF == null || toF == null) return null;
    const lo = Math.min(fromF, toF), hi = Math.max(fromF, toF);
    let max = null, prev = null, prevF = null;
    const dt = 1 / fps;
    for (let f = lo; f <= hi; f++) {
      const ri = frameMap[f]; if (ri == null) continue;
      const v = parseFloat(rows[ri][ci]);
      if (isNaN(v)) { prev = null; continue; }
      if (prev != null && prevF != null && f > prevF) {
        const vel = Math.abs(v - prev) / ((f - prevF) * dt);
        if (max == null || vel > max) max = vel;
      }
      prev = v; prevF = f;
    }
    return max;
  };
  const safe = (v) => (v == null || isNaN(v)) ? null : v;

  // ━━━ 메카닉(C) per-trial scalar ━━━
  // ★ 모든 변수는 raw 시계열에서 직접 산출 (2026-05-03 — Uplift 사전계산값 의존 제거)
  const out = {
    meta: { athleteName, captureDate, fps, handedness, armSide, kinSeq, sessionFolder },  // ★ v33.8 sessionFolder (Lab_ID 매칭용)
    events,
    _eventMeta,
  };

  // 윈도우 정의 — 시계열 산출에 공통 사용
  const _winFrom = (events.kh != null) ? events.kh : (events.fc != null ? events.fc - 100 : null);
  const _winTo   = (events.br != null) ? events.br + 30 : null;

  // ── peak_pelvis_av ★raw — 골반 회전속도 max|값| in [KH or FC-100, BR+30] ──
  if (_winFrom != null && _winTo != null) {
    out.peak_pelvis_av = colMaxAbsBetween('pelvis_rotational_velocity_with_respect_to_ground', _winFrom, _winTo);
    out.peak_trunk_av  = colMaxAbsBetween('trunk_rotational_velocity_with_respect_to_ground',  _winFrom, _winTo);
    // ★ v31.12 throwing arm 자동 검출 — 양 팔 비교 후 큰 쪽 사용
    const _armL_av = colMaxAbsBetween('left_arm_rotational_velocity_with_respect_to_ground',  _winFrom, _winTo) || 0;
    const _armR_av = colMaxAbsBetween('right_arm_rotational_velocity_with_respect_to_ground', _winFrom, _winTo) || 0;
    out.peak_arm_av = Math.max(_armL_av, _armR_av);
    // ★ arm_trunk_speedup (2026-05-03) — 몸통→팔 에너지 전달 효율
    //   ratio = peak_arm_av / peak_trunk_av. elite 1.8~2.2 (정예준 1.97 → 매우 효율적)
    if (out.peak_trunk_av != null && out.peak_trunk_av > 0 && out.peak_arm_av != null) {
      out.arm_trunk_speedup = out.peak_arm_av / out.peak_trunk_av;
    }
    // pelvis_trunk_speedup도 함께 (참고용, 카테고리 미사용)
    if (out.peak_pelvis_av != null && out.peak_pelvis_av > 0 && out.peak_trunk_av != null) {
      out.pelvis_trunk_speedup = out.peak_trunk_av / out.peak_pelvis_av;
    }
  }

  // ── max_x_factor ★raw — signed max in [KH, FC+5] (2026-05-03 보정) ──
  //   X-factor는 stretch 단계(KH→FC)에 peak. FC 후 trunk가 catch up 하며 부호 뒤집힘.
  //   기존 abs max는 FC 후 반대 부호 peak를 잡을 위험 → [KH, FC+5] 윈도우 + signed max로 보정
  //   signed: 양수 = loading peak, 점수에는 절댓값 사용
  //   ★ v30.14: 좌투는 회전 방향 반대 → (pelvis-trunk) 대신 (trunk-pelvis) max 산출
  if (events.kh != null && events.fc != null) {
    const xf = (armSide === 'left')
      ? colDiffSignedMaxBetween('trunk_global_rotation', 'pelvis_global_rotation', events.kh, events.fc + 5)
      : colDiffSignedMaxBetween('pelvis_global_rotation', 'trunk_global_rotation', events.kh, events.fc + 5);
    if (xf != null) out.max_x_factor = xf;
  }
  // 시퀀스 lag
  if (events.peakPelvis != null && events.peakTrunk != null)
    out.pelvis_to_trunk_lag_ms = (events.peakTrunk - events.peakPelvis) / fps * 1000;
  if (events.peakTrunk != null && events.peakArm != null)
    out.trunk_to_arm_lag_ms = (events.peakArm - events.peakTrunk) / fps * 1000;

  // ════════════════════════════════════════════════════════════════════
  // ★ v30.22 키네틱 체인 6단계 신규 변인 (Step A) — raw 시계열 직접 산출
  //   단계 1 하체 드라이브 + 단계 2 앞다리 블로킹 보강
  // ════════════════════════════════════════════════════════════════════

  // ── stride_time_ms ★ — KH→FC 시간 (단계 1 하체 드라이브 길이) ──
  if (events.kh != null && events.fc != null) {
    out.stride_time_ms = (events.fc - events.kh) / fps * 1000;
  }

  // ── drive_hip_ext_vel_max ★ — 드라이브 다리 hip 신전속도 max [KH, FC] (단계 1) ──
  //   drive leg = 우투 right, 좌투 left
  //   hip_flexion_velocity_with_respect_to_trunk의 음수 max = 신전속도
  if (events.kh != null && events.fc != null) {
    const driveSidePrefix = (armSide === 'left' ? 'left' : 'right');
    const driveHipFlexVelCol = driveSidePrefix + '_hip_flexion_velocity_with_respect_to_trunk';
    const minVal = colMinBetween(driveHipFlexVelCol, events.kh, events.fc);
    if (minVal != null && minVal < 0) out.drive_hip_ext_vel_max = -minVal;
  }

  // ── lead_hip_flex_at_fc ★ — 앞다리 hip 굴곡 at FC (단계 2 앞다리 블로킹 자세) ──
  //   lead leg = 우투 left, 좌투 right
  if (events.fc != null) {
    const leadSidePrefix = (armSide === 'left' ? 'right' : 'left');
    out.lead_hip_flex_at_fc = valAt(events.fc, leadSidePrefix + '_hip_flexion_with_respect_to_trunk');
  }

  // ── lead_hip_ext_vel_max ★ — 앞다리 hip 신전속도 max [FC, BR] (단계 2 블로킹 후 신전) ──
  if (events.fc != null && events.br != null) {
    const leadSidePrefix = (armSide === 'left' ? 'right' : 'left');
    const leadHipFlexVelCol = leadSidePrefix + '_hip_flexion_velocity_with_respect_to_trunk';
    const minVal = colMinBetween(leadHipFlexVelCol, events.fc, events.br);
    if (minVal != null && minVal < 0) out.lead_hip_ext_vel_max = -minVal;
  }
  // proper_sequence_binary (2026-05-03 수정) — peak frame 시간 순서 직접 비교가 1차 기준
  //   기존: kinematic_sequence_order 문자열 substring match에만 의존
  //   문제: 컬럼 비거나 형식 다르면(언더스코어/화살표) 무조건 0으로 처리
  //   개선: peak Pelvis < peak Trunk < peak Arm 이면 1, 아니면 0. 셋 다 있으면 문자열 무시
  if (events.peakPelvis != null && events.peakTrunk != null && events.peakArm != null) {
    out.proper_sequence_binary =
      (events.peakPelvis < events.peakTrunk && events.peakTrunk < events.peakArm) ? 1 : 0;
  } else if (kinSeq) {
    // peak frame 셋 중 하나라도 없으면 문자열 fallback (정규화 후 substring match)
    const norm = kinSeq.toLowerCase().replace(/[\s_\u2192>\-]+/g, '-');  // 공백/언더스코어/화살표/대시 통일
    out.proper_sequence_binary = norm.includes('pelvis-trunk-arm') ? 1 : 0;
  }
  // proper_sequence_binary가 끝까지 미정의면 collect()에서 자동 제외됨

  // FC at-event
  if (events.fc != null) {
    let trunkRot  = valAt(events.fc, 'trunk_global_rotation');
    let pelvisRot = valAt(events.fc, 'pelvis_global_rotation');
    // ★ v30.14 좌투 좌표계 보정 (2026-05-03 — 좌완 8명 157 trial 검증)
    //   좌완은 lab fixed-axis 기준 별도 좌표 영역(우완 -67°, 좌완 +174° / 240° 차이)
    //   1) circular normalize로 wrap-around 처리
    //   2) 좌완 → 우완 등가로 매핑 → 단일 target(-67°) 적용 가능
    if (armSide === 'left') {
      trunkRot  = normalizeAngle(trunkRot,  LEFT_TRUNK_REF);
      pelvisRot = normalizeAngle(pelvisRot, LEFT_PELVIS_REF);
      if (trunkRot  != null) trunkRot  = trunkRot  - LEFT_TO_RIGHT_TRUNK_OFFSET;
      if (pelvisRot != null) pelvisRot = pelvisRot - LEFT_TO_RIGHT_PELVIS_OFFSET;
    }
    out.trunk_rotation_at_fc      = trunkRot;
    // hip_shoulder_sep@FC: signed (pelvis - trunk), 양수 = pelvis 먼저 열림(좋음)
    out.hip_shoulder_sep_at_fc    = (trunkRot != null && pelvisRot != null) ? (pelvisRot - trunkRot) : null;
    // BBL 컨벤션: 음수 = 뒤로 기울임(이상), 0 = 똑바로, 양수 = 앞으로 기울임
    // Uplift trunk_global_flexion: 180° = upright, >180° = back tilt, <180° = forward tilt
    // 변환: BBL = 180 - |Uplift_wrap|  (예: Uplift 183 → BBL -3°, 거의 똑바로)
    // ★ v30.14: 좌투는 trunk_global_flexion 부호 반대(-173° vs +173°) → abs 변환
    // ★ v33.10: 우투수에서도 [-180,180] 범위 벗어나는 trial 발생(예: -197° → BBL 산출 377°).
    //   Theia 비교에서 mean 81° outlier 발견. wrap-around to [-180,180] 후 |flex| 적용해
    //   좌·우투 동일 처리 → 모든 케이스 정상 산출 (Theia 비교 mean diff 86°→3°로 개선 검증됨).
    let upFlexFc = valAt(events.fc, 'trunk_global_flexion');
    if (upFlexFc != null) {
      // wrap to [-180, 180]
      upFlexFc = ((upFlexFc + 180) % 360 + 360) % 360 - 180;
      out.trunk_forward_tilt_at_fc = 180 - Math.abs(upFlexFc);
    } else {
      out.trunk_forward_tilt_at_fc = null;
    }
    const sideHadd = armSide === 'left' ? 'left_shoulder_horizontal_adduction' : 'right_shoulder_horizontal_adduction';
    const habdRaw  = valAt(events.fc, sideHadd);
    out.shoulder_h_abd_at_fc      = habdRaw != null ? -habdRaw : null;  // 부호 반전
  }
  // Window max [FC, BR]  — lead knee
  if (events.fc != null && events.br != null) {
    const leadCol = armSide === 'left' ? 'right_knee_extension_velocity' : 'left_knee_extension_velocity';
    out.lead_knee_ext_vel_max = colMaxBetween(leadCol, events.fc, events.br);

    // lead_knee_ext_change_fc_to_br — 신전량 (FC→BR 차이, 절대값)  ★Phase2
    const leadKneeCol = armSide === 'left' ? 'right_knee_extension' : 'left_knee_extension';
    const kneeFc = valAt(events.fc, leadKneeCol);
    const kneeBr = valAt(events.br, leadKneeCol);
    if (kneeFc != null && kneeBr != null) out.lead_knee_ext_change_fc_to_br = kneeBr - kneeFc;
  }

  // ── trunk_flex_vel_max ★ — trunk_global_flexion 시계열 1차 미분 max ──
  // (cohort 있는 변수인데 그동안 미추출 — 이번 추가)
  if (events.fc != null && events.br != null) {
    const tflexCol = idx['trunk_global_flexion'];
    const dt = 1 / fps;
    let maxAbsVel = null;
    const lo = Math.max(0, events.fc - 30);
    const hi = events.br + 30;
    if (tflexCol != null) {
      let prev = null, prevFrame = null;
      for (let f = lo; f <= hi; f++) {
        const ri = frameMap[f];
        if (ri == null) continue;
        const v = parseFloat(rows[ri][tflexCol]);
        if (isNaN(v)) { prev = null; continue; }
        if (prev != null && prevFrame != null) {
          const vel = Math.abs(v - prev) / ((f - prevFrame) * dt);
          if (maxAbsVel == null || vel > maxAbsVel) maxAbsVel = vel;
        }
        prev = v; prevFrame = f;
      }
    }
    out.trunk_flex_vel_max = maxAbsVel;
  }

  // ── max_cog_velo ★raw — trunk COM 3D 합성 속도 max [KH-20, BR+5] ──
  //   샘플 검증: trunk_COM 3D 합성 = 3.291 m/s ≈ Uplift max_trunk_com_velocity 3.283 m/s (일치)
  //   whole_body_COM x 단축 미분(0.58)은 잘못된 방식. trunk COM 3D vector magnitude가 정답
  if (events.fc != null && events.br != null) {
    const lo = Math.max(0, (events.kh != null ? events.kh : events.fc) - 20);
    const hi = events.br + 5;
    const cx = idx['trunk_center_of_mass_x'], cy = idx['trunk_center_of_mass_y'], cz = idx['trunk_center_of_mass_z'];
    if (cx != null && cy != null && cz != null) {
      const dt = 1 / fps;
      let max = null, prev = null, prevF = null;
      for (let f = lo; f <= hi; f++) {
        const ri = frameMap[f]; if (ri == null) continue;
        const x = parseFloat(rows[ri][cx]), y = parseFloat(rows[ri][cy]), z = parseFloat(rows[ri][cz]);
        if (isNaN(x) || isNaN(y) || isNaN(z)) { prev = null; continue; }
        if (prev != null && prevF != null && f > prevF) {
          const dx = x - prev[0], dy = y - prev[1], dz = z - prev[2];
          const vel = Math.sqrt(dx*dx + dy*dy + dz*dz) / ((f - prevF) * dt);
          if (max == null || vel > max) max = vel;
        }
        prev = [x, y, z]; prevF = f;
      }
      if (max != null) out.max_cog_velo = max;
    }
  }

  // ── hip_ir_vel_max_drive ★ — drive 다리 (handedness 반영) hip IR velocity max [KH, FC] ──
  if (events.kh != null && events.fc != null) {
    const driveSide = armSide === 'left' ? 'left' : 'right';  // 우투면 drive=right
    const hipIrCol = driveSide + '_hip_internal_rotation_velocity_with_respect_to_pelvis';
    const v = colMaxBetween(hipIrCol, events.kh, events.fc);
    if (v != null) out.hip_ir_vel_max_drive = v;
  }

  // ── com_decel_pct ★ — COM 전진 속도 감속률 [FC → BR] ──
  // (peak_velo - end_velo) / peak_velo × 100
  // 큰 값 = 효과적 블로킹 (운동량을 회전으로 전환)
  if (events.fc != null && events.br != null && idx['whole_body_center_of_mass_x'] != null) {
    const comCol = idx['whole_body_center_of_mass_x'];
    const dt = 1 / fps;
    // [KH-20, BR+5]에서 COM 위치 시계열 → 속도 시계열
    const lo = Math.max(0, (events.kh != null ? events.kh : events.fc) - 20);
    const hi = events.br + 5;
    const xSeries = [], frameList = [];
    for (let f = lo; f <= hi; f++) {
      const ri = frameMap[f];
      if (ri == null) continue;
      const x = parseFloat(rows[ri][comCol]);
      if (!isNaN(x)) { xSeries.push(x); frameList.push(f); }
    }
    if (xSeries.length >= 5) {
      const velos = []; const veloFrames = [];
      for (let i = 1; i < xSeries.length; i++) {
        const dx = xSeries[i] - xSeries[i-1];
        const df = frameList[i] - frameList[i-1];
        if (df > 0) {
          velos.push(Math.abs(dx) / (df * dt));
          veloFrames.push(frameList[i]);
        }
      }
      // peak velo: [FC-10, BR] 안 max
      let peakV = 0, peakIdx = -1;
      for (let i = 0; i < velos.length; i++) {
        if (veloFrames[i] >= events.fc - 10 && veloFrames[i] <= events.br && velos[i] > peakV) {
          peakV = velos[i]; peakIdx = i;
        }
      }
      // end velo: BR 시점 (또는 가장 가까운 프레임)
      let endV = null;
      for (let i = velos.length - 1; i >= 0; i--) {
        if (veloFrames[i] <= events.br) { endV = velos[i]; break; }
      }
      if (peakV > 0 && endV != null) {
        const decelPct = ((peakV - endV) / peakV) * 100;
        if (decelPct >= 0 && decelPct <= 100) out.com_decel_pct = decelPct;
      }
    }
  }

  // ── lead_knee_amortization_ms ★ — 앞다리 무릎 (min → max 신전) 시간 ──
  // 짧을수록 SSC 효율 ↑
  if (events.fc != null && events.br != null) {
    const kneeCol = armSide === 'left' ? 'right_knee_extension' : 'left_knee_extension';
    const ci = idx[kneeCol];
    if (ci != null) {
      const lo = Math.max(0, events.fc - 5);
      const hi = events.br + 30;
      let minVal = null, minFrame = null;
      let maxValAfterMin = null, maxFrameAfterMin = null;
      // 1) [FC-5, BR] 사이 min (max flexion = 가장 굽은 시점)
      for (let f = lo; f <= events.br; f++) {
        const ri = frameMap[f];
        if (ri == null) continue;
        const v = parseFloat(rows[ri][ci]);
        if (isNaN(v)) continue;
        if (minVal == null || v < minVal) { minVal = v; minFrame = f; }
      }
      // 2) min 이후 max (full extension)
      if (minFrame != null) {
        for (let f = minFrame + 1; f <= hi; f++) {
          const ri = frameMap[f];
          if (ri == null) continue;
          const v = parseFloat(rows[ri][ci]);
          if (isNaN(v)) continue;
          if (maxValAfterMin == null || v > maxValAfterMin) { maxValAfterMin = v; maxFrameAfterMin = f; }
        }
      }
      if (minFrame != null && maxFrameAfterMin != null && maxFrameAfterMin > minFrame) {
        out.lead_knee_amortization_ms = (maxFrameAfterMin - minFrame) / fps * 1000;
      }
    }
  }

  // ── trunk_forward_tilt_at_br_trial ★raw — BR 시점 trunk_global_flexion 직접 (180 변환 X — sd만 보면 됨) ──
  //   기존: Uplift trunk_forward_tilt_at_ball_release 우선 + valAt fallback
  //   변경: raw valAt 단독. trunk_forward_tilt_at_fc는 BBL 컨벤션 변환(180-) 적용했지만
  //         여기서는 trial 간 SD 산출용이라 절대값 변환 무관. 일관되게 raw flexion.
  if (events.br != null) {
    let upFlexBr = valAt(events.br, 'trunk_global_flexion');
    // ★ v30.14: 좌투는 부호 반대 → abs 후 SD 산출 (trial 간 일관성 확보)
    if (upFlexBr != null && armSide === 'left') upFlexBr = Math.abs(upFlexBr);
    out.trunk_forward_tilt_at_br_trial = upFlexBr;
  }

  // ════════════════════════════════════════════════════════════════════
  // Driveline 5각형 추가 변수 (PPTX 9페이지 상대적 중요도 적용 대상)
  // ════════════════════════════════════════════════════════════════════

  // ── elbow_ext_vel_max ★ — 팔꿈치 신전 속도 max [FC, BR] (Arm Action 0.56) ──
  if (events.fc != null && events.br != null) {
    const elbowVelCol = armSide === 'left' ? 'left_elbow_flexion_velocity' : 'right_elbow_flexion_velocity';
    const ci = idx[elbowVelCol];
    if (ci != null) {
      let maxAbs = null;
      for (let f = events.fc; f <= events.br + 5; f++) {
        const ri = frameMap[f]; if (ri == null) continue;
        const v = parseFloat(rows[ri][ci]); if (isNaN(v)) continue;
        const abs = Math.abs(v);
        if (maxAbs == null || abs > maxAbs) maxAbs = abs;
      }
      out.elbow_ext_vel_max = maxAbs;
    }
  }

  // ── shoulder_ir_vel_max ★ — 어깨 회전 속도 [MER-30, BR+30] 95-percentile (Arm Action 0.36) ──
  // ★ v33.10 (Theia 비교 결과): raw abs max는 noise spike 취약 (1 trial 38719°/s 같은 비현실값 발견).
  //   Theia의 c3d 처리는 Butterworth low-pass 후 산출 → BBL은 95-percentile로 robust 산출.
  //   효과: noise spike 제거. elite humerus IR velocity 정상 범위(4000~7000°/s)에 부합.
  if (events.mer != null && events.br != null) {
    const irVelCol = armSide === 'left' ? 'left_shoulder_external_rotation_velocity' : 'right_shoulder_external_rotation_velocity';
    const ci = idx[irVelCol];
    if (ci != null) {
      const absVals = [];
      const lo = Math.max(0, events.mer - 30);
      const hi = events.br + 30;
      for (let f = lo; f <= hi; f++) {
        const ri = frameMap[f]; if (ri == null) continue;
        const v = parseFloat(rows[ri][ci]); if (isNaN(v)) continue;
        absVals.push(Math.abs(v));
      }
      if (absVals.length > 0) {
        absVals.sort((a, b) => a - b);
        const idx95 = Math.min(absVals.length - 1, Math.floor(absVals.length * 0.95));
        out.shoulder_ir_vel_max = absVals[idx95];
      }
    }
  }

  // ── arm_to_forearm_speedup ★ v32.9 — 상완→전완 에너지 전달 효율 ──
  //   ratio = elbow_ext_vel_max / shoulder_ir_vel_max
  //   elite 0.50~0.65 (전완이 상완의 절반 정도). > 0.70 전완 의존(부상 위험), < 0.40 출력 손실
  //   Phase 2: 코호트 분포 산출 후 percentile 전환 검토
  if (out.elbow_ext_vel_max != null && out.shoulder_ir_vel_max != null && out.shoulder_ir_vel_max > 0) {
    out.arm_to_forearm_speedup = out.elbow_ext_vel_max / out.shoulder_ir_vel_max;
  }

  // ── peak_torso_counter_rot ★ — 와인드업 시 trunk가 뒤로 회전한 max (Posture 0.38) ──
  // [KH-50, FC] 사이 trunk_global_rotation의 (max - min) — counter rotation 진폭
  if (events.kh != null && events.fc != null) {
    const tCol = idx['trunk_global_rotation'];
    if (tCol != null) {
      let minV = null, maxV = null;
      for (let f = Math.max(0, events.kh - 50); f <= events.fc; f++) {
        const ri = frameMap[f]; if (ri == null) continue;
        const v = parseFloat(rows[ri][tCol]); if (isNaN(v)) continue;
        if (minV == null || v < minV) minV = v;
        if (maxV == null || v > maxV) maxV = v;
      }
      if (minV != null && maxV != null) out.peak_torso_counter_rot = Math.abs(maxV - minV);
    }
  }

  // ── torso_side_bend_at_mer ★ — MER 시점 측면 기울기 (Posture 0.26) ──
  if (events.mer != null) {
    const v = valAt(events.mer, 'trunk_lateral_flexion_right');
    if (v != null) out.torso_side_bend_at_mer = Math.abs(v);
  }

  // ── torso_rotation_at_br ★ — BR 시점 몸통 회전 절대값 (Posture 0.25) ──
  if (events.br != null) {
    const v = valAt(events.br, 'trunk_global_rotation');
    if (v != null) out.torso_rotation_at_br = Math.abs(v);
  }

  // ── elbow_flexion_at_fp 제거 (v31.25, 사용자 요청) ──
  //   사유: FC 시점 팔꿈치 굴곡은 결과적 자세 지표로 구속 향상 코칭에 직접 활용도 낮음

  // ── MER (max external rotation) — 견고한 추출 ──
  //   1) Uplift가 검출한 MER 프레임 시점 값
  //   2) 확장 윈도우 [KH-10 ~ BR+30] 의 max
  //   3) max_layback_angle 컬럼 (단, BBL 코호트와 컨벤션 다를 수 있어 fallback만)
  //   세 후보 중 가장 큰 값 사용 (MER은 항상 양의 큰 값이어야 정상)
  const erCol = armSide === 'left' ? 'left_shoulder_external_rotation' : 'right_shoulder_external_rotation';
  const erCandidates = [];
  if (events.mer != null) {
    const v = valAt(events.mer, erCol);
    if (v != null) erCandidates.push(v);
  }
  // 확장 윈도우 — KH(없으면 FC-100)부터 BR+30까지
  const winFrom = events.kh != null ? (events.kh - 10) : (events.fc != null ? events.fc - 100 : null);
  const winTo   = events.br != null ? (events.br + 30) : null;
  if (winFrom != null && winTo != null) {
    const v = colMaxBetween(erCol, winFrom, winTo);
    if (v != null) erCandidates.push(v);
  }
  if (erCandidates.length > 0) {
    out.max_shoulder_ER = Math.max(...erCandidates);
  }

  // ━━━ 제구(P) per-trial scalar — raw 시계열 직산출 (좌표계 검증 후 보정 2026-05-03) ━━━
  //   좌표계: y = vertical (up), z = forward (pitching direction), x = lateral
  //   capture origin은 던지기 박스 중심 (지면이 아니라서 별도 보정 필요)

  // ── arm_slot_angle_trial ★raw — BR 시점 어깨→손목 벡터의 elevation angle (y가 vertical) ──
  //   0° = sidearm, 90° = overhead, 음수 = sub-arm (드물지만 가능)
  if (events.br != null) {
    const sP = (armSide === 'left' ? 'left' : 'right') + '_shoulder_jc_3d';
    const wP = (armSide === 'left' ? 'left' : 'right') + '_wrist_jc_3d';
    const sx = valAt(events.br, sP+'_x'), sy = valAt(events.br, sP+'_y'), sz = valAt(events.br, sP+'_z');
    const wx = valAt(events.br, wP+'_x'), wy = valAt(events.br, wP+'_y'), wz = valAt(events.br, wP+'_z');
    if (sx!=null && sy!=null && sz!=null && wx!=null && wy!=null && wz!=null) {
      const vDiff = wy - sy;  // y가 vertical
      const hDiff = Math.sqrt((wx-sx)*(wx-sx) + (wz-sz)*(wz-sz));  // x,z 평면이 horizontal
      out.arm_slot_angle_trial = Math.atan2(vDiff, hDiff) * 180 / Math.PI;
    }
  }

  // ── release_height_trial ★raw — 지면 기준 손목 높이 (m) ──
  //   wrist_y - 평균 발목_y(FC 시점). FC 시점 발목 y가 0(지면) 가정에 해당
  if (events.br != null && events.fc != null) {
    const wP = (armSide === 'left' ? 'left' : 'right') + '_wrist_jc_3d';
    const wy = valAt(events.br, wP+'_y');
    const lay = valAt(events.fc, 'left_ankle_jc_3d_y');
    const ray = valAt(events.fc, 'right_ankle_jc_3d_y');
    if (wy != null && lay != null && ray != null) {
      out.release_height_trial = wy - (lay + ray) / 2;
    } else if (wy != null && (lay != null || ray != null)) {
      out.release_height_trial = wy - (lay != null ? lay : ray);
    }
  }

  // ── stride_length_trial ★raw — front foot가 KH→FC까지 이동한 3D 거리 (m) ──
  //   Driveline 정의: 앞다리(front)가 max knee raise 시점부터 foot contact까지 이동한 거리
  //   샘플 검증: def3=0.966m vs Uplift 1.032m (차이 6.4%, 정의 일치)
  if (events.kh != null && events.fc != null) {
    const frontPrefix = (armSide === 'left' ? 'right' : 'left') + '_ankle_jc_3d';
    const fxKH = valAt(events.kh, frontPrefix+'_x'), fyKH = valAt(events.kh, frontPrefix+'_y'), fzKH = valAt(events.kh, frontPrefix+'_z');
    const fxFC = valAt(events.fc, frontPrefix+'_x'), fyFC = valAt(events.fc, frontPrefix+'_y'), fzFC = valAt(events.fc, frontPrefix+'_z');
    if (fxKH!=null && fyKH!=null && fzKH!=null && fxFC!=null && fyFC!=null && fzFC!=null) {
      out.stride_length_trial = Math.sqrt(
        (fxFC-fxKH)*(fxFC-fxKH) + (fyFC-fyKH)*(fyFC-fyKH) + (fzFC-fzKH)*(fzFC-fzKH)
      );
    }
  }

  if (events.mer != null && events.br != null)
    out.mer_to_br_time_trial = (events.br - events.mer) / fps * 1000;

  // ── trunk_tilt_at_br_trial ★raw — BR 시점 trunk_lateral_flexion_right 시계열 직접 ──
  if (events.br != null) {
    out.trunk_tilt_at_br_trial = valAt(events.br, 'trunk_lateral_flexion_right');
  }
  // wrist 3D 위치 @ BR (handedness 반영)
  if (events.br != null) {
    const wPrefix = (armSide === 'left' ? 'left' : 'right') + '_wrist_jc_3d';
    out.wrist_x_at_br = valAt(events.br, wPrefix + '_x');
    out.wrist_y_at_br = valAt(events.br, wPrefix + '_y');
    out.wrist_z_at_br = valAt(events.br, wPrefix + '_z');
  }

  // ════════════════════════════════════════════════════════════════════
  // ★ Phase 3 (v33.6, 2026-05-05) — Output(출력) vs Transfer(전달) 7변수
  //   Python (extract_uplift_scalars.py) 1:1 포팅. 변경 시 두 곳 동시.
  //   throwingArm = _throwingArmDetected (자동검출 결과)
  // ════════════════════════════════════════════════════════════════════
  const throwingArm = _throwingArmDetected;

  // BR ± 2 frame 중앙차분 3D speed 헬퍼 (median for stability)
  const _3d_speed_at_br = (jc3dPrefix) => {
    if (events.br == null) return null;
    const cx = idx[jc3dPrefix + '_x'], cy = idx[jc3dPrefix + '_y'], cz = idx[jc3dPrefix + '_z'];
    if (cx == null || cy == null || cz == null) return null;
    const dt = 1.0 / fps;
    const speeds = [];
    for (const offset of [-2, -1, 0, 1, 2]) {
      const f1 = events.br + offset - 1;
      const f2 = events.br + offset + 1;
      const ri1 = frameMap[f1], ri2 = frameMap[f2];
      if (ri1 == null || ri2 == null) continue;
      const x1 = parseFloat(rows[ri1][cx]), y1 = parseFloat(rows[ri1][cy]), z1 = parseFloat(rows[ri1][cz]);
      const x2 = parseFloat(rows[ri2][cx]), y2 = parseFloat(rows[ri2][cy]), z2 = parseFloat(rows[ri2][cz]);
      if (isNaN(x1)||isNaN(y1)||isNaN(z1)||isNaN(x2)||isNaN(y2)||isNaN(z2)) continue;
      const dx = x2-x1, dy = y2-y1, dz = z2-z1;
      speeds.push(Math.sqrt(dx*dx + dy*dy + dz*dz) / (2*dt));
    }
    if (speeds.length === 0) return null;
    speeds.sort((a,b)=>a-b);
    return speeds[Math.floor(speeds.length/2)];  // median
  };

  // forearm_length (elbow_jc → wrist_jc 3D distance at BR) — 공통 사용
  let forearm_length = null;
  if (events.br != null) {
    const ePre = throwingArm + '_elbow_jc_3d';
    const wPre = throwingArm + '_wrist_jc_3d';
    const ex = valAt(events.br, ePre+'_x'), ey = valAt(events.br, ePre+'_y'), ez = valAt(events.br, ePre+'_z');
    const wx = valAt(events.br, wPre+'_x'), wy = valAt(events.br, wPre+'_y'), wz = valAt(events.br, wPre+'_z');
    if (ex!=null && ey!=null && ez!=null && wx!=null && wy!=null && wz!=null) {
      forearm_length = Math.sqrt((wx-ex)**2 + (wy-ey)**2 + (wz-ez)**2);
      out.forearm_length_m = forearm_length;
    }
  }

  // ── 1) wrist_release_speed (m/s) ★ 출력 통합 결과 (ball release proxy) ──
  const _wrist_speed = _3d_speed_at_br(throwingArm + '_wrist_jc_3d');
  if (_wrist_speed != null) out.wrist_release_speed = _wrist_speed;

  // ── 2) elbow_to_wrist_speedup (ratio) ★ 전달 — 마지막 whip 효율 ──
  if (out.wrist_release_speed != null) {
    const elbow_speed = _3d_speed_at_br(throwingArm + '_elbow_jc_3d');
    if (elbow_speed != null && elbow_speed > 0.1) {
      out.elbow_to_wrist_speedup = out.wrist_release_speed / elbow_speed;
    }
  }

  // ── 3) angular_chain_amplification (ratio) ★ 전달 — 골반→팔 증폭률 ──
  if (out.peak_arm_av != null && out.peak_pelvis_av != null && out.peak_pelvis_av > 0) {
    out.angular_chain_amplification = out.peak_arm_av / out.peak_pelvis_av;
  }

  // ── 4) elbow_valgus_torque_proxy (Nm proxy) ★ 부상 — UCL stress proxy ──
  //   T proxy = 0.5 × m_forearm × L² × ω². m_forearm = 1.6 kg (HS 인구평균)
  if (out.shoulder_ir_vel_max != null && forearm_length != null && forearm_length > 0) {
    const omega_rad = out.shoulder_ir_vel_max * Math.PI / 180.0;
    const m_forearm = 1.6;
    out.elbow_valgus_torque_proxy = 0.5 * m_forearm * forearm_length * forearm_length * (omega_rad * omega_rad);
  }

  // ── 5) stride_to_pelvis_lag_ms ★ 전달 — FC → peakPelvis 시간차 ──
  if (events.fc != null && events.peakPelvis != null) {
    out.stride_to_pelvis_lag_ms = (events.peakPelvis - events.fc) / fps * 1000;
  }

  // ── 6) x_factor_to_peak_pelvis_lag_ms ★ 전달 — X-factor max → peakPelvis ──
  if (events.kh != null && events.fc != null && events.peakPelvis != null) {
    const colA = (armSide === 'left') ? 'trunk_global_rotation' : 'pelvis_global_rotation';
    const colB = (armSide === 'left') ? 'pelvis_global_rotation' : 'trunk_global_rotation';
    const cA = idx[colA], cB = idx[colB];
    if (cA != null && cB != null) {
      let bestXf = null, bestFrame = null;
      for (let f = events.kh; f <= events.fc + 5; f++) {
        const ri = frameMap[f]; if (ri == null) continue;
        const a = parseFloat(rows[ri][cA]), b = parseFloat(rows[ri][cB]);
        if (isNaN(a) || isNaN(b)) continue;
        const xf = a - b;
        if (bestXf == null || xf > bestXf) { bestXf = xf; bestFrame = f; }
      }
      if (bestFrame != null) {
        out.x_factor_to_peak_pelvis_lag_ms = (events.peakPelvis - bestFrame) / fps * 1000;
      }
    }
  }

  // ── 7) knee_varus_max_drive (deg) ★ 부상 — drive 다리 무릎 외반 max ──
  if (events.kh != null && events.fc != null) {
    const driveSide = (armSide === 'left') ? 'left' : 'right';
    const v = colMaxAbsBetween(driveSide + '_knee_varus', events.kh, events.fc);
    if (v != null) out.knee_varus_max_drive = v;
  }

  return out;
}

// ── 다중 trial 집계 → BBL 변수 ──
function applyMultiTrialUplift(scalarsList) {
  const mean = arr => arr.length ? arr.reduce((a,b) => a+b, 0) / arr.length : null;
  const stdev = arr => {
    if (arr.length < 2) return null;
    const m = mean(arr);
    const v = arr.reduce((a, x) => a + (x - m) ** 2, 0) / (arr.length - 1);
    return Math.sqrt(v);
  };

  // ════════════════════════════════════════════════════════════════════
  // ★ QC 필터 (v30.18.2 정책 재정립) — Uplift 유효성 기반 (raw mismatch는 경고만)
  //   기존: raw vs Uplift 차이 >30ms (또는 300ms) → trial 제외
  //   문제: raw 검출 알고리즘이 일부 케이스에서 ~1000ms 일찍 잡는 버그 → 모든 trial 제외 발생
  //   해결: trial 제외는 Uplift 자체 biomechanical 유효성(KH<FC<BR)으로만 판단
  //         raw vs Uplift 차이는 정보 표시만 (사용에 영향 없음)
  // ════════════════════════════════════════════════════════════════════
  const QC_THRESHOLD_MS = 300;        // 경고용 임계값 (제외 X)
  const _qcExcluded = [];              // 정보 표시용 (실제 제외 사유 별도)
  const _qcInvalidOrder = [];          // Uplift 자체 invalid (KH≥FC or FC≥BR)
  const _scalarsAll = scalarsList;
  scalarsList = scalarsList.filter((s, i) => {
    const m = s._eventMeta; if (!m) return true;
    const fps = s.meta?.fps || 240;
    // ★ Uplift 이벤트 자체 biomechanical 유효성 체크 (KH < FC < BR 순서)
    const upKh = m.kh?.uplift, upFc = m.fc?.uplift, upBr = m.br?.uplift;
    if (upKh != null && upFc != null && upKh >= upFc) {
      _qcInvalidOrder.push({ trialIndex: i+1, reason: `Uplift KH(${upKh}) ≥ FC(${upFc})` });
      return false;
    }
    if (upFc != null && upBr != null && upFc >= upBr) {
      _qcInvalidOrder.push({ trialIndex: i+1, reason: `Uplift FC(${upFc}) ≥ BR(${upBr})` });
      return false;
    }
    // raw vs Uplift 차이는 경고 정보만 수집 (제외하지 않음)
    for (const e of ['kh','fc','mer','br']) {
      const em = m[e];
      if (em && em.uplift != null && em.raw != null) {
        const diffMs = Math.abs(em.raw - em.uplift) / fps * 1000;
        if (diffMs > QC_THRESHOLD_MS) {
          _qcExcluded.push({
            trialIndex: i + 1,
            trialName: s.meta?.captureDate || `trial ${i+1}`,
            event: e.toUpperCase(),
            diffMs: Math.round(diffMs),
            uplift: em.uplift,
            raw: em.raw,
          });
          // 제외하지 않음 (Uplift 사용)
        }
      }
    }
    return true;
  });
  // 만약 모든 trial이 Uplift invalid로 제외되면 안전장치: 그래도 모두 사용 (분석 진행 우선)
  if (scalarsList.length === 0 && _scalarsAll.length > 0) {
    console.warn('QC: 모든 trial Uplift 유효성 체크 실패 → 안전장치로 모든 trial 사용');
    scalarsList = _scalarsAll;
  }

  const _trialN = {};   // ★ 변수별 사용 trial 수 (2026-05-03)
  const collect = (key) => {
    const vals = scalarsList.map(s => s[key]).filter(v => v != null && !isNaN(v));
    _trialN[key] = vals.length;
    return vals;
  };

  const loaded = {};

  // 메카닉(C) — 평균
  const meanFields = {
    'max_pelvis_rot_vel_dps':       'peak_pelvis_av',
    'max_trunk_twist_vel_dps':      'peak_trunk_av',
    'trunk_flex_vel_max':           'trunk_flex_vel_max',     // 새로 추가 (cohort 있는 변수)
    'peak_x_factor':                'max_x_factor',
    'max_shoulder_ER_deg':          'max_shoulder_ER',
    'trunk_rotation_at_fc':         'trunk_rotation_at_fc',
    'hip_shoulder_sep_at_fc':       'hip_shoulder_sep_at_fc',
    'trunk_forward_tilt_at_fc':     'trunk_forward_tilt_at_fc',
    // [v33.10] 'shoulder_h_abd_at_fc' meanField 제거 — Theia 비교에서 평면 차이
    'lead_knee_ext_vel_max':        'lead_knee_ext_vel_max',
    'lead_knee_ext_change_fc_to_br':'lead_knee_ext_change_fc_to_br', // ★Phase2
    'max_cog_velo':                 'max_cog_velo',                  // ★Phase2
    'hip_ir_vel_max_drive':         'hip_ir_vel_max_drive',          // ★Phase2
    'com_decel_pct':                'com_decel_pct',                 // ★Phase2
    'lead_knee_amortization_ms':    'lead_knee_amortization_ms',     // ★Phase2
    // Driveline 5각형 추가 변수
    'elbow_ext_vel_max':            'elbow_ext_vel_max',             // ★Phase2 (Arm Action)
    'shoulder_ir_vel_max':          'shoulder_ir_vel_max',           // ★Phase2 (Arm Action)
    // [v33.10] 'peak_torso_counter_rot' meanField 제거 — Theia 비교에서 정의 차이
    'torso_side_bend_at_mer':       'torso_side_bend_at_mer',        // ★Phase2 (Posture)
    'torso_rotation_at_br':         'torso_rotation_at_br',          // ★Phase2
    'arm_trunk_speedup':            'arm_trunk_speedup',             // ★ 운동량 전달 효율 (2026-05-03)
    'pelvis_trunk_speedup':         'pelvis_trunk_speedup',          // ★ 참고용 (Posture)
    // 'elbow_flexion_at_fp' 제거 (v31.25, 사용자 요청)
    'pelvis_to_trunk_lag_ms':       'pelvis_to_trunk_lag_ms',
    'trunk_to_arm_lag_ms':          'trunk_to_arm_lag_ms',
    // ★ Phase 3 (v33.6, 2026-05-05) — Output(출력) vs Transfer(전달) vs Injury(부상) 7변수
    //   v33.7 hotfix: meanFields 누락으로 사분면 카드가 빈 상태였음 (extractScalars는 산출, 집계 단계서 누락)
    'wrist_release_speed':              'wrist_release_speed',              // 출력 통합 결과
    'elbow_to_wrist_speedup':           'elbow_to_wrist_speedup',           // 전달 — 마지막 whip 효율
    'angular_chain_amplification':      'angular_chain_amplification',      // 전달 — 골반→팔 증폭률
    'elbow_valgus_torque_proxy':        'elbow_valgus_torque_proxy',        // 부상 — UCL stress proxy
    'stride_to_pelvis_lag_ms':          'stride_to_pelvis_lag_ms',          // 전달 — FC→peakPelvis 타이밍
    'x_factor_to_peak_pelvis_lag_ms':   'x_factor_to_peak_pelvis_lag_ms',   // 전달 — SSC 타이밍
    'knee_varus_max_drive':             'knee_varus_max_drive',             // 부상 — drive 무릎 외반
    'forearm_length_m':                 'forearm_length_m',                 // 메타 (참고용)
  };
  for (const [bbl, key] of Object.entries(meanFields)) {
    const vals = collect(key);
    if (vals.length) loaded[bbl] = mean(vals);
  }
  // ★ hip_shoulder_sep_sd_deg (2026-05-03 v30.11) — FC 시점 hip-shoulder sep 변동성
  //   메카닉 안정성 + 제구 일관성 양쪽 신호 (elite 통계 r=-0.71 ★★★★★)
  const hsepVals = collect('hip_shoulder_sep_at_fc');
  if (hsepVals.length >= 2) loaded['hip_shoulder_sep_sd_deg'] = stdev(hsepVals);

  // proper_sequence (메카닉 C5 binary) — N trial 중 proper인 비율을 0/1로 (0.5↑면 1)
  const seqVals = collect('proper_sequence_binary');
  if (seqVals.length) {
    loaded['proper_sequence'] = mean(seqVals) >= 0.5 ? 1 : 0;
    loaded['proper_sequence_pct'] = mean(seqVals) * 100;  // P4 변수 (0~100%)
    loaded['_proper_seq_x_of_n'] = `${seqVals.filter(v=>v===1).length}/${seqVals.length}`;  // UI 표시용 ("1/3")
  }

  // ━━━ 제구(P) ━━━
  // P2: arm_slot
  const armSlot = collect('arm_slot_angle_trial');
  if (armSlot.length)      loaded['arm_slot_mean_deg'] = mean(armSlot);
  if (armSlot.length >= 2) loaded['arm_slot_sd_deg']   = stdev(armSlot);
  // P3: release_height (m → cm for SD)
  const rh = collect('release_height_trial');
  if (rh.length)      loaded['release_height_m']     = mean(rh);
  if (rh.length >= 2) loaded['release_height_sd_cm'] = stdev(rh) * 100;
  // P4: mer→br timing SD
  const mtb = collect('mer_to_br_time_trial');
  if (mtb.length >= 2) loaded['mer_to_br_sd_ms'] = stdev(mtb);
  // P5: stride
  const stride = collect('stride_length_trial');
  if (stride.length)      loaded['stride_mean_m'] = mean(stride);
  if (stride.length >= 2) loaded['stride_sd_cm']  = stdev(stride) * 100;
  // [v33.10] stride_norm_height 산출 비활성화 — Theia/Qualisys 비교에서 정의 본질 차이로 신뢰 어려움 (ICC <0.13)
  //   stride_mean_m / stride_sd_cm은 P5 trial-to-trial 변동성 지표로만 유지 (제구 카테고리에서 SD만 사용).
  //   stride_norm_height(절대 신장 정규화) 점수 평가는 v33.10에서 제거.
  // P6: trunk tilt SD @ BR — 전후(forward) 단일 평면 SD 사용 (2026-05-03 수정)
  //   기존 √(σ_lat² + σ_fwd²) 합성은 임의적이고 SD가 부풀려지는 문제 → forward 단일 채택
  //   lateral은 보조 지표로 별도 저장 (trunk_lateral_sd_deg)
  const tiltLat = collect('trunk_tilt_at_br_trial');
  const tiltFwd = collect('trunk_forward_tilt_at_br_trial');
  const sdLat = tiltLat.length >= 2 ? stdev(tiltLat) : null;
  const sdFwd = tiltFwd.length >= 2 ? stdev(tiltFwd) : null;
  if (sdFwd != null)      loaded['trunk_tilt_sd_deg']   = sdFwd;          // ★ 메인 점수 변수
  else if (sdLat != null) loaded['trunk_tilt_sd_deg']   = sdLat;          // forward 없으면 lateral 폴백
  if (sdLat != null)      loaded['trunk_lateral_sd_deg'] = sdLat;         // 보조 지표
  // P1: wrist 3D 합성 SD (m → cm)
  const wx = collect('wrist_x_at_br'), wy = collect('wrist_y_at_br'), wz = collect('wrist_z_at_br');
  if (wx.length >= 2 && wy.length >= 2 && wz.length >= 2) {
    const sdX = stdev(wx), sdY = stdev(wy), sdZ = stdev(wz);
    loaded['wrist_3d_sd_cm'] = Math.sqrt(sdX*sdX + sdY*sdY + sdZ*sdZ) * 100;
    // wrist_3d_sd_cm은 3축 모두 사용 — n은 최소값 보고
    _trialN['wrist_3d_sd_cm'] = Math.min(wx.length, wy.length, wz.length);
  }

  // ★ Trial-N 매핑 (2026-05-03) — trial 변수 키 → BBL 최종 변수 키
  //   UI에서 (n=X / Y) 형태로 신뢰도 표시 가능
  const _trial2bbl = {
    'stride_length':                      ['stride_mean_m', 'stride_sd_cm'],
    'arm_slot_angle_trial':               ['arm_slot_mean_deg', 'arm_slot_sd_deg'],
    'release_height_trial':               ['release_height_m', 'release_height_sd_cm'],
    'mer_to_br_time_trial':               ['mer_to_br_sd_ms'],
    'trunk_forward_tilt_at_br_trial':     ['trunk_tilt_sd_deg'],
    'trunk_tilt_at_br_trial':             ['trunk_lateral_sd_deg'],
    'proper_sequence_binary':             ['proper_sequence', 'proper_sequence_pct'],
  };
  const trialCounts = {};
  // 평균 변수 (meanFields)는 같은 collect key 사용
  for (const [trialKey, bblKeys] of Object.entries(_trial2bbl)) {
    if (_trialN[trialKey] != null) {
      bblKeys.forEach(bk => { trialCounts[bk] = _trialN[trialKey]; });
    }
  }
  // meanFields는 trialKey == bblKey
  Object.entries(_trialN).forEach(([k, n]) => {
    if (trialCounts[k] == null) trialCounts[k] = n;
  });
  loaded['_trial_counts']     = trialCounts;
  loaded['_num_trials_total'] = scalarsList.length;     // QC 통과한 trial 수
  loaded['_num_trials']       = scalarsList.length;     // 기존 호환
  loaded['_num_trials_uploaded'] = _scalarsAll.length;  // 업로드된 전체 (QC 전)
  loaded['_qc_excluded']        = _qcExcluded;            // raw mismatch 정보 (제외 X)
  loaded['_qc_invalid_order']   = _qcInvalidOrder;        // 실제 제외 (Uplift biomech invalid)
  loaded['_qc_threshold_ms']    = QC_THRESHOLD_MS;

  // ★ 이벤트 검출 일치도 집계 (2026-05-03) — Uplift vs raw 비교
  const eventNames = ['kh', 'fc', 'mer', 'br'];
  const eventAgreement = {};
  for (const evt of eventNames) {
    const diffs = [];        // raw - uplift (양수 = raw가 더 늦음)
    const upVals = [], rawVals = [];
    let bothCount = 0, onlyRawCount = 0, onlyUpliftCount = 0;
    for (const s of scalarsList) {
      const m = s._eventMeta?.[evt];
      if (!m) continue;
      if (m.uplift != null && m.raw != null) {
        diffs.push(m.raw - m.uplift);
        upVals.push(m.uplift); rawVals.push(m.raw);
        bothCount++;
      } else if (m.raw != null) onlyRawCount++;
      else if (m.uplift != null) onlyUpliftCount++;
    }
    if (diffs.length === 0) {
      eventAgreement[evt] = { n: 0 };
      continue;
    }
    const meanDiff = diffs.reduce((a,b)=>a+b, 0) / diffs.length;
    const absMax   = Math.max(...diffs.map(Math.abs));
    // fps는 trial 평균 사용 (각 trial scalarsList[i].meta.fps)
    const fpsList  = scalarsList.map(s => s.meta?.fps).filter(v => v != null && !isNaN(v));
    const fpsMean  = fpsList.length > 0 ? fpsList.reduce((a,b)=>a+b,0)/fpsList.length : 240;
    const meanDiffMs = meanDiff / fpsMean * 1000;
    const absMaxMs   = absMax   / fpsMean * 1000;
    eventAgreement[evt] = {
      n: bothCount,
      onlyRaw: onlyRawCount,
      onlyUplift: onlyUpliftCount,
      meanDiff, absMax, meanDiffMs, absMaxMs,
      meanUplift: upVals.reduce((a,b)=>a+b,0)/upVals.length,
      meanRaw:    rawVals.reduce((a,b)=>a+b,0)/rawVals.length,
    };
  }
  loaded['_event_agreement'] = eventAgreement;

  return loaded;
}

// ── 다중 Uplift CSV 처리 ──
function handleMultipleUpliftFiles(files) {
  const promises = files.map(f => new Promise((resolve) => {
    const r = new FileReader();
    r.onload = e => resolve({ name: f.name, text: e.target.result });
    r.onerror = () => resolve({ name: f.name, text: null });
    r.readAsText(f);
  }));

  Promise.all(promises).then(results => {
    const valid = []; const invalid = [];
    for (const r of results) {
      if (!r.text) { invalid.push(r.name + ' (읽기 실패)'); continue; }
      const parsed = parseUpliftFile(r.text);
      if (!parsed) { invalid.push(r.name + ' (Uplift 형식 아님)'); continue; }
      try {
        const scalars = extractScalarsFromUplift(parsed);
        valid.push({ name: r.name, scalars });
      } catch (e) {
        console.error(`${r.name} 추출 오류:`, e);
        invalid.push(r.name + ' (추출 오류)');
      }
    }

    if (valid.length === 0) {
      alert('Uplift CSV로 인식한 파일이 없습니다.\n\n' + invalid.slice(0, 10).join('\n'));
      return;
    }

    const scalarsList = valid.map(v => v.scalars);
    const loaded = applyMultiTrialUplift(scalarsList);

    if (Object.keys(loaded).length === 0) {
      alert('변수 추출에 실패했습니다.');
      return;
    }

    CURRENT_INPUT.mechanics = {};
    Object.assign(CURRENT_INPUT.mechanics, loaded);

    // Step 1 자동 채움 (첫 trial 메타)
    const firstMeta = scalarsList[0].meta;
    // ★ v30.15 Phase 2: armSide를 CURRENT_INPUT에 저장 (점수제 4-cell 분기에 필요)
    CURRENT_INPUT._armSide = firstMeta.armSide || 'right';
    if (firstMeta.athleteName) {
      const el = document.getElementById('player-name');
      if (!el.value || el.value === '신규 선수') el.value = firstMeta.athleteName;
    }
    if (firstMeta.captureDate) {
      const el = document.getElementById('player-date');
      if (!el.value) el.value = parseDateFlex((firstMeta.captureDate || '').split(' ')[0]);
    }
    // ★ v30.16.2: master_fitness.xlsx 자동 매칭 — 체력 CSV 없어도 키/몸무게/MaxV/손잡이 보강
    try {
      const masterRaw = localStorage.getItem('bbl_master_fitness');
      if (masterRaw && firstMeta.athleteName) {
        const masterRows = JSON.parse(masterRaw);
        const targetName = firstMeta.athleteName.toLowerCase().replace(/^s\d+\s+/i, '').trim();
        const targetDate = parseDateFlex((firstMeta.captureDate || '').split(' ')[0]);
        // ★ v33.8 — session_folder (Lab_ID) 추출 — trial CSV 파일 경로에서 부모 폴더명
        //   형식: "jeongyejun_20250429" — master_fitness Lab_ID와 정확히 일치
        const targetLabId = firstMeta.sessionFolder || firstMeta.session_folder || null;
        // 0차 매칭 (★ v33.8 신설): Lab_ID 정확 일치 — 가장 신뢰성 높음
        let masterRow = null;
        if (targetLabId) {
          masterRow = masterRows.find(r => {
            const labMatch = (r.Lab_ID || r['Lab_ID'] || '').toString().toLowerCase().trim() === targetLabId.toLowerCase().trim();
            return labMatch;
          });
        }
        // 1차 매칭: ID + 측정일 일치
        if (!masterRow) {
          masterRow = masterRows.find(r => {
            const idMatch = (r.ID || '').toString().toLowerCase().trim() === targetName
                         || (r.Name || '').toString().trim() === firstMeta.athleteName.trim()
                         || (r.athleteName || '').toString().trim() === firstMeta.athleteName.trim();
            const dateNum = parseInt((r.Date || '').toString().replace(/\D/g, ''), 10);
            const targetNum = parseInt((targetDate || '').toString().replace(/\D/g, ''), 10);
            return idMatch && (!targetNum || Math.abs(dateNum - targetNum) <= 7);  // ±7일 허용
          });
        }
        // 2차 매칭: ID만 일치 (가장 가까운 날짜)
        if (!masterRow) {
          masterRow = masterRows.find(r => (r.ID || '').toString().toLowerCase().trim() === targetName);
        }
        // ★ v33.8 3차 매칭: 부분 문자열 fuzzy (영어 ID에서 마지막 토큰만 일치하는 경우 등)
        if (!masterRow && targetName.length >= 4) {
          masterRow = masterRows.find(r => {
            const rid = (r.ID || '').toString().toLowerCase().trim();
            return rid.length >= 4 && (rid.includes(targetName) || targetName.includes(rid));
          });
        }
        if (masterRow) {
          // 손잡이 마스터 우선
          if (masterRow.Handedness) {
            const masterHand = masterRow.Handedness.toString().toLowerCase() === 'l' ? 'left' : 'right';
            CURRENT_INPUT._armSide = masterHand;
          }
          // MaxV 자동 채움
          const veloEl = document.getElementById('player-velo');
          if (veloEl && (!veloEl.value || veloEl.value === '') && masterRow['Max Velocity'] != null) {
            veloEl.value = parseFloat(masterRow['Max Velocity']).toFixed(1);
          }
          // ★ v30.18: master_fitness의 모든 fitness 변수 자동 채움 (체력 CSV 없어도 점수 산출 가능)
          if (!CURRENT_INPUT.fitness) CURRENT_INPUT.fitness = {};
          const FITNESS_KEYS_FROM_MASTER = [
            'Height[M]', 'Weight[KG]', 'BMI',
            'CMJ Peak Power [W]', 'CMJ Peak Power / BM [W/kg]',
            'CMJ Concentric Impulse [N s]', 'CMJ RSI-modified [m/s]',
            'SJ Peak Power [W]', 'SJ Peak Power / BM [W/kg]', 'SJ RSI-modified [m/s]',
            'EUR',
            'IMTP Peak Vertical Force [N]', 'IMTP Peak Vertical Force / BM [N/kg]',
            'Grip Strength',  // ★ v32.1 — 악력 추가 (134명 코호트 cross d=+1.18 Large)
            // ROM 변수 제거 (v31.44 F5_Flexibility 카테고리 제거)
          ];
          let filledCount = 0;
          for (const k of FITNESS_KEYS_FROM_MASTER) {
            if (masterRow[k] != null && CURRENT_INPUT.fitness[k] == null) {
              const v = parseFloat(masterRow[k]);
              if (!isNaN(v)) { CURRENT_INPUT.fitness[k] = v; filledCount++; }
            }
          }
          console.log(`📊 master_fitness 자동 매칭: ${firstMeta.athleteName} → 손잡이 ${CURRENT_INPUT._armSide}, MaxV ${masterRow['Max Velocity']}, fitness ${filledCount}개 채움`);
        }
      }
    } catch (e) {
      console.warn('master_fitness 자동 매칭 실패 (정상 동작에 영향 없음):', e);
    }

    // 선수 동일성 체크
    const uniqueNames = [...new Set(scalarsList.map(s => s.meta.athleteName).filter(Boolean))];
    let nameWarning = '';
    if (uniqueNames.length > 1) {
      nameWarning = `<br>⚠️ 여러 선수 이름이 섞여 있습니다: ${uniqueNames.join(', ')}`;
    }

    WIDE_CSV_CACHE.mechanics = null;
    hidePlayerSelector('mechanics');

    const handLabel = firstMeta.armSide === 'left' ? '좌투' : '우투';
    // ★ v30.18.2: QC 정책 변경 — raw vs Uplift 차이는 정보 표시만 (제외하지 않음)
    const qcEx = loaded._qc_excluded || [];           // raw mismatch 정보
    const qcInvalidOrder = loaded._qc_invalid_order || []; // 실제 제외 (Uplift biomech invalid)
    const qcThresh = loaded._qc_threshold_ms || 300;
    const nUploaded = loaded._num_trials_uploaded || valid.length;
    const nUsed = loaded._num_trials_total || valid.length;
    let qcBanner = '';
    // 실제 제외된 trial (Uplift biomech invalid)만 빨간 배너
    if (qcInvalidOrder.length > 0) {
      const orderList = qcInvalidOrder.map(x =>
        `<div style="font-size:10px;color:#f87171;padding-left:8px;">• trial ${x.trialIndex} 제외: ${x.reason}</div>`
      ).join('');
      qcBanner += `<div style="margin-top:6px;padding:6px 10px;background:rgba(248,113,113,0.08);border-left:2px solid #f87171;border-radius:3px;font-size:11px;">
        <div style="color:#f87171;font-weight:600;margin-bottom:2px;">❌ ${qcInvalidOrder.length} trial 제외 (Uplift 이벤트 순서 비정상)</div>
        ${orderList}
      </div>`;
    }
    // raw mismatch 정보 (참고용 — 제외 영향 없음)
    if (qcEx.length > 0) {
      const sampleList = qcEx.slice(0, 3).map(x =>
        `<div style="font-size:10px;color:#5f636b;padding-left:8px;">• trial ${x.trialIndex} ${x.event} 차이 ${x.diffMs}ms</div>`
      ).join('');
      const more = qcEx.length > 3 ? `<div style="font-size:10px;color:#5f636b;padding-left:8px;">… 그 외 ${qcEx.length - 3}건</div>` : '';
      qcBanner += `<div style="margin-top:6px;padding:6px 10px;background:rgba(96,165,250,0.05);border-left:2px solid #60a5fa;border-radius:3px;font-size:11px;">
        <div style="color:#60a5fa;font-weight:600;margin-bottom:2px;">ℹ️ raw 자체 검출이 Uplift와 ${qcEx.length}건 차이 — Uplift 신뢰 사용 (분석 영향 없음)</div>
        ${sampleList}${more}
        <div style="color:#5f636b;font-size:10px;margin-top:3px;">v30.18.2: raw 알고리즘 한계로 일부 trial에서 검출 차이 — Uplift 사전계산 우선</div>
      </div>`;
    }

    // ★ Trial-N breakdown — 변수별 사용 trial 수 (2026-05-03)
    const tc = loaded._trial_counts || {};
    const tTotal = loaded._num_trials_total || valid.length;
    const breakdown = (() => {
      const keyVars = [
        ['stride_mean_m',      'Stride 평균/SD'],
        ['mer_to_br_sd_ms',    'MER→BR Time SD'],
        ['proper_sequence_pct','시퀀스 적정 비율'],
        ['arm_slot_sd_deg',    'Arm Slot SD'],
        ['release_height_sd_cm','릴리스 높이 SD'],
        ['trunk_tilt_sd_deg',  '몸통 기울기 SD'],
        ['wrist_3d_sd_cm',     '손목 3D SD'],
      ];
      const cells = keyVars.map(([k,lbl]) => {
        const n = tc[k];
        if (n == null) return `<span style="color:#5f636b;">${lbl}: —</span>`;
        const low = (n < 5);
        const c   = low ? '#f87171' : '#9ca3af';
        return `<span style="color:${c};">${lbl}: <strong>n=${n}/${tTotal}</strong></span>`;
      });
      // 이벤트 일치도 패널 (Uplift vs raw 자체 검출)
      const ea = loaded._event_agreement || {};
      const eventLabels = { kh: 'KH', fc: 'FC', mer: 'MER', br: 'BR' };
      const eaCells = Object.entries(eventLabels).map(([k, lbl]) => {
        const a = ea[k];
        if (!a || a.n === 0) {
          return `<span style="color:#5f636b;">${lbl}: —</span>`;
        }
        // 평균 차이 ms 기준: |diff| ≤ 15ms = 양호(녹색), 15-30ms = 주의(노랑), >30ms = 큰 불일치(빨강)
        const am = Math.abs(a.meanDiffMs);
        const c = am <= 15 ? '#4ade80' : am <= 30 ? '#fbbf24' : '#f87171';
        const sign = a.meanDiff >= 0 ? '+' : '';
        const tip = `n=${a.n} trial · raw 평균 ${a.meanRaw.toFixed(0)} frame, Uplift 평균 ${a.meanUplift.toFixed(0)} frame · 최대 차이 ${a.absMax.toFixed(0)} frame (${a.absMaxMs.toFixed(0)}ms)`;
        return `<span style="color:${c};" title="${tip}">${lbl}: <strong>raw−Uplift ${sign}${a.meanDiff.toFixed(1)}f (${sign}${a.meanDiffMs.toFixed(0)}ms)</strong></span>`;
      });
      return `<div style="margin-top:6px;padding:6px 10px;background:rgba(96,165,250,0.06);border-left:2px solid #60a5fa;border-radius:3px;font-size:11px;line-height:1.7;">
        <div style="color:#60a5fa;font-weight:600;margin-bottom:2px;">📊 변수별 사용 Trial 수 (이벤트 검출 성공한 trial만 집계)</div>
        ${cells.join(' · ')}
      </div>
      <div style="margin-top:6px;padding:6px 10px;background:rgba(192,132,252,0.06);border-left:2px solid #c084fc;border-radius:3px;font-size:11px;line-height:1.7;">
        <div style="color:#c084fc;font-weight:600;margin-bottom:2px;">🎯 이벤트 검출 일치도 (Uplift vs BBL raw 자체 검출 · hover로 상세)</div>
        ${eaCells.join(' · ')}
        <div style="color:#5f636b;font-size:10px;margin-top:3px;">
          녹색 ≤15ms · 노랑 15–30ms · 빨강 >30ms — 큰 불일치는 Uplift 사전계산 또는 raw 검출 알고리즘 점검 필요
        </div>
      </div>`;
    })();
    renderUploadStatus('mechanics', {
      meta: { name: firstMeta.athleteName, date: parseDateFlex((firstMeta.captureDate || '').split(' ')[0]) },
      loaded, ignored: [],
      sourceLabel: `Uplift Capture × <strong>${valid.length} trials</strong> (평균 + SD 산출 · ${handLabel})${nameWarning}${invalid.length ? `<br>· 인식 실패 ${invalid.length}개: <span class="mono text-[11px]">${invalid.slice(0,3).join(', ')}${invalid.length>3?' …':''}</span>` : ''}${qcBanner}${breakdown}`,
    });
  });
}

// ── Uplift Capture raw CSV 처리 ─────────────────────────────────
// 이벤트 프레임 + 요약 메트릭 + FC 시점 시계열 추출 → BBL 메카닉 변수
function processUpliftCsv(header, headerNorm, lines, type) {
  if (type !== 'mechanics') {
    alert('Uplift Capture CSV는 메카닉(Step 3) 영역에 업로드해주세요.\n현재 영역(체력+구속)에는 다른 형식의 CSV가 필요합니다.');
    return;
  }

  // 헤더 인덱스 (raw 컬럼명 그대로 lookup)
  const idx = {};
  header.forEach((h, i) => { idx[h] = i; });

  // 필수 컬럼 사전 검증
  const requiredCols = ['athlete_name', 'frame', 'fps', 'foot_contact_frame', 'ball_release_frame'];
  const missing = requiredCols.filter(c => idx[c] == null);
  if (missing.length) {
    alert('Uplift CSV의 필수 컬럼이 빠져 있습니다:\n  ' + missing.join(', ')
          + '\n\nUplift Capture에서 정상 export된 CSV인지 확인해주세요.');
    return;
  }

  // 데이터 행 파싱 (성능: 너무 큰 파일 경고)
  if (lines.length > 50000) {
    if (!confirm(`CSV가 매우 큽니다 (${lines.length.toLocaleString()} 행). 처리에 시간이 걸릴 수 있습니다. 계속할까요?`)) return;
  }
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length < 5) continue;
    rows.push(cols);
  }
  if (rows.length === 0) { alert('Uplift CSV에 데이터 행이 없습니다.'); return; }

  const r0 = rows[0];

  // 메타데이터 (모든 행에 동일)
  const athleteName  = r0[idx['athlete_name']] || '';
  const captureDate  = r0[idx['capture_datetime']] || '';
  const fps          = parseFloat(r0[idx['fps']]) || 240;
  const handedness   = (r0[idx['handedness']] || '').toLowerCase();
  const kinSeq       = r0[idx['kinematic_sequence_order']] || '';

  // 이벤트 프레임 (절대 frame index = current_frame - event_relative_value)
  const cur0 = parseFloat(r0[idx['frame']]) || 0;
  const getFrameAbs = (key) => {
    const ci = idx[key];
    if (ci == null) return null;
    const v = parseFloat(r0[ci]);
    if (isNaN(v)) return null;
    return cur0 - v;
  };
  // peak_*_angular_velocity_frame이 비어있을 수 있어 max_*_rotational_velocity_with_respect_to_ground_frame을 fallback
  const armSide = handedness === 'left' ? 'left' : 'right';
  const events = {
    fc:   getFrameAbs('foot_contact_frame'),
    br:   getFrameAbs('ball_release_frame'),
    mer:  getFrameAbs('max_external_rotation_frame'),
    mir:  getFrameAbs('max_internal_rotation_frame'),
    kh:   getFrameAbs('max_knee_raise_frame'),
    peakPelvis: getFrameAbs('peak_pelvis_angular_velocity_frame')
                ?? getFrameAbs('max_pelvis_rotational_velocity_with_respect_to_ground_frame'),
    peakTrunk:  getFrameAbs('peak_trunk_angular_velocity_frame')
                ?? getFrameAbs('max_trunk_rotational_velocity_with_respect_to_ground_frame'),
    peakArm:    getFrameAbs('peak_arm_angular_velocity_frame')
                ?? getFrameAbs(`max_${armSide}_arm_rotational_velocity_with_respect_to_ground_frame`),
    maxXFactor: getFrameAbs('max_x_factor_frame'),
  };

  // frame → row index lookup
  const frameMap = {};
  rows.forEach((r, i) => {
    const f = parseInt(r[idx['frame']], 10);
    if (!isNaN(f)) frameMap[f] = i;
  });

  const valAtFrame = (frameAbs, colName) => {
    if (frameAbs == null) return null;
    const ci = idx[colName];
    if (ci == null) return null;
    const ri = frameMap[frameAbs];
    if (ri == null) return null;
    const v = parseFloat(rows[ri][ci]);
    return isNaN(v) ? null : v;
  };
  const colMaxBetween = (colName, fromF, toF) => {
    const ci = idx[colName];
    if (ci == null || fromF == null || toF == null) return null;
    let max = null;
    const lo = Math.min(fromF, toF), hi = Math.max(fromF, toF);
    for (let f = lo; f <= hi; f++) {
      const ri = frameMap[f];
      if (ri == null) continue;
      const v = parseFloat(rows[ri][ci]);
      if (!isNaN(v) && (max == null || v > max)) max = v;
    }
    return max;
  };

  // ── BBL 메카닉 변수 추출 ──
  const loaded = {};
  const setVal = (bblKey, val) => {
    if (val != null && !isNaN(val)) loaded[bblKey] = val;
  };

  // 1) raw 시계열 산출 (2026-05-03 — Uplift 사전계산값 의존 제거)
  //   peak_pelvis_av, peak_trunk_av, max_x_factor, peak_arm_av를 시계열에서 직접 산출
  const _winFromS = (events.kh != null) ? events.kh : (events.fc != null ? events.fc - 100 : null);
  const _winToS   = (events.br != null) ? events.br + 30 : null;
  if (_winFromS != null && _winToS != null) {
    const _maxAbsCol = (col) => {
      const ci = idx[col]; if (ci == null) return null;
      let max = null;
      const lo = Math.min(_winFromS, _winToS), hi = Math.max(_winFromS, _winToS);
      for (let f = lo; f <= hi; f++) {
        const ri = frameMap[f]; if (ri == null) continue;
        const v = parseFloat(rows[ri][ci]); if (isNaN(v)) continue;
        const abs = Math.abs(v);
        if (max == null || abs > max) max = abs;
      }
      return max;
    };
    const _maxAbsDiff = (cA, cB) => {
      const iA = idx[cA], iB = idx[cB]; if (iA == null || iB == null) return null;
      let max = null;
      const lo = Math.min(_winFromS, _winToS), hi = Math.max(_winFromS, _winToS);
      for (let f = lo; f <= hi; f++) {
        const ri = frameMap[f]; if (ri == null) continue;
        const a = parseFloat(rows[ri][iA]), b = parseFloat(rows[ri][iB]);
        if (isNaN(a) || isNaN(b)) continue;
        const d = Math.abs(a - b);
        if (max == null || d > max) max = d;
      }
      return max;
    };
    setVal('max_pelvis_rot_vel_dps',  _maxAbsCol('pelvis_rotational_velocity_with_respect_to_ground'));
    setVal('max_trunk_twist_vel_dps', _maxAbsCol('trunk_rotational_velocity_with_respect_to_ground'));
    // peak_x_factor: signed max (pelvis - trunk) in [KH, FC+5] — 2026-05-03 보정
    const _signedXf = (cA, cB, fromF, toF) => {
      const iA = idx[cA], iB = idx[cB]; if (iA == null || iB == null) return null;
      let max = null;
      const lo = Math.min(fromF, toF), hi = Math.max(fromF, toF);
      for (let f = lo; f <= hi; f++) {
        const ri = frameMap[f]; if (ri == null) continue;
        const a = parseFloat(rows[ri][iA]), b = parseFloat(rows[ri][iB]);
        if (isNaN(a) || isNaN(b)) continue;
        const d = a - b;
        if (max == null || d > max) max = d;
      }
      return max;
    };
    if (events.kh != null && events.fc != null) {
      // ★ v30.14: 좌투는 회전 방향 반대 → 컬럼 순서 swap
      const xf = (armSide === 'left')
        ? _signedXf('trunk_global_rotation', 'pelvis_global_rotation', events.kh, events.fc + 5)
        : _signedXf('pelvis_global_rotation', 'trunk_global_rotation', events.kh, events.fc + 5);
      setVal('peak_x_factor', xf);
    }
  }
  // max_shoulder_ER_deg는 max_layback_angle과 컨벤션이 다름 → 시계열에서 직접 추출 (아래 4번 단계에서)

  // 2) proper_sequence (binary 0/1) — peak frame 시간 순서 직접 비교 (2026-05-03)
  if (events.peakPelvis != null && events.peakTrunk != null && events.peakArm != null) {
    loaded['proper_sequence'] =
      (events.peakPelvis < events.peakTrunk && events.peakTrunk < events.peakArm) ? 1 : 0;
  } else if (kinSeq) {
    const norm = kinSeq.toLowerCase().replace(/[\s_\u2192>\-]+/g, '-');
    loaded['proper_sequence'] = norm.includes('pelvis-trunk-arm') ? 1 : 0;
  }

  // 3) 시퀀스 lag (peak frame 차이 → ms)
  if (events.peakPelvis != null && events.peakTrunk != null) {
    setVal('pelvis_to_trunk_lag_ms', (events.peakTrunk - events.peakPelvis) / fps * 1000);
  }
  if (events.peakTrunk != null && events.peakArm != null) {
    setVal('trunk_to_arm_lag_ms', (events.peakArm - events.peakTrunk) / fps * 1000);
  }

  // 4) FC 시점 시계열 추출
  if (events.fc != null) {
    let trunkRot  = valAtFrame(events.fc, 'trunk_global_rotation');
    let pelvisRot = valAtFrame(events.fc, 'pelvis_global_rotation');
    let trunkFwd  = valAtFrame(events.fc, 'trunk_global_flexion');
    // ★ v30.14 좌투 좌표계 보정 (extractScalarsFromUplift와 동일)
    if (armSide === 'left') {
      trunkRot  = normalizeAngle(trunkRot,  LEFT_TRUNK_REF);
      pelvisRot = normalizeAngle(pelvisRot, LEFT_PELVIS_REF);
      if (trunkRot  != null) trunkRot  = trunkRot  - LEFT_TO_RIGHT_TRUNK_OFFSET;
      if (pelvisRot != null) pelvisRot = pelvisRot - LEFT_TO_RIGHT_PELVIS_OFFSET;
      if (trunkFwd  != null) trunkFwd  = Math.abs(trunkFwd);  // 좌투 trunk_global_flexion 부호 반대 → abs
    }
    setVal('trunk_rotation_at_fc', trunkRot);
    if (trunkRot != null && pelvisRot != null) {
      setVal('hip_shoulder_sep_at_fc', pelvisRot - trunkRot);  // signed (양수 = pelvis 먼저 열림)
    }
    // BBL 변환: 180 - Uplift (양수=forward tilt, 음수=back tilt)
    setVal('trunk_forward_tilt_at_fc', trunkFwd != null ? (180 - trunkFwd) : null);

    // shoulder_h_abd_at_fc: Uplift는 horizontal_adduction(수평 내전), BBL은 abduction(수평 외전) — 부호 반전
    const sideHadd = armSide === 'left'
      ? 'left_shoulder_horizontal_adduction'
      : 'right_shoulder_horizontal_adduction';
    const habdRaw = valAtFrame(events.fc, sideHadd);
    setVal('shoulder_h_abd_at_fc', habdRaw != null ? -habdRaw : null);
  }

  // 5) 앞다리 무릎 신전속도 max [FC, BR]  (우투면 lead = left)
  if (events.fc != null && events.br != null) {
    const leadCol = armSide === 'left'
      ? 'right_knee_extension_velocity'
      : 'left_knee_extension_velocity';
    setVal('lead_knee_ext_vel_max', colMaxBetween(leadCol, events.fc, events.br));

    // max_shoulder_ER_deg: 시계열의 [FC, BR] 구간 max (max_layback_angle은 컨벤션이 달라 사용 안 함)
    //   BBL 코호트는 thoracic-frame ER 기준 (180~210° 범위)
    //   Uplift right_shoulder_external_rotation 시계열의 max @ MER이 동일 기준
    const erCol = armSide === 'left'
      ? 'left_shoulder_external_rotation'
      : 'right_shoulder_external_rotation';
    setVal('max_shoulder_ER_deg', colMaxBetween(erCol, events.fc, events.br));
  }

  // 6) 제구 (P 카테고리) — raw 시계열 직산출 (좌표계 검증 후 보정 2026-05-03)
  //    좌표계: y = vertical (up), z = forward (pitching direction), x = lateral
  //    SD 변수(release point/timing/trunk consistency)는 다중 trial 필요 → 미입력

  // arm_slot: BR 시점 어깨→손목 벡터의 elevation angle (y가 vertical)
  if (events.br != null) {
    const sP = (armSide === 'left' ? 'left' : 'right') + '_shoulder_jc_3d';
    const wP = (armSide === 'left' ? 'left' : 'right') + '_wrist_jc_3d';
    const sx = valAtFrame(events.br, sP+'_x'), sy = valAtFrame(events.br, sP+'_y'), sz = valAtFrame(events.br, sP+'_z');
    const wx = valAtFrame(events.br, wP+'_x'), wy = valAtFrame(events.br, wP+'_y'), wz = valAtFrame(events.br, wP+'_z');
    if (sx!=null && sy!=null && sz!=null && wx!=null && wy!=null && wz!=null) {
      const vDiff = wy - sy;  // y가 vertical
      const hDiff = Math.sqrt((wx-sx)*(wx-sx) + (wz-sz)*(wz-sz));
      setVal('arm_slot_mean_deg', Math.atan2(vDiff, hDiff) * 180 / Math.PI);
    }
    // release_height: 지면 기준 손목 높이 (wrist_y - 평균 발목_y at FC)
    if (events.fc != null) {
      const wy_br = valAtFrame(events.br, wP+'_y');
      const lay = valAtFrame(events.fc, 'left_ankle_jc_3d_y');
      const ray = valAtFrame(events.fc, 'right_ankle_jc_3d_y');
      if (wy_br != null && lay != null && ray != null) {
        setVal('release_height_m', wy_br - (lay + ray) / 2);
      } else if (wy_br != null && (lay != null || ray != null)) {
        setVal('release_height_m', wy_br - (lay != null ? lay : ray));
      }
    }
  }
  // stride_length: front foot가 KH→FC까지 이동한 3D 거리 (m)
  if (events.kh != null && events.fc != null) {
    const frontPrefix = (armSide === 'left' ? 'right' : 'left') + '_ankle_jc_3d';
    const fxKH = valAtFrame(events.kh, frontPrefix+'_x'), fyKH = valAtFrame(events.kh, frontPrefix+'_y'), fzKH = valAtFrame(events.kh, frontPrefix+'_z');
    const fxFC = valAtFrame(events.fc, frontPrefix+'_x'), fyFC = valAtFrame(events.fc, frontPrefix+'_y'), fzFC = valAtFrame(events.fc, frontPrefix+'_z');
    if (fxKH!=null && fyKH!=null && fzKH!=null && fxFC!=null && fyFC!=null && fzFC!=null) {
      setVal('stride_mean_m', Math.sqrt(
        (fxFC-fxKH)*(fxFC-fxKH) + (fyFC-fyKH)*(fyFC-fyKH) + (fzFC-fzKH)*(fzFC-fzKH)
      ));
    }
  }
  // proper_sequence_pct: 단일 trial에서는 0/100 (binary × 100) — peak frame 우선 (2026-05-03)
  if (events.peakPelvis != null && events.peakTrunk != null && events.peakArm != null) {
    loaded['proper_sequence_pct'] =
      (events.peakPelvis < events.peakTrunk && events.peakTrunk < events.peakArm) ? 100 : 0;
  } else if (kinSeq) {
    const norm = kinSeq.toLowerCase().replace(/[\s_\u2192>\-]+/g, '-');
    loaded['proper_sequence_pct'] = norm.includes('pelvis-trunk-arm') ? 100 : 0;
  }

  // 추출 0개면 경고
  if (Object.keys(loaded).length === 0) {
    alert('⚠️ Uplift CSV에서 BBL 메카닉 변수를 하나도 추출하지 못했습니다.\n'
          + 'CSV에 요약 메트릭(peak_pelvis_angular_velocity 등)과 이벤트 프레임이 들어있는지 확인해주세요.');
    return;
  }

  // ── 입력 적용 + Step 1 자동 채움 ──
  CURRENT_INPUT.mechanics = {};
  for (const [k, v] of Object.entries(loaded)) CURRENT_INPUT.mechanics[k] = v;

  const dateIso = parseDateFlex((captureDate || '').split(' ')[0]);
  const metaApplied = {};
  if (athleteName) {
    const el = document.getElementById('player-name');
    // fitness가 먼저 채웠으면 덮어쓰지 않음
    if (!el.value || el.value === '신규 선수') { el.value = athleteName; metaApplied.name = athleteName; }
  }
  if (dateIso) {
    const el = document.getElementById('player-date');
    if (!el.value) { el.value = dateIso; metaApplied.date = dateIso; }
  }

  // 셀렉터 닫고, 결과 카드 렌더
  WIDE_CSV_CACHE.mechanics = null;
  hidePlayerSelector('mechanics');

  const handLabel = armSide === 'left' ? '좌투' : '우투';
  const eventsLabel = `KH=${events.kh ?? '?'} · FC=${events.fc ?? '?'} · MER=${events.mer ?? '?'} · BR=${events.br ?? '?'}`;
  renderUploadStatus('mechanics', {
    meta: metaApplied,
    loaded,
    ignored: [],
    sourceLabel: `Uplift Capture raw 시계열 (${rows.length} 프레임 · ${fps.toFixed(1)} fps · ${handLabel})<br>· 이벤트 프레임: <span class="mono text-[11px]">${eventsLabel}</span>`,
  });
}

// ── 롱 포맷: 한 변수 한 행 ────────────────────────────────────
function processLongCsv(header, headerNorm, lines, type) {
  const keyIdx = headerNorm.findIndex(h => h === 'field_key' || h === 'fieldkey' || h === 'key');
  const valIdx = headerNorm.findIndex(h => h === 'value');

  const lookup = getCohortKeyLookup(type);
  const loaded = {};
  const ignored = [];

  CURRENT_INPUT[type] = {};

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const rawKey = cols[keyIdx];
    const val = parseFloat(cols[valIdx]);
    if (!rawKey || isNaN(val)) continue;
    const cohortKey = lookup[normalizeColName(rawKey)]
      || (COHORT.var_distributions[rawKey] ? rawKey : null);
    if (cohortKey) {
      CURRENT_INPUT[type][cohortKey] = val;
      loaded[cohortKey] = val;
    } else {
      ignored.push(rawKey);
    }
  }

  WIDE_CSV_CACHE[type] = null;
  hidePlayerSelector(type);
  renderUploadStatus(type, { meta: {}, loaded, ignored, sourceLabel: 'BBL 템플릿 (롱 포맷)' });
}

// ── 와이드 포맷: 한 행 = 한 선수 ────────────────────────────────
function processWideCsv(header, headerNorm, lines, type) {
  const lookup = getCohortKeyLookup(type);
  const colMap = [];
  const metaMap = [];
  const ignored = [];

  for (let i = 0; i < header.length; i++) {
    const norm = headerNorm[i];
    if (META_COL_MAP[norm]) { metaMap.push({ idx: i, metaKey: META_COL_MAP[norm] }); continue; }
    if (lookup[norm]) colMap.push({ idx: i, cohortKey: lookup[norm] });
    else if (header[i]) ignored.push(header[i]);
  }

  if (colMap.length === 0) {
    alert('⚠️ 매칭되는 변수 컬럼을 찾지 못했습니다. CSV 헤더를 확인해주세요.');
    return;
  }

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.every(c => !c)) continue;
    rows.push(cols);
  }
  if (rows.length === 0) { alert('CSV에 데이터 행이 없습니다.'); return; }

  WIDE_CSV_CACHE[type] = { header, headerNorm, rows, colMap, metaMap, ignored };

  if (rows.length === 1) {
    hidePlayerSelector(type);
  } else {
    const selId    = type === 'fitness' ? 'fitness-player-select'    : 'mech-player-select';
    const wrapId   = type === 'fitness' ? 'fitness-player-selector'  : 'mech-player-selector';
    const sel = document.getElementById(selId);
    sel.innerHTML = rows.map((r, i) => {
      const nameMeta = metaMap.find(m => m.metaKey === 'name');
      const dateMeta = metaMap.find(m => m.metaKey === 'date');
      const nm = nameMeta ? (r[nameMeta.idx] || `Row ${i+1}`) : `Row ${i+1}`;
      const dt = dateMeta ? r[dateMeta.idx] : '';
      return `<option value="${i}">${nm}${dt ? ' · ' + dt : ''}</option>`;
    }).join('');
    sel.value = '0';
    document.getElementById(wrapId).classList.remove('hidden');
  }
  applyRow(type, 0);
}

function hidePlayerSelector(type) {
  const wrapId = type === 'fitness' ? 'fitness-player-selector' : 'mech-player-selector';
  const el = document.getElementById(wrapId);
  if (el) el.classList.add('hidden');
}

// 와이드 한 행 적용 (변수 + 메타 + 요약)
function applyRow(type, rowIdx) {
  const cache = WIDE_CSV_CACHE[type];
  if (!cache) return;
  const { rows, colMap, metaMap, ignored } = cache;
  if (rowIdx < 0 || rowIdx >= rows.length) return;
  const row = rows[rowIdx];

  // 1) 변수 적용 (해당 type만 초기화 후 채우기)
  CURRENT_INPUT[type] = {};
  const loaded = {};
  for (const { idx, cohortKey } of colMap) {
    const v = parseFloat(row[idx]);
    if (!isNaN(v)) {
      CURRENT_INPUT[type][cohortKey] = v;
      loaded[cohortKey] = v;
    }
  }

  // 2) 메타 → Step 1 자동 입력
  // fitness CSV는 항상 덮어쓰고, mechanics CSV는 비어있는 경우에만 채움 (fitness가 우선)
  const overwrite = (type === 'fitness');
  const metaApplied = {};
  for (const { idx, metaKey } of metaMap) {
    const raw = row[idx];
    if (!raw) continue;
    if (metaKey === 'name') {
      const el = document.getElementById('player-name');
      if (overwrite || !el.value || el.value === '신규 선수') { el.value = raw; metaApplied.name = raw; }
    } else if (metaKey === 'date') {
      const el = document.getElementById('player-date');
      const iso = parseDateFlex(raw);
      if (overwrite || !el.value) { el.value = iso; metaApplied.date = iso; }
    } else if (metaKey === 'velocity') {
      const el = document.getElementById('player-velo');
      const v = parseFloat(raw);
      if (!isNaN(v) && (overwrite || !el.value)) { el.value = v; metaApplied.velocity = v; }
    }
  }

  const sourceLabel = rows.length > 1
    ? `와이드 포맷 (${rows.length}명 중 ${rowIdx+1}번째)`
    : '와이드 포맷';
  renderUploadStatus(type, { meta: metaApplied, loaded, ignored, sourceLabel });
}

// 셀렉터 onchange
function selectPlayerFromCsv(rowIdx) { applyRow('fitness', parseInt(rowIdx, 10)); }
function selectMechanicsPlayerFromCsv(rowIdx) { applyRow('mechanics', parseInt(rowIdx, 10)); }

// 업로드 결과 카드 렌더 (type별)
function renderUploadStatus(type, { meta, loaded, ignored, sourceLabel }) {
  const ids = type === 'fitness'
    ? { empty: 'fitness-empty-state', status: 'fitness-upload-status', summary: 'fitness-upload-summary', table: 'fitness-loaded-table' }
    : { empty: 'mech-empty-state',    status: 'mech-upload-status',    summary: 'mech-upload-summary',    table: 'mech-loaded-table' };

  document.getElementById(ids.empty).classList.add('hidden');
  document.getElementById(ids.status).classList.remove('hidden');
  const summary = document.getElementById(ids.summary);
  const tableDiv = document.getElementById(ids.table);

  // 메타 (이름·날짜·구속) 표시
  const metaBits = [];
  if (meta.name)             metaBits.push(`<strong>${meta.name}</strong>`);
  if (meta.date)             metaBits.push(meta.date);
  if (meta.velocity != null) metaBits.push(`측정 ${meta.velocity} km/h`);

  // type별 카운트
  let countLine = '';
  let cats = [];
  if (type === 'fitness') {
    const fitC = COHORT.fitness_cats.reduce((a,c) => a + (COHORT.category_vars[c]||[]).filter(v => loaded[v[0]]!=null).length, 0);
    const ctrlC = COHORT.control_cats.reduce((a,c) => a + (COHORT.category_vars[c]||[]).filter(v => loaded[v[0]]!=null).length, 0);
    countLine = `· 체력 변수 <strong>${fitC}개</strong>${ctrlC ? `, 제구 변수 <strong>${ctrlC}개</strong>` : ''} 적용`;
    cats = [...COHORT.fitness_cats, ...COHORT.control_cats];
  } else {
    const mC = COHORT.mechanics_cats.reduce((a,c) => a + (COHORT.category_vars[c]||[]).filter(v => loaded[v[0]]!=null).length, 0);
    const pC = COHORT.control_cats.reduce((a,c) => a + (COHORT.category_vars[c]||[]).filter(v => loaded[v[0]]!=null).length, 0);
    const phase2 = COHORT.mechanics_cats.reduce((a,c) => a + (COHORT.category_vars[c]||[]).filter(v => !COHORT.var_distributions[v[0]]).length, 0);
    countLine = `· 메카닉 변수 <strong>${mC}개</strong>${pC ? `, 제구 변수 <strong>${pC}개</strong>` : ''} 적용 (Phase 2 변수 ${phase2}개는 자동 제외)`;
    cats = [...COHORT.mechanics_cats, ...COHORT.control_cats];
  }

  summary.innerHTML = `
    ✅ <strong>${sourceLabel}</strong> 로드 완료
    ${metaBits.length ? `<br>· ${metaBits.join(' · ')}` : ''}
    <br>${countLine}
    ${ignored.length ? `<br>· 무시된 컬럼 ${ignored.length}개: <span class="mono text-[11px] text-[var(--text-muted)]">${ignored.slice(0,8).join(', ')}${ignored.length>8?' …':''}</span>` : ''}
  `;

  let html = '<table class="preview-table"><thead><tr><th>카테고리</th><th>변수</th><th class="text-right">값</th><th>단위</th></tr></thead><tbody>';
  for (const cat of cats) {
    const meta2 = COHORT.category_meta[cat] || {};
    for (const v of (COHORT.category_vars[cat] || [])) {
      const [key, name, unit, dec] = v;
      if (loaded[key] == null) continue;
      const val = loaded[key];
      const decN = dec != null ? dec : 2;
      html += `<tr>
        <td class="text-[var(--text-muted)]">${cat.split('_')[0]} ${meta2.name||''}</td>
        <td>${name}</td>
        <td class="text-right mono">${(typeof val === 'number' ? val.toFixed(decN) : val)}</td>
        <td class="text-[var(--text-muted)]">${unit || ''}</td>
      </tr>`;
    }
  }
  html += '</tbody></table>';
  tableDiv.innerHTML = html;
}

function clearInputs(type) {
  CURRENT_INPUT[type] = {};
  WIDE_CSV_CACHE[type] = null;
  const ids = type === 'fitness'
    ? { empty: 'fitness-empty-state', status: 'fitness-upload-status', sel: 'fitness-player-selector' }
    : { empty: 'mech-empty-state',    status: 'mech-upload-status',    sel: 'mech-player-selector' };
  const sel = document.getElementById(ids.sel);
  const status = document.getElementById(ids.status);
  const empty = document.getElementById(ids.empty);
  if (sel) sel.classList.add('hidden');
  if (status) status.classList.add('hidden');
  if (empty) empty.classList.remove('hidden');
}

// ── 드래그앤드롭 ─────────────────────────────────────────────────
function setupDropZone(zoneId, type) {
  const zone = document.getElementById(zoneId);
  if (!zone) return;
  ['dragover', 'dragenter'].forEach(evt => {
    zone.addEventListener(evt, (e) => {
      e.preventDefault(); e.stopPropagation();
      zone.classList.add('dragover');
    });
  });
  ['dragleave', 'dragend'].forEach(evt => {
    zone.addEventListener(evt, (e) => {
      e.preventDefault(); e.stopPropagation();
      zone.classList.remove('dragover');
    });
  });
  zone.addEventListener('drop', (e) => {
    e.preventDefault(); e.stopPropagation();
    zone.classList.remove('dragover');
    const allFiles = e.dataTransfer && e.dataTransfer.files;
    if (!allFiles || allFiles.length === 0) return;
    const allArr = Array.from(allFiles);
    // xlsx 파일은 fitness 영역에서만 처리
    const xlsxFiles = allArr.filter(f => /\.(xlsx|xls)$/i.test(f.name));
    const csvFiles  = allArr.filter(f => f.name.toLowerCase().endsWith('.csv'));
    if (xlsxFiles.length > 0 && type === 'fitness') {
      handleMasterXlsxUpload(xlsxFiles[0]);
      return;
    }
    if (csvFiles.length === 0) {
      alert('CSV 또는 xlsx 파일이 없습니다.');
      return;
    }
    handleCsvUpload({ target: { files: csvFiles, value: '' } }, type);
  });
}

// ★ fitness 영역 통합 업로드 핸들러 (csv + xlsx 모두 받음, 2026-05-03)
function handleFitnessUploadAny(event) {
  const files = event.target.files;
  if (!files || files.length === 0) return;
  const file = files[0];
  if (/\.(xlsx|xls)$/i.test(file.name)) {
    handleMasterXlsxUpload(file);
    event.target.value = '';
    return;
  }
  // 일반 CSV는 기존 로직
  handleCsvUpload(event, 'fitness');
}

// ★ 마스터 xlsx 파일 처리 (2026-05-03) — 134명 × H1/H2 데이터
//   업로드 시 선수+세션 선택 모달 → 선택된 행을 와이드 CSV로 변환해 기존 처리 재사용
function handleMasterXlsxUpload(file) {
  if (typeof XLSX === 'undefined') {
    alert('xlsx 라이브러리가 로드되지 않았습니다. 페이지를 새로고침하고 다시 시도해주세요.');
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: null });
      if (rows.length === 0) {
        alert('xlsx 파일이 비어 있습니다.');
        return;
      }
      // localStorage에 마스터 DB 저장 (다음에 자동 로드)
      try { localStorage.setItem('bbl_master_fitness', JSON.stringify(rows)); } catch (err) {}
      showMasterXlsxPicker(rows);
    } catch (err) {
      console.error('xlsx 처리 오류:', err);
      alert('xlsx 파일을 읽지 못했습니다.\n' + (err.message || err));
    }
  };
  reader.readAsArrayBuffer(file);
}

// ★ 선수 선택 모달
function showMasterXlsxPicker(rows) {
  // 기존 모달 제거
  const old = document.getElementById('master-xlsx-picker');
  if (old) old.remove();

  // 헤더 키들 (첫 행에서 추출)
  const cols = Object.keys(rows[0]);
  const playerIdKey = cols.find(c => /player[_\s]?id/i.test(c)) || cols.find(c => /^id$/i.test(c)) || 'Player_ID';
  const sessionKey  = cols.find(c => /session/i.test(c)) || 'Session';
  const nameKey     = cols.find(c => /^name$/i.test(c)) || 'Name';
  const dateKey     = cols.find(c => /^date$/i.test(c)) || 'Date';
  const veloKey     = cols.find(c => /max\s*velocity/i.test(c)) || 'Max Velocity';

  // 모달 HTML
  const modal = document.createElement('div');
  modal.id = 'master-xlsx-picker';
  modal.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.7); z-index:10000; display:flex; align-items:center; justify-content:center;';
  modal.innerHTML = `
    <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:8px; padding:24px; max-width:600px; width:90%; max-height:80vh; display:flex; flex-direction:column;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <div class="display text-lg" style="color:#60a5fa;">📊 마스터 파일에서 선수 선택</div>
        <button onclick="document.getElementById('master-xlsx-picker').remove()" style="background:transparent; border:none; color:var(--text-muted); font-size:24px; cursor:pointer;">×</button>
      </div>
      <div class="text-xs text-[var(--text-muted)] mb-3">총 <strong>${rows.length}</strong>개 측정 인식. 분석할 선수와 세션을 선택하세요.</div>
      <input type="text" id="master-xlsx-search" placeholder="선수명 또는 ID 검색..." class="input-field mb-3" oninput="_filterMasterXlsxList()">
      <div id="master-xlsx-list" style="flex:1; overflow-y:auto; border:1px solid var(--border); border-radius:4px;">
        ${rows.map((r, i) => {
          const pid = r[playerIdKey] || '';
          const ses = r[sessionKey] || '';
          const nm  = r[nameKey] || '';
          const dt  = r[dateKey] || '';
          const v   = r[veloKey] != null ? r[veloKey] : '—';
          const veloStr = (typeof v === 'number') ? v.toFixed(1) : v;
          return `<div class="master-row" data-search="${(nm + ' ' + pid).toLowerCase()}"
                       onclick="_selectMasterXlsxRow(${i})"
                       style="padding:10px 14px; border-bottom:1px solid var(--border); cursor:pointer; display:flex; justify-content:space-between; gap:10px;">
            <div>
              <div class="text-sm font-medium">${nm}</div>
              <div class="text-[10px] text-[var(--text-muted)] mono">${pid} · ${ses} · ${dt}</div>
            </div>
            <div class="text-sm" style="color:var(--accent);">${veloStr} <span class="text-[10px] text-[var(--text-muted)]">km/h</span></div>
          </div>`;
        }).join('')}
      </div>
      <div class="text-[10px] text-[var(--text-muted)] mt-2">팁: 마스터 DB는 브라우저에 저장되어 다음 방문 시 자동 로드됩니다.</div>
    </div>
  `;
  document.body.appendChild(modal);
  // hover 효과
  modal.querySelectorAll('.master-row').forEach(el => {
    el.addEventListener('mouseenter', () => el.style.background = 'rgba(96,165,250,0.05)');
    el.addEventListener('mouseleave', () => el.style.background = '');
  });
  // 데이터 임시 저장
  window._MASTER_XLSX_ROWS = rows;
}

function _filterMasterXlsxList() {
  const q = (document.getElementById('master-xlsx-search').value || '').toLowerCase();
  document.querySelectorAll('#master-xlsx-list .master-row').forEach(el => {
    el.style.display = el.dataset.search.includes(q) ? '' : 'none';
  });
}

function _selectMasterXlsxRow(idx) {
  const row = window._MASTER_XLSX_ROWS && window._MASTER_XLSX_ROWS[idx];
  if (!row) return;
  // 선택된 행을 와이드 CSV 형식 텍스트로 변환 (header + 1 data row)
  const cols = Object.keys(row);
  const headerLine = cols.map(c => `"${c}"`).join(',');
  const valueLine  = cols.map(c => {
    const v = row[c];
    if (v == null) return '';
    return /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g,'""')}"` : String(v);
  }).join(',');
  const csvText = headerLine + '\n' + valueLine;
  // 모달 닫고 기존 와이드 CSV 처리 호출
  document.getElementById('master-xlsx-picker').remove();
  // virtual file 만들어 handleCsvUpload 재사용
  const blob = new Blob([csvText], { type: 'text/csv' });
  const file = new File([blob], 'master_selected.csv', { type: 'text/csv' });
  handleCsvUpload({ target: { files: [file], value: '' } }, 'fitness');
}

// 페이지 로드 시 마스터 DB 자동 로드 (이전 업로드한 게 있으면)
function _autoLoadMasterDB() {
  try {
    const saved = localStorage.getItem('bbl_master_fitness');
    if (saved) {
      const rows = JSON.parse(saved);
      if (Array.isArray(rows) && rows.length > 0) {
        // 자동 모달 X — 사용자가 명시적으로 트리거할 때만 표시
        // 대신 fitness dropzone에 작은 힌트 표시
        const zone = document.getElementById('fitness-drop-zone');
        if (zone) {
          const hint = document.createElement('div');
          hint.style.cssText = 'margin-top:6px; font-size:10px; color:#60a5fa; cursor:pointer;';
          hint.innerHTML = `📊 저장된 마스터 DB(${rows.length}개) — <span style="text-decoration:underline;" onclick="showMasterXlsxPicker(JSON.parse(localStorage.getItem('bbl_master_fitness'))); event.stopPropagation();">선수 선택</span>`;
          zone.parentElement.appendChild(hint);
        }
      }
    }
  } catch (e) {}
}

// 외부 영역에 파일이 떨어져 navigation 되는 것을 방지
['dragover', 'drop'].forEach(evt => {
  document.addEventListener(evt, (e) => {
    if (!e.target.closest || !e.target.closest('.file-drop')) e.preventDefault();
  });
});


// 카테고리 아코디언 — 헤더(이름·점수) → 변인별 점수 → 의미·해석·코칭·근거
function renderCategoryAccordion(catId, varScores, catScore) {
  const d = CATEGORY_DETAILS[catId];
  if (!d) return '';
  const vars = (COHORT.category_vars[catId] || []);
  const seen = new Set();
  const catColor = scoreColor(catScore);

  // 변인별 점수 행
  const varRows = vars.filter(v => !seen.has(v[0]) && (seen.add(v[0]), true)).map(v => {
    const [key, name, unit, dec, polarity] = v;
    const score = varScores[key];
    const inputVal = (CURRENT_INPUT.fitness[key] != null) ? CURRENT_INPUT.fitness[key] : CURRENT_INPUT.mechanics[key];
    const decN = dec != null ? dec : 2;
    let rawStr = inputVal != null ? Number(inputVal).toFixed(decN) + (unit ? ' ' + unit : '') : '—';
    // ★ 시퀀싱 변수 특별 표시 (UI 라벨 분리, 2026-05-03)
    if (key === 'proper_sequence_pct' && inputVal != null) {
      const xn = CURRENT_INPUT.mechanics?._proper_seq_x_of_n;
      rawStr = Math.round(inputVal) + '%' + (xn ? ` (${xn} trial)` : '');
    }
    if (key === 'proper_sequence' && inputVal != null) {
      rawStr = (Number(inputVal) >= 0.5) ? '✓ 충족' : '✗ 미충족';
    }
    // ★ 코호트 분포 비교 (2026-05-03 A4) — raw 값 옆에 q25/median/q75 표시
    let cohortInfo = '';
    const dist = COHORT.var_distributions?.[key];
    if (dist && inputVal != null) {
      const fmt = (v) => Number(v).toFixed(decN);
      // 정예준 raw 값이 코호트 어디에 위치하는지 직관 표시
      let pos = '평균';
      if (inputVal < dist.q25) pos = '하위25↓';
      else if (inputVal < dist.median) pos = '중앙↓';
      else if (inputVal < dist.q75) pos = '중앙↑';
      else pos = '상위25↑';
      cohortInfo = `<div class="text-[9px] text-[var(--text-muted)] mt-0.5" style="font-family:'JetBrains Mono',monospace;" title="코호트 ${dist.n}명 분포">코호트 q25/q50/q75: ${fmt(dist.q25)}/${fmt(dist.median)}/${fmt(dist.q75)} · <span style="color:#9ca3af;">${pos}</span></div>`;
    }
    const scoreStr = score != null ? Math.round(score) : '—';
    const w = score != null ? Math.max(0, Math.min(100, score)) : 0;
    const vColor = scoreColor(score);
    const dirIndicator = polarity === 'lower' ? ' <span style="opacity:0.5">↓</span>' : '';
    // ★ Plausibility 배지 (2026-05-03)
    const implBadge = (typeof IMPLAUSIBLE_VARS !== 'undefined' && IMPLAUSIBLE_VARS.has(key))
      ? ` <span style="background:#fbbf24;color:#0a0b0d;font-size:9px;padding:1px 5px;border-radius:3px;margin-left:4px;font-weight:700;" title="비상식적 raw 값 → 결측 보정 50점">결측 보정</span>`
      : '';
    // ★ Trial-N 배지 (2026-05-03) — 변수별 사용 trial 수 + n 부족 경고
    const tCounts  = CURRENT_INPUT.mechanics?._trial_counts;
    const tTotal   = CURRENT_INPUT.mechanics?._num_trials_total;
    const usedN    = tCounts?.[key];
    const isSdVar  = key.includes('_sd_') || key.endsWith('_sd_ms') || key.endsWith('_sd_deg') || key.endsWith('_sd_cm');
    let trialBadge = '';
    if (usedN != null && tTotal != null && tTotal > 1) {
      const lowN = (isSdVar && usedN < 5) || (!isSdVar && usedN < 3);
      const bg   = lowN ? '#f87171' : '#374151';
      const fg   = lowN ? '#0a0b0d' : '#9ca3af';
      const lab  = lowN ? `n=${usedN}/${tTotal} 부족` : `n=${usedN}/${tTotal}`;
      const tip  = lowN
        ? `사용된 trial 수가 적어 추정치 신뢰도 낮음 (SD는 n≥5, 평균은 n≥3 권장)`
        : `이 변수에 실제 사용된 trial 수`;
      trialBadge = ` <span style="background:${bg};color:${fg};font-size:9px;padding:1px 5px;border-radius:3px;margin-left:4px;font-family:'JetBrains Mono',monospace;" title="${tip}">${lab}</span>`;
    }
    const ctxShort = scoreContextShort(score);
    const ctxColor = score >= 60 ? '#9ca3af' : score >= 40 ? '#5f636b' : '#fbbf24';
    return `
      <div class="var-row-v29">
        <div>
          <div class="var-name">${name}${dirIndicator}${implBadge}${trialBadge}</div>
          <div class="var-desc">${key}</div>
        </div>
        <div class="var-raw">${rawStr}${cohortInfo}</div>
        <div class="var-score">
          <div class="var-mini-bar"><div class="var-mini-bar-fill" style="width:${w}%; background:${vColor}"></div></div>
          <span class="cat-mini-score" style="color:${vColor}">${scoreStr}</span>
          ${ctxShort ? `<span style="font-size:9px;color:${ctxColor};margin-left:4px;font-weight:500;">${ctxShort}</span>` : ''}
        </div>
      </div>`;
  }).join('');

  const interpRows = (d.interpretation || []).map(([range, text]) =>
    `<tr><td>${range}</td><td>${text}</td></tr>`
  ).join('');

  // ★ Contextual 해석 (2026-05-03) — C3/C5 시너지 패턴 인식
  let contextNote = '';
  const _ctxInputs = CURRENT_INPUT.mechanics || {};
  if (catId === 'C3_TrunkPower') {
    const trunkVel = _ctxInputs['max_trunk_twist_vel_dps'];
    const speedup  = _ctxInputs['arm_trunk_speedup'];
    const trunkFlexVel = _ctxInputs['trunk_flex_vel_max'];
    const speedupScore = varScores['arm_trunk_speedup'];
    if (trunkVel != null && trunkVel < 950 && speedupScore != null && speedupScore >= 85) {
      contextNote = `<div style="background:rgba(74,222,128,0.08);border-left:3px solid #4ade80;padding:8px 12px;margin-top:8px;border-radius:3px;font-size:12px;line-height:1.6;">
        💡 <strong style="color:#4ade80;">시너지 인사이트</strong>: 회전 속도(${trunkVel.toFixed(0)} °/s)는 평균 수준이지만 <strong>몸통→팔 에너지 전달 비율(${speedup?.toFixed(2)})</strong>이 매우 우수합니다.
        ${trunkFlexVel != null && trunkFlexVel >= 600 ? `또한 <strong>몸통 굴곡 속도(${trunkFlexVel.toFixed(0)} °/s)</strong>가 회전 부족분을 보완합니다. ` : ''}
        이 패턴은 약점이 아니라 <strong>"효율 타입" 엘리트의 특징</strong>이며 제구 안정성에 유리합니다.
      </div>`;
    }
  }
  if (catId === 'C5_Sequencing') {
    const speedup = _ctxInputs['arm_trunk_speedup'];
    const speedupScore = varScores['arm_trunk_speedup'];
    const properSeq = _ctxInputs['proper_sequence'];
    if (speedupScore != null && speedupScore >= 85 && properSeq === 1) {
      contextNote = `<div style="background:rgba(74,222,128,0.08);border-left:3px solid #4ade80;padding:8px 12px;margin-top:8px;border-radius:3px;font-size:12px;line-height:1.6;">
        ⚡ <strong style="color:#4ade80;">에너지 전달 우수</strong>: speedup ${speedup?.toFixed(2)} (elite 1.8~2.2)은 <strong>몸통의 회전 에너지를 거의 손실 없이 팔로 전달</strong>한다는 의미입니다.
        시퀀싱 충족률 100%와 결합되어 <strong>구속의 진짜 원천</strong>이 됩니다.
      </div>`;
    }
  }

  return `
    <div class="accordion-card" data-cat="${catId}">
      <div class="accordion-header" onclick="this.parentElement.classList.toggle('open')">
        <div class="flex-1">
          <div class="flex items-center gap-3">
            <div class="text-sm font-bold">${d.name}</div>
            <div class="cat-mini-score" style="color:${catColor}">${catScore != null ? Math.round(catScore) : '—'}점</div>
            ${catScore != null ? `<div class="text-[10px]" style="color:${catColor};opacity:0.85;font-weight:500;">${scoreContext(catScore)}</div>` : ''}
          </div>
          <div class="mono text-[10px] text-[var(--text-muted)] mt-1">${d.short_desc || ''}</div>
        </div>
        <span class="accordion-icon">▶</span>
      </div>
      <div class="accordion-content">
        <div class="accordion-body">
          ${varRows ? `
          <div class="mb-4">
            <div class="mono text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-2">세부 변수 점수 (코호트 백분위)</div>
            ${varRows}
          </div>` : ''}
          <div class="mb-3">
            <div class="mono text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-1">의미</div>
            <div class="text-xs text-[var(--text-secondary)] leading-relaxed">${d.meaning || ''}</div>
          </div>
          ${d.method ? `
          <div class="mb-3">
            <div class="mono text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-1">산출 방식</div>
            <div class="text-xs text-[var(--text-secondary)] leading-relaxed">${d.method}</div>
          </div>` : ''}
          ${interpRows ? `
          <div class="mb-3">
            <div class="mono text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-1">점수 해석</div>
            <table class="interp-table"><tbody>${interpRows}</tbody></table>
          </div>` : ''}
          ${contextNote}
          ${d.coaching ? `
          <div class="mb-3">
            <div class="mono text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-1">코칭 포인트</div>
            <div class="text-xs text-[var(--text-secondary)] leading-relaxed">${d.coaching}</div>
          </div>` : ''}
          ${d.reference ? `
          <div>
            <div class="mono text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-1">학술 근거</div>
            <div class="mono text-[10px] text-[var(--text-muted)]">${d.reference}</div>
          </div>` : ''}
        </div>
      </div>
    </div>`;
}

// ════════════════════════════════════════════════════════════════════
// Driveline 5각형 메카닉 매핑 (v29 일치)
// ════════════════════════════════════════════════════════════════════
const DRIVELINE_5_ORDER = ['Posture', 'Block', 'Rotation', 'Arm Action', 'CoG'];
const DRIVELINE_5_LABELS_KO = {
  'Posture':    'Posture · 자세',
  'Block':      'Block · 앞다리 블록',
  'Rotation':   'Rotation · 회전',
  'Arm Action': 'Arm Action · 팔 동작',
  'CoG':        'CoG · 무게중심',
};
// 각 카테고리 → BBL 메카닉 변수 키 매핑 (PPTX 9페이지 갱신)
// [v33.10] D등급 변수 카테고리에서 제거: peak_torso_counter_rot, stride_norm_height, shoulder_h_abd_at_fc
//   Theia/Qualisys 비교에서 ICC <0.13 또는 정의 평면 차이로 신뢰 어려움 확인
const DRIVELINE_5_CATS = {
  'Posture':    ['trunk_rotation_at_fc', 'hip_shoulder_sep_at_fc',
                 'trunk_forward_tilt_at_fc',
                 'torso_side_bend_at_mer', 'torso_rotation_at_br'],
  'Block':      ['lead_knee_ext_change_fc_to_br', 'lead_knee_ext_vel_max'],
  'Rotation':   ['max_pelvis_rot_vel_dps', 'max_trunk_twist_vel_dps'],
  'Arm Action': ['max_shoulder_ER_deg',
                 'elbow_ext_vel_max', 'shoulder_ir_vel_max'],  // 'elbow_flexion_at_fp' 제거 v31.25
  'CoG':        ['com_decel_pct', 'max_cog_velo'],
};

// PPTX 9페이지 — 몸통 회전 속도(=1.00) 기준 상대적 중요도
// [v33.10] D등급 변수 가중치 제거 (peak_torso_counter_rot, stride_norm_height, shoulder_h_abd_at_fc)
const DRIVELINE_5_WEIGHTS = {
  'Posture': {
    'trunk_rotation_at_fc':       0.35,
    'hip_shoulder_sep_at_fc':     0.44,
    'trunk_forward_tilt_at_fc':   0.36,
    'torso_side_bend_at_mer':     0.26,
    'torso_rotation_at_br':       0.25,
  },
  'Block': {
    'lead_knee_ext_change_fc_to_br':   0.58,
    'lead_knee_ext_vel_max':           0.19,
  },
  'Rotation': {
    'max_pelvis_rot_vel_dps':  0.27,
    'max_trunk_twist_vel_dps': 1.00,
  },
  'Arm Action': {
    'max_shoulder_ER_deg':   0.86,
    'elbow_ext_vel_max':     0.56,
    'shoulder_ir_vel_max':   0.36,
  },
  'CoG': {
    'com_decel_pct':  0.70,
    'max_cog_velo':   0.29,
  },
};

// 변수별 백분위 점수에서 Driveline 5 카테고리 점수 산출 (가중 평균)
function drivelineFiveCatScores(varScores) {
  const out = {};
  for (const cat of DRIVELINE_5_ORDER) {
    const keys = DRIVELINE_5_CATS[cat] || [];
    const weights = DRIVELINE_5_WEIGHTS[cat] || {};
    let weightedSum = 0, totalWeight = 0;
    for (const k of keys) {
      const score = varScores[k];
      if (score != null && !isNaN(score)) {
        const w = weights[k] != null ? weights[k] : 1;
        weightedSum += score * w;
        totalWeight += w;
      }
    }
    out[cat] = totalWeight > 0 ? weightedSum / totalWeight : null;
  }
  return out;
}

// 메카닉 차트 모드 토글
let MECH_VIEW_MODE = '6';  // '6' = BBL 6각형, '5' = Driveline 5각형
let CURRENT_REPORT_RESULT = null;  // setMechMode가 메카닉 카드를 재렌더하기 위해 보관

const DRIVELINE_5_DETAILS = {
  'Posture': { name: 'Posture · 자세', short_desc: 'FC 시점 정렬 + X-Factor',
    meaning: 'Foot Plant 시점에서의 몸통/골반/어깨 정렬과 회전 자세. 강한 와인드업과 X-Factor 형성의 기반. Flying open(몸통이 일찍 열리는 현상) 방지가 핵심.',
    method: '몸통 회전 절대값(닫힘 정도), Hip-Shoulder Sep, Forward Tilt 등 자세 변수의 코호트 백분위 평균.',
    coaching: 'FC 시점 몸통 닫힘 비디오 피드백, X-Factor 인식 메디신볼 회전, 와인드업 정렬 드릴' },
  'Block': { name: 'Block · 앞다리 블록', short_desc: '앞다리 신전 + Stride',
    meaning: 'Stride 길이와 앞다리 무릎 신전. 착지 후 회전 사슬에 에너지를 전달하는 블로킹 효율을 결정.',
    method: 'Lead Knee Extension Velo, Stride Length, FC→BR 신전량의 코호트 백분위 평균.',
    coaching: '드롭 점프, 한 다리 SSC 점프(plyometric), 앞다리 강화 + 블로킹 안정성 드릴' },
  'Rotation': { name: 'Rotation · 회전', short_desc: '몸통·골반 회전 속도',
    meaning: '몸통 회전 속도가 가장 강력한 구속 결정 요인 (Driveline 중요도 1.00 · 1mph ≈ 40°/s).',
    method: 'Torso Rotation Velo + Pelvis Rotation Velo의 코호트 백분위 평균.',
    coaching: '메디신볼 회전 던지기, 분절 회전 드릴, 코어 회전 가속 훈련' },
  'Arm Action': { name: 'Arm Action · 팔 동작', short_desc: 'MER · Layback · 팔 가속',
    meaning: 'Layback(MER), Elbow Extension Velo, Shoulder Abduction 등 팔의 가속·릴리스 동작.',
    method: 'Layback, Elbow Ext Velo, Shoulder Abd, Scap Load, Shoulder IR Velo 등의 백분위 평균.',
    coaching: '어깨 외회전 모빌리티, Sleeper Stretch, 견갑골 안정화, 팔 가속 드릴' },
  'CoG': { name: 'CoG · 무게중심', short_desc: 'COM 가속/감속',
    meaning: '무게중심의 전후방 가속(Max CoG Velo)과 착지 시 감속(CoG Decel). 운동량 전환 효율의 지표.',
    method: 'CoG Decel, Max CoG Velo의 코호트 백분위 평균.',
    coaching: 'COM 전진 속도 향상 스트라이드 파워, 앞다리 블로킹으로 COM 감속 효율 ↑' },
};

function setMechMode(mode) {
  MECH_VIEW_MODE = mode;
  if (!CURRENT_REPORT_RESULT) {
    // 리포트 미생성 — 토글만 시각적으로 활성
    document.querySelectorAll('.mech-mode-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('mech-mode-' + mode)?.classList.add('active');
    return;
  }
  // 메카닉 카드 전체를 새 모드로 재렌더
  const card = document.getElementById('mech-section-card');
  if (card) card.innerHTML = renderMechCardInner(CURRENT_REPORT_RESULT, mode);
  // 차트 데이터 캐시도 같이 갱신 (다운로드 HTML이 정확히 반영되도록)
  if (window.__BBL_RADAR_DATA__) {
    const mechData = window.__BBL_RADAR_DATA__.find(d => d && d.isMechanics);
    // 메카닉 데이터는 변하지 않음 (양쪽 데이터 다 들어있음) — 그냥 차트 재렌더
  }
  renderRadarCharts();
}

// ════════════════════════════════════════════════════════════════════
// 코칭 세션 — 동영상 + 키네매틱 시퀀스 + 키네틱 체인 시각화
// ════════════════════════════════════════════════════════════════════
const COACH_VIDEO_SAMPLES = [
  { key: 'hong',  label: '홍 (sample)',  url: 'https://raw.githubusercontent.com/kkl0511/BBL_Pitching_Report1/main/assets/hong.mp4'  },
  { key: 'jeong', label: '정 (sample)',  url: 'https://raw.githubusercontent.com/kkl0511/BBL_Pitching_Report1/main/assets/jeong.mp4' },
  { key: 'kim',   label: '김 (sample)',  url: 'https://raw.githubusercontent.com/kkl0511/BBL_Pitching_Report1/main/assets/kim.mp4'   },
  { key: 'kwon',  label: '권 (sample)',  url: 'https://raw.githubusercontent.com/kkl0511/BBL_Pitching_Report1/main/assets/kwon.mp4'  },
];
const COACH_VIDEO_FPS = 240;  // 기본 fps (Uplift 표준 240 Hz, 사용자 변경 가능)
const COACH_VIDEO_DEFAULT_SPEED = 0.1;  // 기본 배속 (슬로우 분석용)

function _showVideoElement() {
  const v = document.getElementById('coach-video');
  const drop = document.getElementById('coach-video-drop');
  if (v) v.classList.remove('hidden');
  if (drop) drop.classList.add('hidden');
}
function _applyDefaultSpeed() {
  const v = document.getElementById('coach-video');
  if (!v) return;
  // 메타데이터 로드 후 디폴트 배속 적용
  const apply = () => {
    v.playbackRate = COACH_VIDEO_DEFAULT_SPEED;
    document.querySelectorAll('.video-speed-btn').forEach(b =>
      b.classList.toggle('active', parseFloat(b.dataset.rate) === COACH_VIDEO_DEFAULT_SPEED));
  };
  if (v.readyState >= 1) apply();
  else v.addEventListener('loadedmetadata', apply, { once: true });
}
function loadVideoSample(key) {
  const sample = COACH_VIDEO_SAMPLES.find(s => s.key === key);
  if (!sample) return;
  const v = document.getElementById('coach-video');
  if (!v) return;
  v.src = sample.url;
  v.load();
  _showVideoElement();
  _applyDefaultSpeed();
}
function loadVideoLocal(event) {
  const file = (event.target && event.target.files && event.target.files[0]) || null;
  if (!file) return;
  const v = document.getElementById('coach-video');
  if (!v) return;
  v.src = URL.createObjectURL(file);
  v.load();
  _showVideoElement();
  _applyDefaultSpeed();
}
function loadVideoFile(file) {
  if (!file) return;
  if (!file.type.startsWith('video/')) {
    alert('비디오 파일만 지원합니다 (.mp4 .mov .webm 등).');
    return;
  }
  const v = document.getElementById('coach-video');
  if (!v) return;
  v.src = URL.createObjectURL(file);
  v.load();
  _showVideoElement();
  _applyDefaultSpeed();
}
// 드래그앤드롭 + 영상 영역 초기화 (리포트 렌더 후 호출)
function setupCoachVideoDropZone() {
  const zone = document.getElementById('coach-video-drop');
  if (!zone) return;
  ['dragover', 'dragenter'].forEach(evt => {
    zone.addEventListener(evt, (e) => {
      e.preventDefault(); e.stopPropagation();
      zone.classList.add('dragover');
    });
  });
  ['dragleave', 'dragend'].forEach(evt => {
    zone.addEventListener(evt, (e) => {
      e.preventDefault(); e.stopPropagation();
      zone.classList.remove('dragover');
    });
  });
  zone.addEventListener('drop', (e) => {
    e.preventDefault(); e.stopPropagation();
    zone.classList.remove('dragover');
    const file = e.dataTransfer && e.dataTransfer.files[0];
    loadVideoFile(file);
  });
}
function clearCoachVideo() {
  const v = document.getElementById('coach-video');
  const drop = document.getElementById('coach-video-drop');
  if (v) {
    if (v.src && v.src.startsWith('blob:')) URL.revokeObjectURL(v.src);
    v.removeAttribute('src');
    v.load();
    v.classList.add('hidden');
  }
  if (drop) drop.classList.remove('hidden');
}
function setVideoSpeed(rate) {
  const v = document.getElementById('coach-video');
  if (!v) return;
  v.playbackRate = rate;
  document.querySelectorAll('.video-speed-btn').forEach(b => b.classList.toggle('active', parseFloat(b.dataset.rate) === rate));
}
function videoFrameStep(direction) {
  const v = document.getElementById('coach-video');
  if (!v) return;
  v.pause();
  const fpsInput = parseFloat(document.getElementById('coach-video-fps')?.value);
  const fps = !isNaN(fpsInput) && fpsInput > 0 ? fpsInput : COACH_VIDEO_FPS;
  const dt = 1 / fps;
  v.currentTime = Math.max(0, Math.min(v.duration || 999, v.currentTime + dt * direction));
}
function videoTogglePlay() {
  const v = document.getElementById('coach-video');
  if (!v) return;
  if (v.paused) v.play(); else v.pause();
}

// 코칭 세션 HTML — 메카닉 결과 r 입력
function renderCoachSessionHtml(r) {
  const speeds = [1.0, 0.5, 0.25, 0.1];
  const speedBtns = speeds.map(s =>
    `<button class="mech-mode-btn video-speed-btn ${s===COACH_VIDEO_DEFAULT_SPEED?'active':''}" data-rate="${s}" onclick="setVideoSpeed(${s})">${s}x</button>`
  ).join('');
  const sampleBtns = COACH_VIDEO_SAMPLES.map(s =>
    `<button class="mech-mode-btn" onclick="loadVideoSample('${s.key}')">${s.label}</button>`
  ).join('');

  // 키네매틱 시퀀스 타임라인 SVG
  const seqSvg = renderKinematicSequenceSvg(r);
  // 키네틱 체인 에너지 흐름 SVG
  const chainSvg = renderKineticChainSvg(r);

  // ★ v31.22 순서 재배치 — 마네킹 → 시퀀스 → 동영상
  return `
    <section class="card p-6 mt-6" style="border-left: 4px solid var(--accent);">
      <div class="display text-xl mb-2">🎥 코칭 세션 — 메카닉 시각화</div>
      <div class="text-xs text-[var(--text-muted)] mb-4">키네틱 체인 마네킹 → 시퀀스 차트 → 동영상 순으로 데이터 → 시각 → 실제 동작을 연결해 분석합니다.</div>

      <!-- ① 키네틱 체인 에너지 흐름 (마네킹) -->
      <div class="mb-6">
        <div class="display text-base mb-1">⚡ 키네틱 체인 — 에너지 흐름</div>
        <div class="text-xs text-[var(--text-muted)] mb-3">지면 → 앞다리 → 골반 → 몸통 → 어깨 → 팔꿈치 → 손목 순으로 에너지가 전달됩니다. 색상은 해당 분절의 코호트 백분위 점수.</div>
        ${chainSvg}
      </div>

      <!-- ② 키네매틱 시퀀스 타임라인 -->
      <div class="mb-6">
        <div class="display text-base mb-1">📊 키네매틱 시퀀스 — 피크 속도 타이밍</div>
        <div class="text-xs text-[var(--text-muted)] mb-3">골반 → 몸통 → 팔 순서로 회전 속도가 정점을 찍어야 합니다. 각 단계 사이 lag은 <strong>40~50 ms</strong>가 이상적.</div>
        ${seqSvg}
      </div>

      <!-- ③ 동영상 플레이어 — 가로 전체, 크게 -->
      <div class="mb-2">
        <div class="display text-base mb-1">🎥 선수 동영상</div>
        <div class="text-xs text-[var(--text-muted)] mb-3">위 시각화 결과를 실제 폼에서 확인합니다. 0.1~0.25배속 + 프레임 이동으로 정밀 분석.</div>
        <!-- 드롭존 (영상 미로드 시 노출) -->
        <div class="file-drop" id="coach-video-drop" onclick="document.getElementById('coach-video-input').click()" style="min-height: 320px; display: flex; flex-direction: column; justify-content: center;">
          <div class="text-5xl mb-3">🎥</div>
          <div class="text-base font-medium">선수 동영상을 드래그 앤 드롭하거나 클릭해서 선택</div>
          <div class="text-xs text-[var(--text-muted)] mt-2">.mp4 .mov .webm — 또는 아래 샘플 선택</div>
          <input type="file" id="coach-video-input" accept="video/*" style="display:none;" onchange="loadVideoLocal(event)">
        </div>

        <!-- 영상 (로드 시 노출) — 큰 크기 -->
        <video id="coach-video" controls preload="metadata" class="w-full rounded hidden" style="background: #000; max-height: 720px;"></video>

        <!-- 영상 소스 선택 -->
        <div class="flex flex-wrap gap-2 mt-3 items-center">
          <span class="mono text-[10px] text-[var(--text-muted)] mr-1">SAMPLE</span>
          ${sampleBtns}
          <button class="mech-mode-btn" onclick="clearCoachVideo()" style="margin-left:auto">🗑 영상 제거</button>
        </div>

        <!-- 재생 컨트롤 -->
        <div class="flex flex-wrap gap-2 mt-2 items-center">
          <span class="mono text-[10px] text-[var(--text-muted)] mr-1">SPEED</span>
          ${speedBtns}
          <span class="mono text-[10px] text-[var(--text-muted)] ml-4 mr-1">FRAME</span>
          <button class="mech-mode-btn" onclick="videoFrameStep(-1)">◀ 1프레임</button>
          <button class="mech-mode-btn" onclick="videoTogglePlay()">▶/❚❚ 재생/정지</button>
          <button class="mech-mode-btn" onclick="videoFrameStep(+1)">1프레임 ▶</button>
          <span class="mono text-[10px] text-[var(--text-muted)] ml-2">fps</span>
          <input type="number" id="coach-video-fps" value="${COACH_VIDEO_FPS}" min="15" max="240" class="input-field" style="width:70px; padding:4px 8px; font-size:11px">
        </div>
      </div>
    </section>`;
}

// ── SequenceChart: Gaussian 곡선 키네매틱 시퀀스 (BBL 패키지 포팅) ──
function renderKinematicSequenceSvg(r) {
  const pToT = CURRENT_INPUT.mechanics?.pelvis_to_trunk_lag_ms;
  const tToA = CURRENT_INPUT.mechanics?.trunk_to_arm_lag_ms;
  // ★ v31.13 디버그 로깅 — 입력값 출처 추적
  console.log('[v31.13 시퀀스 디버그]', {
    pelvis_to_trunk_lag_ms: pToT,
    trunk_to_arm_lag_ms: tToA,
    ALGORITHM_VERSION,
  });
  if (pToT == null || tToA == null) {
    return `<div class="text-xs text-[var(--text-muted)] py-6 text-center border border-dashed border-[var(--border)] rounded">시퀀스 lag 데이터가 없어 시각화 불가 (Uplift CSV 업로드 필요)</div>`;
  }
  // ★ v32.8 (2026-05-04) — 음수 lag = 이벤트 검출 오류 (biomechanically 불가능)
  //   proximal-to-distal sequencing 원칙: pelvis → trunk → arm peak 순서 절대
  //   음수 lag이 나오면 peak detection 윈도우 또는 throwing arm 분기 문제
  //   처리: abs()로 magnitude 표시 + 차트 아래 검출 오류 경고
  //   v32.7 "발달 미성숙" 해석은 잘못 — 정정
  const detectionErrorPT = pToT < 0;
  const detectionErrorTA = tToA < 0;
  const pToTAdj = Math.abs(pToT);
  const tToAAdj = Math.abs(tToA);
  const pelvisMs = 0;
  const trunkMs  = pelvisMs + Math.round(pToTAdj);
  const armMs    = trunkMs  + Math.round(tToAAdj);
  const g1 = Math.round(pToTAdj), g2 = Math.round(tToAAdj);
  const hasDetectionError = detectionErrorPT || detectionErrorTA;

  const uid = 'seq' + Math.random().toString(36).slice(2, 8);
  // ★ v32.7 차트 범위 — 음수 lag 케이스에도 모든 peak 포함되도록 확장
  const allMs = [pelvisMs, trunkMs, armMs];
  const tMin = Math.min(-30, ...allMs.map(m => m - 30));
  const tMax = Math.max(150, ...allMs.map(m => m + 30));
  const w = 800, h = 320;
  const padL = 24, padR = 24, padT = 30, padB = 90;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  const toX = (ms) => padL + ((ms - tMin) / (tMax - tMin)) * plotW;
  const toY = (v)  => padT + plotH - v * plotH;

  const segs = [
    { ko: '골반', peakMs: pelvisMs, amp: 0.42, color: '#4a90c2', sigma: 26 },
    { ko: '몸통', peakMs: trunkMs,  amp: 0.66, color: '#5db885', sigma: 24 },
    { ko: '상완', peakMs: armMs,    amp: 0.95, color: '#e8965a', sigma: 20 },
  ];
  const sample = (peak, amp, sigma, t) => amp * Math.exp(-((t - peak) * (t - peak)) / (2 * sigma * sigma));
  const curvePath = (peak, amp, sigma) => {
    let d = '';
    for (let t = tMin; t <= tMax; t += 2) {
      d += (d === '' ? `M ${toX(t).toFixed(1)} ${toY(sample(peak, amp, sigma, t)).toFixed(1)}`
                     : ` L ${toX(t).toFixed(1)} ${toY(sample(peak, amp, sigma, t)).toFixed(1)}`);
    }
    return d;
  };

  const okG1 = g1 >= 30 && g1 <= 60;
  const okG2 = g2 >= 30 && g2 <= 60;
  const dtRow1Y = padT + plotH + 26;
  const dtRow2Y = padT + plotH + 58;

  // 곡선 paths
  const curveDefs = segs.map((s, i) =>
    `<path id="seqCurve-${i}-${uid}" d="${curvePath(s.peakMs, s.amp, s.sigma)}" fill="none"/>`
  ).join('');

  // Curve groups + animations
  const curveGroups = segs.map((s, i) => {
    const d = curvePath(s.peakMs, s.amp, s.sigma);
    const peakX = toX(s.peakMs);
    const peakY = toY(s.amp);
    const partDur = 2.0;
    const partDelay = -((segs.length - 1 - i) * 0.35);
    const particles = [0, 0.5].map((offset, j) => `
      <circle r="3.2" fill="${s.color}" opacity="0.95" style="filter: url(#curveGlow-${uid})">
        <animateMotion dur="${partDur}s" repeatCount="indefinite" begin="${(partDelay - offset * partDur).toFixed(2)}s">
          <mpath href="#seqCurve-${i}-${uid}"/>
        </animateMotion>
      </circle>`).join('');
    return `
      <g>
        <path d="${d} L ${toX(tMax)} ${toY(0)} L ${toX(tMin)} ${toY(0)} Z" fill="${s.color}" opacity="0.10"/>
        <path d="${d}" stroke="${s.color}" stroke-width="2.6" fill="none" stroke-linecap="round" style="filter: url(#curveGlow-${uid})"/>
        <path d="${d}" stroke="#ffffff" stroke-opacity="0.5" stroke-width="1.2" fill="none" stroke-dasharray="10 22">
          <animate attributeName="stroke-dashoffset" values="32;0" dur="1.6s" repeatCount="indefinite"/>
        </path>
        ${particles}
        <circle cx="${peakX}" cy="${peakY}" r="10" fill="none" stroke="${s.color}" stroke-opacity="0.65" stroke-width="2">
          <animate attributeName="r" values="8;20;8" dur="1.6s" repeatCount="indefinite" begin="${i * 0.4}s"/>
          <animate attributeName="stroke-opacity" values="0.7;0;0.7" dur="1.6s" repeatCount="indefinite" begin="${i * 0.4}s"/>
        </circle>
        <circle cx="${peakX}" cy="${peakY}" r="6.5" fill="${s.color}" stroke="#08080c" stroke-width="2" style="filter: url(#peakGlow-${uid})"/>
        <text x="${peakX}" y="${peakY - 18}" text-anchor="middle" fill="${s.color}" font-size="11" font-family="JetBrains Mono" font-weight="700">${s.ko} ${s.peakMs}ms</text>
      </g>`;
  }).join('');

  // Δt 표시 (두 행)
  const dtBars = [
    { x1: toX(pelvisMs), x2: toX(trunkMs), val: g1, ok: okG1, label: '골반→몸통', y: dtRow1Y },
    { x1: toX(trunkMs),  x2: toX(armMs),   val: g2, ok: okG2, label: '몸통→상완', y: dtRow2Y },
  ].map(b => {
    const xmid = (b.x1 + b.x2) / 2;
    const clr = b.ok ? '#4ade80' : '#f87171';
    return `
      <g>
        <line x1="${b.x1}" x2="${b.x1}" y1="${b.y - 6}" y2="${b.y + 6}" stroke="${clr}" stroke-width="2"/>
        <line x1="${b.x2}" x2="${b.x2}" y1="${b.y - 6}" y2="${b.y + 6}" stroke="${clr}" stroke-width="2"/>
        <line x1="${b.x1 + 2}" x2="${b.x2 - 2}" y1="${b.y}" y2="${b.y}" stroke="${clr}" stroke-width="1.8"/>
        <polygon points="${b.x1 + 8},${b.y - 4} ${b.x1 + 2},${b.y} ${b.x1 + 8},${b.y + 4}" fill="${clr}"/>
        <polygon points="${b.x2 - 8},${b.y - 4} ${b.x2 - 2},${b.y} ${b.x2 - 8},${b.y + 4}" fill="${clr}"/>
        <rect x="${xmid - 70}" y="${b.y - 22}" width="140" height="18" rx="3" fill="#ffffff" stroke="${clr}" stroke-opacity="0.75"/>
        <text x="${xmid}" y="${b.y - 9}" text-anchor="middle" font-size="11" fill="${clr}" font-weight="700" font-family="JetBrains Mono">Δt ${b.label} ${b.val} ms</text>
      </g>`;
  }).join('');

  // 시간 눈금 — ★ v32.7: 음수 tMin 케이스 대응 (좌완 발달 미성숙 선수)
  const ticks = [-180, -150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150, 180]
    .filter(t => t >= tMin && t <= tMax)
    .map(t => `<line x1="${toX(t)}" x2="${toX(t)}" y1="${padT}" y2="${padT + plotH}" stroke="#1e293b" stroke-width="1" stroke-dasharray="2 4"/>`)
    .join('');

  // ★ v32.8 — 음수 lag 검출 시 magnitude로 보정한 결과를 차트에 표시 + 명확한 검출 오류 경고
  //   biomechanically lag은 항상 양수 (proximal-to-distal). 음수 = 이벤트 검출 오류
  const detectionErrorParts = [];
  if (detectionErrorPT) detectionErrorParts.push(`pelvis→trunk 원본 ${pToT.toFixed(0)}ms`);
  if (detectionErrorTA) detectionErrorParts.push(`trunk→arm 원본 ${tToA.toFixed(0)}ms`);
  const immatureNoteHtml = hasDetectionError
    ? `<div class="text-[11px]" style="color:#f87171;margin-top:6px;line-height:1.5;">
         🚨 <strong>이벤트 검출 오류 의심</strong> — ${detectionErrorParts.join(', ')} (음수 lag은 운동학적으로 불가능).
         차트의 lag 값은 절댓값으로 보정되어 표시됩니다. 정확한 시퀀스 분석을 위해 raw Trial CSV를 재업로드해
         새 산식(${ALGORITHM_VERSION})으로 재계산하시거나, peak detection 윈도우 점검이 필요합니다.
       </div>`
    : '';

  return `
    <div class="card p-3" style="background: #ffffff;">
      <div class="scroll-x-mobile"><!-- v33.11 모바일 가로 스크롤 (Theia v0.97) -->
      <svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" preserveAspectRatio="xMidYMid meet" class="svg-min-sequence">
        <defs>
          <filter id="curveGlow-${uid}" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="peakGlow-${uid}" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <linearGradient id="plotBg-${uid}" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stop-color="#f5f7fa"/><stop offset="1" stop-color="#e8eef5"/>
          </linearGradient>
          ${curveDefs}
        </defs>
        <rect x="${padL}" y="${padT}" width="${plotW}" height="${plotH}" fill="url(#plotBg-${uid})" rx="4"/>
        <rect x="${toX(30)}" y="${padT}" width="${toX(60) - toX(30)}" height="${plotH}" fill="rgba(74,222,128,0.05)"/>
        <rect x="${toX(60)}" y="${padT}" width="${toX(120) - toX(60)}" height="${plotH}" fill="rgba(74,222,128,0.04)"/>
        ${ticks}
        <line x1="${toX(0)}" x2="${toX(0)}" y1="${padT}" y2="${padT + plotH}" stroke="#475569" stroke-width="1.5" stroke-opacity="0.6"/>
        ${curveGroups}
        ${dtBars}
        <text x="${padL + 6}" y="${padT + 14}" fill="#64748b" font-size="9" font-family="Inter">↑ 정규화 회전 속도 (이상 lag 30~60 ms 영역 음영)</text>
      </svg>
      </div><!-- /scroll-x-mobile (v33.11) -->
      ${immatureNoteHtml}
    </div>`;
}

// ── EnergyFlow: 3D 마네킹 + 에너지 파이프 + 핵심 변수 라벨 ──
function renderKineticChainSvg(r) {
  const cs = r.cat_scores || {};
  const vs = r.var_scores || {};
  const inputs = CURRENT_INPUT.mechanics || {};

  // ★ v31.15 ETI 임계 완화 — 시퀀스 차트와 일관성 (사용자 피드백)
  //   시퀀스 차트 정상 lag (30~60ms) → ETI 1.0
  //   학술 표준 외부도 부드러운 감소 (Gaussian-like)
  //   완전한 leak (<0.85)는 lag <15 또는 >85 일 때만
  function lagToETI(lag) {
    if (lag == null) return null;
    if (lag < 0) return 0;            // 음수 = 시퀀스 역순 = 전달 0
    if (lag >= 20 && lag <= 80) return 1.0;   // 정상 — 시퀀스 차트보다 관대
    if (lag < 20) return Math.max(0.4, lag / 20 * 0.85);  // 0~20: 0.4 → 0.85
    if (lag <= 120) return Math.max(0.5, 1.0 - (lag - 80) / 40 * 0.5);  // 80~120: 1.0 → 0.5
    return 0.4;                       // 너무 지연 (>120ms)
  }
  const ptLag = inputs.pelvis_to_trunk_lag_ms;
  const taLag = inputs.trunk_to_arm_lag_ms;
  const etiPT = lagToETI(ptLag);
  const etiTA = lagToETI(taLag);
  const ptLeak = etiPT != null && etiPT < 0.85;
  const taLeak = etiTA != null && etiTA < 0.85;
  const leakPct = taLeak ? Math.round((1 - etiTA) * 100) : 0;

  // ★ v31.20 — leak severity 분리 (KINETIC_FAULTS 기준과 일치)
  //   severe (빨강): KINETIC_FAULTS PelvisTrunkDisconnect(<-30) / LateTrunkRotation(>90) 발동 수준
  //   mild   (주황): 정상(20~80ms) 외 발달 단계 미세 누수
  //   정상     (파랑): 20~80ms
  const ptSevere = ptLag != null && (ptLag < -30 || ptLag > 90);
  const taSevere = taLag != null && (taLag < -30 || taLag > 90);
  const ptColor  = !ptLeak ? '#60a5fa' : (ptSevere ? '#ef4444' : '#f59e0b');
  const taColor  = !taLeak ? '#2563EB' : (taSevere ? '#ef4444' : '#f59e0b');
  const ptTextColor = !ptLeak ? '#94a3b8' : (ptSevere ? '#ef4444' : '#fcd34d');
  const taTextColor = !taLeak ? '#94a3b8' : (taSevere ? '#fca5a5' : '#fcd34d');

  // ★ v32.9 — ARM → FOREARM 에너지 전달 효율 (상완 IR → 전완 신전)
  //   ratio = elbow_ext_vel_max / shoulder_ir_vel_max (Option A)
  //   누수: > 0.70 전완 의존 (부상 위험), < 0.40 전완 약화 (출력 손실), 0.40~0.70 정상
  const armForearmRatio = inputs.arm_to_forearm_speedup;
  let afStatus = 'na';   // 'normal' | 'high' (전완 우세) | 'low' (전완 약함) | 'na'
  if (armForearmRatio != null) {
    if (armForearmRatio > 0.70) afStatus = 'high';
    else if (armForearmRatio < 0.40) afStatus = 'low';
    else afStatus = 'normal';
  }
  const afColor = afStatus === 'high' ? '#ef4444' : (afStatus === 'low' ? '#f59e0b' : '#4ade80');
  const afLeak = afStatus === 'high' || afStatus === 'low';

  // ★ v31.20 — Drive leg → Pelvis 에너지 (밀고 나가는 발 → 골반 추진력)
  //   조합 진단: drive_hip_ext_vel_max (직접 토크) + max_cog_velo (전진 효율)
  //   임계 정합 (코호트 기반): KINETIC_FAULTS의 SlowDriveHip(<455)·WeakDrive(<2.24)와 일관
  //   - leak: hip<455°/s OR cog<2.24 m/s (medium 수준, 코호트 하위 ~10%)
  //   - weak: hip<500 OR cog<2.47 (low 수준, 코호트 하위 ~20%)
  //   - normal: 둘 다 OK (hip≥500 AND cog≥2.47)
  const driveHipVel = inputs.drive_hip_ext_vel_max;     // °/s, elite 500~700, 코호트 mean 595±110
  const cogVelo = inputs.max_cog_velo;                   // m/s, 코호트 mean 2.90±0.51, Pro 3.2
  let driveStatus = 'na';   // 'normal' | 'weak' | 'leak' | 'na'
  if (driveHipVel != null && cogVelo != null) {
    const hipOK = driveHipVel >= 500;
    const cogOK = cogVelo >= 2.47;
    const hipLow = driveHipVel < 455;
    const cogLow = cogVelo < 2.24;
    if (hipLow || cogLow) driveStatus = 'leak';
    else if (hipOK && cogOK) driveStatus = 'normal';
    else driveStatus = 'weak';
  } else if (driveHipVel != null || cogVelo != null) {
    // 둘 중 하나만 있으면 단일 변수로 판단
    const v = driveHipVel != null ? driveHipVel : null;
    const c = cogVelo != null ? cogVelo : null;
    if (v != null) driveStatus = v >= 500 ? 'normal' : (v >= 455 ? 'weak' : 'leak');
    else if (c != null) driveStatus = c >= 2.47 ? 'normal' : (c >= 2.24 ? 'weak' : 'leak');
  }
  const driveColors = {
    normal: { stop1: '#22d3ee', stop2: '#3b82f6', label: '#3b82f6', text: '✓ 추진 양호' },
    weak:   { stop1: '#fde68a', stop2: '#f59e0b', label: '#f59e0b', text: '△ 추진 약함' },
    leak:   { stop1: '#fca5a5', stop2: '#ef4444', label: '#ef4444', text: '⚠ 추진 부족' },
    na:     { stop1: '#475569', stop2: '#475569', label: '#64748b', text: '데이터 없음' },
  }[driveStatus];

  // ── 핵심 변수 ──
  // ① 몸통 회전 속도 — 가장 중요한 구속 결정 요인 (Driveline 1.00, 1mph≈40°/s)
  const trunkRotVel = inputs.max_trunk_twist_vel_dps;
  const trunkRotScore = vs.max_trunk_twist_vel_dps;
  // ② Flying Open — X-Factor @ FC가 작으면 몸통이 일찍 열렸다는 뜻
  // ★ v31.17 임계 합리화 — 기존 <30 은 코호트 평균(21°)보다 높아 평균 선수도 다 잡힘
  //   <5° = trunk가 pelvis와 거의 동시(또는 먼저) 회전 = 진정한 Flying Open
  //   KINETIC_FAULTS의 trunk_rotation_at_fc 기준(평균 -30° 이탈)과 등가 (코호트 하위 ~11%)
  const xFactor = inputs.hip_shoulder_sep_at_fc;
  const flyingOpen = xFactor != null && xFactor < 5;
  // ③ 무릎 무너짐 — FC 시 무릎보다 BR 시 무릎이 더 굽었다면 무너짐
  //    lead_knee_ext_change_fc_to_br = (BR knee_extension) - (FC knee_extension)
  //    양수 = 신전 (정상), 음수 = 무너짐 (역신전)
  // ★ v31.18 임계 합리화 — 코호트 평균 +3.3°, q25 -3.7°이라 <0° 임계는 약 39% 잡혀 너무 엄격
  //   <-10° = EXTRA_VAR_SCORING 0점 임계 + Driveline 표준 + 코호트 하위 ~16% (medium severity 적정)
  //   <-22.2° = KINETIC_FAULTS LeadKneeCollapse high severity (코호트 하위 ~3%)
  // ★ v31.20 severity 분리 — kneeCollapseSevere(KINETIC_FAULTS와 일치) vs kneeCollapseMild(시각화 경고)
  const kneeChange = inputs.lead_knee_ext_change_fc_to_br;
  const kneeCollapse = kneeChange != null && kneeChange < -10;
  const kneeCollapseSevere = kneeChange != null && kneeChange < -22.2;

  const uid = 'eg' + Math.random().toString(36).slice(2, 8);
  // 마네킹 keypoints
  const K = {
    head: [470, 100], neck: [478, 138],
    rShoulder: [520, 162], lShoulder: [438, 158],
    rElbow: [572, 108], rWrist: [612, 72], ball: [634, 60],
    lElbow: [376, 176], lWrist: [424, 220],
    pelvisR: [506, 280], pelvisL: [446, 280], pelvisC: [476, 280],
    rKnee: [556, 358], rAnkle: [620, 412], rToe: [658, 420],
    lKnee: [370, 384], lAnkle: [332, 472], lToe: [290, 474],
  };
  // ★ v33.0 — 착지다리 에너지 경로를 착지측 고관절(앞 hip = pelvisL) 경유로 변경
  //   기존: lAnkle → lKnee → pelvisC (가운데로 바로 이동)
  //   현재: lAnkle → lKnee → pelvisL (앞 hip) → pelvisC → rShoulder → rElbow → rWrist → ball
  //   생물역학적으로 GRF는 발→무릎→앞 hip→골반 회전축으로 전달됨
  const energyPath = `M ${K.lAnkle[0]} ${K.lAnkle[1]} L ${K.lKnee[0]} ${K.lKnee[1]} L ${K.pelvisL[0]} ${K.pelvisL[1]} L ${K.pelvisC[0]} ${K.pelvisC[1]} L ${K.rShoulder[0]} ${K.rShoulder[1]} L ${K.rElbow[0]} ${K.rElbow[1]} L ${K.rWrist[0]} ${K.rWrist[1]} L ${K.ball[0]} ${K.ball[1]}`;

  // ★ v31.16 — Drive leg path (밀고 나가는 발 → 무릎 → 골반 우측)
  //   메인 energyPath와 별도로 그려져 골반에서 합류하는 두 갈래 흐름 구현
  const driveLegPath = `M ${K.rAnkle[0]-12} ${K.rAnkle[1]-2} L ${K.rKnee[0]} ${K.rKnee[1]} L ${K.pelvisR[0]+2} ${K.pelvisR[1]+2}`;

  // 누수 시 burst
  const leakBurst = taLeak ? `
    <g>
      <circle cx="${(K.rShoulder[0]+K.rElbow[0])/2}" cy="${(K.rShoulder[1]+K.rElbow[1])/2}" r="38" fill="url(#leak-${uid})">
        <animate attributeName="r" values="28;44;28" dur="1.2s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.9;0.4;0.9" dur="1.2s" repeatCount="indefinite"/>
      </circle>
    </g>` : '';

  return `
    <div class="card p-3" style="background: #ffffff;">
      <div class="scroll-x-mobile"><!-- v33.11 모바일 가로 스크롤 (Theia v0.97 패턴) -->
      <svg viewBox="0 0 800 520" width="100%" preserveAspectRatio="xMidYMid meet" style="max-height: 520px;" class="svg-min-mannequin">
        <defs>
          <linearGradient id="bg-${uid}" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stop-color="#f5f7fa" stop-opacity="0"/>
            <stop offset="1" stop-color="#f5f7fa" stop-opacity="0.35"/>
          </linearGradient>
          <linearGradient id="energy-${uid}" gradientUnits="userSpaceOnUse" x1="${K.lAnkle[0]}" y1="${K.lAnkle[1]}" x2="${K.ball[0]}" y2="${K.ball[1]}">
            <stop offset="0%"  stop-color="${kneeCollapse ? '#fde68a' : '#22d3ee'}"/>
            <stop offset="17%" stop-color="${kneeCollapse ? '#fbbf24' : '#60a5fa'}"/>
            <stop offset="30%" stop-color="${kneeCollapse ? '#f59e0b' : '#60a5fa'}"/>
            <stop offset="50%" stop-color="${ptLeak ? (ptSevere ? '#ef4444' : '#f59e0b') : '#3b82f6'}"/>
            <stop offset="72%" stop-color="${taLeak ? (taSevere ? '#ef4444' : '#f59e0b') : '#2563EB'}"/>
            <stop offset="86%" stop-color="${taLeak ? (taSevere ? '#7f1d1d' : '#d97706') : '#1d4ed8'}"/>
            <stop offset="100%" stop-color="${taLeak ? (taSevere ? '#7f1d1d' : '#d97706') : '#1e3a8a'}"/>
          </linearGradient>
          <linearGradient id="drive-${uid}" gradientUnits="userSpaceOnUse" x1="${K.rAnkle[0]}" y1="${K.rAnkle[1]}" x2="${K.pelvisR[0]}" y2="${K.pelvisR[1]}">
            <stop offset="0%"  stop-color="${driveColors.stop1}"/>
            <stop offset="100%" stop-color="${driveColors.stop2}"/>
          </linearGradient>
          <filter id="glow-${uid}" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <radialGradient id="leak-${uid}">
            <stop offset="0%" stop-color="#fee2e2" stop-opacity="0.95"/>
            <stop offset="40%" stop-color="#ef4444" stop-opacity="0.7"/>
            <stop offset="100%" stop-color="#7f1d1d" stop-opacity="0"/>
          </radialGradient>
          <radialGradient id="mSphere-${uid}" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stop-color="#f1f5f9"/><stop offset="45%" stop-color="#cbd5e1"/>
            <stop offset="85%" stop-color="#64748b"/><stop offset="100%" stop-color="#334155"/>
          </radialGradient>
          <linearGradient id="mLimb-${uid}" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stop-color="#e2e8f0"/><stop offset="50%" stop-color="#94a3b8"/><stop offset="100%" stop-color="#475569"/>
          </linearGradient>
          <linearGradient id="mLimbD-${uid}" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stop-color="#94a3b8"/><stop offset="55%" stop-color="#64748b"/><stop offset="100%" stop-color="#1e293b"/>
          </linearGradient>
          <linearGradient id="mTorso-${uid}" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stop-color="#e2e8f0"/><stop offset="40%" stop-color="#94a3b8"/><stop offset="100%" stop-color="#334155"/>
          </linearGradient>
          <radialGradient id="mJoint-${uid}" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stop-color="#f8fafc"/><stop offset="60%" stop-color="#94a3b8"/><stop offset="100%" stop-color="#334155"/>
          </radialGradient>
          <radialGradient id="aoShadow-${uid}" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#000" stop-opacity="0.45"/>
            <stop offset="100%" stop-color="#000" stop-opacity="0"/>
          </radialGradient>
        </defs>

        <line x1="40" y1="485" x2="760" y2="485" stroke="#2a3a5a" stroke-width="1.5" stroke-dasharray="3 6"/>
        <rect x="0" y="0" width="800" height="520" fill="url(#bg-${uid})"/>
        <ellipse cx="${(K.lAnkle[0]+K.rAnkle[0])/2}" cy="488" rx="180" ry="12" fill="url(#aoShadow-${uid})"/>

        <!-- Glove arm (back) -->
        <g>
          <line x1="${K.lShoulder[0]}" y1="${K.lShoulder[1]}" x2="${K.lElbow[0]}" y2="${K.lElbow[1]}" stroke="url(#mLimbD-${uid})" stroke-width="22" stroke-linecap="round"/>
          <circle cx="${K.lElbow[0]}" cy="${K.lElbow[1]}" r="12" fill="url(#mJoint-${uid})"/>
          <line x1="${K.lElbow[0]}" y1="${K.lElbow[1]}" x2="${K.lWrist[0]}" y2="${K.lWrist[1]}" stroke="url(#mLimbD-${uid})" stroke-width="19" stroke-linecap="round"/>
          <circle cx="${K.lWrist[0]}" cy="${K.lWrist[1]}" r="13" fill="url(#mSphere-${uid})"/>
        </g>

        <!-- Back leg (drive) -->
        <g>
          <line x1="${K.pelvisR[0]-2}" y1="${K.pelvisR[1]}" x2="${K.rKnee[0]}" y2="${K.rKnee[1]}" stroke="url(#mLimb-${uid})" stroke-width="32" stroke-linecap="round"/>
          <circle cx="${K.rKnee[0]}" cy="${K.rKnee[1]}" r="15" fill="url(#mJoint-${uid})"/>
          <line x1="${K.rKnee[0]}" y1="${K.rKnee[1]}" x2="${K.rAnkle[0]}" y2="${K.rAnkle[1]}" stroke="url(#mLimb-${uid})" stroke-width="24" stroke-linecap="round"/>
          <circle cx="${K.rAnkle[0]}" cy="${K.rAnkle[1]}" r="11" fill="url(#mJoint-${uid})"/>
          <path d="M ${K.rAnkle[0]-8} ${K.rAnkle[1]+4} Q ${K.rAnkle[0]-4} ${K.rAnkle[1]+18} ${K.rToe[0]-6} ${K.rToe[1]+10} L ${K.rToe[0]+4} ${K.rToe[1]+2} Q ${K.rToe[0]-2} ${K.rAnkle[1]-2} ${K.rAnkle[0]+6} ${K.rAnkle[1]-4} Z" fill="url(#mLimb-${uid})"/>
        </g>

        <!-- Front leg (braced) — v31.20: severity 분리 (severe=red, mild=amber, 정상=정상색) -->
        <g>
          <line x1="${K.pelvisL[0]+2}" y1="${K.pelvisL[1]}" x2="${K.lKnee[0]}" y2="${K.lKnee[1]}" stroke="${kneeCollapse ? (kneeCollapseSevere ? '#ef4444' : '#f59e0b') : 'url(#mLimb-' + uid + ')'}" stroke-width="34" stroke-linecap="round" ${kneeCollapse ? 'opacity="0.85"' : ''}/>
          <circle cx="${K.lKnee[0]}" cy="${K.lKnee[1]}" r="17" fill="${kneeCollapse ? (kneeCollapseSevere ? '#ef4444' : '#f59e0b') : 'url(#mJoint-' + uid + ')'}"/>
          <line x1="${K.lKnee[0]}" y1="${K.lKnee[1]}" x2="${K.lAnkle[0]}" y2="${K.lAnkle[1]}" stroke="${kneeCollapse ? (kneeCollapseSevere ? '#f97316' : '#fbbf24') : 'url(#mLimb-' + uid + ')'}" stroke-width="26" stroke-linecap="round" ${kneeCollapse ? 'opacity="0.85"' : ''}/>
          <circle cx="${K.lAnkle[0]}" cy="${K.lAnkle[1]}" r="12" fill="${kneeCollapse ? '#fbbf24' : 'url(#mJoint-' + uid + ')'}"/>
          <path d="M ${K.lAnkle[0]-12} ${K.lAnkle[1]+2} Q ${K.lToe[0]-4} ${K.lToe[1]-8} ${K.lToe[0]-12} ${K.lToe[1]+8} L ${K.lAnkle[0]-4} ${K.lAnkle[1]+14} Z" fill="${kneeCollapse ? '#fbbf24' : 'url(#mLimb-' + uid + ')'}"/>
          ${kneeCollapse ? `<g>
            <circle cx="${K.lKnee[0]}" cy="${K.lKnee[1]}" r="22" fill="none" stroke="${kneeCollapseSevere ? '#ef4444' : '#f59e0b'}" stroke-width="2" opacity="0.6">
              <animate attributeName="r" values="20;30;20" dur="1.4s" repeatCount="indefinite"/>
              <animate attributeName="opacity" values="0.7;0.2;0.7" dur="1.4s" repeatCount="indefinite"/>
            </circle>
          </g>` : ''}
        </g>

        <!-- Torso -->
        <line x1="${K.lShoulder[0]+2}" y1="${K.lShoulder[1]+4}" x2="${K.rShoulder[0]-2}" y2="${K.rShoulder[1]+4}" stroke="url(#mLimb-${uid})" stroke-width="34" stroke-linecap="round"/>
        <path d="M ${K.lShoulder[0]+4} ${K.lShoulder[1]+8} C ${K.lShoulder[0]-2} ${K.lShoulder[1]+50}, ${K.pelvisL[0]+2} ${K.pelvisL[1]-68}, ${K.pelvisL[0]+6} ${K.pelvisL[1]-20} L ${K.pelvisR[0]-6} ${K.pelvisR[1]-20} C ${K.pelvisR[0]-2} ${K.pelvisR[1]-68}, ${K.rShoulder[0]+2} ${K.rShoulder[1]+50}, ${K.rShoulder[0]-4} ${K.rShoulder[1]+8} Z" fill="url(#mTorso-${uid})" stroke="#1e293b" stroke-width="1.2"/>
        <path d="M ${K.pelvisL[0]+6} ${K.pelvisL[1]-22} C ${K.pelvisL[0]+2} ${K.pelvisL[1]-12}, ${K.pelvisL[0]-2} ${K.pelvisL[1]-2}, ${K.pelvisL[0]-6} ${K.pelvisL[1]+10} L ${K.pelvisR[0]+6} ${K.pelvisR[1]+10} C ${K.pelvisR[0]+2} ${K.pelvisR[1]-2}, ${K.pelvisR[0]-2} ${K.pelvisR[1]-12}, ${K.pelvisR[0]-6} ${K.pelvisR[1]-22} Z" fill="url(#mTorso-${uid})" stroke="#1e293b" stroke-width="1"/>
        <circle cx="${K.lShoulder[0]}" cy="${K.lShoulder[1]}" r="15" fill="url(#mJoint-${uid})"/>
        <circle cx="${K.rShoulder[0]}" cy="${K.rShoulder[1]}" r="16" fill="url(#mJoint-${uid})"/>

        <!-- Neck + head -->
        <line x1="${K.neck[0]-2}" y1="${K.neck[1]-6}" x2="${K.neck[0]+2}" y2="${K.neck[1]+8}" stroke="url(#mLimb-${uid})" stroke-width="16" stroke-linecap="round"/>
        <circle cx="${K.head[0]}" cy="${K.head[1]}" r="28" fill="url(#mSphere-${uid})" stroke="#1e293b" stroke-width="1"/>

        <!-- Throwing arm -->
        <g>
          <line x1="${K.rShoulder[0]}" y1="${K.rShoulder[1]}" x2="${K.rElbow[0]}" y2="${K.rElbow[1]}" stroke="url(#mLimb-${uid})" stroke-width="26" stroke-linecap="round"/>
          <circle cx="${K.rElbow[0]}" cy="${K.rElbow[1]}" r="13" fill="url(#mJoint-${uid})"/>
          <line x1="${K.rElbow[0]}" y1="${K.rElbow[1]}" x2="${K.rWrist[0]}" y2="${K.rWrist[1]}" stroke="url(#mLimb-${uid})" stroke-width="20" stroke-linecap="round"/>
          <circle cx="${K.rWrist[0]}" cy="${K.rWrist[1]}" r="11" fill="url(#mJoint-${uid})"/>
        </g>

        <!-- Ball -->
        <circle cx="${K.ball[0]}" cy="${K.ball[1]}" r="9" fill="#f8fafc" stroke="#1e293b" stroke-width="1.2"/>
        <path d="M ${K.ball[0]-6} ${K.ball[1]-3} Q ${K.ball[0]} ${K.ball[1]-8} ${K.ball[0]+6} ${K.ball[1]-3}" stroke="#ef4444" stroke-width="1.2" fill="none"/>
        <path d="M ${K.ball[0]-6} ${K.ball[1]+3} Q ${K.ball[0]} ${K.ball[1]+8} ${K.ball[0]+6} ${K.ball[1]+3}" stroke="#ef4444" stroke-width="1.2" fill="none"/>

        <!-- ★ v31.16 Drive leg energy pipe (밀고 나가는 발 → 골반) -->
        ${driveStatus !== 'na' ? `
        <path d="${driveLegPath}" stroke="#0f1a30" stroke-opacity="0.55" stroke-width="18" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="${driveLegPath}" stroke="url(#drive-${uid})" stroke-width="11" fill="none" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow-${uid})" stroke-dasharray="20 12" opacity="0.92">
          <animate attributeName="stroke-dashoffset" from="0" to="-64" dur="1.8s" repeatCount="indefinite"/>
        </path>
        ${driveStatus === 'leak' ? `
        <g>
          <circle cx="${(K.rKnee[0]+K.pelvisR[0])/2}" cy="${(K.rKnee[1]+K.pelvisR[1])/2}" r="22" fill="none" stroke="#ef4444" stroke-width="2" opacity="0.55">
            <animate attributeName="r" values="18;30;18" dur="1.5s" repeatCount="indefinite"/>
            <animate attributeName="opacity" values="0.65;0.15;0.65" dur="1.5s" repeatCount="indefinite"/>
          </circle>
        </g>` : ''}
        ` : ''}

        <!-- Energy pipe -->
        <path d="${energyPath}" stroke="#0f1a30" stroke-opacity="0.6" stroke-width="22" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="${energyPath}" stroke="url(#energy-${uid})" stroke-width="14" fill="none" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow-${uid})" stroke-dasharray="24 14">
          <animate attributeName="stroke-dashoffset" from="0" to="-76" dur="1.6s" repeatCount="indefinite"/>
        </path>
        ${leakBurst}

        <!-- ★ v33.0 — 공 던지는 팔 팔꿈치 노드 (elbow → wrist → ball 에너지 흐름 강조) -->
        <g>
          <circle cx="${K.rElbow[0]}" cy="${K.rElbow[1]}" r="11" fill="none" stroke="${afColor}" stroke-opacity="0.5" stroke-width="2">
            <animate attributeName="r" values="9;14;9" dur="1.8s" repeatCount="indefinite"/>
            <animate attributeName="stroke-opacity" values="0.6;0.15;0.6" dur="1.8s" repeatCount="indefinite"/>
          </circle>
          <circle cx="${K.rElbow[0]}" cy="${K.rElbow[1]}" r="6" fill="${afColor}" stroke="#08080c" stroke-width="1.5" filter="url(#glow-${uid})"/>
          <text x="${K.rElbow[0]}" y="${K.rElbow[1]+22}" font-size="9" fill="${afColor}" text-anchor="middle" font-family="Inter" font-weight="700" letter-spacing="1">ELBOW</text>
        </g>
        <!-- ★ v33.0 — 손(wrist) 노드도 강조 (elbow → wrist 흐름 가시화) -->
        <g>
          <circle cx="${K.rWrist[0]}" cy="${K.rWrist[1]}" r="5" fill="#22d3ee" stroke="#08080c" stroke-width="1.5" filter="url(#glow-${uid})"/>
        </g>

        <!-- ★ v32.9 — 누수 감지 라벨 only (정상 단계는 표시 X) -->
        <!-- 누수가 하나라도 발견되면 해당 라벨만 출력. 모두 정상이면 중앙에 ✅ 메시지. -->

        <!-- PELVIS → TRUNK 누수 -->
        ${ptLeak ? `
        <g>
          <line x1="${K.pelvisC[0]-20}" y1="${K.pelvisC[1]-10}" x2="150" y2="280" stroke="${ptColor}" stroke-width="1.2" stroke-dasharray="2 3"/>
          <rect x="42" y="252" width="176" height="60" rx="6" fill="#ffffff" stroke="${ptColor}" stroke-opacity="0.85" stroke-width="2"/>
          <text x="130" y="268" fill="${ptColor}" font-size="10" font-family="Inter" font-weight="800" text-anchor="middle" letter-spacing="1">⚠ PELVIS → TRUNK</text>
          <text x="130" y="286" fill="#e2e8f0" font-size="14" font-family="JetBrains Mono" font-weight="800" text-anchor="middle">lag ${ptLag.toFixed(0)}ms</text>
          <text x="130" y="302" fill="${ptTextColor}" font-size="9" font-family="Inter" text-anchor="middle">${ptSevere && ptLag < 0 ? '시퀀스 역순' : (ptSevere ? '명확한 누수 (정상 30~80ms)' : '미세 누수 — 트렁크 활성화 늦음')}</text>
        </g>` : ''}

        <!-- TRUNK → ARM 누수 -->
        ${taLeak ? `
        <g>
          <line x1="${K.rShoulder[0]+12}" y1="${K.rShoulder[1]-4}" x2="700" y2="140" stroke="${taColor}" stroke-width="1.2" stroke-dasharray="2 3"/>
          <rect x="592" y="110" width="180" height="60" rx="6" fill="#ffffff" stroke="${taColor}" stroke-opacity="0.85" stroke-width="2"/>
          <text x="682" y="126" fill="${taColor}" font-size="10" font-family="Inter" font-weight="800" text-anchor="middle" letter-spacing="1">⚠ TRUNK → ARM</text>
          <text x="682" y="144" fill="#e2e8f0" font-size="15" font-family="JetBrains Mono" font-weight="800" text-anchor="middle">lag ${taLag.toFixed(0)}ms</text>
          <text x="682" y="160" fill="${taTextColor}" font-size="9" font-family="Inter" text-anchor="middle">${taSevere && taLag < 0 ? '시퀀스 역순' : (taSevere ? '명확한 누수 — 어깨 부하↑' : '미세 누수 (정상 30~80ms)')}</text>
        </g>` : ''}

        <!-- ★ v32.9 신규: ARM → FOREARM 누수 (상완→전완 에너지 전달 효율) -->
        ${afLeak ? `
        <g>
          <line x1="${K.rElbow[0]+6}" y1="${K.rElbow[1]+10}" x2="700" y2="240" stroke="${afColor}" stroke-width="1.5" stroke-dasharray="2 3"/>
          <rect x="582" y="210" width="200" height="64" rx="6" fill="#ffffff" stroke="${afColor}" stroke-opacity="0.85" stroke-width="2"/>
          <text x="682" y="226" fill="${afColor}" font-size="10" font-family="Inter" font-weight="800" text-anchor="middle" letter-spacing="1">${afStatus === 'high' ? '🚨 ARM → FOREARM' : '△ ARM → FOREARM'}</text>
          <text x="682" y="246" fill="#e2e8f0" font-size="14" font-family="JetBrains Mono" font-weight="800" text-anchor="middle">ratio ${armForearmRatio.toFixed(2)}</text>
          <text x="682" y="262" fill="${afColor}" font-size="9" font-family="Inter" text-anchor="middle">${afStatus === 'high' ? '전완 의존 — 팔꿈치 부하↑ (정상 0.50~0.65)' : '전완 가속 부족 — 출력 손실 (정상 0.50~0.65)'}</text>
        </g>` : ''}

        <!-- Flying Open (X-Factor 부족) -->
        ${flyingOpen ? `
        <g>
          <line x1="${K.pelvisR[0]+10}" y1="${K.pelvisR[1]-10}" x2="700" y2="370" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="2 3"/>
          <rect x="592" y="346" width="190" height="58" rx="6" fill="#ffffff" stroke="#ef4444" stroke-opacity="0.85" stroke-width="2"/>
          <text x="687" y="362" fill="#f59e0b" font-size="10" font-family="Inter" font-weight="800" text-anchor="middle" letter-spacing="1">⚠ FLYING OPEN</text>
          <text x="687" y="382" fill="#e2e8f0" font-size="14" font-family="JetBrains Mono" font-weight="800" text-anchor="middle">${Math.round(xFactor)}<tspan font-size="10" fill="#94a3b8" font-family="Inter">° (정상 ≥ 5°)</tspan></text>
          <text x="687" y="396" fill="#fcd34d" font-size="9" font-family="Inter" text-anchor="middle">FC 시 몸통 분리 부족 — 일찍 열림</text>
        </g>` : ''}

        <!-- ★ v33.12 — '무릎 무너짐' 표현 → 'Late Block / 신전 약함'으로 정리 (사용자 피드백) -->
        ${kneeCollapse ? `
        <g>
          <line x1="${K.lKnee[0]-12}" y1="${K.lKnee[1]+4}" x2="180" y2="370" stroke="${kneeCollapseSevere ? '#ef4444' : '#f59e0b'}" stroke-width="1.5" stroke-dasharray="2 3"/>
          <rect x="42" y="346" width="176" height="58" rx="6" fill="#ffffff" stroke="${kneeCollapseSevere ? '#ef4444' : '#f59e0b'}" stroke-opacity="0.85" stroke-width="2"/>
          <text x="130" y="362" fill="${kneeCollapseSevere ? '#ef4444' : '#f59e0b'}" font-size="10" font-family="Inter" font-weight="800" text-anchor="middle" letter-spacing="1">${kneeCollapseSevere ? '⚠ 신전 약함' : '△ 블록 반응 약함'}</text>
          <text x="130" y="381" fill="#1a1a1a" font-size="14" font-family="JetBrains Mono" font-weight="800" text-anchor="middle">Δ ${kneeChange.toFixed(1)}<tspan font-size="10" fill="#6b7280" font-family="Inter">° (정상 ≥ -10°)</tspan></text>
          <text x="130" y="396" fill="${kneeCollapseSevere ? '#dc2626' : '#d97706'}" font-size="9" font-family="Inter" text-anchor="middle">앞다리 블록 반응 타이밍 개선 권장</text>
        </g>` : ''}

        <!-- Drive leg 추진 약함 (normal 제외) -->
        ${driveStatus === 'leak' || driveStatus === 'weak' ? `
        <g>
          <line x1="${K.rKnee[0]+8}" y1="${K.rKnee[1]+8}" x2="700" y2="438" stroke="${driveColors.label}" stroke-width="1.5" stroke-dasharray="2 3"/>
          <rect x="582" y="412" width="200" height="58" rx="6" fill="#ffffff" stroke="${driveColors.label}" stroke-opacity="0.85" stroke-width="2"/>
          <text x="682" y="428" fill="${driveColors.label}" font-size="10" font-family="Inter" font-weight="800" text-anchor="middle" letter-spacing="1">${driveColors.text}</text>
          <text x="682" y="446" fill="#e2e8f0" font-size="12" font-family="JetBrains Mono" font-weight="700" text-anchor="middle">${driveHipVel != null ? `${Math.round(driveHipVel)}°/s` : '—'} · ${cogVelo != null ? `${cogVelo.toFixed(2)} m/s` : '—'}</text>
          <text x="682" y="462" fill="#94a3b8" font-size="9" font-family="Inter" text-anchor="middle">뒷다리 hip 신전·CoG 전진 부족 (또래 595°/s, 2.9 m/s)</text>
        </g>` : ''}

        <!-- ★ v33.12 (사용자 피드백) — '누수 미감지' 표현 부적절 (다른 단계에서 손실 있을 수 있음).
             전체 시퀀스 정상 + 마네킹 시각화 누수 0건일 때만 '회전 순서 정상' 표시. 그 외는 비표시. -->
        ${(!ptLeak && !taLeak && !afLeak && !flyingOpen && !kneeCollapse && driveStatus === 'normal') ? `
        <g>
          <rect x="280" y="495" width="400" height="48" rx="8" fill="rgba(22,163,74,0.08)" stroke="#16a34a" stroke-opacity="0.8" stroke-width="2"/>
          <text x="480" y="515" fill="#16a34a" font-size="14" font-family="Inter" font-weight="800" text-anchor="middle" letter-spacing="1">✓ 전체 회전 순서 정상</text>
          <text x="480" y="533" fill="#15803d" font-size="11" font-family="Inter" text-anchor="middle">시퀀스 누수 미감지 — 미세 조정은 4단계 진단 참조</text>
        </g>` : ''}
      </svg>
      </div><!-- /scroll-x-mobile (v33.11) -->

      <div class="text-xs text-[var(--text-muted)] mt-2 px-2">
        <span style="color:#4ade80">●</span> 정상 단계는 라벨 없음 ·
        <span style="color:#f59e0b">●</span> 미세 누수 (발달 단계 경향) ·
        <span style="color:#ef4444">●</span> 명확한 누수 (KINETIC_FAULTS 진단 수준) —
        ★ v32.9: 누수가 감지된 단계만 라벨 표시 (정상 단계는 깨끗하게).
      </div>
    </div>`;
}

// ── LaybackMeter: 어깨 외회전 게이지 (BBL 패키지 포팅) ──
function renderLaybackMeterSvg(deg) {
  if (deg == null || isNaN(deg)) {
    return `<div class="text-xs text-[var(--text-muted)] py-6 text-center">어깨 외회전 데이터 없음</div>`;
  }
  const size = 280;
  const cx = size/2, cy = size * 0.78, r = size * 0.38;
  const angle = Math.min(220, Math.max(0, deg));
  const toRad = (a) => (a * Math.PI) / 180;
  const angleToPos = (a) => [cx + Math.cos(toRad(a)) * r, cy - Math.sin(toRad(a)) * r];
  const arcPath = (from, to, color, w = 10) => {
    const [x1,y1] = angleToPos(from), [x2,y2] = angleToPos(to);
    const large = Math.abs(to - from) > 180 ? 1 : 0;
    return `<path d="M ${x1} ${y1} A ${r} ${r} 0 ${large} 0 ${x2} ${y2}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round"/>`;
  };
  const [nx, ny] = angleToPos(angle);
  const ticks = [0, 60, 120, 180, 220].map(t => {
    const [x,y] = angleToPos(t);
    const rOut = r + 16;
    const xo = cx + Math.cos(toRad(t)) * rOut;
    const yo = cy - Math.sin(toRad(t)) * rOut;
    const xi = cx + Math.cos(toRad(t)) * (r-8);
    const yi = cy - Math.sin(toRad(t)) * (r-8);
    return `<line x1="${x}" y1="${y}" x2="${xi}" y2="${yi}" stroke="rgba(255,255,255,0.18)"/>
            <text x="${xo}" y="${yo+4}" text-anchor="middle" font-size="11" font-weight="600" fill="#cbd5e1" font-family="Inter">${t}°</text>`;
  }).join('');
  const proBand = (deg >= 160 && deg <= 180) ? '✓ 프로 밴드 (160~180°)' : '';
  return `
    <svg width="100%" viewBox="0 0 ${size} ${size * 1.2}" preserveAspectRatio="xMidYMid meet" style="max-width: 280px;">
      <defs>
        <linearGradient id="laybackG" x1="0" x2="1">
          <stop offset="0" stop-color="#2563EB"/><stop offset="1" stop-color="#60a5fa"/>
        </linearGradient>
      </defs>
      ${arcPath(0, 220, 'rgba(255,255,255,0.08)', 10)}
      ${arcPath(160, 180, 'rgba(34,197,94,0.7)', 10)}
      ${arcPath(0, Math.max(1, angle), 'url(#laybackG)', 10)}
      ${ticks}
      <line x1="${cx}" y1="${cy}" x2="${nx}" y2="${ny}" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="${cx}" cy="${cy}" r="6" fill="#fff"/>
      <text x="${cx}" y="${cy + 30}" text-anchor="middle" font-size="22" font-weight="800" fill="#fff" font-family="JetBrains Mono">${Math.round(deg)}°</text>
      <text x="${cx}" y="${cy + 48}" text-anchor="middle" font-size="10" fill="#4ade80" font-family="Inter">${proBand}</text>
    </svg>`;
}

// 메카닉 카드 본문 렌더 (헤더 + 토글 + 차트 + 아코디언) — 모드별 분기
function renderMechCardInner(r, mode) {
  const isDriveline = mode === '5';
  let displayScore, accordionHtml;

  if (isDriveline) {
    // Driveline 5각형 모드
    const dvScores = drivelineFiveCatScores(r.var_scores || {});
    const dvVals = Object.values(dvScores).filter(v => v != null);
    displayScore = dvVals.length ? Math.round(dvVals.reduce((a,b)=>a+b,0)/dvVals.length * 10)/10 : null;
    accordionHtml = DRIVELINE_5_ORDER.map(cat => {
      return renderDrivelineCategoryAccordion(cat, dvScores[cat], r.var_scores || {});
    }).join('');
  } else {
    // BBL 6각형 모드
    displayScore = r.Mechanics_Score;
    accordionHtml = COHORT.mechanics_cats.map(catId => {
      return renderCategoryAccordion(catId, r.var_scores || {}, r.cat_scores[catId]);
    }).join('');
  }

  const headerScore = displayScore != null ? Math.round(displayScore) : '—';
  const headerColor = scoreColor(displayScore);

  return `
    <div class="flex justify-between items-end mb-4">
      <div>
        <div class="mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">SECTION</div>
        <div class="display text-xl mt-1" style="color: var(--accent)">메카닉</div>
      </div>
      <div class="text-right">
        <div class="display text-4xl" style="color: ${headerColor}">${headerScore}</div>
        <div class="text-[10px] text-[var(--text-muted)] mono uppercase">/100${isDriveline ? ' · Driveline' : ''}</div>
      </div>
    </div>
    <div class="flex items-center justify-end gap-1 mb-2">
      <span class="mono text-[10px] text-[var(--text-muted)] mr-1">VIEW</span>
      <button id="mech-mode-6" class="mech-mode-btn ${mode==='6'?'active':''}" onclick="setMechMode('6')">6각 (BBL)</button>
      <button id="mech-mode-5" class="mech-mode-btn ${mode==='5'?'active':''}" onclick="setMechMode('5')">5각 (Driveline)</button>
    </div>
    <div class="mb-4 relative" style="height: 240px;">
      <canvas id="radar-mech"></canvas>
    </div>
    ${accordionHtml}`;
}

// Driveline 카테고리용 아코디언 — DRIVELINE_5_CATS의 변수들을 코호트 백분위로 보여줌
function renderDrivelineCategoryAccordion(dvCat, catScore, varScores) {
  const d = DRIVELINE_5_DETAILS[dvCat];
  if (!d) return '';
  const catColor = scoreColor(catScore);
  const varKeys = DRIVELINE_5_CATS[dvCat] || [];

  // 각 변수의 점수 행 (코호트 분포 없으면 ★Phase2 표기)
  const varRows = varKeys.map(key => {
    // 코호트 메타에서 변수 정보 찾기
    let varMeta = null;
    for (const cat of [...COHORT.mechanics_cats, ...COHORT.fitness_cats, ...COHORT.control_cats]) {
      for (const v of (COHORT.category_vars[cat] || [])) {
        if (v[0] === key) { varMeta = v; break; }
      }
      if (varMeta) break;
    }
    const name = varMeta ? varMeta[1] : key;
    const unit = varMeta ? varMeta[2] : '';
    const dec  = varMeta && varMeta[3] != null ? varMeta[3] : 2;
    const polarity = varMeta && varMeta[4] || 'higher';
    const score = varScores[key];
    const inputVal = (CURRENT_INPUT.fitness[key] != null) ? CURRENT_INPUT.fitness[key] : CURRENT_INPUT.mechanics[key];
    const rawStr = inputVal != null ? Number(inputVal).toFixed(dec) + (unit ? ' ' + unit : '') : '—';
    const inCohort = COHORT.var_distributions[key];
    const phase2Tag = !inCohort ? '<span class="badge badge-warn ml-1" style="font-size:9px">★Phase2</span>' : '';
    // ★ 코호트 분포 비교 (2026-05-03 A4)
    let cohortInfo = '';
    if (inCohort && inputVal != null) {
      const fmt = (v) => Number(v).toFixed(dec);
      let pos = '평균';
      if (inputVal < inCohort.q25) pos = '하위25↓';
      else if (inputVal < inCohort.median) pos = '중앙↓';
      else if (inputVal < inCohort.q75) pos = '중앙↑';
      else pos = '상위25↑';
      cohortInfo = `<div class="text-[9px] text-[var(--text-muted)] mt-0.5" style="font-family:'JetBrains Mono',monospace;" title="코호트 ${inCohort.n}명 분포">코호트 q25/q50/q75: ${fmt(inCohort.q25)}/${fmt(inCohort.median)}/${fmt(inCohort.q75)} · <span style="color:#9ca3af;">${pos}</span></div>`;
    }
    const contextNote = '';  // Driveline accordion에서는 사용 안 함 (빈 값)
    const scoreStr = score != null ? Math.round(score) : '—';
    const w = score != null ? Math.max(0, Math.min(100, score)) : 0;
    const vColor = scoreColor(score);
    const dirIndicator = polarity === 'lower' ? ' <span style="opacity:0.5">↓</span>' : '';
    return `
      <div class="var-row-v29">
        <div>
          <div class="var-name">${name}${dirIndicator}${phase2Tag}</div>
          <div class="var-desc">${key}</div>
        </div>
        <div class="var-raw">${rawStr}${cohortInfo}</div>
        <div class="var-score">
          <div class="var-mini-bar"><div class="var-mini-bar-fill" style="width:${w}%; background:${vColor}"></div></div>
          <span class="cat-mini-score" style="color:${vColor}">${scoreStr}</span>
        </div>
      </div>`;
  }).join('');

  return `
    <div class="accordion-card" data-cat="${dvCat}">
      <div class="accordion-header" onclick="this.parentElement.classList.toggle('open')">
        <div class="flex-1">
          <div class="flex items-center gap-3">
            <div class="text-sm font-bold">${d.name}</div>
            <div class="cat-mini-score" style="color:${catColor}">${catScore != null ? Math.round(catScore) : '—'}점</div>
            ${catScore != null ? `<div class="text-[10px]" style="color:${catColor};opacity:0.85;font-weight:500;">${scoreContext(catScore)}</div>` : ''}
          </div>
          <div class="mono text-[10px] text-[var(--text-muted)] mt-1">${d.short_desc || ''}</div>
        </div>
        <span class="accordion-icon">▶</span>
      </div>
      <div class="accordion-content">
        <div class="accordion-body">
          ${varRows ? `
          <div class="mb-4">
            <div class="mono text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-2">매핑 변수 점수 (코호트 백분위)</div>
            ${varRows}
          </div>` : ''}
          <div class="mb-3">
            <div class="mono text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-1">의미</div>
            <div class="text-xs text-[var(--text-secondary)] leading-relaxed">${d.meaning}</div>
          </div>
          <div class="mb-3">
            <div class="mono text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-1">산출 방식</div>
            <div class="text-xs text-[var(--text-secondary)] leading-relaxed">${d.method}</div>
          </div>
          <div class="mb-3">
            <div class="mono text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-1">코칭 포인트</div>
            <div class="text-xs text-[var(--text-secondary)] leading-relaxed">${d.coaching}</div>
          </div>
        </div>
      </div>
    </div>`;
}

// ════════════════════════════════════════════════════════════════════
// 카테고리별 변수 가중치 (PPTX 9페이지 — 몸통 회전 속도 1.00 기준)
// 없으면 단순 평균. 메카닉 6각형 모든 카테고리에 적용.
// ════════════════════════════════════════════════════════════════════
// ★ v30.22 키네틱 체인 6단계 카테고리 가중치 (Step B)
//   각 단계의 핵심 변인에 큰 가중치, 보조 변인에 작은 가중치
//   사용자 통찰 반영: 회전속도/lag도 핵심 (단, 우리 직접 산출 변인 강조)
// ★ v32.1 (2026-05-04) F1_Strength 가중치 신설
//   IMTP/BM (cross d=+0.98) + Grip Strength (cross d=+1.18) 둘 다 Large effect
const CATEGORY_WEIGHTS = {
  F1_Strength: {             // 근력 — IMTP + 악력 (둘 다 Large effect)
    'IMTP Peak Vertical Force / BM [N/kg]': 1.00,  // cross d=+0.98 (Large)
    'Grip Strength':                          1.00, // cross d=+1.18 (Large)
  },
  C1_LowerBodyDrive: {       // 단계 1 — 하체 드라이브 (KH→FC)
    // [v33.10] 'stride_norm_height' 가중치 제거 — Theia 비교에서 정의 본질 차이 (ICC <0.13)
    'stride_time_ms':          0.50,
    'drive_hip_ext_vel_max':   0.80,  // ★ drive 다리 신전 → 추진력
    'hip_ir_vel_max_drive':    0.50,
    'max_cog_velo':            0.70,  // ★ 추진 결과
  },
  C2_FrontLegBlock: {        // 단계 2 — 앞다리 블로킹 (FC→early MER)
    // ★ v31.33 사용자 도메인 인사이트 (2026-05-04):
    //   무릎 각도 유지(무너짐 여부)가 핵심. 신전 속도는 부차적 — 각도 유지하면서 elite 던지는 투수 흔함
    'lead_knee_ext_change_fc_to_br': 1.00,  // ★★ 무너짐 여부 = 가장 중요
    'com_decel_pct':                 1.00,  // ★ 추진력 stop = 회전 전환
    'lead_knee_ext_vel_max':         0.20,  // ↓ 신전 속도 자체는 부차적 (각도 유지 우선)
    'lead_knee_amortization_ms':     0.40,
    'lead_hip_flex_at_fc':           0.40,
    'lead_hip_ext_vel_max':          0.40,
  },
  C3_SeparationFormation: {  // 단계 3 — 몸통 에너지 로딩 (v31.36 5변수)
    'peak_x_factor':              1.00,  // ★ 골반-몸통 꼬임 (optimal 50°)
    'trunk_rotation_at_fc':       0.80,  // FC 시 몸통 열림 (Flying Open)
    'trunk_forward_tilt_at_fc':   0.50,  // FC 시 몸통 앞 기울기
    'max_pelvis_rot_vel_dps':     0.80,  // ★ 골반 회전 속도 (optimal 550°/s, Aguinaldo)
    'pelvis_to_trunk_lag_ms':     0.80,  // ★ 골반→몸통 lag (optimal 45ms)
  },
  C4_TrunkAcceleration: {    // 단계 4 — 몸통 에너지 발현 (v31.37 2변수, v32.0 가중치 갱신)
    'max_trunk_twist_vel_dps':  1.00,  // ★ 몸통 회전 속도 (optimal 950°/s, Werner 2008; cohort cross d=+0.90)
    'trunk_flex_vel_max':       1.00,  // ★ v32.0 0.80 → 1.00: cohort long d=+0.96 (단일 최강 향상 변수)
  },
  C5_UpperBodyTransfer: {    // 단계 5 — 팔 에너지 (v31.38 4변수)
    'max_shoulder_ER_deg':    1.00,  // ★ 레이백 (Driveline elite 175~200°)
    'arm_trunk_speedup':      1.00,  // ★ 몸통→팔 전달율 (elite 1.88)
    'trunk_to_arm_lag_ms':    0.80,  // ★ 몸통→팔 lag (40~50ms)
    'shoulder_ir_vel_max':    0.80,  // ★ 어깨 IR 속도 (Driveline elite 4500+)
  },
  C6_ReleaseAcceleration: {  // 단계 6 — 릴리스 가속 (MER→BR)
    'peak_arm_av':             0.80,  // ★ 팔 회전 peak
    'elbow_ext_vel_max':       1.00,  // ★ 사용자 통찰: 부상 위험 진단 + 전완 출력
    'trunk_flex_vel_max':      0.30,
    'arm_slot_mean_deg':       0.40,
    'release_height_m':        0.60,
    'torso_rotation_at_br':    0.30,
  },
};

// ════════════════════════════════════════════════════════════════════
// 점수 계산 (v29 로직 포팅)
// ════════════════════════════════════════════════════════════════════
function calculateScores(input, age, measuredVelo) {
  const adj = COHORT.age_group_adjustment[age] || {velo_offset:0, score_offset:0};
  const allVarScores = {};
  const catScores = {};

  // ★ v30.15 Phase 2: 분석 컨텍스트 설정 (armSide × mode)
  CURRENT_ARM_SIDE = input._armSide || 'right';
  CURRENT_MODE     = getPlayerMode(CURRENT_ARM_SIDE, measuredVelo);
  
  // 1) 변수별 점수 계산 (카테고리별 가중치 지원)
  const allCats = [...COHORT.fitness_cats, ...COHORT.mechanics_cats, ...COHORT.control_cats];
  for (const catId of allCats) {
    const vars = COHORT.category_vars[catId] || [];
    const scoresWithKeys = [];  // [{key, score}]
    const missingKeys = [];
    for (const v of vars) {
      const [key, name, unit, dec, polarity] = v;
      const pol = polarity || 'higher';
      // 입력에서 찾기 (fitness or mechanics 둘 중)
      let val = input.fitness[key];
      if (val == null) val = input.mechanics[key];
      if (val != null) {
        const score = percentileOfCohort(key, val, pol);
        if (score != null) {
          allVarScores[key] = score;
          scoresWithKeys.push({ key, score });
        } else {
          missingKeys.push(key);
        }
      } else {
        missingKeys.push(key);
      }
    }
    // ★ v31.2 결측률 50% 미만 카테고리는 점수 보류 (사용자 피드백)
    const totalVars = vars.length;
    const measuredVars = scoresWithKeys.length;
    const coverage = totalVars > 0 ? measuredVars / totalVars : 0;
    if (scoresWithKeys.length > 0 && coverage >= 0.5) {
      let avg;
      const weights = CATEGORY_WEIGHTS[catId];
      if (weights) {
        // 가중 평균 (PPTX 9페이지 상대적 중요도)
        let weightedSum = 0, totalWeight = 0;
        for (const { key, score } of scoresWithKeys) {
          const w = weights[key] || 1;
          weightedSum += score * w;
          totalWeight += w;
        }
        avg = totalWeight > 0 ? weightedSum / totalWeight : 0;
      } else {
        // 기본 — 단순 평균
        avg = scoresWithKeys.reduce((a, x) => a + x.score, 0) / scoresWithKeys.length;
      }
      // v29 카테고리별 산식 보정 적용
      const offset = (COHORT.category_offsets && COHORT.category_offsets[catId]) || 0;
      avg += offset;
      // 연령군 보정 적용
      avg = Math.max(0, Math.min(100, avg + adj.score_offset));
      catScores[catId] = Math.round(avg * 10) / 10;
    } else if (coverage < 0.5 && totalVars > 0) {
      // 결측률 50% 초과 → 점수 보류
      catScores[catId] = null;
      catScores[catId + '_skipped_reason'] = `측정 ${measuredVars}/${totalVars} (${Math.round(coverage*100)}%) — 결측 50% 초과로 점수 보류`;
    }
    // 카테고리 변수별 측정/누락 정보 저장 (UI 진단 표시)
    catScores[catId + '_coverage'] = { measured: measuredVars, total: totalVars, pct: Math.round(coverage * 100), missing: missingKeys };
  }

  // 1.5) Driveline 5각형 전용 변수도 점수 산출 (BBL 6각형 카테고리에 없는 변수들)
  // ★ v31.5: 카테고리에 없는 변수는 UI 노출 차단 (사용자 결정으로 제거된 15개 변수 자동 제외)
  const _allCatVars = new Set();
  const _allCatsAllForCheck = [...(COHORT.fitness_cats||[]), ...(COHORT.mechanics_cats||[]), ...(COHORT.control_cats||[])];
  for (const cat of _allCatsAllForCheck) {
    for (const v of (COHORT.category_vars[cat] || [])) {
      _allCatVars.add(v[0]);
    }
  }
  for (const k of Object.keys(EXTRA_VAR_SCORING)) {
    if (allVarScores[k] != null) continue;  // 이미 산출됐으면 skip
    if (!_allCatVars.has(k)) continue;       // ★ v31.5: 카테고리에 없는 변수는 점수 산출 차단
    let val = input.fitness[k];
    if (val == null) val = input.mechanics[k];
    if (val == null) continue;
    const score = percentileOfCohort(k, val, 'higher');
    if (score != null) allVarScores[k] = score;
  }
  
  // 2) 종합 점수 — ★ v31.39 영역별 카테고리 가중치 도입 (사용자 도메인 인사이트)
  //   F4_Body는 잠재 변인 아님 (신장은 더 클 수 없고, 체중만 늘려도 구속 안 늘음) → 0.3
  //   F2_Power(체중당)이 구속과 가장 직접 연관 → 2.0 (최대)
  //   F1·F3는 표준 1.0
  const FITNESS_CAT_WEIGHTS  = { F1_Strength: 1.0, F2_Power: 2.0, F3_Reactivity: 1.0, F4_Body: 0.3 };
  // ★ v31.42 메카닉 카테고리 가중치 — 학술 근거 단일 회귀 r 기반 (Werner 2008, Wood-Smith 2019, Driveline)
  //   C4 몸통 회전 속도 r≈0.61 (단일 최강) / C5 레이백·전달 r≈0.50 / C3 로딩 r≈0.40
  //   C2 앞다리 버팀·C1 하체 추진은 토대(foundation) — 직접 r 낮음
  // ★ v32.2 (2026-05-04) C5 절충 — 134명 코호트에서 cross d=+0.09 (MER ~190° 천장 효과)
  //   문헌(r≈0.50)과 자체 코호트(d≈0) 사이 절충값 1.0 채택
  const MECHANICS_CAT_WEIGHTS = {
    C1_LowerBodyDrive:       0.8,
    C2_FrontLegBlock:        1.0,
    C3_SeparationFormation:  1.0,
    C4_TrunkAcceleration:    1.5,
    C5_UpperBodyTransfer:    1.0,  // ★ v32.2 1.5 → 1.0 (절충)
  };
  // ★ v31.43 제구 카테고리 가중치 — Whiteley 2018, Driveline Pitch Design
  //   P1 릴리스 점(3D SD) = 제구 가장 직접적 단일 지표 / P4 타이밍 = proper sequence + MER→BR SD
  const CONTROL_CAT_WEIGHTS   = {
    P1_ReleaseConsistency: 1.5,  // ★ 제구 단일 최강 지표
    P2_ArmSlot:            1.0,
    P3_ReleaseHeight:      1.0,
    P4_TimingConsistency:  1.2,  // ★ 운동사슬 안정성
    P5_StrideConsistency:  1.0,
    P6_TrunkConsistency:   1.0,
  };

  const _weightedMean = (cats, weights) => {
    let sum = 0, totalW = 0;
    for (const c of cats) {
      const s = catScores[c];
      if (s == null) continue;
      const w = (weights && weights[c] != null) ? weights[c] : 1.0;
      sum += s * w;
      totalW += w;
    }
    return totalW > 0 ? sum / totalW : null;
  };

  const _fitMean  = _weightedMean(COHORT.fitness_cats,   FITNESS_CAT_WEIGHTS);
  const _mechMean = _weightedMean(COHORT.mechanics_cats, MECHANICS_CAT_WEIGHTS);
  const _ctrlMean = _weightedMean(COHORT.control_cats,   CONTROL_CAT_WEIGHTS);

  const Fitness_Score   = _fitMean  != null ? Math.round(_fitMean  * 10) / 10 : null;
  const Mechanics_Score = _mechMean != null ? Math.round(_mechMean * 10) / 10 : null;
  const Control_Score   = _ctrlMean != null ? Math.round(_ctrlMean * 10) / 10 : null;

  // legacy 변수 유지 (다른 코드에서 사용)
  const fitCatScores  = COHORT.fitness_cats.map(c => catScores[c]).filter(s => s != null);
  const mechCatScores = COHORT.mechanics_cats.map(c => catScores[c]).filter(s => s != null);
  const ctrlCatScores = COHORT.control_cats.map(c => catScores[c]).filter(s => s != null);

  // ★ v30.36 결측치 신뢰도 — 영역별 입력 변수 비율 계산
  //   사용자 통찰: 결측치 많은 카테고리의 점수는 신뢰성 낮음 → 시각적 경고 + 신뢰도 표시
  const computeCoverage = (cats) => {
    let total = 0, measured = 0;
    for (const cat of cats) {
      const vars = COHORT.category_vars[cat] || [];
      total += vars.length;
      for (const v of vars) {
        if (allVarScores[v[0]] != null) measured++;
      }
    }
    return total > 0 ? { measured, total, pct: Math.round(measured / total * 100) } : null;
  };
  const Fitness_Coverage   = computeCoverage(COHORT.fitness_cats);
  const Mechanics_Coverage = computeCoverage(COHORT.mechanics_cats);
  const Control_Coverage   = computeCoverage(COHORT.control_cats);

  // 신뢰도 등급
  const reliabilityGrade = (pct) => {
    if (pct == null) return null;
    if (pct >= 80) return { label: '높음', color: '#4ade80' };
    if (pct >= 50) return { label: '중간', color: '#fbbf24' };
    if (pct >= 30) return { label: '낮음', color: '#f97316' };
    return { label: '매우 낮음', color: '#dc2626' };
  };
  const Fitness_Reliability   = Fitness_Coverage   ? reliabilityGrade(Fitness_Coverage.pct)   : null;
  const Mechanics_Reliability = Mechanics_Coverage ? reliabilityGrade(Mechanics_Coverage.pct) : null;
  const Control_Reliability   = Control_Coverage   ? reliabilityGrade(Control_Coverage.pct)   : null;
  
  // 3) 회귀로 PV, MV 계산 (연령군 구속 보정 포함)
  // ★ v30.20 옵션 D: cohort_v29.js의 regression 직접 사용 (하드코딩 제거)
  //   fitness: Phase A 4 카테고리 회귀 (slope 0.214, R²=0.175, n=222)
  //   좌·우완: regression.fitness_by_hand에서 자동 분기 + recommended_offset_left
  //   mechanics: v30.13 회귀 유지 (raw 표본 부족으로 재학습 보류)
  const _frBase = COHORT.regression.fitness_to_velocity;
  const _frByHand = COHORT.regression.fitness_by_hand || null;
  const _mrBase = COHORT.regression.mechanics_to_velocity;
  const _handSide = CURRENT_ARM_SIDE || 'right';
  // 좌완 offset (cohort 권장값 우선, 없으면 -5 fallback)
  const _leftOffset = (_frByHand?.recommended_offset_left ?? -5);
  const handOffset = (_handSide === 'left') ? _leftOffset : 0;
  // fitness 회귀: cohort base 사용 (v30.19에서 0.214로 갱신됨)
  const fr = { slope: _frBase.slope, intercept: _frBase.intercept + handOffset };
  // 메카닉 회귀: 기존 pivot-at-60 구조 유지
  const mr = { slope: 0.285, intercept: _mrBase.intercept + (_mrBase.slope - 0.285) * 60 + handOffset };
  // 보정 전 점수로 계산
  const fitRaw = fitCatScores.length ? fitCatScores.reduce((a,b)=>a+b,0)/fitCatScores.length - adj.score_offset : null;
  const mechRaw = mechCatScores.length ? mechCatScores.reduce((a,b)=>a+b,0)/mechCatScores.length - adj.score_offset : null;
  
  const PV = fitRaw != null ? Math.round((fr.slope * fitRaw + fr.intercept + adj.velo_offset) * 10) / 10 : null;
  const MV = mechRaw != null ? Math.round((mr.slope * mechRaw + mr.intercept + adj.velo_offset) * 10) / 10 : null;

  // 4) 잠재 구속 — 3가지 시나리오 (F100, M100, FM100)
  //    공통 보수화: 개인화 ×2 + 절대 ×1 / 3 → 가중평균
  //    Cap: 측정 + 연령군 max gain | 연령군 elite ceiling | floor: 측정+0
  const AGE_MAX_GAIN     = { '중학': 15, '고교': 12, '대학': 8,  '프로': 5  };
  // ★ v31.31 잠재 구속 천장 상향 (사용자 요청 2026-05-04)
  //   고교 elite: 152 → 160 km/h, 좌완 offset: -3 → -5 (좌완 elite 155 km/h)
  const AGE_ELITE_CEILING= { '중학': 145, '고교': 160, '대학': 165, '프로': 170 };
  const maxGain  = AGE_MAX_GAIN[age]      || 10;
  const HAND_CEILING_OFFSET = { right: 0, left: -5 };
  const eliteCap = (AGE_ELITE_CEILING[age] || 160) + (HAND_CEILING_OFFSET[CURRENT_ARM_SIDE || 'right'] || 0);

  // 학습 곡선 — quadratic. 현재 점수가 낮을수록 발달 효율 급감 (floor 없음)
  // 학습곡선 — 2026-05-03 (s/100)^2 → (s/100)^1.2 완화
  //   기존: 50점→0.25 (너무 가혹) / 새: 50점→0.43 (현실적)
  //   30점 → 0.20, 50점 → 0.43, 60점 → 0.54, 80점 → 0.76, 100점 → 1.0
  const _devMult = (currentScore) => {
    const s = Math.max(0, Math.min(100, currentScore || 0)) / 100;
    return Math.pow(s, 1.2);
  };

  // 단일 시나리오 ceiling 계산 — 현재 quality에 monotonic 보장
  // 핵심:
  //  1) 절대 회귀 항 제거 → 개인화 anchor만 사용 (저측정 선수가 절대값에 끌려 올라가는 효과 차단)
  //  2) 학습 곡선 quadratic → 저점수 선수의 발달폭이 빠르게 작아짐
  //  3) 현실 cap = maxGain × pow(현재 quality, 1.5) → 현재 quality가 낮으면 발달폭 자체가 제한
  function _computeCeiling(measured, fitCurrent, mechCurrent, fitTarget, mechTarget) {
    if (measured == null) return { theoretical: null, ceiling: null };
    // 시나리오별 회귀 gain × 학습 효율 (현재 점수 quadratic)
    const fitGap  = Math.max(0, fitTarget  - fitCurrent);
    const mechGap = Math.max(0, mechTarget - mechCurrent);
    // ★ 시너지 multiplier 보수화 (2026-05-03 v30.11)
    //   사용자 인사이트: 체력 측정 신뢰도 낮음 → lever 효과 과대 평가 가능성
    //   0.7+0.8M → 0.8+0.4M (체력 영향 보수적, 메카닉 영향은 회귀 slope에서 흡수)
    const _synergy = 0.8 + 0.4 * (mechCurrent / 100);  // M=0→0.8, M=80→1.12, M=100→1.2
    const fitGain  = fr.slope * fitGap  * _devMult(fitCurrent) * _synergy;
    const mechGain = mr.slope * mechGap * _devMult(mechCurrent);
    const theoretical = measured + fitGain + mechGain;
    // 현실 cap (옵션 A 적용 2026-05-03) — quality cap + room cap의 max
    //   기존: quality 기반만 — 50점 평균 선수가 25%만 cap 받음 (성장 여지 부정)
    //   변경: 두 관점 max — 점수 낮은 선수도 "성장 여지" 기반 cap, 높은 선수도 "quality" 기반 cap
    //   결과: 평균 선수(50/50)의 잠재 구속이 +4.2 → +7.4 km/h로 향상, 80/80 선수도 +8.6 km/h 유지
    const currentQuality = (fitCurrent + mechCurrent) / 200;       // 0~1
    const room = Math.max(0, 1 - currentQuality);                  // 성장 여지 (점수 낮을수록 큼)
    const qualityCap = maxGain * Math.pow(Math.max(0, currentQuality), 1.5);
    const roomCap    = maxGain * Math.pow(room, 0.7);
    const realisticGainCap = Math.max(qualityCap, roomCap);
    let c = Math.min(theoretical, measured + realisticGainCap, eliteCap);
    c = Math.max(c, measured);
    return { theoretical: Math.round(theoretical * 10) / 10, ceiling: Math.round(c * 10) / 10 };
  }

  let ceiling_F100 = null, ceiling_M100 = null, ceiling_FM100 = null;
  let ceiling = null, theoreticalCeiling = null;

  if (measuredVelo != null && fitRaw != null && mechRaw != null) {
    // F100: 체력만 100점, 메카닉 그대로
    const cF  = _computeCeiling(measuredVelo, fitRaw, mechRaw, 100,    mechRaw);
    // M100: 메카닉만 100점, 체력 그대로
    const cM  = _computeCeiling(measuredVelo, fitRaw, mechRaw, fitRaw, 100);
    // FM100: 둘 다 100점
    const cFM = _computeCeiling(measuredVelo, fitRaw, mechRaw, 100,    100);
    ceiling_F100 = cF.ceiling;
    ceiling_M100 = cM.ceiling;
    ceiling_FM100 = cFM.ceiling;
    ceiling = cFM.ceiling;
    theoreticalCeiling = cFM.theoretical;
  } else if (measuredVelo != null && mechRaw != null) {
    // 체력 누락 — 메카닉만 발달 시나리오
    const cM = _computeCeiling(measuredVelo, mechRaw, mechRaw, mechRaw, 100);
    ceiling_M100 = cM.ceiling;
    ceiling_FM100 = cM.ceiling;
    ceiling = cM.ceiling;
    theoreticalCeiling = cM.theoretical;
  } else if (mechRaw != null) {
    theoreticalCeiling = mr.slope * 100 + mr.intercept + adj.velo_offset;
    ceiling = Math.min(theoreticalCeiling, eliteCap);
    if (ceiling != null) ceiling = Math.round(ceiling * 10) / 10;
    if (theoreticalCeiling != null) theoreticalCeiling = Math.round(theoreticalCeiling * 10) / 10;
  }

  // ★ v32.0 IPS 계산용 raw 입력 저장 (trunk_flex_vel_max 등)
  const _raw_inputs = {};
  const _ipsRawKeys = ['trunk_flex_vel_max', 'max_trunk_twist_vel_dps', 'max_cog_velo'];
  for (const k of _ipsRawKeys) {
    let val = input.fitness?.[k];
    if (val == null) val = input.mechanics?.[k];
    if (val != null) _raw_inputs[k] = val;
  }

  return {
    age, adj,
    var_scores: allVarScores,
    cat_scores: catScores,
    Fitness_Score, Mechanics_Score, Control_Score,
    Fitness_Coverage, Mechanics_Coverage, Control_Coverage,
    Fitness_Reliability, Mechanics_Reliability, Control_Reliability,
    PV_predicted: PV,
    MV_predicted: MV,
    ceiling,
    ceiling_F100,           // 체력만 100점화
    ceiling_M100,           // 메카닉만 100점화
    ceiling_FM100,          // 체력 + 메카닉 둘 다 100점화 (= ceiling)
    theoretical_ceiling: theoreticalCeiling,
    age_max_gain: maxGain,
    age_elite_cap: eliteCap,
    measuredVelo,
    _raw_inputs,            // ★ v32.0 IPS 계산용
    mechanics: input.mechanics || {},   // ★ v33.7.2 — 사분면 카드(renderOutputTransferCardInner) raw 값 접근용
    fitness:   input.fitness   || {},   // 일관성 위해 같이 보존
  };
}

// ════════════════════════════════════════════════════════════════════
// ★ v32.0 IPS — Improvement Potential Score (향상 잠재력 점수)
//   H1·H2 두 시점 측정값이 모두 있을 때만 산출.
//   134명 코호트 종단(Improver vs Non-improver) 효과크기 기반 가중 z-score 합.
//
//   가중치 (효과크기 d 비례):
//     0.40 × Z(Δtrunk_flex_vel_max)        — long d=+0.96 (단일 최강)
//     0.30 × Z(ΔC4_TrunkAcceleration_score) — long d=+0.63
//     0.20 × Z(ΔMechanics_Score)            — long d=+0.57
//     0.10 × Z(ΔC1_LowerBodyDrive_score)    — long d=+0.45
//
//   Z(Δ) = (Δ − cohort_Δ_mean) / cohort_Δ_sd
//   IPS = 50 + 20 × weighted_Z  (clip 0~100)
//   해석: ≥70 급성장형 / 50~70 정상 / 30~50 주의 / <30 정체 위험
//
//   Phase 1: cohort_v29.js delta_distributions 잠정값 사용
//   Phase 2: 134명 페어드 raw 분포로 갱신 + 다중회귀 가중치 재학습
// ════════════════════════════════════════════════════════════════════
const IPS_WEIGHTS = {
  trunk_flex_vel_max:        0.40,
  C4_TrunkAcceleration:      0.30,
  Mechanics_Score:           0.20,
  C1_LowerBodyDrive:         0.10,
};

function _zOfDelta(key, delta) {
  const dist = (window.COHORT && COHORT.delta_distributions) ? COHORT.delta_distributions[key] : null;
  if (!dist || dist.sd == null || dist.sd <= 0 || delta == null) return null;
  return (delta - (dist.mean || 0)) / dist.sd;
}

function calculateIPS(h1, h2) {
  if (!h1 || !h2) return null;
  const deltas = {
    trunk_flex_vel_max: null,
    C4_TrunkAcceleration: (h1.cat_scores?.C4_TrunkAcceleration != null && h2.cat_scores?.C4_TrunkAcceleration != null)
      ? h2.cat_scores.C4_TrunkAcceleration - h1.cat_scores.C4_TrunkAcceleration : null,
    Mechanics_Score: (h1.Mechanics_Score != null && h2.Mechanics_Score != null)
      ? h2.Mechanics_Score - h1.Mechanics_Score : null,
    C1_LowerBodyDrive: (h1.cat_scores?.C1_LowerBodyDrive != null && h2.cat_scores?.C1_LowerBodyDrive != null)
      ? h2.cat_scores.C1_LowerBodyDrive - h1.cat_scores.C1_LowerBodyDrive : null,
  };
  if (h1._raw_inputs && h2._raw_inputs) {
    const r1 = h1._raw_inputs.trunk_flex_vel_max;
    const r2 = h2._raw_inputs.trunk_flex_vel_max;
    if (r1 != null && r2 != null) deltas.trunk_flex_vel_max = r2 - r1;
  }
  let weightedZ = 0, totalWeight = 0;
  const components = {};
  for (const key of Object.keys(IPS_WEIGHTS)) {
    const z = _zOfDelta(key, deltas[key]);
    if (z == null) continue;
    const clippedZ = Math.max(-3, Math.min(3, z));
    weightedZ += clippedZ * IPS_WEIGHTS[key];
    totalWeight += IPS_WEIGHTS[key];
    components[key] = { delta: deltas[key], z: Math.round(z * 100) / 100, weight: IPS_WEIGHTS[key] };
  }
  if (totalWeight < 0.4) return null;
  const normalizedZ = weightedZ / totalWeight;
  const score = Math.max(0, Math.min(100, Math.round((50 + 20 * normalizedZ) * 10) / 10));
  let label, color;
  if (score >= 70)      { label = '급성장형';     color = '#4ade80'; }
  else if (score >= 50) { label = '정상 발달';    color = '#60a5fa'; }
  else if (score >= 30) { label = '주의';         color = '#fbbf24'; }
  else                  { label = '정체 위험';    color = '#f87171'; }
  // ★ v32.3 FP tolerance — 0.40+0.30+0.20+0.10이 정확히 1.0이 안 되는 문제
  const isPartial = totalWeight < 0.999;
  return {
    score, label, color, components,
    coverage: totalWeight,
    note: isPartial ? `부분 측정 (가중치 ${Math.round(totalWeight*100)}% 활용)` : null,
  };
}

function renderIPSCard(r1, r2) {
  const extract = (r) => {
    const s = r?.scores || r?.result || r?.calc || r;
    if (!s) return null;
    if (!s._raw_inputs && r?.inputs) {
      const raw = {};
      for (const k of ['trunk_flex_vel_max', 'max_trunk_twist_vel_dps', 'max_cog_velo']) {
        let v = r.inputs.fitness?.[k];
        if (v == null) v = r.inputs.mechanics?.[k];
        if (v != null) raw[k] = v;
      }
      s._raw_inputs = raw;
    }
    return s;
  };
  const h1 = extract(r1);
  const h2 = extract(r2);
  const ips = calculateIPS(h1, h2);
  if (!ips) {
    return `<div style="background:rgba(15,17,21,0.6);border:1px dashed #334155;border-radius:8px;padding:12px 16px;margin-bottom:12px;color:#94a3b8;font-size:12px;">
      <strong style="color:#cbd5e1;">📈 향상 잠재력 점수 (IPS):</strong> 두 시점 데이터로 산출 불가 — trunk_flex_vel_max·C4·메카닉·C1 중 측정된 항목 부족
    </div>`;
  }
  const compRows = Object.entries(ips.components).map(([key, c]) => {
    const dispKey = ({
      trunk_flex_vel_max: '몸통 굴곡 속도 (°/s)',
      C4_TrunkAcceleration: 'C4 몸통 가속',
      Mechanics_Score: '메카닉 종합',
      C1_LowerBodyDrive: 'C1 하체 드라이브',
    })[key] || key;
    const sign = c.delta >= 0 ? '+' : '';
    const deltaStr = key === 'trunk_flex_vel_max' ? `${sign}${(c.delta||0).toFixed(0)} °/s` : `${sign}${(c.delta||0).toFixed(1)}점`;
    const zColor = c.z >= 0.5 ? '#4ade80' : (c.z <= -0.5 ? '#f87171' : '#94a3b8');
    return `<tr>
      <td style="padding:4px 8px;color:#cbd5e1;">${dispKey}</td>
      <td style="padding:4px 8px;text-align:right;font-family:monospace;color:#e2e8f0;">${deltaStr}</td>
      <td style="padding:4px 8px;text-align:right;font-family:monospace;color:${zColor};">z=${c.z>=0?'+':''}${c.z.toFixed(2)}</td>
      <td style="padding:4px 8px;text-align:right;font-size:11px;color:#94a3b8;">w=${c.weight.toFixed(2)}</td>
    </tr>`;
  }).join('');
  const noteHtml = ips.note ? `<div style="font-size:11px;color:#fbbf24;margin-top:4px;">⚠ ${ips.note}</div>` : '';
  return `<div style="background:linear-gradient(135deg,rgba(15,17,21,0.85),rgba(20,30,45,0.85));border:1px solid ${ips.color};border-radius:10px;padding:14px 18px;margin-bottom:14px;">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
      <div>
        <div style="font-size:13px;color:#94a3b8;font-weight:600;">📈 향상 잠재력 점수 (IPS) · v32.0</div>
        <div style="font-size:10px;color:#64748b;margin-top:2px;">H1→H2 변화량 기반 · 134명 코호트 종단 효과크기 가중</div>
      </div>
      <div style="text-align:right;">
        <div style="font-family:'JetBrains Mono',monospace;font-size:32px;font-weight:800;color:${ips.color};line-height:1;">${ips.score.toFixed(1)}</div>
        <div style="font-size:13px;font-weight:700;color:${ips.color};margin-top:2px;">${ips.label}</div>
      </div>
    </div>
    <table style="width:100%;margin-top:10px;font-size:12px;border-collapse:collapse;">
      <thead><tr style="border-bottom:1px solid #334155;color:#64748b;font-size:11px;">
        <th style="padding:4px 8px;text-align:left;font-weight:500;">기여 항목</th>
        <th style="padding:4px 8px;text-align:right;font-weight:500;">Δ (H2−H1)</th>
        <th style="padding:4px 8px;text-align:right;font-weight:500;">z-score</th>
        <th style="padding:4px 8px;text-align:right;font-weight:500;">가중치</th>
      </tr></thead>
      <tbody>${compRows}</tbody>
    </table>
    ${noteHtml}
    <div style="font-size:10px;color:#64748b;margin-top:6px;line-height:1.4;">
      해석 — 70+ 급성장형 / 50~70 정상 / 30~50 주의 / &lt;30 정체 위험. Phase 1 잠정 코호트 분포 사용.
    </div>
  </div>`;
}

// ════════════════════════════════════════════════════════════════════
// 리포트 렌더링
// ════════════════════════════════════════════════════════════════════
// ★ v30.16.1: 좌투/우투 수동 토글 — 헤더 뱃지에서 호출
function toggleArmSide() {
  const cur = CURRENT_INPUT._armSide || 'right';
  CURRENT_INPUT._armSide = (cur === 'left') ? 'right' : 'left';
  const newLabel = CURRENT_INPUT._armSide === 'left' ? '좌투' : '우투';
  console.log(`✏️ 투구 손잡이 변경: ${cur} → ${CURRENT_INPUT._armSide} (${newLabel})`);
  // 리포트 재생성
  if (typeof generateReport === 'function') generateReport();
}

function generateReport() {
  resetImplausibleFlags();   // ★ 비상식 값 플래그 reset (2026-05-03)
  // 입력 변수 수 확인
  const totalFit = Object.keys(CURRENT_INPUT.fitness).length;
  const totalMech = Object.keys(CURRENT_INPUT.mechanics).length;
  if (totalFit === 0 && totalMech === 0) {
    alert('⚠️ 입력된 변수가 없습니다. 최소 1개 이상의 변수를 입력해주세요.');
    return;
  }
  
  const playerName = document.getElementById('player-name').value || '신규 선수';
  const measuredVelo = parseFloat(document.getElementById('player-velo').value) || null;
  const date = document.getElementById('player-date').value || '';
  const result = calculateScores(CURRENT_INPUT, CURRENT_AGE, measuredVelo);
  CURRENT_REPORT_RESULT = result;  // setMechMode 등이 참조

  const reportHtml = renderReportHtml(playerName, measuredVelo, date, result, totalFit, totalMech);
  const area = document.getElementById('report-area');
  area.innerHTML = reportHtml;
  area.classList.remove('hidden');
  // DOM에 캔버스가 박힌 후 레이더 차트 렌더 + 동영상 드롭존 초기화
  renderRadarCharts();
  // ★ Phase 3 v33.7 — 출력 vs 전달 사분면 차트
  renderOutputTransferChart(result);
  setupCoachVideoDropZone();
  // 자동 저장 (같은 name+date+age면 update, 아니면 add)
  const _savedReport = autoSaveReport(true);
  // ★ Phase 3 v33.7.4 — 신규 7변수가 mechanics에 들어가서 자동 저장됐으면 사용자에게 알림
  //   (silent 모드인 autoSaveReport는 토스트 없이 저장만 — 사용자가 저장 사실 모름)
  if (_savedReport && CURRENT_INPUT.mechanics && CURRENT_INPUT.mechanics.wrist_release_speed != null) {
    showAutoSavedToast(_savedReport.name);
  }
  area.scrollIntoView({ behavior: 'smooth' });
}

// ── 레이더 차트 (Chart.js) ─────────────────────────────────────
// ════════════════════════════════════════════════════════════════════
// ★ Phase 3 (v33.7, 2026-05-05) — Output(출력) vs Transfer(전달) 사분면 다이어그램
//   X축: wrist_release_speed percentile (출력 통합)
//   Y축: angular_chain_amplification percentile (전달 통합)
//   색상: elbow_valgus_torque_proxy percentile (부상 위험)
//   사분면: ① elite / ② 낭비형 / ③ 효율형 / ④ 발달
// ════════════════════════════════════════════════════════════════════

// ★ v33.9 — 카테고리별 종합 점수 산출 (OUTPUT·TRANSFER·INJURY 13/13/3 변수 percentile 평균)
//   percentileOfCohort가 polarity 자동 처리하므로 결과를 단순 평균하면 "높은 점수 = 좋음" 의미로 일관됨
//   INJURY는 lower-better 변수가 var_polarity에 'lower'로 등록돼서 자동 반전 → "INJURY 종합 80pt = 안전"
function computeCategoryScore(r, catKey) {
  if (typeof OUTPUT_VS_TRANSFER === 'undefined' || !OUTPUT_VS_TRANSFER[catKey]) return null;
  const cat = OUTPUT_VS_TRANSFER[catKey];
  const m = r.mechanics || r.inputs?.mechanics || (typeof CURRENT_INPUT !== 'undefined' ? CURRENT_INPUT.mechanics : {}) || {};
  const scores = [];
  const breakdown = {};  // 변수별 점수 (디버깅·표시용)
  for (const varKey of cat.variables) {
    const rawVal = m[varKey];
    if (rawVal == null) { breakdown[varKey] = null; continue; }
    const polarity = (typeof COHORT !== 'undefined' && COHORT.var_polarity?.[varKey]) || 'higher';
    const pct = percentileOfCohort(varKey, rawVal, polarity);
    if (pct != null) { scores.push(pct); breakdown[varKey] = pct; }
    else breakdown[varKey] = null;
  }
  if (scores.length === 0) return null;
  return {
    score: Math.round(scores.reduce((a,b)=>a+b,0) / scores.length),
    n_used: scores.length,
    n_total: cat.variables.length,
    breakdown,
  };
}

// 사분면 분류 + 코칭 메시지
function getQuadrantCoaching(outPct, trPct, injPct) {
  if (outPct == null || trPct == null) return null;
  const highOut = outPct >= 50;
  const highTr = trPct >= 50;
  const highInj = (injPct != null && injPct >= 80);  // 부상 percentile 높음 = 위험

  let q, label, color, msg, priority;
  if (highOut && highTr) {
    q = 1; label = '① Elite (출력↑ 전달↑)'; color = '#4ade80';
    msg = '출력과 전달 효율 모두 코호트 상위. 현재 메카닉을 유지하면서 정교화에 집중. 부상 위험 모니터링 + 투구량 관리 우선.';
    priority = '유지·정교화';
  } else if (highOut && !highTr) {
    q = 2; label = '② 낭비형 (출력↑ 전달↓)'; color = '#fb923c';
    msg = '출력은 코호트 상위지만 전달 효율이 평균 이하. 만들어진 출력이 공으로 충분히 전달되지 않고 손실. 시퀀싱 타이밍·X-factor 활용·키네틱 체인 증폭률 점검 필요. 코칭 효과가 가장 큰 유형.';
    priority = '★ 전달 최적화 (코칭 효과 가장 큼)';
  } else if (!highOut && highTr) {
    q = 3; label = '③ 효율형 (출력↓ 전달↑)'; color = '#60a5fa';
    msg = '전달 효율은 좋지만 출력 자체가 부족. 메카닉은 양호하니 체력(파워·근력) 보강으로 출력 끌어올리면 즉시 구속 향상.';
    priority = '체력(F1·F2·F3) 보강';
  } else {
    q = 4; label = '④ 발달 단계 (출력↓ 전달↓)'; color = '#94a3b8';
    msg = '출력·전달 모두 평균 미만. 발달 단계. 체력 기반(파워·SSC) + 메카닉 시퀀싱 동시 향상이 필요. 단계적 접근 권장.';
    priority = '체력 + 시퀀싱 기초 동시 향상';
  }
  let injBlock = '';
  if (highInj) {
    injBlock = ` <strong style="color:#f87171">⚠ 부상 위험 신호</strong>: elbow valgus torque proxy가 코호트 상위 ${100-Math.round(injPct)}%로 UCL stress 모니터링 필요.`;
  }
  return { quadrant: q, label, color, message: msg + injBlock, priority };
}

// 사분면 카드 본문 HTML 생성
function renderOutputTransferCardInner(r) {
  // 통합 지표 raw 값 (헤더 ★ 표시용)
  const m = r.mechanics || r.inputs?.mechanics || (typeof CURRENT_INPUT !== 'undefined' ? CURRENT_INPUT.mechanics : {}) || {};
  const outRaw = m.wrist_release_speed;
  const trRaw  = m.angular_chain_amplification;
  const injRaw = m.elbow_valgus_torque_proxy;

  // ★ v33.9 — 사분면 위치는 카테고리 종합 점수(13/13/3 변수 percentile 평균)로 결정 (단일 변수 outlier 영향 감소)
  const outCat = computeCategoryScore(r, 'OUTPUT');
  const trCat  = computeCategoryScore(r, 'TRANSFER');
  const injCat = computeCategoryScore(r, 'INJURY');
  const outPct = outCat ? outCat.score : null;
  const trPct  = trCat  ? trCat.score  : null;

  // 통합 지표 단일 percentile (헤더 ★ 표시용 — 카테고리 종합과 별도)
  const outIntPct = outRaw != null ? percentileOfCohort('wrist_release_speed', outRaw, 'higher') : null;
  const trIntPct  = trRaw  != null ? percentileOfCohort('angular_chain_amplification', trRaw, 'higher') : null;

  // 부상 카테고리 종합 — INJURY 평균 점수 (높을수록 안전), 사분면 차트 색상은 안전 점수 반전 → 위험 percentile
  const injSafetyPct = injCat ? injCat.score : null;       // 높을수록 안전
  const injRiskPct = injSafetyPct != null ? (100 - injSafetyPct) : null;  // 높을수록 위험
  // 부상 통합 지표 raw rank (참고용)
  let injIntRankPct = null;
  if (injRaw != null && COHORT.var_sorted_lookup.elbow_valgus_torque_proxy) {
    const arr = COHORT.var_sorted_lookup.elbow_valgus_torque_proxy;
    let rank = 0;
    for (let i = 0; i < arr.length; i++) { if (arr[i] <= injRaw) rank++; else break; }
    injIntRankPct = Math.round(100 * rank / arr.length);
  }

  // 부상 알림은 INJURY 카테고리 종합(전체 평균) 또는 통합 지표(elbow_valgus) 둘 중 하나라도 위험이면 발동
  const injAlertPct = Math.max(injRiskPct ?? 0, injIntRankPct ?? 0);
  const coach = getQuadrantCoaching(outPct, trPct, injAlertPct);

  if (outPct == null || trPct == null) {
    return `
      <div class="display text-xl mb-2" style="color: #fb923c">출력 vs 전달 진단</div>
      <div class="text-sm text-[var(--text-muted)] py-8 text-center">
        OUTPUT 또는 TRANSFER 카테고리 변수 산출 실패 — Uplift CSV 업로드 필요
      </div>`;
  }

  const formatPct = p => p != null ? Math.round(p) : '—';
  const ovTLabel = coach ? coach.label : '—';
  const ovTColor = coach ? coach.color : '#94a3b8';

  // 카드 헤더 + 메시지 + 차트 + 세부 변수 표
  return `
    <div class="flex justify-between items-end mb-3">
      <div>
        <div class="mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">DIAGNOSIS · ${ALGORITHM_VERSION}</div>
        <div class="display text-xl mt-1" style="color: #fb923c">출력 vs 전달 분리 진단</div>
      </div>
      <div class="text-right">
        <div class="display text-sm" style="color: ${ovTColor}; font-weight:600">${ovTLabel}</div>
        <div class="text-[10px] text-[var(--text-muted)] mono uppercase mt-1">우선순위: ${coach ? coach.priority : '—'}</div>
      </div>
    </div>
    <div class="text-sm leading-relaxed mb-4 p-3 rounded" style="background:var(--bg-elevated); border-left:3px solid ${ovTColor}">
      ${coach ? coach.message : ''}
    </div>
    <details class="mb-3 text-xs" style="background:var(--bg-elevated); padding:10px; border-radius:4px">
      <summary class="cursor-pointer text-[var(--text-muted)]" style="font-weight:600">📖 이 차트 읽는 법 (코치용)</summary>
      <div class="mt-2 leading-relaxed">
        <div class="mb-2"><strong>X축 — 출력 (Output)</strong>: 선수가 만들어내는 절대 회전·속도 출력의 통합 지표. <code>wrist_release_speed</code>(손목 릴리스 속도)를 코호트 134명과 비교한 percentile (0~100). 50이 코호트 중앙값.</div>
        <div class="mb-2"><strong>Y축 — 전달 (Transfer)</strong>: 만들어진 출력이 분절 간(하체→골반→몸통→팔→공) 얼마나 효율적으로 흐르는가. <code>angular_chain_amplification</code>(골반→팔 전체 증폭률)을 코호트와 비교.</div>
        <div class="mb-2"><strong>4 사분면 의미:</strong></div>
        <ul class="list-none pl-2 space-y-1">
          <li><span style="color:#4ade80">●</span> <strong>① Elite</strong> (출력↑ 전달↑): 만들어내는 출력도 좋고, 키네틱 체인을 통해 공으로 전달도 잘 됨. <em>현재 메카닉 유지 + 부상 모니터링.</em></li>
          <li><span style="color:#fb923c">●</span> <strong>② 낭비형</strong> (출력↑ 전달↓): 출력은 만들어지는데 시퀀싱·증폭률이 낮아 손실. <em>코칭 효과가 가장 큰 유형 — 전달 최적화로 즉시 구속 향상 가능.</em></li>
          <li><span style="color:#60a5fa">●</span> <strong>③ 효율형</strong> (출력↓ 전달↑): 메카닉(전달)은 좋은데 출력 자체가 부족. <em>체력(파워·근력)으로 출력 끌어올리기.</em></li>
          <li><span style="color:#94a3b8">●</span> <strong>④ 발달 단계</strong> (출력↓ 전달↓): 둘 다 평균 미만. <em>체력 + 시퀀싱 기초 동시 향상.</em></li>
        </ul>
        <div class="mt-2"><strong>점 색상</strong>: 부상 위험(<code>elbow_valgus_torque_proxy</code> 코호트 ranking)에 따라 <span style="color:#4ade80">초록(안전)</span> / <span style="color:#fb923c">주황(주의)</span> / <span style="color:#f87171">빨강(상위 20%, UCL stress 모니터링 권장)</span>.</div>
      </div>
    </details>
    <div class="mb-4 relative" style="height: 320px;">
      <canvas id="output-transfer-chart"></canvas>
    </div>
    ${renderOutputTransferAccordion(r, 'OUTPUT', '#4ade80')}
    ${renderOutputTransferAccordion(r, 'TRANSFER', '#fb923c')}
    ${renderOutputTransferAccordion(r, 'INJURY', '#f87171')}
    <details class="mt-3 text-xs">
      <summary class="cursor-pointer text-[var(--text-muted)]">세부 종합 지표 (★ v33.9 카테고리 평균 + 통합 지표)</summary>
      <div class="mt-2">
        <table class="w-full" style="border-collapse:collapse">
          <thead><tr style="border-bottom:1px solid var(--border); color:var(--text-muted)">
            <th class="text-left py-1">카테고리</th>
            <th class="text-right py-1">종합 (n변수 평균)</th>
            <th class="text-left py-1 pl-3">★ 통합 지표</th>
            <th class="text-right py-1">raw</th>
            <th class="text-right py-1">percentile</th>
          </tr></thead>
          <tbody>
            <tr style="border-bottom:1px solid rgba(95,99,107,0.15)">
              <td class="py-1">출력</td>
              <td class="text-right mono" style="color:${outPct >= 50 ? '#4ade80' : '#fb923c'}">${formatPct(outPct)}pt <span class="text-[9px] text-[var(--text-muted)]">(${outCat ? outCat.n_used : 0}/${outCat ? outCat.n_total : 0})</span></td>
              <td class="pl-3">wrist_release_speed (m/s)</td>
              <td class="text-right mono">${outRaw != null ? outRaw.toFixed(2) : '—'}</td>
              <td class="text-right mono">${formatPct(outIntPct)}pt</td>
            </tr>
            <tr style="border-bottom:1px solid rgba(95,99,107,0.15)">
              <td class="py-1">전달</td>
              <td class="text-right mono" style="color:${trPct >= 50 ? '#4ade80' : '#fb923c'}">${formatPct(trPct)}pt <span class="text-[9px] text-[var(--text-muted)]">(${trCat ? trCat.n_used : 0}/${trCat ? trCat.n_total : 0})</span></td>
              <td class="pl-3">angular_chain_amplification</td>
              <td class="text-right mono">${trRaw != null ? trRaw.toFixed(2) : '—'}</td>
              <td class="text-right mono">${formatPct(trIntPct)}pt</td>
            </tr>
            <tr>
              <td class="py-1">부상 (안전도)</td>
              <td class="text-right mono" style="color:${injSafetyPct == null ? '#94a3b8' : injSafetyPct >= 50 ? '#4ade80' : '#f87171'}">${formatPct(injSafetyPct)}pt <span class="text-[9px] text-[var(--text-muted)]">(${injCat ? injCat.n_used : 0}/${injCat ? injCat.n_total : 0})</span></td>
              <td class="pl-3">elbow_valgus_torque_proxy (Nm)</td>
              <td class="text-right mono">${injRaw != null ? injRaw.toFixed(0) : '—'}</td>
              <td class="text-right mono" style="color:${injIntRankPct >= 80 ? '#f87171' : '#94a3b8'}">위험 ${formatPct(injIntRankPct)}pt</td>
            </tr>
          </tbody>
        </table>
        <div class="mt-2 text-[10px] text-[var(--text-muted)] leading-relaxed">
          <strong>종합 (카테고리 평균)</strong>: 각 카테고리 내 산출 가능한 변수의 percentile 평균. 단일 outlier 영향이 적어 사분면 위치 결정에 사용.<br>
          <strong>★ 통합 지표</strong>: 카테고리를 가장 잘 대표하는 단일 변수 (참고용).<br>
          <strong>부상 안전도</strong>: 카테고리 종합은 "높을수록 안전" 의미 (var_polarity가 lower인 변수는 자동 반전됨). 통합 지표 elbow_valgus_torque_proxy는 raw rank 위험 percentile (높을수록 위험)로 별도 표시.
        </div>
      </div>
    </details>`;
}

// 출력/전달/부상 카테고리별 변수 폴더 (아코디언) — 사분면 카드 안에 들어감
function renderOutputTransferAccordion(r, catKey, color) {
  if (typeof OUTPUT_VS_TRANSFER === 'undefined' || !OUTPUT_VS_TRANSFER[catKey]) return '';
  const cat = OUTPUT_VS_TRANSFER[catKey];
  const meta = (typeof OUTPUT_VS_TRANSFER_VAR_META !== 'undefined') ? OUTPUT_VS_TRANSFER_VAR_META : {};
  const m = r.mechanics || r.inputs?.mechanics || (typeof CURRENT_INPUT !== 'undefined' ? CURRENT_INPUT.mechanics : {}) || {};

  // 변수별 행 생성
  const rows = cat.variables.map(varKey => {
    const vm = meta[varKey] || { name: varKey, unit: '', hint: '' };
    const rawVal = m[varKey];
    if (rawVal == null) {
      return `<tr style="border-bottom:1px solid rgba(95,99,107,0.15)">
        <td class="py-1.5 pr-2"><div style="font-weight:500">${vm.name}</div><div class="text-[10px] text-[var(--text-muted)]">${vm.hint}</div></td>
        <td class="text-right mono py-1.5 pr-2 text-[var(--text-muted)]">—</td>
        <td class="text-right mono py-1.5 text-[var(--text-muted)]">—</td>
      </tr>`;
    }
    // percentile 산출 (var_polarity 자동 사용)
    const polarity = (typeof COHORT !== 'undefined' && COHORT.var_polarity?.[varKey]) || 'higher';
    let pct = percentileOfCohort(varKey, rawVal, polarity);
    // INJURY 카테고리는 raw rank (높을수록 위험) + 문헌 절대 임계 동시 표시
    let pctDisplay = '';
    let pctColor = '#94a3b8';
    let litCell = '<td class="text-right py-1.5 pr-2"></td>';  // 기본 빈 (OUTPUT/TRANSFER용)
    if (catKey === 'INJURY') {
      // (1) raw rank percentile (높을수록 위험) — 코호트 내 위치
      const arr = COHORT.var_sorted_lookup?.[varKey];
      if (arr) {
        let rank = 0;
        for (let i = 0; i < arr.length; i++) { if (arr[i] <= rawVal) rank++; else break; }
        const rankPct = Math.round(100 * rank / arr.length);
        pctColor = rankPct >= 80 ? '#f87171' : rankPct >= 60 ? '#fb923c' : '#4ade80';
        pctDisplay = `코호트 ${rankPct}pt`;
      } else {
        pctDisplay = pct != null ? `${pct}pt` : '—';
      }
      // (2) 문헌 절대 임계 분류 (있으면 추가 셀 표시)
      const lit = (typeof INJURY_LITERATURE_THRESHOLDS !== 'undefined') ? INJURY_LITERATURE_THRESHOLDS[varKey] : null;
      if (lit) {
        let band = null;
        if (lit.risk && (lit.risk.min == null || rawVal >= lit.risk.min) && (lit.risk.max == null || rawVal < lit.risk.max)) band = lit.risk;
        else if (lit.monitor && (lit.monitor.min == null || rawVal >= lit.monitor.min) && (lit.monitor.max == null || rawVal < lit.monitor.max)) band = lit.monitor;
        else if (lit.safe && (lit.safe.min == null || rawVal >= lit.safe.min) && (lit.safe.max == null || rawVal < lit.safe.max)) band = lit.safe;
        if (band) {
          litCell = `<td class="text-right py-1.5 pr-2 mono" style="color:${band.color}; white-space:nowrap" title="문헌: ${lit.source}">문헌 <strong>${band.label}</strong></td>`;
        } else {
          litCell = `<td class="text-right py-1.5 pr-2 mono text-[var(--text-muted)]">—</td>`;
        }
      } else {
        // 문헌 임계 없음 (예: elbow_valgus_torque_proxy proxy 한계) — 명시
        litCell = `<td class="text-right py-1.5 pr-2 text-[10px] text-[var(--text-muted)]" title="proxy 한계 — 절대 토크 X, ranking only">문헌 임계 X<br>(proxy)</td>`;
      }
    } else {
      // OUTPUT/TRANSFER는 percentileOfCohort 결과 그대로 (높을수록 좋음)
      pctColor = pct == null ? '#94a3b8' : pct >= 75 ? '#4ade80' : pct >= 50 ? '#fbbf24' : pct >= 30 ? '#fb923c' : '#f87171';
      pctDisplay = pct != null ? `${pct}pt` : '—';
    }
    const rawDisplay = (typeof rawVal === 'number')
      ? (Math.abs(rawVal) >= 100 ? rawVal.toFixed(0) : rawVal.toFixed(2)) + (vm.unit ? ' ' + vm.unit : '')
      : String(rawVal);
    return `<tr style="border-bottom:1px solid rgba(95,99,107,0.15)">
      <td class="py-1.5 pr-2"><div style="font-weight:500">${vm.name}</div><div class="text-[10px] text-[var(--text-muted)]">${vm.hint}</div></td>
      <td class="text-right mono py-1.5 pr-2" style="white-space:nowrap">${rawDisplay}</td>
      ${catKey === 'INJURY' ? litCell : ''}
      <td class="text-right mono py-1.5" style="color:${pctColor}; white-space:nowrap">${pctDisplay}</td>
    </tr>`;
  }).join('');

  // 카테고리 헤더 + integration_var 강조 + ★ v33.9 카테고리 종합 점수
  const intVar = cat.integration_var;
  const intMeta = meta[intVar] || {};
  const intRaw = m[intVar];
  const catScore = computeCategoryScore(r, catKey);  // ★ v33.9
  const catScoreStr = catScore ? `종합 ${catScore.score}pt (${catScore.n_used}/${catScore.n_total}변수)` : '종합 산출 불가';
  const catScoreColor = !catScore ? '#94a3b8'
                      : catKey === 'INJURY' ? (catScore.score >= 50 ? '#4ade80' : '#f87171')
                      : (catScore.score >= 75 ? '#4ade80' : catScore.score >= 50 ? '#fbbf24' : '#fb923c');
  const headerSubtitle = intRaw != null
    ? `통합 지표: ${intMeta.name || intVar} = ${typeof intRaw === 'number' ? (Math.abs(intRaw) >= 100 ? intRaw.toFixed(0) : intRaw.toFixed(2)) : intRaw}${intMeta.unit ? ' ' + intMeta.unit : ''}`
    : `통합 지표: ${intMeta.name || intVar} = (산출 안 됨)`;

  return `
    <details class="mb-2" style="background:var(--bg-elevated); border-left:3px solid ${color}; border-radius:4px">
      <summary class="cursor-pointer p-3" style="font-weight:600">
        <span style="color:${color}">${cat.name}</span>
        <span class="text-[10px] text-[var(--text-muted)] ml-2 mono">${cat.variables.length}변수</span>
        <span class="text-xs ml-3 mono" style="color:${catScoreColor}; font-weight:600">${catScoreStr}</span>
        <div class="text-[11px] mt-1 text-[var(--text-muted)]" style="font-weight:400">${cat.desc}</div>
        <div class="text-[10px] mt-0.5 text-[var(--text-muted)]" style="font-weight:400">${headerSubtitle}</div>
      </summary>
      <div class="px-3 pb-3 text-xs">
        <table class="w-full" style="border-collapse:collapse">
          <thead><tr style="border-bottom:1px solid var(--border); color:var(--text-muted)">
            <th class="text-left py-1.5 pr-2">변수 (의미)</th>
            <th class="text-right py-1.5 pr-2">raw</th>
            ${catKey === 'INJURY' ? '<th class="text-right py-1.5 pr-2">문헌 임계</th>' : ''}
            <th class="text-right py-1.5">${catKey === 'INJURY' ? '코호트 ranking' : 'percentile'}</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        ${catKey === 'INJURY' ? `<div class="mt-2 text-[10px] text-[var(--text-muted)] leading-relaxed">
          <strong>해석:</strong> 문헌 임계와 코호트 ranking이 <strong>동시에 위험 수준</strong>이면 강한 부상 위험 신호. 한쪽만 위험이면 측정 노이즈 또는 코호트 특성 의심. <code>elbow_valgus_torque_proxy</code>는 markerless proxy(0.5×m×L²×ω²)라 절대 토크 비교 불가 — ranking으로만 평가.
        </div>` : ''}
      </div>
    </details>`;
}

// Chart.js scatter로 사분면 다이어그램 렌더 (renderRadarCharts와 동일 패턴)
let _OUTPUT_TRANSFER_CHART = null;
function renderOutputTransferChart(r) {
  if (typeof Chart === 'undefined') return;
  const canvas = document.getElementById('output-transfer-chart');
  if (!canvas) return;
  if (_OUTPUT_TRANSFER_CHART) {
    try { _OUTPUT_TRANSFER_CHART.destroy(); } catch(e) {}
  }
  // ★ v33.9 — 사분면 위치 = 카테고리 종합 점수 (단일 변수 outlier 영향 감소)
  const outCat = computeCategoryScore(r, 'OUTPUT');
  const trCat  = computeCategoryScore(r, 'TRANSFER');
  const injCat = computeCategoryScore(r, 'INJURY');
  const outPct = outCat ? outCat.score : null;
  const trPct  = trCat  ? trCat.score  : null;
  if (outPct == null || trPct == null) return;

  // 부상 위험: INJURY 카테고리 종합 안전도 + 통합 지표 raw rank 둘 중 큰 위험
  const m = r.mechanics || r.inputs?.mechanics || (typeof CURRENT_INPUT !== 'undefined' ? CURRENT_INPUT.mechanics : {}) || {};
  const injRaw = m.elbow_valgus_torque_proxy;
  let injIntRankPct = null;
  if (injRaw != null && COHORT.var_sorted_lookup.elbow_valgus_torque_proxy) {
    const arr = COHORT.var_sorted_lookup.elbow_valgus_torque_proxy;
    let rank = 0;
    for (let i = 0; i < arr.length; i++) { if (arr[i] <= injRaw) rank++; else break; }
    injIntRankPct = Math.round(100 * rank / arr.length);
  }
  const injCatRiskPct = injCat ? (100 - injCat.score) : null;
  const injRankPct = Math.max(injIntRankPct ?? 0, injCatRiskPct ?? 0);
  // 부상 위험에 따른 점 색상 (낮음=초록, 중간=노랑, 높음=빨강)
  const dotColor = injRankPct == null ? '#94a3b8'
                 : injRankPct >= 80 ? '#f87171'
                 : injRankPct >= 60 ? '#fb923c'
                 : '#4ade80';

  _OUTPUT_TRANSFER_CHART = new Chart(canvas, {
    type: 'scatter',
    data: {
      datasets: [{
        label: '선수 위치',
        data: [{ x: outPct, y: trPct }],
        backgroundColor: dotColor,
        borderColor: '#ffffff',
        borderWidth: 2,
        pointRadius: 12,
        pointHoverRadius: 14,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          min: 0, max: 100,
          title: { display: true, text: '출력 (Output) percentile — wrist_release_speed', color: '#94a3b8' },
          grid: { color: 'rgba(95,99,107,0.2)' },
          ticks: { color: '#94a3b8' },
        },
        y: {
          min: 0, max: 100,
          title: { display: true, text: '전달 (Transfer) percentile — angular_chain_amplification', color: '#94a3b8' },
          grid: { color: 'rgba(95,99,107,0.2)' },
          ticks: { color: '#94a3b8' },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `출력 ${Math.round(ctx.parsed.x)}pt · 전달 ${Math.round(ctx.parsed.y)}pt${injRankPct != null ? ' · 부상 ' + injRankPct + 'pt' : ''}`,
          },
        },
        annotation: undefined,  // chartjs-plugin-annotation 없으므로 사분면 라벨은 별도
      },
    },
    // 사분면 가이드선 (50pct 십자선) + 라벨 — afterDraw로 직접 그리기
    plugins: [{
      id: 'quadrantOverlay',
      afterDraw: (chart) => {
        const { ctx, chartArea: ca, scales: { x, y } } = chart;
        ctx.save();
        // 50pct 십자선
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]);
        const x50 = x.getPixelForValue(50);
        const y50 = y.getPixelForValue(50);
        ctx.beginPath();
        ctx.moveTo(x50, ca.top); ctx.lineTo(x50, ca.bottom);
        ctx.moveTo(ca.left, y50); ctx.lineTo(ca.right, y50);
        ctx.stroke();
        ctx.setLineDash([]);
        // 사분면 라벨
        ctx.font = '11px monospace';
        ctx.fillStyle = 'rgba(74,222,128,0.7)';
        ctx.textAlign = 'right'; ctx.textBaseline = 'top';
        ctx.fillText('① Elite', ca.right - 8, ca.top + 6);
        ctx.fillStyle = 'rgba(251,146,60,0.7)';
        ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
        ctx.fillText('② 낭비형', ca.right - 8, ca.bottom - 6);
        ctx.fillStyle = 'rgba(96,165,250,0.7)';
        ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText('③ 효율형', ca.left + 8, ca.top + 6);
        ctx.fillStyle = 'rgba(148,163,184,0.7)';
        ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
        ctx.fillText('④ 발달', ca.left + 8, ca.bottom - 6);
        ctx.restore();
      },
    }],
  });
}

const _RADAR_INSTANCES = {};
function renderRadarCharts() {
  if (typeof Chart === 'undefined') {
    console.warn('Chart.js가 로드되지 않았습니다. 인터넷 연결 또는 CDN 차단을 확인하세요.');
    return;
  }
  const data = window.__BBL_RADAR_DATA__ || [];
  for (const d of data) {
    if (!d) continue;
    const canvas = document.getElementById(d.canvasId);
    if (!canvas) continue;
    // 기존 인스턴스 파괴 (재렌더 대비)
    if (_RADAR_INSTANCES[d.canvasId]) {
      try { _RADAR_INSTANCES[d.canvasId].destroy(); } catch(e) {}
    }
    // 메카닉 카드는 현재 모드(6각형 BBL / 5각형 Driveline)에 따라 데이터 분기
    const useDriveline = d.isMechanics && MECH_VIEW_MODE === '5';
    const labels = useDriveline ? d.drivelineLabels : d.labels;
    const values = useDriveline ? d.drivelineValues : d.values;
    const playerLabel = useDriveline ? '선수 점수 (Driveline)' : '선수 점수';

    _RADAR_INSTANCES[d.canvasId] = new Chart(canvas, {
      type: 'radar',
      data: {
        labels: labels,
        datasets: [
          {
            label: '코호트 평균 (50)',
            data: labels.map(() => 50),
            backgroundColor: 'rgba(95,99,107,0.08)',
            borderColor: 'rgba(95,99,107,0.4)',
            borderWidth: 1,
            borderDash: [3, 3],
            pointRadius: 0,
          },
          {
            label: playerLabel,
            data: values,
            backgroundColor: d.color + '33',  // ~20% 투명
            borderColor: d.color,
            borderWidth: 2,
            pointRadius: 4,
            pointBackgroundColor: d.color,
            pointBorderColor: '#ffffff',
            pointBorderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: {
            min: 0, max: 100,
            ticks: { color: '#5f636b', stepSize: 25, backdropColor: 'transparent', font: { size: 9 } },
            grid: { color: 'rgba(95,99,107,0.2)' },
            angleLines: { color: 'rgba(95,99,107,0.3)' },
            pointLabels: { color: '#b3b5b9', font: { size: 11 } },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#141518',
            borderColor: '#2a2c31',
            borderWidth: 1,
            titleColor: '#e8e9ec',
            bodyColor: '#b3b5b9',
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.r}`,
            },
          },
        },
      },
    });
  }
}

function renderReportHtml(name, measuredVelo, date, r, totalFit, totalMech) {
  const fitRes = (measuredVelo != null && r.PV_predicted != null) ? measuredVelo - r.PV_predicted : null;
  const mechRes = (measuredVelo != null && r.MV_predicted != null) ? measuredVelo - r.MV_predicted : null;
  const growth = (r.ceiling != null && measuredVelo != null) ? r.ceiling - measuredVelo : 
                 (r.ceiling != null && r.MV_predicted != null) ? r.ceiling - r.MV_predicted : null;
  
  // 강점/약점 (75 이상 / 40 이하 카테고리)
  const allCats = [
    ...COHORT.fitness_cats.map(c => ({id:c, area:'체력', score:r.cat_scores[c]})),
    ...COHORT.mechanics_cats.map(c => ({id:c, area:'메카닉', score:r.cat_scores[c]})),
    ...COHORT.control_cats.map(c => ({id:c, area:'제구', score:r.cat_scores[c]})),
  ].filter(c => c.score != null);
  
  const strengths = allCats.filter(c => c.score >= 70).sort((a,b) => b.score - a.score).slice(0, 4);
  const weaknesses = allCats.filter(c => c.score < 40).sort((a,b) => a.score - b.score).slice(0, 4);
  
  // 가장 약한 메카닉 (코칭 우선순위)
  const lowestMech = COHORT.mechanics_cats
    .map(c => ({id:c, score:r.cat_scores[c]}))
    .filter(c => c.score != null)
    .sort((a,b) => a.score - b.score)[0];
  
  // ★ v30.17 Phase 4: 모드별 코칭 메시지 (Mode A/B 분기)
  const _armSide_p4 = CURRENT_INPUT._armSide || 'right';
  const _mode_p4 = getPlayerMode(_armSide_p4, measuredVelo);
  // ★ v33.7.5 — 좌·우투 평가 통일: 단일 임계 사용, 라벨은 정보 표시로만 유지
  const _threshold_p4 = UNIFIED_ELITE_THRESHOLD;
  const _handLabel_p4 = _armSide_p4 === 'left' ? '좌투' : '우투';  // 정보용 라벨 (평가 통일이라 메시지에서 빼도 의미 동일)

  // 활용도 한 줄 (잔차) — 모드별 표현
  let utilLine = '';
  if (fitRes != null && mechRes != null) {
    const fitWord = fitRes >= 5 ? '효율 우수' : fitRes >= 1 ? '효율 양호' : fitRes >= -1 ? '평균적' : fitRes >= -5 ? '능력 미발휘' : '잠재력 잠금';
    const mechWord = mechRes >= 5 ? '효율 우수' : mechRes >= 1 ? '효율 양호' : mechRes >= -1 ? '평균적' : mechRes >= -5 ? '능력 미발휘' : '잠재력 잠금';
    const cls = (fitRes < -5 || mechRes < -5) ? 'bad' : (fitRes >= 5 || mechRes >= 5) ? 'good' : '';
    utilLine = `<div class="summary-callout ${cls}">
      <strong>신체 능력</strong>으로 보면 <strong>${r.PV_predicted?.toFixed(1)} km/h</strong>를 던질 만한 선수인데, 실제로는 <strong>${fitRes >= 0 ? '+' : ''}${fitRes.toFixed(1)} km/h</strong> ${fitRes >= 0 ? '더 잘' : '덜'} 던지고 있습니다 (${fitWord}).
      <strong>투구 메카닉</strong>으로 보면 <strong>${r.MV_predicted?.toFixed(1)} km/h</strong>가 예상되는데, 실제로는 <strong>${mechRes >= 0 ? '+' : ''}${mechRes.toFixed(1)} km/h</strong> ${mechRes >= 0 ? '더 잘' : '덜'} 던지고 있습니다 (${mechWord}).
    </div>`;
  }

  // ★ v30.31 Step 2: 키네틱 체인 개념 설명 (한글화 + GIF + 단계 라벨)
  const kineticChainGifHtml = `
    <div class="card p-4 mb-6" style="border: 1px solid var(--border); background: linear-gradient(180deg, rgba(96,165,250,0.04), transparent);">
      <div class="display text-base mb-2">⚡ 2단계 · 키네틱 체인이란?</div>
      <div class="text-sm leading-relaxed mb-3" style="color: var(--text-secondary);">
        투구는 <strong>다리에서 시작된 힘이 골반 → 몸통 → 팔</strong>로 채찍처럼 전달되는 운동입니다.
        각 단계의 타이밍과 강도가 정확해야 빠른 공이 나오고 부상도 예방됩니다.
      </div>
      <img src="kinetic_chain.gif" alt="키네틱 체인 — 5단계 에너지 흐름"
           loading="lazy" decoding="async"
           style="width:100%; max-width:1000px; display:block; margin:0 auto; border-radius:6px;" />
    </div>`;

  // ★ v30.31 Step 3: 본인 에너지 플로우 진단 (단계별 ✓/⚠ 요약)
  let energyFlowHtml = '';
  try {
    const faults_step3 = detectKineticFaults(CURRENT_INPUT.mechanics || {}, measuredVelo, _armSide_p4);
    const STAGE_NAMES_S3 = {
      1: '하체 드라이브', 2: '앞다리 블록', 3: '분리 형성',
      4: '트렁크 가속', 5: '상지 코킹·전달', 6: '릴리스 가속'
    };
    // 단계별 최고 심각도 집계
    const stageMax = {1:'ok', 2:'ok', 3:'ok', 4:'ok', 5:'ok', 6:'ok'};
    const stageFaults = {1:[], 2:[], 3:[], 4:[], 5:[], 6:[]};
    const sevPriority = {critical: 4, high: 3, medium: 2, low: 1, ok: 0};
    faults_step3.forEach(f => {
      stageFaults[f.stage].push(f);
      if (sevPriority[f.severity] > sevPriority[stageMax[f.stage]]) {
        stageMax[f.stage] = f.severity;
      }
    });
    const sevColorS3 = { critical:'#dc2626', high:'#f97316', medium:'#eab308', low:'#60a5fa', ok:'#4ade80' };
    const sevIcon    = { critical:'🚨', high:'⚠⚠', medium:'⚠', low:'ℹ', ok:'✓' };
    const sevText    = { critical:'에너지 누출 큼', high:'에너지 누출', medium:'주의', low:'경미', ok:'정상' };
    const stageRows = [1,2,3,4,5,6].map(s => {
      const sev = stageMax[s];
      const c = sevColorS3[sev];
      const fs = stageFaults[s];
      const desc = fs.length > 0 ? fs.map(f => f.label.replace(/[⚠🚨].*?\(/, '(')).join(', ') : '결함 없음';
      return `<div class="flex items-center gap-2 py-1.5" style="border-bottom:1px dashed var(--border);">
        <span style="width:20px; text-align:center; font-size:14px;">${sevIcon[sev]}</span>
        <span class="mono text-xs" style="width:30px; color:var(--text-muted);">단계 ${s}</span>
        <strong class="text-sm" style="width:120px; color:${c};">${STAGE_NAMES_S3[s]}</strong>
        <span class="text-xs" style="color:${c}; font-weight:600; margin-right:8px;">${sevText[sev]}</span>
        <span class="text-xs" style="color:var(--text-secondary);">${desc}</span>
      </div>`;
    }).join('');
    const totalLeak = faults_step3.length;
    const criticalLeak = faults_step3.filter(f => f.severity === 'critical').length;
    const highLeak = faults_step3.filter(f => f.severity === 'high').length;
    const summaryColor = criticalLeak > 0 ? '#dc2626' : highLeak > 0 ? '#f97316' : totalLeak > 0 ? '#eab308' : '#4ade80';

    // ★ v33.11 (Theia v0.93 P3 패턴) — Primary Leak 1문장 + 3 KPI 메인, 6단계 상세는 펼침
    //   가장 심각한 fault 1건을 자연어 1문장으로 추출 (사용자가 한 줄로 핵심 진단 인지)
    const sevOrder_p3 = { critical: 0, high: 1, medium: 2, low: 3 };
    const sortedFaults_p3 = [...faults_step3].sort((a,b) => sevOrder_p3[a.severity] - sevOrder_p3[b.severity]);
    const topF = sortedFaults_p3[0];
    const primaryLeakLine = totalLeak === 0
      ? `✅ <strong>전 단계 정상</strong> — 에너지가 깨끗하게 전달되고 있습니다.`
      : `🎯 <strong>주요 손실 구간</strong>: <strong style="color:${summaryColor};">${STAGE_NAMES_S3[topF.stage]}</strong> 단계 — ${topF.label}` +
        (totalLeak > 1 ? ` <span style="color:var(--text-muted);">(추가 ${totalLeak - 1}건은 펼침)</span>` : '');

    // 3 KPI: Lead-leg Block (C2) · Pelvis→Trunk Transfer (C3) · Arm Load Monitor (C5)
    const cs = r.cat_scores || {};
    // ★ v33.12 — 카테고리 라벨/힌트 정리 (사용자 피드백): 형태/타이밍 분리, '무너짐' 표현 제거
    const kpiSpec = [
      { key: 'C2_FrontLegBlock',      label: '앞다리 블록 (형태)',  hint: '무릎 각도 유지력 평가 — FC→BR 형태. 반응 타이밍은 4단계 fault에서 별도 진단' },
      { key: 'C3_SeparationFormation',label: '몸통 로딩·전달',       hint: '분리·lag·골반 회전 통합 (Pelvis→Trunk Transfer)' },
      { key: 'C5_UpperBodyTransfer',  label: '팔 에너지·UCL',       hint: '레이백·전달율·IR 속도 (Arm Load Monitor)' },
    ];
    const kpiHtml = kpiSpec.map(kp => {
      const sc = cs[kp.key];
      const scNum = (sc != null) ? Math.round(sc) : null;
      const c = scNum == null ? 'var(--text-muted)'
              : scNum >= 75 ? '#4ade80'
              : scNum >= 50 ? '#60a5fa'
              : scNum >= 25 ? '#f59e0b'
              : '#ef4444';
      return `<div class="card p-3" style="border-left: 3px solid ${c}; background: var(--bg-elevated);">
        <div class="mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">${kp.label}</div>
        <div class="kpi-row mt-1"><span class="kpi-num" style="color:${c};">${scNum ?? '—'}</span><span class="kpi-unit">/ 100</span></div>
        <div class="text-[11px] mt-1" style="color: var(--text-muted); line-height:1.4;">${kp.hint}</div>
      </div>`;
    }).join('');

    energyFlowHtml = `
    <div class="card p-4 mb-6" style="border: 2px solid ${summaryColor}; background: ${summaryColor}08;">
      <div class="display text-base mb-3" style="color: ${summaryColor};">⚡ 3단계 · 당신의 에너지 흐름</div>
      <div class="primary-leak-line ${totalLeak === 0 ? 'is-good' : ''}">${primaryLeakLine}</div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
        ${kpiHtml}
      </div>
      <details class="theia-details">
        <summary>6단계별 누수 상세 펼치기 (✓/⚠ 6 분절)</summary>
        <div>${stageRows}</div>
      </details>
    </div>`;
  } catch (e) { console.warn('Energy flow render error:', e); }

  // ★ v30.24 Step C: 키네틱 체인 결함 자동 진단 카드
  let faultsHtml = '';
  try {
    const faults = detectKineticFaults(CURRENT_INPUT.mechanics || {}, measuredVelo, _armSide_p4);
    if (faults.length > 0) {
      const STAGE_NAMES = {
        1: '하체 드라이브', 2: '앞다리 블로킹', 3: '분리 형성',
        4: '트렁크 가속', 5: '상지 코킹·전달', 6: '릴리스 가속'
      };
      const sevColor = { critical: '#dc2626', high: '#f97316', medium: '#eab308', low: '#60a5fa' };
      // ★ v33.11 톤 정리 (Theia v0.92) — "매우 위험 (즉시 조치)" → "우선 보강", 프로페셔널 표현
      const sevLabel = { critical: '⚠ 우선 보강', high: '⚠ 점검 권장', medium: '⚡ 중간', low: 'ℹ️ 낮음' };
      // 심각도 정렬
      const sevOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      faults.sort((a,b) => sevOrder[a.severity] - sevOrder[b.severity]);
      const faultRows = faults.map(f => {
        const c = sevColor[f.severity] || '#888';
        // ★ v31.23 변인 설명 접이식 카드 / v31.26 이미지 제거 (사용자 요청)
        const guide = (typeof FAULT_VISUAL_GUIDE !== 'undefined') ? FAULT_VISUAL_GUIDE[f.id] : null;
        const visualBlock = guide ? `
          <details class="mt-2" style="background:#f8fafc; border:1px solid var(--border); border-radius:6px;">
            <summary class="text-xs px-2 py-1.5 cursor-pointer" style="color:#60a5fa; user-select:none;">📖 변인 설명 보기 — <strong>${guide.title}</strong></summary>
            <div class="p-3 text-xs leading-relaxed" style="border-top:1px dashed var(--border); color:var(--text-secondary);">
              <div class="mb-2"><strong style="color:#fbbf24;">현상:</strong> ${guide.desc}</div>
              <div><strong style="color:#4ade80;">관련 피지컬·기술:</strong> ${guide.physical}</div>
            </div>
          </details>` : '';
        return `<div class="card p-3 mb-2" style="border-left: 4px solid ${c};">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-xs px-2 py-0.5 rounded mono" style="background:${c}22; color:${c}; font-weight:600;">${sevLabel[f.severity] || f.severity}</span>
            <span class="text-xs text-[var(--text-muted)] mono">단계 ${f.stage} · ${STAGE_NAMES[f.stage]}</span>
            <strong class="text-sm" style="color:${c}">${f.label}</strong>
          </div>
          <div class="text-xs mt-2" style="color:var(--text-secondary);">
            <strong>원인:</strong> ${f.cause}
          </div>
          <div class="text-xs mt-1" style="color:var(--text-secondary);">
            <strong>코칭:</strong> ${f.coaching}
          </div>
          ${f.drills && f.drills.length ? `<div class="text-xs mt-1" style="color:var(--text-muted);">
            <strong style="color:#4ade80;">💪 추천 drill:</strong> ${f.drills.join(' · ')}
          </div>` : ''}
          ${visualBlock}
        </div>`;
      }).join('');
      const criticalCount = faults.filter(f => f.severity === 'critical').length;
      const highCount = faults.filter(f => f.severity === 'high').length;
      const headerColor = criticalCount > 0 ? '#dc2626' : highCount > 0 ? '#f97316' : '#eab308';

      // ★ v33.11 (Theia v0.92 패턴) — 1차 원인↔주요 손실 구간↔코칭 우선순위 SummaryBar
      //   가장 심각한 fault 1건을 추출해 인과 3카드로 요약 (사용자 인지 부담 감소)
      const STAGE_NAMES_SUM = {
        1: '하체 드라이브', 2: '앞다리 블로킹', 3: '분리 형성',
        4: '트렁크 가속', 5: '상지 코킹·전달', 6: '릴리스 가속'
      };
      const topFault = faults[0]; // 정렬됨 — 가장 심각도 높은 1건
      const causeText  = topFault.cause || '핵심 변수 점검';
      const resultText = `${STAGE_NAMES_SUM[topFault.stage]} 단계 · ${topFault.label}`;
      const coachText  = topFault.coaching || '약점 보강 trial 반복';
      const summaryBarHtml = `
        <div class="cause-result-grid">
          <div class="cause-result-card crc-cause">
            <div class="crc-label">1차 원인 (Cause)</div>
            <div class="crc-body">${causeText}</div>
          </div>
          <div class="cause-result-card crc-result">
            <div class="crc-label">주요 손실 구간 (Result)</div>
            <div class="crc-body">${resultText}</div>
          </div>
          <div class="cause-result-card crc-coach">
            <div class="crc-label">코칭 우선순위 (Action)</div>
            <div class="crc-body">${coachText}</div>
          </div>
        </div>`;

      const tonePreface = criticalCount > 0
        ? `<span style="color:${headerColor}; font-weight:600;">우선 보강 ${criticalCount}건 — 부상 가능성 변수 포함, 가까운 일정으로 점검·중재 권장.</span>`
        : (highCount > 0 ? `점검 권장 ${highCount}건 — 다음 세션 중 보강 진행.` : '');

      faultsHtml = `<div class="card p-4 mb-6" style="border: 2px solid ${headerColor}; background: ${headerColor}08;">
        <div class="display text-base mb-2" style="color:${headerColor};">
          🔬 4단계 · 에너지 리크의 원인
        </div>
        <div class="text-sm mb-1" style="color: var(--text-secondary);">
          감지된 ${faults.length}개 단계의 누출 변수와 인과 구조를 정리합니다.
          ${tonePreface}
        </div>
        ${summaryBarHtml}
        <details class="theia-details" style="margin-top: 14px;">
          <summary>변수별 상세 진단 펼치기 (${faults.length}건)</summary>
          <div>
            ${faultRows}
            <div class="text-[11px] mt-2" style="color:var(--text-muted);">
              심각도: ⚠ 우선 보강 → ⚠ 점검 권장 → ⚡ 중간 → ℹ️ 낮음
            </div>
          </div>
        </details>
      </div>`;
    } else if (measuredVelo != null) {
      faultsHtml = '';  // Step 3에서 이미 정상 메시지 표시 — 중복 제거
    }
  } catch (e) { console.warn('Fault detection error:', e); }

  // ★ v31.6/v31.8 체력·메카닉 편차 + 표면 메카닉형 자동 진단 코칭
  //   분류 4가지: Mechanics-Driven / Strength-Driven / Balanced / Surface Mechanics (NEW)
  //   v31.8: 권진서 케이스 — 자세 점수 좋지만 동적 출력 부족 자동 감지
  let coachingDiagHtml = '';
  try {
    const fitS = r.Fitness_Score, mechS = r.Mechanics_Score;
    if (fitS != null && mechS != null) {
      // ★ v32.7 FP 정밀도 — toFixed(1)로 소수점 1자리 통일 (예: +19.200000000000003 → +19.2)
      const diffRaw = mechS - fitS;
      const diff = +diffRaw.toFixed(1);
      const eliteThr = (CURRENT_INPUT._armSide === 'left') ? 135 : 140;
      const inputs = CURRENT_INPUT.mechanics || {};

      // ★ v31.8 출력 변수 평가 (권진서 같은 케이스 감지)
      const peakArmAv = inputs.peak_arm_av;
      const elbowExtVel = inputs.elbow_ext_vel_max;
      const armTrunkSpeedup = inputs.arm_trunk_speedup;
      // 출력 부족 조건: peak_arm_av < 2500°/s OR elbow_ext_vel < 2000°/s OR speedup < 1.7
      const lowOutput = (peakArmAv != null && peakArmAv < 2500) ||
                        (elbowExtVel != null && elbowExtVel < 2000) ||
                        (armTrunkSpeedup != null && armTrunkSpeedup < 1.7);
      // 표면 메카닉형 조건: 측정 구속이 elite 임계 미만 + 메카닉 점수 ≥ 60 + 출력 부족
      const isSurfaceMech = measuredVelo != null && measuredVelo < eliteThr - 5
                            && mechS >= 60 && lowOutput;

      let typeLabel = null, typeColor = '#60a5fa', narrative = '', strategy = '';
      let velocityGain = null;

      if (isSurfaceMech) {
        // ★ v31.8 표면 메카닉형 — 자세 좋지만 동적 출력 부족 (권진서 패턴)
        typeLabel = '표면 메카닉형 (Surface Mechanics — 자세 우수, 출력 부족)';
        typeColor = '#f97316';
        const outputDetails = [];
        if (peakArmAv != null) outputDetails.push(`팔 회전 속도 ${peakArmAv.toFixed(0)}°/s (Elite ≥4500)`);
        if (elbowExtVel != null) outputDetails.push(`팔꿈치 신전 속도 ${elbowExtVel.toFixed(0)}°/s (Elite ≥2400)`);
        if (armTrunkSpeedup != null) outputDetails.push(`팔/몸통 전달 효율 ${armTrunkSpeedup.toFixed(2)} (Elite 1.88)`);
        narrative = `메카닉 점수 <strong style="color:#f97316;">${mechS}점</strong>이지만 측정 구속 <strong>${measuredVelo.toFixed(1)} km/h</strong>로 elite 임계 미만입니다. <strong>자세 변수(각도)는 좋게 평가</strong>되지만 <strong>동적 출력(회전 속도·팔 속도)이 elite 미달</strong>입니다.`;
        strategy = `<strong>출력(폭발력) 강화 시급</strong>: 자세는 이미 정렬됨 — 추가 자세 미세조정보다 <strong>상체 폭발력·회전 속도</strong> 강화가 직접적 구속 향상으로 연결됩니다.<br/><br/><strong>핵심 약점:</strong><br/>${outputDetails.map(d => `• ${d}`).join('<br/>')}<br/><br/><strong>권장 트레이닝</strong>: Plyo ball 회전 던지기, Med ball rotational throws, Long toss with intent, 상체 폭발력(IMTP·CMJ Peak Power) 강화.`;
        velocityGain = `자세 그대로 유지 + 출력 변수 elite 도달 시 <strong style="color:#4ade80;">+10~15 km/h</strong> 향상 잠재력 (Werner 2008·Driveline R&D 기반).`;
      } else if (diff >= 15) {
        // 메카닉 우선형 — 체력 강화로 lever effect 활용 (정예준 패턴)
        typeLabel = '메카닉 우선형 (Mechanics-Driven)';
        typeColor = '#c084fc';
        narrative = `메카닉 <strong style="color:#c084fc;">${mechS}점</strong>이 체력 <strong>${fitS}점</strong>보다 <strong>+${diff}점</strong> 높습니다. 운동 효율은 elite 수준에 도달했지만 raw 체력이 부족한 상태입니다.`;
        strategy = `<strong>체력 강화 우선</strong>: 이미 갖춘 elite 메카닉이 향상된 체력을 더 효율적으로 구속으로 변환합니다 (lever effect). 체력 약점 (CMJ/SJ Peak Power, IMTP) 집중 트레이닝 권장.`;
        if (r.ceiling_F100 != null && measuredVelo != null) {
          const gainF = r.ceiling_F100 - measuredVelo;
          velocityGain = `체력만 100점 발달 시 → <strong style="color:#4ade80;">+${gainF.toFixed(1)} km/h</strong> 추가 도달 가능 (현재 메카닉 그대로 유지).`;
        }
      } else if (diff <= -15) {
        typeLabel = '체력 우선형 (Strength-Driven)';
        typeColor = '#60a5fa';
        narrative = `체력 <strong style="color:#60a5fa;">${fitS}점</strong>이 메카닉 <strong>${mechS}점</strong>보다 <strong>+${-diff}점</strong> 높습니다. 강한 raw 체력이 운동량 사슬을 견인하지만 메카닉 정착이 필요한 상태입니다.`;
        strategy = `<strong>메카닉 정착 우선</strong>: 강한 체력이 정밀 메카닉과 결합되면 폭발적 효율 향상 가능. 시퀀싱·X-factor·릴리스 안정화 집중 권장.`;
        if (r.ceiling_M100 != null && measuredVelo != null) {
          const gainM = r.ceiling_M100 - measuredVelo;
          velocityGain = `메카닉만 100점 발달 시 → <strong style="color:#4ade80;">+${gainM.toFixed(1)} km/h</strong> 추가 도달 가능 (현재 체력 그대로 유지).`;
        }
      } else {
        typeLabel = '균형 발달형 (Balanced)';
        typeColor = '#4ade80';
        narrative = `체력 <strong>${fitS}점</strong> · 메카닉 <strong>${mechS}점</strong>으로 두 영역이 균형 있게 발달 중 (편차 ${Math.abs(diff)}점 미만).`;
        strategy = `<strong>균형 발달 유지</strong>: 두 영역을 동시에 끌어올리는 종합 트레이닝. 결함 진단 결과를 따라 약점 우선 보강.`;
        velocityGain = null;
      }

      coachingDiagHtml = `
        <div class="card p-4 mb-6" style="border: 2px solid ${typeColor}; background: ${typeColor}10;">
          <div class="display text-base mb-2" style="color: ${typeColor};">🎯 코칭 우선순위 자동 진단</div>
          <div class="text-sm font-bold mb-2" style="color: ${typeColor};">${typeLabel}</div>
          <div class="text-sm leading-relaxed mb-2" style="color: var(--text-secondary);">${narrative}</div>
          <div class="text-sm leading-relaxed mb-2" style="color: var(--text-secondary);">📌 ${strategy}</div>
          ${velocityGain ? `<div class="text-sm" style="background: rgba(74,222,128,0.08); padding: 8px 12px; border-radius: 4px; border-left: 3px solid #4ade80;">⚡ ${velocityGain}</div>` : ''}
        </div>`;
    }
  } catch (e) { console.warn('Coaching diagnosis render error:', e); }

  // ★ v30.31 Step 5: 트레이닝·코칭 방향 (우선순위 1~3 통합)
  let trainingPriorityHtml = '';
  try {
    const faults_s5 = detectKineticFaults(CURRENT_INPUT.mechanics || {}, measuredVelo, _armSide_p4);
    if (faults_s5.length > 0) {
      const sevOrderS5 = { critical: 0, high: 1, medium: 2, low: 3 };
      faults_s5.sort((a,b) => sevOrderS5[a.severity] - sevOrderS5[b.severity]);
      const top3 = faults_s5.slice(0, 3);
      const sevColorS5 = { critical:'#dc2626', high:'#f97316', medium:'#eab308', low:'#60a5fa' };
      const STAGE_NAMES_S5 = {
        1: '하체 드라이브', 2: '앞다리 블록', 3: '분리 형성',
        4: '트렁크 가속', 5: '상지 코킹·전달', 6: '릴리스 가속'
      };
      // ★ v31.5 결함별 코호트 변수 매핑 (한국 고1 단기 향상 가이드)
      //   카테고리에서 제거된 변수는 매핑 제거 — 그 결함들은 코호트 비교 표시 안 됨
      const FAULT_COHORT_VAR = {
        'WeakDrive': 'max_cog_velo',
        'LeadKneeCollapse': 'lead_knee_ext_change_fc_to_br',
        'FlyingOpen': 'trunk_rotation_at_fc',
        'OpenFrontSide': 'shoulder_h_abd_at_fc',
        'LateTrunkRotation': 'pelvis_to_trunk_lag_ms',
        'PelvisTrunkDisconnect': 'pelvis_to_trunk_lag_ms',
        'InsufficientLayback': 'max_shoulder_ER_deg',
        'ElbowOverload': 'elbow_ext_vel_max',
        'ElbowWatchList': 'elbow_ext_vel_max',
        // 제거: SlowDriveHip(drive_hip_ext_vel_max), ShortStride(stride_norm_height),
        //       SoftBlock(com_decel_pct), LateBlock(lead_knee_amortization_ms),
        //       InsufficientCounterRot(peak_torso_counter_rot), TrunkArmDisconnect(arm_trunk_speedup),
        //       TrunkFallingForward(trunk_forward_tilt_at_br) — 카테고리에서 제거된 변수
      };
      const cohortInputs = CURRENT_INPUT.mechanics || {};

      const buildCohortCompare = (f) => {
        const varKey = FAULT_COHORT_VAR[f.id];
        if (!varKey) return '';
        const myVal = cohortInputs[varKey];
        const stats = COHORT.var_distributions?.[varKey];
        if (myVal == null || !stats) return '';
        const median = stats.median;
        const q75 = stats.q75;
        const q25 = stats.q25;
        const unit = (varKey.includes('_ms')) ? ' ms'
                   : (varKey.includes('_dps') || varKey.includes('_vel')) ? ' °/s'
                   : (varKey.includes('cog_velo')) ? ' m/s'
                   : (varKey.includes('decel_pct')) ? ' %'
                   : (varKey.includes('norm_height') || varKey.includes('speedup')) ? ''
                   : '°';
        const fmt = (v) => (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(2));
        return `<div class="text-xs mt-2 p-2" style="background:rgba(96,165,250,0.06); border-left:3px solid #60a5fa; border-radius:3px;">
          <strong style="color:#60a5fa;">📍 한국 고교 코호트 비교 (단기 향상 가이드)</strong>
          <div class="ml-1 mt-1">
            본인 <strong>${fmt(myVal)}${unit}</strong> · 또래 평균 <strong>${fmt(median)}${unit}</strong> · 코호트 상위 25% <strong>${fmt(q75)}${unit}</strong>
          </div>
          <div class="ml-1 mt-1" style="color: var(--text-muted);">
            → 단기 목표: 또래 상위 25% 진입 (${fmt(q75)}${unit})
          </div>
        </div>`;
      };

      const priorityRows = top3.map((f, i) => {
        const c = sevColorS5[f.severity] || '#888';
        return `<div class="card p-3 mb-2" style="border-left: 4px solid ${c}; background: ${c}05;">
          <div class="flex items-center gap-2 mb-2">
            <span class="text-xs px-2 py-0.5 rounded mono" style="background:${c}22; color:${c}; font-weight:700;">우선순위 ${i+1}</span>
            <span class="text-xs text-[var(--text-muted)] mono">단계 ${f.stage} · ${STAGE_NAMES_S5[f.stage]}</span>
            <strong class="text-sm" style="color:${c}">${f.label}</strong>
          </div>
          <div class="text-xs mb-1" style="color: var(--text-secondary);">
            <strong>코칭 방향:</strong> ${f.coaching}
          </div>
          ${buildCohortCompare(f)}
          ${f.drills && f.drills.length ? `<div class="text-xs mt-2" style="color:var(--text-secondary);">
            <strong style="color:#4ade80;">💪 추천 드릴:</strong>
            <div class="ml-4 mt-1">${f.drills.map((d, di) => `${di+1}) ${d}`).join('<br/>')}</div>
          </div>` : ''}
        </div>`;
      }).join('');
      trainingPriorityHtml = `
        <div class="card p-4 mb-6" style="border: 2px solid #4ade80; background: rgba(74,222,128,0.05);">
          <div class="display text-base mb-2" style="color: #4ade80;">💪 5단계 · 어떻게 개선할까</div>
          <div class="text-sm mb-3" style="color: var(--text-secondary);">
            발견된 ${faults_s5.length}개 결함 중 <strong>우선순위 ${Math.min(3, top3.length)}개</strong>를 집중 트레이닝 권장합니다.
            <strong style="color:#60a5fa;">단기 향상 목표는 한국 고교 코호트 기반</strong>이며, 장기 목표는 카테고리 차트의 MLB 평균 대비 점수입니다.
          </div>
          ${priorityRows}
          <div class="text-[11px] mt-2" style="color:var(--text-muted);">
            ※ 코호트 평균/상위 25% 수치는 BBL 데이터베이스 기준. 카테고리별 세부 점수는 위 메카닉·체력·제구 섹션 참조.
          </div>
        </div>`;
    }
  } catch (e) { console.warn('Training priority render error:', e); }

  // ★ Phase 4: 모드별 핵심 코칭 콜아웃 (utilLine보다 위)
  let modeCoachingHtml = '';
  if (measuredVelo != null) {
    if (_mode_p4 === 'sub_elite') {
      // Mode A: Elite gap + 우선 보강 영역
      const eliteGap = _threshold_p4 - measuredVelo;
      const lowestMechName = lowestMech ? (COHORT.category_meta[lowestMech.id]?.name || lowestMech.id) : '메카닉 전반';
      const lowestMechScore = lowestMech ? Math.round(lowestMech.score) : null;
      // ★ v33.7.5 — 좌·우 라벨 제거, 통일된 elite 임계 표현
      modeCoachingHtml = `<div class="summary-callout" style="border-left:4px solid #2563eb; background: rgba(37,99,235,0.08); padding:12px 16px; margin:12px 0;">
        <div class="text-sm font-semibold mb-1" style="color:#2563eb;">🚀 Sub-elite 발전 단계 (Mode A) — Elite 임계값까지</div>
        <div class="text-sm">
          현재 <strong>${measuredVelo} km/h</strong> → <strong>${_threshold_p4} km/h</strong>(Elite 임계) 도달까지 <strong style="color:#f59e0b;">+${eliteGap.toFixed(1)} km/h</strong> 필요.
          ${lowestMechScore != null ? ` 우선 보강 영역 — <strong>${lowestMechName}</strong> (${lowestMechScore}점). 이 카테고리를 elite 평균(70+)으로 끌어올리면 큰 폭의 구속 향상 기대.` : ''}
        </div>
      </div>`;
    } else {
      // Mode B: Elite 정착 + 미세조정 영역
      const aboveThreshold = measuredVelo - _threshold_p4;
      const lowestMechName = lowestMech ? (COHORT.category_meta[lowestMech.id]?.name || lowestMech.id) : '메카닉 전반';
      const lowestMechScore = lowestMech ? Math.round(lowestMech.score) : null;
      // ★ v33.7.5 — 좌·우 라벨 제거, 통일된 elite 임계 표현
      modeCoachingHtml = `<div class="summary-callout" style="border-left:4px solid #7c3aed; background: rgba(124,58,237,0.08); padding:12px 16px; margin:12px 0;">
        <div class="text-sm font-semibold mb-1" style="color:#7c3aed;">⭐ Elite 정착 단계 (Mode B) — Elite 임계 안에서 미세조정</div>
        <div class="text-sm">
          Elite 임계 ${_threshold_p4} km/h를 <strong>+${aboveThreshold.toFixed(1)} km/h</strong> 초과 (현재 ${measuredVelo} km/h).
          ${lowestMechScore != null ? ` 미세조정 영역 — <strong>${lowestMechName}</strong> (${lowestMechScore}점). 안정성·일관성·trial SD 감소가 추가 향상 핵심.` : ''}
        </div>
      </div>`;
    }
  }
  
  // 헤더 — 5칸 직관 (측정 구속 / 체력 PV / 메카닉 MV / 잠재 / 활용도)
  // ★ v30.15 Phase 2: handedness × mode 뱃지 (가독성 개선 v30.15.1, v30.16.1 hotfix)
  const armSide = CURRENT_INPUT._armSide || 'right';
  const mode = getPlayerMode(armSide, measuredVelo);
  const handLabel = armSide === 'left' ? '좌투' : '우투';  // ★ v33.7.5 — 정보 라벨로만 유지 (평가는 통일)
  const modeLabel = mode === 'elite' ? 'Elite 정착 (Mode B)' : 'Sub-elite 발전 (Mode A)';
  const modeIcon = mode === 'elite' ? '⭐' : '🚀';
  const modeColor = mode === 'elite' ? '#7c3aed' : '#2563eb';
  const modeBgColor = mode === 'elite' ? '#ede9fe' : '#dbeafe';
  const threshold = UNIFIED_ELITE_THRESHOLD;  // ★ v33.7.5 — 좌·우 통일 임계 140 km/h
  const modeDesc = mode === 'elite'
    ? `MaxV ≥${threshold} km/h — 미세조정 (좁은 σ)`
    : `MaxV <${threshold} km/h — gap 측정 (넓은 σ)`;
  // ★ v31.27 사용자 요청: 헤더 프로필은 신장·체중만 표시 (BMI, MaxV 제거)
  const heightM = CURRENT_INPUT.fitness?.['Height[M]'];
  const weightKg = CURRENT_INPUT.fitness?.['Weight[KG]'];
  const physInfo = [];
  if (heightM != null)  physInfo.push(`${(heightM*100).toFixed(0)} cm`);
  if (weightKg != null) physInfo.push(`${weightKg.toFixed(0)} kg`);
  const physInfoHtml = physInfo.length
    ? `<div class="mt-2 text-xs flex gap-2" style="color:var(--text-secondary);">${physInfo.join('<span style="opacity:0.4;">·</span>')}</div>`
    : '';
  const modeBadge = `<div class="mt-3 flex flex-wrap gap-2 items-center">
      <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold" style="background:${modeBgColor}; color:${modeColor}; border:2px solid ${modeColor};">
        <span>${modeIcon}</span><span>${handLabel}</span><span style="opacity:0.5;">·</span><span>${modeLabel}</span>
      </div>
      <button onclick="toggleArmSide()" class="text-xs px-2 py-1 rounded border" style="border-color:var(--text-muted);color:var(--text-secondary);background:transparent;" title="좌투/우투 변경 후 리포트 재생성">
        ✏️ ${armSide === 'left' ? '우투' : '좌투'}로 변경
      </button>
      <div class="text-xs" style="color:var(--text-muted);">${modeDesc}</div>
    </div>${physInfoHtml}`;
  const header = `
    <div class="card p-6 mb-6" style="border: 2px solid var(--accent);">
      <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div>
          <div class="mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">Player ID · ${r.age}</div>
          <div class="display text-2xl mt-1">${name.toUpperCase()}</div>
          <div class="text-xs text-[var(--text-muted)] mt-1">${date} · ${totalFit + totalMech}개 변수 입력</div>
          ${modeBadge}
        </div>
        ${measuredVelo != null ? `
        <div>
          <div class="mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">측정 구속</div>
          <div class="kpi-row mt-1"><span class="kpi-num">${measuredVelo.toFixed(1)}</span><span class="kpi-unit">km/h</span></div>
        </div>` : `
        <div>
          <div class="mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">측정 구속</div>
          <div class="display text-2xl mt-1 text-[var(--text-muted)]">미입력</div>
        </div>`}
        <!-- ★ v31.31 라벨/부연 설명 명확화 — "한 영역만 발달, 다른 영역 현재 유지" 의미 명시 -->
        <!-- ★ v33.11 KPI 카드 unit overflow fix (Theia v0.98 패턴) — kpi-row + kpi-num + kpi-unit -->
        <div>
          <div class="mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">체력만 발달 시 잠재 구속</div>
          <div class="kpi-row mt-1"><span class="kpi-num" style="color: var(--fitness)">${r.ceiling_F100?.toFixed(1) ?? '—'}</span><span class="kpi-unit">km/h</span></div>
          ${(measuredVelo != null && r.ceiling_F100 != null) ? `
            <div class="text-sm mt-1" style="color: #4ade80; font-weight:600;">+${(r.ceiling_F100 - measuredVelo).toFixed(1)} km/h</div>
            <div class="text-[10px] text-[var(--text-muted)] mt-1">체력 ${r.Fitness_Score?.toFixed(0) ?? '—'} → 100점, 메카닉 ${r.Mechanics_Score?.toFixed(0) ?? '—'}점 유지</div>` : ''}
        </div>
        <div>
          <div class="mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">메카닉만 발달 시 잠재 구속</div>
          <div class="kpi-row mt-1"><span class="kpi-num" style="color: var(--accent)">${r.ceiling_M100?.toFixed(1) ?? '—'}</span><span class="kpi-unit">km/h</span></div>
          ${(measuredVelo != null && r.ceiling_M100 != null) ? `
            <div class="text-sm mt-1" style="color: #4ade80; font-weight:600;">+${(r.ceiling_M100 - measuredVelo).toFixed(1)} km/h</div>
            <div class="text-[10px] text-[var(--text-muted)] mt-1">메카닉 ${r.Mechanics_Score?.toFixed(0) ?? '—'} → 100점, 체력 ${r.Fitness_Score?.toFixed(0) ?? '—'}점 유지</div>` : ''}
        </div>
        <div>
          <div class="mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">동시 발달 시 잠재 구속</div>
          <div class="kpi-row mt-1"><span class="kpi-num" style="color: var(--warn)">${r.ceiling?.toFixed(1) ?? '—'}</span><span class="kpi-unit">km/h</span></div>
          ${growth != null ? `
            <div class="text-sm mt-1" style="color: #4ade80; font-weight:600;">+${growth.toFixed(1)} km/h</div>
            <div class="text-[10px] text-[var(--text-muted)] mt-1">체력 ${r.Fitness_Score?.toFixed(0) ?? '—'}·메카닉 ${r.Mechanics_Score?.toFixed(0) ?? '—'} → 모두 100점</div>` : ''}
        </div>
      </div>
    </div>`;
  
  // ★ 투수 프로파일 분석 (2026-05-03) — 점수 패턴 기반 타입 분류 + contextual 해석
  //   느린 회전 + 우수 speedup = "효율 타입" (정예준 케이스). 단순 점수 대신 시너지 인식
  const profileHtml = (() => {
    const vs = r.var_scores || {};
    const inputs = CURRENT_INPUT.mechanics || {};
    
    const trunkVel       = inputs['max_trunk_twist_vel_dps'];
    const trunkVelScore  = vs['max_trunk_twist_vel_dps'];
    const speedup        = inputs['arm_trunk_speedup'];
    const speedupScore   = vs['arm_trunk_speedup'];
    const properSeq      = inputs['proper_sequence'];
    const trunkFlexVel   = inputs['trunk_flex_vel_max'];
    const xFactor        = inputs['peak_x_factor'];
    const xFactorScore   = vs['peak_x_factor'];
    const lag2           = inputs['trunk_to_arm_lag_ms'];
    
    if (trunkVel == null || speedup == null) return '';  // 데이터 부족 시 스킵
    
    const traits = [];   // 짧은 라벨들
    let typeLabel = null, typeColor = '#60a5fa', narratives = [];
    
    // 분류 조건
    const seqExcellent = (speedupScore != null && speedupScore >= 85) && (properSeq === 1 || properSeq === undefined);
    const trunkVelModerate = trunkVel >= 600 && trunkVel < 950;
    const trunkVelLow      = trunkVel < 600;
    const trunkVelHigh     = trunkVel >= 950;
    const xFactorGood      = xFactorScore != null && xFactorScore >= 70;
    
    // 체력 vs 메카닉 점수 차이로 발달 유형 추가 분류
    // ★ v30.18: 체력 변수가 너무 적으면 (측정 누락) 비교 보류 — 0점 = 약점이 아닌 데이터 누락
    const fitVarCount = Object.keys(CURRENT_INPUT.fitness || {}).length;
    const fitScore = r.Fitness_Score;
    const mechScore = r.Mechanics_Score;
    const fitDataReliable = fitVarCount >= 5 && fitScore != null && fitScore >= 5;  // 최소 5개 변수 + 0점 아님
    const isPowerDriven = fitDataReliable && mechScore != null && (fitScore - mechScore >= 15);
    const isMechDriven  = fitDataReliable && mechScore != null && (mechScore - fitScore >= 15);
    
    if (seqExcellent && (trunkVelModerate || trunkVelLow)) {
      typeLabel = '효율 타입 (Efficiency Type)';
      typeColor = '#4ade80';
      traits.push('몸통→팔 에너지 전달 비율 우수');
      traits.push('느린 회전 속도가 오히려 강점');
      traits.push('제구 안정성에 유리한 메커니즘');
      narratives.push(`이 선수는 <strong style="color:#4ade80">"효율 타입" 엘리트 투수</strong>입니다. 몸통 회전 속도 ${trunkVel.toFixed(0)} °/s는 평균 수준이지만, <strong>몸통→팔 에너지 전달 비율 ${speedup.toFixed(2)}</strong>(엘리트 1.8~2.2)이 매우 우수해 회전 에너지를 거의 손실 없이 팔로 전달합니다.`);
      narratives.push(`<strong>느린 회전 속도는 약점이 아닌 강점</strong>입니다. 과한 회전 속도는 릴리스 타이밍을 일관되게 맞추기 어렵게 만들지만, 이 선수의 회전 속도는 <strong>릴리스 정밀도와 제구에 유리한 범위</strong>입니다.`);
      if (trunkFlexVel != null && trunkFlexVel >= 600) {
        traits.push('몸통 굴곡 에너지 활용');
        narratives.push(`또한 몸통 굴곡 속도 ${trunkFlexVel.toFixed(0)} °/s가 높아, 회전 에너지 부족분을 <strong>굴곡(forward flex) 에너지로 보완</strong>합니다. 회전 + 굴곡의 복합 운동량이 빠른 구속의 진짜 원천입니다.`);
      }
      if (xFactorGood) {
        traits.push('Hip-shoulder 분리 우수');
      }
    } else if (isPowerDriven) {
      typeLabel = '체력 우선 발달형 (Strength-Driven)';
      typeColor = '#60a5fa';
      traits.push(`체력 ${fitScore.toFixed(0)}점 > 메카닉 ${mechScore.toFixed(0)}점 (+${(fitScore-mechScore).toFixed(0)})`);
      traits.push('하체 폭발력이 운동량 사슬 견인');
      traits.push('메카닉 정착하면 추가 향상 여지');
      narratives.push(`이 선수는 <strong style="color:#60a5fa">"체력 우선 발달형"</strong>입니다. 체력 점수(${fitScore.toFixed(0)})가 메카닉(${mechScore.toFixed(0)})보다 ${(fitScore-mechScore).toFixed(0)}점 높아, <strong>강한 하체 파워가 운동량 사슬 전체를 견인</strong>하는 패턴입니다.`);
      narratives.push(`이런 프로파일은 <strong>메카닉 정착</strong>이 다음 단계입니다. 체력은 이미 갖춰져 있으니, 시퀀싱·X-factor·릴리스 안정화에 집중하면 추가 +2~4 km/h 향상 가능합니다.`);
    } else if (isMechDriven) {
      typeLabel = '메카닉 정착형 (Mechanics-Driven)';
      typeColor = '#c084fc';
      traits.push(`메카닉 ${mechScore.toFixed(0)}점 > 체력 ${fitScore.toFixed(0)}점 (+${(mechScore-fitScore).toFixed(0)})`);
      traits.push('운동량 사슬 시퀀싱 우수');
      traits.push('체력 강화로 lever 효과 기대');
      narratives.push(`이 선수는 <strong style="color:#c084fc">"메카닉 정착형"</strong>입니다. 메카닉 점수(${mechScore.toFixed(0)})가 체력(${fitScore.toFixed(0)})보다 ${(mechScore-fitScore).toFixed(0)}점 높아, <strong>운동 효율은 우수하지만 raw 체력이 부족</strong>한 패턴입니다.`);
      narratives.push(`체력 강화(특히 하체 폭발력)가 다음 단계입니다. 이미 좋은 메카닉이 있어 체력 향상이 <strong>lever 효과</strong>로 큰 구속 향상을 만들 수 있습니다 (정예준 케이스 같은 효율 타입의 진화).`);
    } else if (trunkVelHigh && xFactorGood) {
      typeLabel = '파워 타입 (Power Type)';
      typeColor = '#ff6b35';
      traits.push('강력한 몸통 회전 속도');
      traits.push('큰 Hip-shoulder 분리');
      narratives.push(`이 선수는 <strong style="color:#ff6b35">"파워 타입"</strong>입니다. 몸통 회전 속도 ${trunkVel.toFixed(0)} °/s와 X-factor ${xFactor.toFixed(0)}°가 모두 우수해 회전 에너지로 직접 구속을 만듭니다.`);
      if (speedupScore != null && speedupScore < 70) {
        narratives.push(`다만 몸통→팔 전달 효율(speedup ${speedup.toFixed(2)})은 다소 낮아, 시퀀싱 개선으로 회전 에너지를 더 활용할 여지가 있습니다.`);
      }
    } else if (trunkVelHigh && seqExcellent) {
      typeLabel = '균형 타입 (Balanced Type)';
      typeColor = '#c084fc';
      traits.push('파워 + 효율 모두 우수');
      narratives.push(`이 선수는 <strong style="color:#c084fc">"균형 타입"</strong> — 몸통 회전 파워와 에너지 전달 효율이 모두 elite급입니다.`);
    } else if (trunkVelLow && !seqExcellent) {
      typeLabel = '발달 단계';
      typeColor = '#fbbf24';
      narratives.push(`회전 속도와 에너지 전달 모두 발달 여지가 있습니다. 하체→몸통→팔의 운동량 사슬 강화가 우선입니다.`);
    } else {
      // 일반 케이스
      typeLabel = '균형 발달형';
      narratives.push(`회전 속도, 에너지 전달, 시퀀싱이 균형있게 발달 중입니다.`);
    }
    
    if (!typeLabel) return '';
    
    return `
      <div class="card p-4 mb-6" style="border-left: 4px solid ${typeColor};">
        <div class="display text-sm uppercase tracking-widest mb-2" style="color:${typeColor};">⚡ 투수 프로파일</div>
        <div class="text-lg font-bold mb-3" style="color:${typeColor};">${typeLabel}</div>
        ${traits.length ? `<div class="flex flex-wrap gap-2 mb-3">
          ${traits.map(t => `<span style="background:rgba(74,222,128,0.1);color:${typeColor};font-size:11px;padding:3px 10px;border-radius:12px;border:1px solid ${typeColor}33;">${t}</span>`).join('')}
        </div>` : ''}
        <div class="text-sm leading-relaxed space-y-2">
          ${narratives.map(n => `<p>${n}</p>`).join('')}
        </div>
      </div>`;
  })();

  // ★ v30.33: strengthsHtml 비활성화 — 사용자 피드백으로 요약(summary) 안의 영역별 강점/약점 카드로 대체
  //   기존 코드는 호환성 위해 유지하되 빈 문자열 반환
  const strengthsHtml = '';
  const _strengthsHtml_legacy = (() => {
    const allVarScores = r.var_scores || {};
    const candidates = [];
    // 모든 카테고리에서 변수 수집
    const allCats = [...(COHORT.fitness_cats||[]), ...(COHORT.mechanics_cats||[]), ...(COHORT.control_cats||[])];
    for (const cat of allCats) {
      const vars = COHORT.category_vars[cat] || [];
      for (const v of vars) {
        const [key, name, unit] = v;
        const score = allVarScores[key];
        if (score != null && score >= 75) {
          // 영역 라벨
          let area = '제구';
          if ((COHORT.fitness_cats||[]).includes(cat)) area = '체력';
          else if ((COHORT.mechanics_cats||[]).includes(cat)) area = '메카닉';
          candidates.push({ key, name, score: Math.round(score), area, cat });
        }
      }
    }
    candidates.sort((a, b) => b.score - a.score);
    const top5 = candidates.slice(0, 5);
    if (top5.length === 0) return '';
    const colorByArea = { '체력': '#60a5fa', '메카닉': '#ff6b35', '제구': '#c084fc' };
    const items = top5.map(s => `
      <div style="background:var(--bg-elevated);border-left:3px solid ${colorByArea[s.area]};padding:8px 12px;border-radius:4px;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div class="text-sm font-medium">${s.name}</div>
          <div class="text-[10px] text-[var(--text-muted)]">${s.area} · ${s.key}</div>
        </div>
        <div style="color:#4ade80;font-weight:700;font-size:18px;">${s.score}</div>
      </div>
    `).join('');
    return `
      <div class="card p-4 mb-6">
        <div class="display text-sm uppercase tracking-widest mb-3" style="color:#4ade80;">⭐ 이 선수의 강점 (Top ${top5.length})</div>
        <div class="text-[11px] text-[var(--text-muted)] mb-3">
          ${candidates.length}개 변수가 75점 이상 — 평균 점수가 낮아도 이 영역들은 이미 우수합니다.
          코칭 시 이 강점은 유지하되 약점 영역에 집중하면 효율적.
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
          ${items}
        </div>
      </div>`;
  })();

  // 종합 카드 3개 (체력·메카닉·제구) — 레이더 차트 포함
  const sections = [
    {key: 'Fitness_Score',   label: '체력',   cats: COHORT.fitness_cats,   color: 'var(--fitness)',  hex: '#60a5fa', radarId: 'radar-fit'},
    {key: 'Mechanics_Score', label: '메카닉', cats: COHORT.mechanics_cats, color: 'var(--accent)',   hex: '#ff6b35', radarId: 'radar-mech'},
    {key: 'Control_Score',   label: '제구',   cats: COHORT.control_cats,   color: 'var(--control)',  hex: '#c084fc', radarId: 'radar-ctrl'},
  ];

  // 차트 데이터 캐시 (innerHTML 이후 Chart.js 렌더링에 사용)
  // 메카닉은 6각형(BBL) + 5각형(Driveline) 두 가지 데이터를 모두 저장 → 토글 시 교체
  window.__BBL_RADAR_DATA__ = sections.map(sec => {
    const score = r[sec.key];
    if (score == null) return null;
    // ★ v33.0 — 레이더 라벨이 하위 카드 라벨과 일치하도록 CATEGORY_DETAILS 우선 사용
    //   (cohort_v29.js의 옛 라벨 "X-Factor 형성/몸통 회전 채찍/레이백+팔 전달" → 카드와 동일한 신규 라벨)
    const labels = sec.cats.map(c =>
      (typeof CATEGORY_DETAILS !== 'undefined' && CATEGORY_DETAILS[c]?.name) ||
      (COHORT.category_meta[c]?.name) || c);
    const values = sec.cats.map(c => r.cat_scores[c] != null ? Math.round(r.cat_scores[c]) : 0);
    const data = { canvasId: sec.radarId, color: sec.hex, labels, values };
    if (sec.key === 'Mechanics_Score') {
      data.isMechanics = true;
      const dvScores = drivelineFiveCatScores(r.var_scores || {});
      data.drivelineLabels = DRIVELINE_5_ORDER.map(c => DRIVELINE_5_LABELS_KO[c]);
      data.drivelineValues = DRIVELINE_5_ORDER.map(c => dvScores[c] != null ? Math.round(dvScores[c]) : 0);
    }
    return data;
  });

  const sectionsHtml = sections.map(sec => {
    const score = r[sec.key];
    if (score == null) return `<div class="card p-6">
      <div class="display text-lg mb-2" style="color: ${sec.color}">${sec.label}</div>
      <div class="text-sm text-[var(--text-muted)] py-12 text-center">변수 입력 부족 — 점수 산출 불가</div>
    </div>`;

    // 메카닉 카드는 토글에 따라 본문 전체가 바뀌므로 별도 함수로 분리
    if (sec.key === 'Mechanics_Score') {
      return `<div class="card p-6" id="mech-section-card">${renderMechCardInner(r, MECH_VIEW_MODE)}</div>`;
    }

    // 체력·제구 카드: v29 동일 — 카테고리 아코디언 (변인 점수 + 변인 설명 포함)
    const catRows = sec.cats.map(catId => {
      const catScore = r.cat_scores[catId];
      return renderCategoryAccordion(catId, r.var_scores || {}, catScore);
    }).join('');

    // ★ v30.36 신뢰도 정보
    const sectionCov = sec.key === 'Fitness_Score' ? r.Fitness_Coverage
                     : sec.key === 'Mechanics_Score' ? r.Mechanics_Coverage
                     : r.Control_Coverage;
    const sectionRel = sec.key === 'Fitness_Score' ? r.Fitness_Reliability
                     : sec.key === 'Mechanics_Score' ? r.Mechanics_Reliability
                     : r.Control_Reliability;
    const lowCoverage = sectionCov && sectionCov.pct < 50;
    return `
      <div class="card p-6">
        <div class="flex justify-between items-end mb-2">
          <div>
            <div class="mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">MLB 평균 대비 점수</div>
            <div class="display text-xl mt-1" style="color: ${sec.color}">${sec.label}</div>
          </div>
          <div class="text-right">
            <div class="display text-4xl" style="color: ${lowCoverage ? 'var(--text-muted)' : scoreColor(score)}">${Math.round(score)}</div>
            <div class="text-[10px] text-[var(--text-muted)] mono uppercase">/100</div>
          </div>
        </div>
        ${sectionCov ? `<div class="text-[11px] mb-1" style="color: var(--text-muted);">
          측정 변수: <strong style="color: ${sectionRel?.color || 'var(--text-secondary)'};">${sectionCov.measured}/${sectionCov.total}</strong> (${sectionCov.pct}%) · 신뢰도 <strong style="color: ${sectionRel?.color || 'var(--text-secondary)'};">${sectionRel?.label || '—'}</strong>
          ${lowCoverage ? '<span style="color: #f97316; margin-left:6px;">⚠ 측정 부족 — 점수 참고용</span>' : ''}
        </div>` : ''}
        <div class="text-[11px] text-[var(--text-muted)] mb-3 italic">※ 100점 = MLB 평균 표준값. 80점+ = 한국 고1 elite. 50점 = 발달 평균.</div>
        <div class="mb-4 relative" style="height: 240px;">
          <canvas id="${sec.radarId}"></canvas>
        </div>
        ${catRows}
      </div>`;
  }).join('');
  
  // ── 종합 평가 텍스트 — 점수 분포 + 잠재구속 시나리오 + 우선순위 ──
  // 점수 분포 카운트
  const allCatScores = allCats.filter(c => c.score != null);
  const strongCount = allCatScores.filter(c => c.score >= 70).length;
  const midCount    = allCatScores.filter(c => c.score >= 50 && c.score < 70).length;
  const weakCount   = allCatScores.filter(c => c.score < 50).length;

  // 잠재구속 시나리오 분석 — F100 vs M100
  let scenarioAnalysis = '';
  if (r.ceiling_F100 != null && r.ceiling_M100 != null && measuredVelo != null) {
    const fGain = r.ceiling_F100 - measuredVelo;
    const mGain = r.ceiling_M100 - measuredVelo;
    const totalGain = (r.ceiling_FM100 != null ? r.ceiling_FM100 : r.ceiling) - measuredVelo;
    let priority;
    if (mGain > fGain * 1.3) {
      priority = `<strong style="color: var(--accent)">메카닉 발달이 가장 효과적</strong> (메카닉만 100점 → +${mGain.toFixed(1)} km/h vs 체력만 → +${fGain.toFixed(1)} km/h)`;
    } else if (fGain > mGain * 1.3) {
      priority = `<strong style="color: var(--fitness)">체력 발달이 가장 효과적</strong> (체력만 100점 → +${fGain.toFixed(1)} km/h vs 메카닉만 → +${mGain.toFixed(1)} km/h)`;
    } else {
      priority = `<strong>체력·메카닉 균형 발달 권장</strong> (체력 +${fGain.toFixed(1)}, 메카닉 +${mGain.toFixed(1)} km/h 비슷)`;
    }
    scenarioAnalysis = `<p class="text-sm leading-relaxed mb-3">
      💡 <strong>잠재 구속 분석</strong> — 둘 다 100점 발달 시 <strong>${(r.ceiling_FM100 || r.ceiling).toFixed(1)} km/h</strong> 도달 (현재 +${totalGain.toFixed(1)} km/h). ${priority}.
    </p>`;
  }

  // 다음 단계 우선순위 — 체력·메카닉·제구 통합 가장 낮은 3개
  // ★ v30.21 옵션 E: 체력도 포함 + 카테고리별 구체적 훈련 추천 카드
  const topPriorities = [...COHORT.fitness_cats, ...COHORT.mechanics_cats, ...COHORT.control_cats]
    .map(c => ({ id: c, score: r.cat_scores[c] }))
    .filter(c => c.score != null && c.score < 70)  // elite 이하만
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);
  const priorityHtml = topPriorities.length > 0 ? `
    <div class="mt-4">
      <div class="text-sm font-bold mb-2">🎯 다음 단계 우선순위 + 훈련 추천</div>
      ${topPriorities.map((c, i) => {
        const meta = COHORT.category_meta[c.id] || {};
        const cd = CATEGORY_DETAILS[c.id] || {};
        const coaching = cd.coaching || meta.coaching || meta.short_desc || '';
        const trainRec = (typeof CATEGORY_TRAINING_RECS === 'object' && CATEGORY_TRAINING_RECS[c.id]) || null;
        const trainBlock = trainRec ? `
          <div class="mt-1 pl-3 text-[11px] leading-relaxed" style="color:var(--text-secondary);">
            <div><strong style="color:#4ade80;">💪 추천 훈련:</strong> ${trainRec.exercises.join(' · ')}</div>
            ${trainRec.target ? `<div><strong style="color:#60a5fa;">🎯 6주 목표:</strong> ${trainRec.target}</div>` : ''}
          </div>` : '';
        return `<div class="text-sm leading-relaxed mb-2 pl-3 border-l-2" style="border-color: ${scoreColor(c.score)}">
          <strong>${i+1}. ${meta.name}</strong> <span class="mono text-xs text-[var(--text-muted)]">${Math.round(c.score)}점</span>${coaching ? ` — ${coaching}` : ''}
          ${trainBlock}
        </div>`;
      }).join('')}
    </div>` : '';

  // 점수 분포 한 줄
  const distLine = `<p class="text-sm leading-relaxed mb-3">
    📊 <strong>카테고리 점수 분포</strong>:
    <span class="text-[var(--good)]">우수 (70+) ${strongCount}개</span>,
    <span class="text-[var(--text-secondary)]">평균 (50~69) ${midCount}개</span>,
    <span class="text-[var(--bad)]">보강 필요 (~50) ${weakCount}개</span>
  </p>`;

  // ★ v30.33 키네틱 체인 블록
  //   sectionsHtml(레이더 차트) 뒤, summary 앞에 위치
  // ★ v31.6: 체력·메카닉 편차 자동 진단 카드를 키네틱 체인 블록 맨 위에 추가
  // ★ v32.9 스토리 순서 재배치 (사용자 요청, 2026-05-04)
  //   3 키네틱 체인 개념 (GIF) → 4 마네킹·시퀀스·에너지 흐름 → 5 리크 원인 →
  //   5.5 투수 유형 진단 → (종합 평가는 summary로) → 7 코칭 우선순위 액션
  //   v31.22 대비 변경:
  //     - coachingDiagHtml: 맨 앞 → faultsHtml 다음(5.5)
  //     - trainingPriorityHtml: 맨 끝 → kineticChainBlock 밖(summary 다음, 7)
  const _coachSessionInline = renderCoachSessionHtml(r);
  // ★ Phase 3 v33.7 — 출력 vs 전달 사분면 진단 카드 (메카닉 카드 다음, 키네틱 체인 블록 시작)
  const outputTransferCardHtml = `<div class="card p-6" id="output-transfer-card">${renderOutputTransferCardInner(r)}</div>`;
  // ★ v33.11 (Theia v0.94 P2 패턴) — 메인은 사분면+5축 + 마네킹·단계 진단,
  //   부가 컨텐츠(개념 설명 GIF·모드별 코칭)는 details 펼침으로 격리해 메인 가독성 확보
  const kineticChainBlock = `
    ${outputTransferCardHtml}
    <details class="theia-details">
      <summary>📘 키네틱 체인 개념 + 모드별 코칭 가이드 (펼치기)</summary>
      <div>
        ${kineticChainGifHtml}
        ${modeCoachingHtml}
      </div>
    </details>
    ${_coachSessionInline}
    ${energyFlowHtml}
    ${faultsHtml}
    ${coachingDiagHtml}
  `;
  // ★ v32.9 — 코칭 우선순위 액션 플랜 (종합 평가 다음, 위치 7)
  const actionPlanBlock = `${trainingPriorityHtml}`;

  // ★ v30.33 강점·약점을 영역별로 분리 (사용자 피드백)
  //   기존: 카테고리별 점수 (체력/메카닉/제구 섞여 있음)
  //   변경: 변수 단위로 영역(체력/메카닉/제구) 분리해서 강점·약점 카드로 구성
  const allVarScoresAll = r.var_scores || {};
  const allCatsAll = [...(COHORT.fitness_cats||[]), ...(COHORT.mechanics_cats||[]), ...(COHORT.control_cats||[])];
  const varStrengths = { '체력': [], '메카닉': [], '제구': [] };
  const varWeaknesses = { '체력': [], '메카닉': [], '제구': [] };
  for (const cat of allCatsAll) {
    const vars = COHORT.category_vars[cat] || [];
    for (const v of vars) {
      const [key, vname] = v;
      const vsc = allVarScoresAll[key];
      if (vsc == null) continue;
      let area = '제구';
      if ((COHORT.fitness_cats||[]).includes(cat)) area = '체력';
      else if ((COHORT.mechanics_cats||[]).includes(cat)) area = '메카닉';
      if (vsc >= 75) varStrengths[area].push({ key, name: vname, score: Math.round(vsc) });
      else if (vsc <= 35) varWeaknesses[area].push({ key, name: vname, score: Math.round(vsc) });
    }
  }
  Object.keys(varStrengths).forEach(a => varStrengths[a].sort((x,y) => y.score - x.score));
  Object.keys(varWeaknesses).forEach(a => varWeaknesses[a].sort((x,y) => x.score - y.score));

  const renderVarList = (groups, isStrength) => {
    const colors = { '체력':'#60a5fa', '메카닉':'#ff6b35', '제구':'#c084fc' };
    const sections = ['체력','메카닉','제구'].map(area => {
      const items = groups[area].slice(0, 5);
      if (items.length === 0) return '';
      return `<div class="mb-3">
        <div class="text-xs uppercase tracking-wider mb-1" style="color:${colors[area]}; font-weight:600;">${area}</div>
        <ul class="list-none pl-0 space-y-1">
          ${items.map(it => `<li class="text-sm flex justify-between" style="background:var(--bg-elevated); padding:6px 10px; border-left:3px solid ${colors[area]}; border-radius:3px;">
            <span>${it.name}</span>
            <strong style="color:${isStrength?'#4ade80':'#f87171'}">${it.score}점</strong>
          </li>`).join('')}
        </ul>
      </div>`;
    }).filter(s => s).join('');
    return sections || `<div class="text-xs text-[var(--text-muted)] italic">해당 변수 없음</div>`;
  };

  const totalStrengths = Object.values(varStrengths).reduce((a,b) => a + b.length, 0);
  const totalWeaknesses = Object.values(varWeaknesses).reduce((a,b) => a + b.length, 0);

  // ★ v30.35 잠재력 발전 여지 강조 톤 (이전 "거의 발현" 표현 제거)
  //   elite 구속 케이스에 "현재 잠재력 + 향후 잠재력 자체 성장 가능성" 두 측면 동시 강조
  let prodigyNote = '';
  const eliteThr = (CURRENT_INPUT._armSide === 'left') ? 135 : 140;
  if (measuredVelo != null && measuredVelo >= eliteThr && r.ceiling != null) {
    const gainKmh = r.ceiling - measuredVelo;
    prodigyNote = `
      <div class="card p-4 mb-4" style="border: 2px solid #fbbf24; background: rgba(251,191,36,0.08);">
        <div class="display text-base mb-2" style="color: #fbbf24;">📐 잠재력 발전 가이드</div>
        <div class="text-sm leading-relaxed" style="color: var(--text-secondary);">
          <strong>${name}</strong> 선수는 측정 구속 <strong>${measuredVelo.toFixed(1)} km/h</strong>로
          BBL 고교 투수 코호트 기준 <strong style="color:#fbbf24;">상위 elite 구간 (≥${eliteThr} km/h)</strong>에 위치합니다.
          현 시점의 체력·메카닉이 100점까지 발달하면 <strong style="color:var(--warn);">${r.ceiling.toFixed(1)} km/h</strong>까지 도달 가능 (성장 여지 <strong style="color:#4ade80;">+${gainKmh.toFixed(1)} km/h</strong>).
          <br/><br/>
          <strong>중요 — 잠재력은 고정된 한계가 아닙니다</strong>:
          이 잠재 구속은 <em>현 시점의 신체·메카닉 조건</em> 기준 추정값입니다.
          향후 <strong>신장·근력 성장</strong>, <strong>트레이닝</strong>, <strong>메카닉 정밀화</strong>에 따라
          <strong style="color:#4ade80;">잠재 구속 자체가 더 높아질 수 있습니다</strong>.
          본 리포트의 결함 진단·코칭 우선순위를 따라 발달하면 다음 측정에서 잠재 구속과 측정 구속 모두 상향이 통계적으로 기대됩니다.
          <br/><br/>
          <strong>점수 해석</strong>:
          헤더 카드의 <strong>현재 수준(km/h)</strong>은 체력·메카닉 기준 추정 구속이며,
          참고용 <strong>percentile 점수</strong>(체력 ${r.Fitness_Score}·메카닉 ${r.Mechanics_Score}점)는 또래 코호트 내 상대 위치로
          코칭 진단·결함 식별에 활용됩니다.
          ${(r.Mechanics_Coverage && r.Mechanics_Coverage.pct < 50) ? `
            <br/><strong style="color:#f97316;">⚠ 메카닉 변수 측정 비율 ${r.Mechanics_Coverage.pct}% — 측정 변수 부족으로 메카닉 점수의 신뢰도가 낮습니다. 추가 측정 후 재평가 권장.</strong>
          ` : ''}
        </div>
      </div>`;
  }

  const summary = `
    <div class="card p-6 mt-6" style="background: linear-gradient(135deg, rgba(255,107,53,0.03) 0%, rgba(96,165,250,0.03) 100%); border: 1px solid rgba(255,107,53,0.15);">
      <div class="display text-xl mb-4">📋 종합 평가 (선수·코치용 해설)</div>

      ${(false) ? `
      <div class="card p-3 mb-4" style="border: 2px solid var(--brand); background: rgba(255,107,53,0.06);">
        <div class="display text-base mb-2" style="color: var(--brand);">📊 1단계 · 내 현재 수준과 발전 여지 (★ v31.27 헤더로 이동)</div>
        ${(() => {
          // ★ v30.36 결측치 신뢰도 표시 — 영역별 입력 변수 비율 + 점수 신뢰도 등급
          const buildRow = (label, score, cov, rel, color) => {
            if (cov == null || score == null) return '';
            const lowAlert = cov.pct < 50;
            return `<div class="flex items-center justify-between py-1.5" style="border-bottom: 1px dashed var(--border);">
              <span style="width:80px; color:${color}; font-weight:600;">${label}</span>
              <span style="width:50px; text-align:right;">
                <strong style="color:${lowAlert ? 'var(--text-muted)' : color}; font-size:14px;">${score}점</strong>
              </span>
              <span class="text-xs" style="width:130px; text-align:right; color:var(--text-secondary);">
                ${cov.measured}/${cov.total} 변수 측정 (${cov.pct}%)
              </span>
              <span class="text-xs" style="width:90px; text-align:right;">
                <span style="color:${rel.color}; font-weight:600;">신뢰도 ${rel.label}</span>
              </span>
            </div>`;
          };
          const fitRow = buildRow('체력', r.Fitness_Score, r.Fitness_Coverage, r.Fitness_Reliability, 'var(--fitness)');
          const mechRow = buildRow('메카닉', r.Mechanics_Score, r.Mechanics_Coverage, r.Mechanics_Reliability, 'var(--accent)');
          const ctrlRow = buildRow('제구', r.Control_Score, r.Control_Coverage, r.Control_Reliability, 'var(--control)');
          const lowAreas = [];
          if (r.Fitness_Coverage && r.Fitness_Coverage.pct < 50) lowAreas.push('체력');
          if (r.Mechanics_Coverage && r.Mechanics_Coverage.pct < 50) lowAreas.push('메카닉');
          if (r.Control_Coverage && r.Control_Coverage.pct < 50) lowAreas.push('제구');
          const warnMsg = lowAreas.length > 0
            ? `<div class="text-xs mt-2" style="color: #f97316;">⚠ ${lowAreas.join('·')} 영역 측정 변수 50% 미만 — 점수 신뢰도 낮음. 추가 변수 측정 권장.</div>`
            : '';
          // ★ v31.2 카테고리별 결측 변수 진단 (사용자가 어떤 변수 추가 측정해야 하는지 즉시 인지)
          const allCats = [...(COHORT.fitness_cats||[]), ...(COHORT.mechanics_cats||[]), ...(COHORT.control_cats||[])];
          const skippedCats = allCats.filter(c => r.cat_scores[c] === null);
          const missingDiagRows = [];
          allCats.forEach(catId => {
            const cov = r.cat_scores[catId + '_coverage'];
            if (!cov || cov.pct >= 80) return;  // 80% 이상은 OK
            const meta = COHORT.category_meta?.[catId] || {};
            const colorByArea = (COHORT.fitness_cats||[]).includes(catId) ? '#60a5fa'
                              : (COHORT.mechanics_cats||[]).includes(catId) ? '#ff6b35'
                              : '#c084fc';
            const skipped = r.cat_scores[catId] === null;
            const missingNames = (cov.missing || []).slice(0, 4).map(k => {
              const v = (COHORT.category_vars[catId] || []).find(x => x[0] === k);
              return v ? v[1] : k;
            });
            const missingMore = (cov.missing || []).length > 4 ? ` 외 ${cov.missing.length - 4}개` : '';
            missingDiagRows.push(`<div class="text-[11px] py-1" style="border-bottom: 1px dashed var(--border);">
              <span style="color: ${colorByArea}; font-weight:600;">${meta.name || catId}</span>
              <span style="color: var(--text-muted);"> · ${cov.measured}/${cov.total} 측정 (${cov.pct}%)</span>
              ${skipped ? '<span style="color: #f97316; margin-left:4px;">⚠ 점수 보류</span>' : ''}
              <div class="ml-2 mt-1" style="color: var(--text-muted);">누락: ${missingNames.join(', ')}${missingMore}</div>
            </div>`);
          });
          const missingDiagHtml = missingDiagRows.length > 0
            ? `<div class="card p-3 mt-2" style="background: rgba(249,115,22,0.05); border-left: 3px solid #f97316; border-radius:4px;">
                <div class="text-xs uppercase tracking-wider mb-2" style="color: #f97316;">⚠ 측정 부족 카테고리 진단 (추가 측정 권장)</div>
                ${missingDiagRows.join('')}
                ${skippedCats.length > 0 ? `<div class="text-[11px] mt-2 italic" style="color: var(--text-muted);">
                  ※ 결측 50% 초과 카테고리는 점수 보류 (종합 점수 산출 시 자동 제외).
                </div>` : ''}
              </div>`
            : '';

          return `<div class="card p-3 mt-2" style="background: var(--bg-elevated); border-radius:6px;">
            <div class="text-xs uppercase tracking-wider mb-1" style="color: var(--text-muted);">📍 한국 고교 코호트 percentile — 단기 향상 가이드</div>
            <div class="text-[10px] mb-2 italic" style="color: var(--text-muted);">
              ※ 위 점수(MLB 평균 대비)는 장기 목표 지표, 아래 percentile은 한국 고교 또래 대비 현재 위치 — 단기 향상의 현실적 출발점.
            </div>
            ${fitRow}${mechRow}${ctrlRow}
            ${warnMsg}
          </div>${missingDiagHtml}`;
        })()}
        ${distLine}
      </div>
      ` : ''}
      <!-- ★ v31.27: 1단계 카드 + prodigyNote + utilLine + scenarioAnalysis 통째로 제거 (헤더 카드로 이동) -->


      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <div class="card p-4" style="border-left: 4px solid #4ade80;">
          <div class="display text-base mb-3" style="color: #4ade80;">⭐ 강점 (75점 이상, 영역별)</div>
          ${totalStrengths === 0 ? '<div class="text-xs text-[var(--text-muted)] italic">75점 이상 변수 없음 — 전반적 발달이 우선</div>' : renderVarList(varStrengths, true)}
        </div>
        <div class="card p-4" style="border-left: 4px solid #f87171;">
          <div class="display text-base mb-3" style="color: #f87171;">🔧 약점 (35점 이하, 영역별)</div>
          ${totalWeaknesses === 0 ? '<div class="text-xs text-[var(--text-muted)] italic">35점 이하 변수 없음 — 전반적 안정 단계</div>' : renderVarList(varWeaknesses, false)}
        </div>
      </div>

      ${priorityHtml}
    </div>`;
  
  // 변수별 상세는 각 카테고리 아코디언 안으로 통합됨 (v29와 동일) — 별도 영역 제거

  // 다운로드 + 저장 버튼
  const downloadBtn = `
    <div class="text-center mt-6 space-x-2 space-y-2">
      <button class="btn btn-primary" onclick="saveCurrentReport()">💾 이 리포트 저장 (비교용)</button>
      <button class="btn btn-primary" onclick="downloadOfflineReport()" style="background: #4ade80; color: #0a0b0d;">📦 오프라인 패키지 다운로드 (선수 전송용)</button>
      <button class="btn btn-secondary" onclick="downloadHtmlReport()">📄 HTML 다운로드 (가벼움·인터넷 필요)</button>
      <button class="btn btn-secondary" onclick="window.print()">🖨 인쇄/PDF</button>
    </div>`;

  // ★ v31.22 coachSession을 kineticChainBlock 안으로 통합 — 별도 호출 제거
  // ★ v30.33: ceilingScenarios 별도 섹션 제거 — 헤더 카드의 잠재 구속(FM100) + 시나리오 텍스트로 통합

  // ★ v33.12 — Athlete Card (선수·코치 전달용 4섹션, Theia v0.98 패턴)
  //   사용자 피드백 (2026-05-06): 분석가용 정보가 너무 많음 → 선수가 첫눈에 받아갈 4섹션 별도 카드 신설
  //   ① 잘되는 점 (cat_scores ≥ 75 자동 추출), ② 가장 먼저 볼 점 (faults[0]),
  //   ③ 선수에게 줄 큐 (통일 cue), ④ 오늘 할 훈련 (faults[0].drills) + ⑤ 6주 후 확인 KPI
  let athleteCardHtml = '';
  try {
    const faultsAC = detectKineticFaults(CURRENT_INPUT.mechanics || {}, measuredVelo, _armSide_p4);
    const sevOrderAC = { critical: 0, high: 1, medium: 2, low: 3 };
    faultsAC.sort((a,b) => sevOrderAC[a.severity] - sevOrderAC[b.severity]);
    const csAC = r.cat_scores || {};
    // 강점: cat_scores 75점 이상 카테고리 라벨 (최대 3개)
    const STRENGTH_LABELS = {
      'F1_Strength': '근력', 'F2_Power': '파워', 'F3_Reactivity': 'SSC 반응성',
      'C1_LowerBodyDrive': '하체 추진', 'C2_FrontLegBlock': '앞다리 형태',
      'C3_SeparationFormation': '몸통 로딩·전달', 'C4_TrunkAcceleration': '몸통 회전 출력',
      'C5_UpperBodyTransfer': '팔 에너지', 'C6_ReleaseAcceleration': '릴리스 가속',
    };
    const strongs = Object.entries(csAC)
      .filter(([k, v]) => v != null && v >= 75 && STRENGTH_LABELS[k])
      .sort((a,b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k]) => STRENGTH_LABELS[k]);
    const strongsLine = strongs.length > 0 ? strongs.join(' · ') : '추가 측정으로 강점 판정 권장';
    const topF = faultsAC[0];
    const focusLine = topF ? `${topF.label} (${topF.cause})` : '큰 손실 구간 미감지 — 현재 폼 유지·반복성 강화';
    const drillsLine = topF && topF.drills ? topF.drills.slice(0, 3).join(' / ') : 'Connected throw · Target throw · 저강도 반복';
    // 6주 후 확인 KPI — 현재 약점에 따라 자동 선정 (없으면 기본 4종)
    const kpiList = [];
    if (csAC['P5_ReleaseConsistency'] != null && csAC['P5_ReleaseConsistency'] < 60) kpiList.push('릴리스 3D 위치 SD');
    if (csAC['C5_UpperBodyTransfer'] != null && csAC['C5_UpperBodyTransfer'] < 60) kpiList.push('몸통→팔 lag (40~60ms)');
    if (csAC['C2_FrontLegBlock'] != null && csAC['C2_FrontLegBlock'] < 60) kpiList.push('앞다리 블록 반응 타이밍');
    if (kpiList.length === 0) kpiList.push('릴리스 3D SD', '몸통→팔 lag', '어깨 IR 속도', '블록 타이밍');
    const kpiText = kpiList.slice(0, 4).join(' · ');

    athleteCardHtml = `
    <section class="card p-6 mt-6" style="border-top: 4px solid var(--accent);">
      <div class="kbo-page-head">
        <span class="kbo-page-num">ATHLETE</span>
        <span class="kbo-page-title-en">Today's Card</span>
        <span class="kbo-page-title-kr">선수·코치 전달용 핵심 카드</span>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="cat-card OUTPUT">
          <div class="mono text-[10px] uppercase tracking-widest" style="color:var(--text-muted);">잘되는 점</div>
          <div class="text-base mt-1" style="color:var(--text-primary); line-height:1.55;">${strongsLine}</div>
        </div>
        <div class="cat-card LEAK">
          <div class="mono text-[10px] uppercase tracking-widest" style="color:var(--text-muted);">가장 먼저 볼 점</div>
          <div class="text-base mt-1" style="color:var(--text-primary); line-height:1.55;">${focusLine}</div>
        </div>
      </div>
      <div class="kbo-plain mt-4">
        <span class="kbo-plain-tag">선수 큐</span>
        <span><strong>"앞발이 닿으면 빨리 버티고, 몸통 다음에 팔이 나오게 하자."</strong></span>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <div class="cat-card CONTROL">
          <div class="mono text-[10px] uppercase tracking-widest" style="color:var(--text-muted);">오늘 할 훈련 (3개)</div>
          <div class="text-sm mt-1" style="color:var(--text-secondary); line-height:1.6;">${drillsLine}</div>
        </div>
        <div class="cat-card TRANSFER">
          <div class="mono text-[10px] uppercase tracking-widest" style="color:var(--text-muted);">6주 후 확인 KPI</div>
          <div class="text-sm mt-1" style="color:var(--text-secondary); line-height:1.6;">${kpiText}</div>
        </div>
      </div>
      <div class="text-[11px] mt-3" style="color:var(--text-muted);">※ 분석가용 세부 점수·산식·코호트 percentile은 위 섹션 참조. 본 카드는 선수·코치가 한눈에 받아갈 수 있도록 4섹션으로 압축한 것입니다.</div>
    </section>`;
  } catch (e) { console.warn('Athlete Card render error:', e); }

  // ★ v31.22 순서 재배치 (사용자 요청, 2026-05-04)
  //   1) header (점수 + 잠재 구속 통합)
  //   2) profileHtml (투수 프로파일 분석)
  //   3) sectionsHtml (체력·메카닉·제구 레이더 차트)
  //   4) kineticChainBlock = 3 GIF → 4 마네킹·시퀀스·에너지 흐름 → 5 리크 원인 → 5.5 투수 유형 진단
  //   5) summary (6 점수·강점·약점·종합 멘트)
  //   6) actionPlanBlock (7 코칭 우선순위 액션 — v32.9에서 분리)
  //   7) athleteCardHtml (v33.12 — 선수·코치 전달용 핵심 카드, 마지막에 노출)
  return header
    + profileHtml
    + `<div class="grid grid-cols-1 md:grid-cols-3 gap-4">` + sectionsHtml + `</div>`
    + kineticChainBlock
    + summary
    + actionPlanBlock
    + athleteCardHtml
    + downloadBtn;
}

// 잠재 구속 3가지 시나리오 카드 (헤더 바로 아래)
function renderCeilingScenarioCard(r, measuredVelo) {
  if (r.ceiling == null || measuredVelo == null) return '';
  const scenarios = [
    { name: '체력만 100점',     val: r.ceiling_F100,  desc: '메카닉은 현재 유지', color: 'var(--fitness)' },
    { name: '메카닉만 100점',   val: r.ceiling_M100,  desc: '체력은 현재 유지',   color: 'var(--accent)' },
    { name: '체력+메카닉 100점', val: r.ceiling_FM100, desc: '둘 다 100점 발달',  color: 'var(--good)' },
  ].filter(s => s.val != null);
  if (scenarios.length === 0) return '';
  const capped = r.theoretical_ceiling != null && r.theoretical_ceiling > r.ceiling + 0.5;
  const capNote = capped
    ? `<div class="text-[10px] text-[var(--text-muted)] mt-2 italic">⚠ 이론값 ${r.theoretical_ceiling.toFixed(1)} km/h 이나 현재 quality(체력·메카닉 점수) 기반 현실 한도로 보정됨 — 점수가 낮을수록 발달 가능폭도 작아짐</div>`
    : '';
  return `
    <div class="card p-5 mb-4" style="border-top: 2px solid var(--accent);">
      <div class="flex justify-between items-end mb-3">
        <div class="display text-base">📈 잠재 구속 시나리오</div>
        <div class="text-xs text-[var(--text-muted)]">측정 구속 <strong class="mono text-[var(--text-primary)]">${measuredVelo.toFixed(1)} km/h</strong> 기준 — 발달 영역에 따른 도달 가능 구속</div>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
        ${scenarios.map(s => {
          const gain = s.val - measuredVelo;
          return `
          <div class="card p-3" style="background: var(--bg-elevated); border-left: 3px solid ${s.color};">
            <div class="mono text-[10px] text-[var(--text-muted)] uppercase tracking-wider">${s.name}</div>
            <div class="display text-2xl mt-1" style="color: ${s.color}">${s.val.toFixed(1)}<span class="text-xs ml-1 text-[var(--text-muted)]">km/h</span></div>
            <div class="text-[10px] mt-1" style="color: ${gain > 0 ? 'var(--good)' : 'var(--text-muted)'}">+${gain.toFixed(1)} km/h 성장</div>
            <div class="text-[10px] text-[var(--text-muted)] mt-1">${s.desc}</div>
          </div>`;
        }).join('')}
      </div>
      ${capNote}
    </div>`;
}

// ════════════════════════════════════════════════════════════════════
// 저장된 리포트 (localStorage) + 탭 전환 + 비교 뷰
// ════════════════════════════════════════════════════════════════════
const SAVED_REPORTS_KEY = 'BBL_SAVED_REPORTS_v1';
let SAVED_REPORTS = [];

function loadSavedReports() {
  try {
    const raw = localStorage.getItem(SAVED_REPORTS_KEY);
    if (raw) SAVED_REPORTS = JSON.parse(raw);
  } catch (e) { SAVED_REPORTS = []; }
}
function persistSavedReports() {
  try { localStorage.setItem(SAVED_REPORTS_KEY, JSON.stringify(SAVED_REPORTS)); }
  catch (e) { console.error('localStorage 저장 실패:', e); }
}

// 자동 저장 — 같은 (name + date + age)면 update, 아니면 add
function autoSaveReport(silent = false) {
  const name = document.getElementById('player-name').value || '신규 선수';
  const date = document.getElementById('player-date').value || '';
  const age  = CURRENT_AGE;
  const velo = parseFloat(document.getElementById('player-velo').value) || null;
  const totalVars = Object.keys(CURRENT_INPUT.fitness).length + Object.keys(CURRENT_INPUT.mechanics).length;
  if (totalVars === 0) return null;

  const result = CURRENT_REPORT_RESULT || calculateScores(CURRENT_INPUT, age, velo);
  const existingIdx = SAVED_REPORTS.findIndex(r => r.name === name && r.date === date && r.age === age);
  const report = {
    id: existingIdx >= 0 ? SAVED_REPORTS[existingIdx].id
                         : 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    name, age, date, measuredVelo: velo,
    armSide: CURRENT_INPUT._armSide || 'right',  // ★ v30.15 Phase 2 stamp
    mode: getPlayerMode(CURRENT_INPUT._armSide || 'right', velo),
    inputs: JSON.parse(JSON.stringify(CURRENT_INPUT)),
    scores: result,
    savedAt: new Date().toISOString(),
    algorithm_version: ALGORITHM_VERSION,  // ★ 산식 버전 stamp
    algorithm_date:    ALGORITHM_DATE,
  };
  if (existingIdx >= 0) SAVED_REPORTS[existingIdx] = report;
  else SAVED_REPORTS.push(report);
  persistSavedReports();
  refreshPlayerSelector();
  return report;
}

function saveCurrentReport() {
  const totalVars = Object.keys(CURRENT_INPUT.fitness).length + Object.keys(CURRENT_INPUT.mechanics).length;
  if (totalVars === 0) {
    alert('⚠️ 입력 변수가 없어 저장할 수 없습니다. CSV를 업로드하고 리포트를 먼저 생성해주세요.');
    return;
  }
  const r = autoSaveReport(true);
  if (r) alert(`✅ 리포트 저장 완료: ${r.name}${r.date ? ' (' + r.date + ')' : ''}\n총 저장 ${SAVED_REPORTS.length}개`);
}

// 저장된 선수 dropdown 갱신 — 이전 선택값 보존 (autoSave 후에도 selection 유지)
function refreshPlayerSelector() {
  const sel = document.getElementById('saved-player-select');
  const wrap = document.getElementById('saved-player-selector');
  if (!sel || !wrap) return;
  const prevValue = sel.value;
  if (SAVED_REPORTS.length === 0) {
    wrap.classList.add('hidden');
    return;
  }
  wrap.classList.remove('hidden');
  const opts = SAVED_REPORTS
    .slice()
    .sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt))
    .map(r => `<option value="${r.id}">${r.name} · ${r.age || '—'} · ${r.date || '날짜없음'}${r.measuredVelo != null ? ' · ' + r.measuredVelo + 'km/h' : ''}</option>`)
    .join('');
  sel.innerHTML = '<option value="">— 선택 안 함 (새로 입력) —</option>' + opts;
  // 이전 선택값이 여전히 존재하면 복원 (autoSave 후 dropdown이 새로 그려져도 선택 유지)
  if (prevValue && SAVED_REPORTS.find(r => r.id === prevValue)) {
    sel.value = prevValue;
  }
}

// 저장된 선수 데이터 복원 + 자동 리포트 생성
function loadSavedPlayer(id) {
  if (!id) return;
  const saved = SAVED_REPORTS.find(r => r.id === id);
  if (!saved) return;

  // Step 1 필드 복원
  document.getElementById('player-name').value = saved.name || '';
  document.getElementById('player-date').value = saved.date || '';
  document.getElementById('player-velo').value = saved.measuredVelo != null ? saved.measuredVelo : '';
  selectAge(saved.age || '고교');

  // 입력 데이터 복원
  CURRENT_INPUT.fitness  = JSON.parse(JSON.stringify((saved.inputs && saved.inputs.fitness) || {}));
  CURRENT_INPUT.mechanics = JSON.parse(JSON.stringify((saved.inputs && saved.inputs.mechanics) || {}));
  // ★ v30.15 Phase 2 / v30.16.1: armSide 복원 — 옛 저장본은 master_fitness 자동 매칭으로 추론
  CURRENT_INPUT._armSide = saved.armSide || (saved.inputs && saved.inputs._armSide) || null;
  if (!CURRENT_INPUT._armSide && typeof MASTER_FITNESS_LOOKUP === 'object') {
    // master_fitness에서 같은 이름·날짜 매칭으로 handedness 가져오기
    const matchKey = `${saved.name}_${saved.date}`;
    const masterRow = MASTER_FITNESS_LOOKUP?.[matchKey] || MASTER_FITNESS_LOOKUP?.[saved.name];
    if (masterRow && masterRow.Handedness) {
      CURRENT_INPUT._armSide = masterRow.Handedness.toLowerCase() === 'l' ? 'left' : 'right';
      console.log(`📋 master_fitness에서 ${saved.name} 손잡이 복원: ${CURRENT_INPUT._armSide}`);
    }
  }
  if (!CURRENT_INPUT._armSide) CURRENT_INPUT._armSide = 'right';  // 최종 fallback

  // Step 2 status 복원
  const fitCount = Object.keys(CURRENT_INPUT.fitness).length;
  const mechCount = Object.keys(CURRENT_INPUT.mechanics).length;
  const fitStatus = document.getElementById('fitness-upload-status');
  const fitEmpty = document.getElementById('fitness-empty-state');
  const fitSummary = document.getElementById('fitness-upload-summary');
  if (fitStatus && fitEmpty && fitSummary) {
    if (fitCount > 0) {
      fitStatus.classList.remove('hidden');
      fitEmpty.classList.add('hidden');
      fitSummary.innerHTML = `✅ <strong>저장된 선수 복원</strong> — 체력+구속 변수 ${fitCount}개`;
    } else {
      fitStatus.classList.add('hidden');
      fitEmpty.classList.remove('hidden');
    }
  }
  // Step 3 status 복원
  const mechStatus = document.getElementById('mech-upload-status');
  const mechEmpty = document.getElementById('mech-empty-state');
  const mechSummary = document.getElementById('mech-upload-summary');
  if (mechStatus && mechEmpty && mechSummary) {
    if (mechCount > 0) {
      mechStatus.classList.remove('hidden');
      mechEmpty.classList.add('hidden');
      mechSummary.innerHTML = `✅ <strong>저장된 선수 복원</strong> — 메카닉 변수 ${mechCount}개`;
    } else {
      mechStatus.classList.add('hidden');
      mechEmpty.classList.remove('hidden');
    }
  }

  // 자동 리포트 생성 (현재 알고리즘으로 재계산됨)
  generateReport();
}

function deleteSelectedSavedPlayer() {
  const sel = document.getElementById('saved-player-select');
  if (!sel || !sel.value) {
    alert('삭제할 선수를 먼저 위 드롭다운에서 선택해주세요.');
    return;
  }
  const id = sel.value;
  const saved = SAVED_REPORTS.find(r => r.id === id);
  if (!saved) {
    alert('선택한 선수를 찾을 수 없습니다.');
    return;
  }
  if (!confirm(`정말 삭제하시겠어요?\n\n${saved.name} (${saved.age || '—'} · ${saved.date || '날짜없음'})`)) return;
  SAVED_REPORTS = SAVED_REPORTS.filter(r => r.id !== id);
  persistSavedReports();
  sel.value = '';  // 선택 초기화
  refreshPlayerSelector();
  alert(`✅ 삭제 완료: ${saved.name}`);
}

// ════════════════════════════════════════════════════════════════════
// 비교 뷰 (H1↔H2 / 선수간) 오프라인 패키지 다운로드
// 인터넷 없이 비교 결과를 선수·지도자에게 전달
// ════════════════════════════════════════════════════════════════════
async function downloadComparisonOfflinePackage(prefix) {
  // 1) 선택된 선수 모음
  let reports, labels, titlePrefix;
  if (prefix === 'h1h2') {
    const r1Id = document.getElementById('h1h2-r1')?.value;
    const r2Id = document.getElementById('h1h2-r2')?.value;
    const r1 = SAVED_REPORTS.find(r => r.id === r1Id);
    const r2 = SAVED_REPORTS.find(r => r.id === r2Id);
    if (!r1 || !r2) { alert('1차/2차 리포트를 모두 선택해주세요.'); return; }
    reports = [r1, r2];
    labels = ['1차', '2차'];
    titlePrefix = `${r1.name} 1차↔2차 비교`;
  } else {
    const ids = ['vs-a', 'vs-b', 'vs-c', 'vs-d']
      .map(id => document.getElementById(id)?.value)
      .filter(v => v);
    reports = ids.map(id => SAVED_REPORTS.find(r => r.id === id)).filter(r => r);
    if (reports.length < 2) { alert('비교할 선수를 2명 이상 선택해주세요.'); return; }
    labels = reports.map(r => r.name);
    titlePrefix = `선수간 비교 (${labels.join(' vs ')})`;
  }

  const progress = document.createElement('div');
  progress.style.cssText = 'position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); background:#141518; padding:24px 32px; border:2px solid var(--accent); border-radius:8px; z-index:99999; color:#e8e9ec; font-size:14px; box-shadow:0 20px 60px rgba(0,0,0,0.6); min-width:340px; text-align:center;';
  progress.innerHTML = '📦 오프라인 패키지 만드는 중...';
  document.body.appendChild(progress);

  try {
    // 2) Chart.js
    progress.innerHTML = '📦 (1/3) Chart.js 다운로드 중...';
    const chartJsSrc = await fetch('https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js').then(r => r.text());

    // 3) 비교 HTML 새로 생성 (selector·버튼 등 인터랙션 요소 제외, 순수 결과만)
    progress.innerHTML = '📦 (2/3) 비교 HTML 조립 중...';
    const comparisonHtml = renderComparisonHtml(reports, labels, prefix);

    // 4) 모든 inline style + 컴파일된 CSS 캡처
    let allStyles = '';
    Array.from(document.querySelectorAll('style')).forEach(s => { allStyles += s.textContent + '\n'; });
    Array.from(document.styleSheets).forEach(sheet => {
      try { for (const rule of sheet.cssRules) allStyles += rule.cssText + '\n'; } catch (e) {}
    });

    // 5) 레이더 차트 데이터 — 오프라인에서 init 시 그릴 수 있도록 직렬화
    progress.innerHTML = '📦 (3/3) HTML 패키지 마무리...';
    const cmpColors = ['#60a5fa', '#ff6b35', '#4ade80', '#c084fc'];
    const sets = [
      { area: 'fitness',   cats: COHORT.fitness_cats },
      { area: 'mechanics', cats: COHORT.mechanics_cats },
      { area: 'control',   cats: COHORT.control_cats },
    ];
    const radarConfigs = sets.map(s => ({
      canvasId: `${prefix}-radar-${s.area}`,
      labels: s.cats.map(c => CATEGORY_DETAILS[c]?.name || c),
      datasets: reports.map((r, i) => ({
        label: labels[i],
        data: s.cats.map(c => r.scores.cat_scores?.[c] != null ? Math.round(r.scores.cat_scores[c]) : 0),
        backgroundColor: cmpColors[i] + '20',
        borderColor: cmpColors[i],
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: cmpColors[i],
      })),
    }));

    const safeChartJs = chartJsSrc.replace(/<\/script>/gi, '<\\/script>');
    const safeJson = (obj) => JSON.stringify(obj).replace(/</g, '\\u003c');

    const initScript = `
const __RADAR_CFG__ = ${safeJson(radarConfigs)};
window.addEventListener("DOMContentLoaded", function(){
  if (typeof Chart === 'undefined') return;
  setTimeout(function(){
    for (const cfg of __RADAR_CFG__) {
      const canvas = document.getElementById(cfg.canvasId);
      if (!canvas) continue;
      new Chart(canvas, {
        type: 'radar',
        data: { labels: cfg.labels, datasets: cfg.datasets },
        options: {
          responsive: true, maintainAspectRatio: false,
          scales: { r: { min: 0, max: 100,
            ticks: { color: '#5f636b', stepSize: 25, backdropColor: 'transparent', font: { size: 9 } },
            grid: { color: 'rgba(95,99,107,0.2)' },
            angleLines: { color: 'rgba(95,99,107,0.3)' },
            pointLabels: { color: '#b3b5b9', font: { size: 11 } } } },
          plugins: { legend: { display: true, position: 'bottom', labels: { color: '#b3b5b9', font: { size: 10 }, boxWidth: 12, padding: 8 } } }
        }
      });
    }
  }, 100);
});`;

    const fullHtml = '<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">'
      + '<title>BBL ' + titlePrefix + '</title>'
      + '<meta name="viewport" content="width=device-width, initial-scale=1.0">'
      + '<meta name="robots" content="noindex, nofollow">'
      + '<style>' + allStyles + '</style>'
      + '<script>' + safeChartJs + '<\/script>'
      + '</head>'
      + '<body class="min-h-screen" style="background:#f5f7fa; color:#1a1a1a; font-family: \'Inter\', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;">'
      + '<div class="max-w-7xl mx-auto px-6 py-8">'
      + '<header class="border-b border-[#2a2c31] mb-6 pb-4">'
      +   '<div class="display text-2xl">📋 BBL ' + (prefix === 'h1h2' ? '1차 ↔ 2차 비교' : '선수간 비교') + '</div>'
      +   '<div class="text-xs text-[var(--text-muted)] mt-1 mono">' + labels.join(' · ') + ' · 생성 ' + new Date().toLocaleString('ko-KR') + '</div>'
      +   '<div class="text-xs text-[var(--text-muted)] mt-1">오프라인 패키지 — 인터넷 없이 작동 (레이더 차트 + 비교표 + 총평)</div>'
      + '</header>'
      + comparisonHtml
      + '</div>'
      + '<script>' + initScript + '<\/script>'
      + '</body></html>';

    document.body.removeChild(progress);

    const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = titlePrefix.replace(/[^\w가-힣]/g, '_');
    a.download = `BBL_${safeName}_offline.html`;
    a.click();
    URL.revokeObjectURL(url);

    const sizeMb = (blob.size / 1024 / 1024).toFixed(2);
    alert(`✅ 오프라인 패키지 다운로드 완료!\n\n파일 크기: ${sizeMb} MB\n파일명: ${a.download}\n\n선수·지도자에게 전송하면 인터넷 없이 그대로 볼 수 있습니다.`);
  } catch (err) {
    if (document.body.contains(progress)) document.body.removeChild(progress);
    console.error('비교 오프라인 패키지 생성 오류:', err);
    alert('❌ 오프라인 패키지 생성 실패\n\n' + (err.message || err) + '\n\n네트워크 또는 CORS 문제일 수 있습니다.');
  }
}

// ★ v30.14 마이그레이션 — 저장된 좌투 선수의 raw trunk_rot 값 변환
//   v30.13.1 이전엔 좌투 값이 [+100, +250] 또는 [-250, -150] 범위 (raw)였음
//   v30.14에선 우완 등가 [-130, -30] 범위로 매핑됨
//   기존 저장값이 "raw 범위"에 있으면 변환 적용 (idempotent: 이미 변환된 값엔 영향 없음)
function migrateV30_14_LeftHanded(inputs) {
  if (!inputs || !inputs.mechanics) return false;
  const m = inputs.mechanics;
  let migrated = false;
  // trunk_rotation_at_fc — raw 좌투 범위: +30~+250 또는 -250~-180
  if (m.trunk_rotation_at_fc != null) {
    const t = m.trunk_rotation_at_fc;
    const isRawLeft = (t > 30) || (t < -180);
    if (isRawLeft) {
      let norm = ((t - LEFT_TRUNK_REF + 180) % 360) - 180 + LEFT_TRUNK_REF;
      m.trunk_rotation_at_fc = norm - LEFT_TO_RIGHT_TRUNK_OFFSET;
      migrated = true;
    }
  }
  return migrated;
}

// 알고리즘 변경 시 — 저장된 모든 리포트 자동 재계산
function recomputeAllSavedReports() {
  if (!SAVED_REPORTS || SAVED_REPORTS.length === 0) return { updated: 0, outdated: 0 };
  let updated = 0, outdated = 0, migrated = 0;
  for (const saved of SAVED_REPORTS) {
    if (!saved.inputs) continue;
    const wasOutdated = saved.algorithm_version !== ALGORITHM_VERSION;
    // ★ v30.14: 좌투 raw trunk_rot 마이그레이션
    if (migrateV30_14_LeftHanded(saved.inputs)) migrated++;
    try {
      const result = calculateScores(saved.inputs, saved.age || '고교', saved.measuredVelo);
      saved.scores = result;
      saved.algorithm_version = ALGORITHM_VERSION;
      saved.algorithm_date    = ALGORITHM_DATE;
      saved.last_recomputed_at = new Date().toISOString();
      updated++;
      if (wasOutdated) outdated++;
    } catch (e) {
      console.warn('재계산 실패:', saved.name, e);
    }
  }
  if (updated > 0) {
    persistSavedReports();
    console.log(`✅ ${updated}개 리포트 재계산 완료 (그중 ${outdated}개는 이전 산식, ${migrated}개는 v30.14 좌투 마이그레이션)`);
  }
  return { updated, outdated, migrated };
}

// ★ 수동 재계산 트리거 (헤더 버튼 클릭 시)
function manualRecompute() {
  const result = recomputeAllSavedReports();
  if (result.updated === 0) {
    alert('저장된 선수가 없습니다. 먼저 선수를 분석하고 저장해주세요.');
    return;
  }
  showRecomputeToast(result);
  refreshPlayerSelector();
  // 현재 표시 중인 리포트가 있다면 다시 렌더
  const area = document.getElementById('report-area');
  if (area && !area.classList.contains('hidden')) {
    const playerName = document.getElementById('player-name').value;
    const matched = SAVED_REPORTS.find(s => s.name === playerName);
    if (matched && matched.scores) {
      // 현재 화면 다시 렌더 — calculateScores 결과 사용
      const totalFit = Object.keys(matched.inputs.fitness || {}).length;
      const totalMech = Object.keys(matched.inputs.mechanics || {}).length;
      area.innerHTML = renderReportHtml(matched.name, matched.measuredVelo, matched.date, matched.scores, totalFit, totalMech);
      renderRadarCharts();
      renderOutputTransferChart(matched.scores);
      setupCoachVideoDropZone();
    }
  }
}

// ★ 토스트 알림 — 재계산 결과를 사용자에게 시각적으로 알림 (2026-05-03)
function showRecomputeToast(result) {
  if (!result || result.updated === 0) return;
  const { updated, outdated } = result;
  const msg = outdated > 0
    ? `✅ 산식 업데이트 (${ALGORITHM_VERSION}) — 저장된 ${updated}명 선수의 점수를 새 산식으로 자동 재계산했습니다 (${outdated}명은 이전 산식이었음).`
    : `✅ 저장된 ${updated}명 선수가 현재 산식(${ALGORITHM_VERSION})에 일치합니다.`;
  const bgColor = outdated > 0 ? '#4ade80' : '#60a5fa';
  const toast = document.createElement('div');
  toast.style.cssText = `position:fixed; top:20px; right:20px; z-index:9999; background:${bgColor}; color:#0a0b0d; padding:12px 18px; border-radius:6px; font-size:13px; font-weight:600; box-shadow:0 4px 12px rgba(15,42,74,0.15); max-width:480px; line-height:1.5; cursor:pointer;`;
  toast.innerHTML = msg + '<div style="font-size:10px;opacity:0.85;margin-top:4px;">탭해서 닫기 · 산식 일자 ' + ALGORITHM_DATE + '</div>';
  toast.onclick = () => toast.remove();
  document.body.appendChild(toast);
  setTimeout(() => { if (toast.parentNode) toast.style.transition = 'opacity 0.5s'; toast.style.opacity = '0'; }, 8000);
  setTimeout(() => { if (toast.parentNode) toast.remove(); }, 8500);
}

// ★ Phase 3 v33.7.4 — SAVED_REPORTS에서 mechanics raw 누락 자동 감지 + 안내 토스트
//   v33.6 이전 저장 리포트는 inputs.mechanics에 신규 7변수가 없어서 사분면 카드 빈 상태
//   사용자에게 누가 trial CSV 재업로드 필요한지 명확히 안내
function showPhase3MissingToast() {
  if (!SAVED_REPORTS || SAVED_REPORTS.length === 0) return;
  const missing = [];
  for (const saved of SAVED_REPORTS) {
    const m = saved.inputs?.mechanics;
    if (!m) continue;  // mechanics 자체 없으면 trial CSV 안 올린 케이스 — 누락 안내 대상 아님
    // 신규 7변수가 모두 누락이면 마이그레이션 필요 케이스 (1개라도 있으면 OK로 간주)
    const hasPhase3 = m.wrist_release_speed != null
      || m.angular_chain_amplification != null
      || m.elbow_to_wrist_speedup != null;
    if (!hasPhase3) {
      missing.push(saved.name + (saved.date ? ` (${saved.date})` : ''));
    }
  }
  if (missing.length === 0) return;  // 모두 OK
  const msg = `⚠ <strong>${missing.length}명의 저장 리포트</strong>에 Phase 3 변수(출력·전달·부상)가 없습니다. 사분면 카드 활성화를 위해 해당 선수의 <strong>trial CSV 재업로드</strong> 후 자동 저장됩니다.`;
  const list = missing.slice(0, 8).join(', ') + (missing.length > 8 ? ` 외 ${missing.length-8}명` : '');
  const toast = document.createElement('div');
  toast.style.cssText = `position:fixed; top:90px; right:20px; z-index:9998; background:#fb923c; color:#0a0b0d; padding:12px 18px; border-radius:6px; font-size:13px; font-weight:500; box-shadow:0 4px 12px rgba(15,42,74,0.15); max-width:520px; line-height:1.5; cursor:pointer;`;
  toast.innerHTML = msg + `<div style="font-size:11px;opacity:0.9;margin-top:6px;">${list}</div>` +
    `<div style="font-size:10px;opacity:0.85;margin-top:6px;">탭해서 닫기 · ${ALGORITHM_VERSION}</div>`;
  toast.onclick = () => toast.remove();
  document.body.appendChild(toast);
  setTimeout(() => { if (toast.parentNode) toast.style.transition = 'opacity 0.5s'; toast.style.opacity = '0'; }, 12000);
  setTimeout(() => { if (toast.parentNode) toast.remove(); }, 12500);
}

// ★ Phase 3 v33.7.4 — Trial CSV 분석 후 자동 저장 토스트 (수동 "저장" 클릭 부담 제거)
function showAutoSavedToast(reportName) {
  if (!reportName) return;
  const toast = document.createElement('div');
  toast.style.cssText = `position:fixed; bottom:20px; right:20px; z-index:9997; background:#60a5fa; color:#0a0b0d; padding:10px 16px; border-radius:6px; font-size:12px; font-weight:500; box-shadow:0 4px 12px rgba(15,42,74,0.15); max-width:380px; line-height:1.4; cursor:pointer;`;
  toast.innerHTML = `💾 <strong>${reportName}</strong> 자동 저장됨 (Phase 3 변수 포함). <div style="font-size:10px;opacity:0.85;margin-top:3px;">탭해서 닫기</div>`;
  toast.onclick = () => toast.remove();
  document.body.appendChild(toast);
  setTimeout(() => { if (toast.parentNode) toast.style.transition = 'opacity 0.5s'; toast.style.opacity = '0'; }, 5000);
  setTimeout(() => { if (toast.parentNode) toast.remove(); }, 5500);
}

function deleteSavedReport(id) {
  if (!confirm('이 리포트를 삭제할까요?')) return;
  SAVED_REPORTS = SAVED_REPORTS.filter(r => r.id !== id);
  persistSavedReports();
  refreshPlayerSelector();
  // 현재 활성 뷰 다시 렌더
  const active = document.querySelector('.nav-tab.active')?.dataset.view;
  if (active === 'h1h2') renderH1H2View();
  else if (active === 'vs') renderVsView();
}

function switchView(view) {
  document.querySelectorAll('.nav-tab').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  document.querySelectorAll('.view-content').forEach(d => {
    d.classList.toggle('hidden', d.id !== ('view-' + view));
  });
  if (view === 'h1h2') renderH1H2View();
  else if (view === 'vs') renderVsView();
}

// ── 비교 뷰 헬퍼 ──
function _emptyState(msg) {
  return `<div class="text-center text-sm text-[var(--text-muted)] py-8 border border-dashed border-[var(--border)] rounded">${msg}</div>`;
}
function _savedReportsListHtml() {
  if (SAVED_REPORTS.length === 0) return '';
  return `<details class="mt-4">
    <summary class="text-xs text-[var(--text-secondary)] py-2 cursor-pointer">📋 저장된 리포트 (${SAVED_REPORTS.length}개) — 관리</summary>
    <div class="mt-2">
      ${SAVED_REPORTS.map(r => `
        <div class="saved-report-card">
          <div>
            <div class="text-sm font-medium">${r.name}</div>
            <div class="meta">${r.age || '—'} · ${r.date || '날짜 없음'} · 저장 ${new Date(r.savedAt).toLocaleString('ko-KR', {month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit'})}</div>
          </div>
          <button class="delete-btn" onclick="deleteSavedReport('${r.id}')">🗑 삭제</button>
        </div>`).join('')}
    </div>
  </details>`;
}

// ── H1↔H2 뷰 (같은 선수, 두 시점) ──
function renderH1H2View() {
  const container = document.getElementById('h1h2-content');
  if (SAVED_REPORTS.length < 2) {
    container.innerHTML = _emptyState('저장된 리포트가 2개 이상 필요합니다. 먼저 개별 선수 탭에서 두 시점의 리포트를 생성·저장하세요.') + _savedReportsListHtml();
    return;
  }

  // 같은 이름이 2번 이상 저장된 선수만 후보
  const byName = {};
  SAVED_REPORTS.forEach(r => { (byName[r.name] = byName[r.name] || []).push(r); });
  const eligible = Object.keys(byName).filter(n => byName[n].length >= 2);

  if (eligible.length === 0) {
    container.innerHTML = _emptyState('같은 이름의 리포트가 2개 이상이어야 비교 가능합니다. (예: "김강연" 리포트를 봄·가을 두 번 저장)') + _savedReportsListHtml();
    return;
  }

  const playerOptions = eligible.map(n => `<option value="${n}">${n} (${byName[n].length}회 저장)</option>`).join('');
  const firstName = eligible[0];
  const reports = byName[firstName].slice().sort((a,b) => (a.date||'').localeCompare(b.date||''));
  const r1Options = reports.map((r, i) => `<option value="${r.id}">${r.date || '날짜 없음'} (저장 ${new Date(r.savedAt).toLocaleDateString('ko-KR')})</option>`).join('');

  container.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
      <div>
        <label class="text-xs text-[var(--text-muted)] block mb-1">선수 선택</label>
        <select id="h1h2-player" class="input-field" onchange="onH1H2PlayerChange()">${playerOptions}</select>
      </div>
      <div>
        <label class="text-xs text-[var(--text-muted)] block mb-1">1차 리포트</label>
        <select id="h1h2-r1" class="input-field" onchange="renderH1H2Comparison()">${r1Options}</select>
      </div>
      <div>
        <label class="text-xs text-[var(--text-muted)] block mb-1">2차 리포트</label>
        <select id="h1h2-r2" class="input-field" onchange="renderH1H2Comparison()">${r1Options}</select>
      </div>
    </div>
    <div class="text-center mb-4">
      <button class="btn btn-primary" onclick="downloadComparisonOfflinePackage('h1h2')" style="background:#4ade80; color:#0a0b0d;">📦 오프라인 패키지 다운로드 (선수·지도자 전송용)</button>
    </div>
    <div id="h1h2-result"></div>
    ${_savedReportsListHtml()}
  `;
  // 기본 선택: 가장 오래된 = 1차, 가장 최근 = 2차
  if (reports.length >= 2) {
    document.getElementById('h1h2-r1').value = reports[0].id;
    document.getElementById('h1h2-r2').value = reports[reports.length-1].id;
  }
  renderH1H2Comparison();
}

function onH1H2PlayerChange() {
  const name = document.getElementById('h1h2-player').value;
  const reports = SAVED_REPORTS.filter(r => r.name === name)
                               .sort((a,b) => (a.date||'').localeCompare(b.date||''));
  const opts = reports.map(r => `<option value="${r.id}">${r.date || '날짜 없음'} (저장 ${new Date(r.savedAt).toLocaleDateString('ko-KR')})</option>`).join('');
  document.getElementById('h1h2-r1').innerHTML = opts;
  document.getElementById('h1h2-r2').innerHTML = opts;
  if (reports.length >= 2) {
    document.getElementById('h1h2-r1').value = reports[0].id;
    document.getElementById('h1h2-r2').value = reports[reports.length-1].id;
  }
  renderH1H2Comparison();
}

function renderH1H2Comparison() {
  const r1Id = document.getElementById('h1h2-r1')?.value;
  const r2Id = document.getElementById('h1h2-r2')?.value;
  const r1 = SAVED_REPORTS.find(r => r.id === r1Id);
  const r2 = SAVED_REPORTS.find(r => r.id === r2Id);
  if (!r1 || !r2) return;
  // ★ v32.0 IPS 카드 + 기존 비교 표
  const ipsHtml = (typeof renderIPSCard === 'function') ? renderIPSCard(r1, r2) : '';
  document.getElementById('h1h2-result').innerHTML = ipsHtml + renderComparisonHtml([r1, r2], ['1차', '2차'], 'h1h2');
  setTimeout(() => renderComparisonRadars('h1h2', [r1, r2], ['1차', '2차']), 30);
}

// ── 선수간 비교 뷰 (최대 4명) ──
function renderVsView() {
  const container = document.getElementById('vs-content');
  if (SAVED_REPORTS.length < 2) {
    container.innerHTML = _emptyState('저장된 리포트가 2개 이상 필요합니다.') + _savedReportsListHtml();
    return;
  }
  const opts = SAVED_REPORTS.map(r =>
    `<option value="${r.id}">${r.name}${r.date ? ' · ' + r.date : ''}</option>`
  ).join('');
  const empty = '<option value="">— 선택 안 함 —</option>';
  container.innerHTML = `
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
      <div>
        <label class="text-xs text-[var(--text-muted)] block mb-1" style="color:#60a5fa">선수 A</label>
        <select id="vs-a" class="input-field" onchange="renderVsComparison()">${opts}</select>
      </div>
      <div>
        <label class="text-xs text-[var(--text-muted)] block mb-1" style="color:#ff6b35">선수 B</label>
        <select id="vs-b" class="input-field" onchange="renderVsComparison()">${opts}</select>
      </div>
      <div>
        <label class="text-xs text-[var(--text-muted)] block mb-1" style="color:#4ade80">선수 C (선택)</label>
        <select id="vs-c" class="input-field" onchange="renderVsComparison()">${empty}${opts}</select>
      </div>
      <div>
        <label class="text-xs text-[var(--text-muted)] block mb-1" style="color:#c084fc">선수 D (선택)</label>
        <select id="vs-d" class="input-field" onchange="renderVsComparison()">${empty}${opts}</select>
      </div>
    </div>
    <div class="text-center mb-4">
      <button class="btn btn-primary" onclick="downloadComparisonOfflinePackage('vs')" style="background:#4ade80; color:#0a0b0d;">📦 오프라인 패키지 다운로드 (선수·지도자 전송용)</button>
    </div>
    <div id="vs-result"></div>
    ${_savedReportsListHtml()}
  `;
  // 기본: 처음 N개
  if (SAVED_REPORTS.length >= 1) document.getElementById('vs-a').value = SAVED_REPORTS[0].id;
  if (SAVED_REPORTS.length >= 2) document.getElementById('vs-b').value = SAVED_REPORTS[1].id;
  if (SAVED_REPORTS.length >= 3) document.getElementById('vs-c').value = SAVED_REPORTS[2].id;
  if (SAVED_REPORTS.length >= 4) document.getElementById('vs-d').value = SAVED_REPORTS[3].id;
  renderVsComparison();
}

function renderVsComparison() {
  const ids = ['vs-a', 'vs-b', 'vs-c', 'vs-d']
    .map(id => document.getElementById(id)?.value)
    .filter(v => v);
  const reports = ids.map(id => SAVED_REPORTS.find(r => r.id === id)).filter(r => r);
  if (reports.length < 2) return;
  const labels = reports.map(r => r.name);
  document.getElementById('vs-result').innerHTML = renderComparisonHtml(reports, labels, 'vs');
  setTimeout(() => renderComparisonRadars('vs', reports, labels), 30);
}

// ── 공통 비교 렌더 (N명, 2~4명) ──
const _CMP_COLORS = ['#60a5fa', '#ff6b35', '#4ade80', '#c084fc'];

function renderComparisonHtml(reports, labels, prefix) {
  const N = reports.length;
  const fmt = (v) => v != null ? Number(v).toFixed(1) : '—';

  // 헤더 N개 카드
  const headerCols = N <= 2 ? 'md:grid-cols-2' : (N === 3 ? 'md:grid-cols-3' : 'md:grid-cols-4');
  const header = `
    <div class="grid grid-cols-1 ${headerCols} gap-3 mb-4">
      ${reports.map((r, i) => {
        // ★ v30.18.3: 비교 뷰 모드 뱃지 (좌투/우투 + Mode A/B)
        const armSide = r.armSide || (r.inputs && r.inputs._armSide) || 'right';
        const mode = (typeof getPlayerMode === 'function')
          ? getPlayerMode(armSide, r.measuredVelo)
          : (r.measuredVelo >= (armSide === 'left' ? 135 : 140) ? 'elite' : 'sub_elite');
        const handLabel = armSide === 'left' ? '좌투' : '우투';
        const modeColor = mode === 'elite' ? '#7c3aed' : '#2563eb';
        const modeBg = mode === 'elite' ? '#ede9fe' : '#dbeafe';
        const modeIcon = mode === 'elite' ? '⭐' : '🚀';
        const modeShort = mode === 'elite' ? 'Mode B' : 'Mode A';
        return `
        <div class="card p-3" style="border: 2px solid ${_CMP_COLORS[i]};">
          <div class="mono text-[10px] text-[var(--text-muted)]">${labels[i]}</div>
          <div class="display text-base mt-1" style="color: ${_CMP_COLORS[i]}">${r.name}</div>
          <div class="text-[10px] text-[var(--text-muted)] mt-1">${r.age || '—'} · ${r.date || '날짜 없음'}</div>
          <div class="mt-1.5">
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold" style="background:${modeBg}; color:${modeColor}; border:1px solid ${modeColor};">
              <span>${modeIcon}</span><span>${handLabel}</span><span style="opacity:0.5;">·</span><span>${modeShort}</span>
            </span>
          </div>
          <div class="grid grid-cols-4 gap-1 mt-2 text-center">
            <div><div class="text-[9px] text-[var(--text-muted)]">측정</div><div class="mono text-xs font-bold">${r.measuredVelo != null ? r.measuredVelo.toFixed(1) : '—'}</div></div>
            <div><div class="text-[9px] text-[var(--text-muted)]">체력</div><div class="mono text-xs font-bold" style="color:${scoreColor(r.scores.Fitness_Score)}">${r.scores.Fitness_Score ?? '—'}</div></div>
            <div><div class="text-[9px] text-[var(--text-muted)]">메카닉</div><div class="mono text-xs font-bold" style="color:${scoreColor(r.scores.Mechanics_Score)}">${r.scores.Mechanics_Score ?? '—'}</div></div>
            <div><div class="text-[9px] text-[var(--text-muted)]">제구</div><div class="mono text-xs font-bold" style="color:${scoreColor(r.scores.Control_Score)}">${r.scores.Control_Score ?? '—'}</div></div>
          </div>
        </div>`;
      }).join('')}
    </div>`;

  // 종합 메트릭 한 줄 — N=2면 Δ, N>=3이면 max-min range + leader
  const summaryRow = (() => {
    const metrics = [
      { name: '측정구속', vals: reports.map(r => r.measuredVelo), unit: 'km/h' },
      { name: '체력',     vals: reports.map(r => r.scores.Fitness_Score) },
      { name: '메카닉',   vals: reports.map(r => r.scores.Mechanics_Score) },
      { name: '제구',     vals: reports.map(r => r.scores.Control_Score) },
      { name: '잠재 구속', vals: reports.map(r => r.scores.ceiling), unit: 'km/h' },
    ];
    const cells = metrics.map(m => {
      const valid = m.vals.filter(v => v != null);
      if (valid.length < 2) return `<span>${m.name}: —</span>`;
      if (N === 2) {
        const d = (valid[1] - valid[0]);
        const cls = Math.abs(d) < 0.5 ? 'delta-neu' : (d > 0 ? 'delta-pos' : 'delta-neg');
        const sign = d > 0 ? '+' : '';
        return `<span>${m.name} Δ: <span class="${cls} mono">${sign}${d.toFixed(1)}</span> ${m.unit||''}</span>`;
      }
      // N >= 3 — Range + leader
      const minV = Math.min(...valid), maxV = Math.max(...valid);
      const leaderIdx = m.vals.indexOf(maxV);
      const leaderName = leaderIdx >= 0 ? labels[leaderIdx] : '';
      return `<span>${m.name}: <span class="mono delta-pos">${maxV.toFixed(1)}</span><span class="text-[var(--text-muted)]"> (${leaderName})</span> · 차 <span class="mono">${(maxV-minV).toFixed(1)}</span> ${m.unit||''}</span>`;
    });
    return `<div class="card p-3 mb-6 mono text-xs flex flex-wrap gap-x-5 gap-y-1 justify-center">${cells.join('')}</div>`;
  })();

  // ★ v30.21 옵션 C: 핵심 메카닉 변수 Δ 표 (N=2일 때만)
  let keyVarDeltaHtml = '';
  if (N === 2 && prefix === 'h1h2') {
    const KEY_VARS = [
      { key: 'trunk_rotation_at_fc', name: '몸통 회전 @ FC', unit: '°', desc: '닫힘 정도' },
      { key: 'hip_shoulder_sep_at_fc', name: 'X-Factor @ FC', unit: '°', desc: '골반-몸통 분리' },
      { key: 'peak_x_factor', name: 'X-Factor 최대', unit: '°', desc: '회전 분리 peak' },
      { key: 'trunk_forward_tilt_at_br', name: 'BR 시 forward tilt', unit: '°', desc: '릴리스 자세' },
      { key: 'max_shoulder_ER_deg', name: '어깨 ER (Layback)', unit: '°', desc: '최대 외회전' },
      { key: 'arm_trunk_speedup', name: 'Arm/Trunk Speedup', unit: '×', desc: '에너지 전달비' },
      { key: 'hip_shoulder_sep_sd_deg', name: 'Hip-Sep SD', unit: '°', desc: '안정성 (낮을수록 좋음)', invert: true },
      { key: 'mer_to_br_sd_ms', name: 'MER→BR Time SD', unit: 'ms', desc: '타이밍 일관성', invert: true },
    ];
    const rows = KEY_VARS.map(v => {
      const v1 = reports[0].inputs?.mechanics?.[v.key];
      const v2 = reports[1].inputs?.mechanics?.[v.key];
      if (v1 == null || v2 == null) return null;
      const d = v2 - v1;
      const sigDelta = Math.abs(d) > (Math.abs(v1) * 0.05 + 0.5);  // 5% or 0.5 minimum
      const dirGood = v.invert ? (d < 0) : (d > 0);  // invert: 낮을수록 좋음
      const cls = !sigDelta ? 'delta-neu' : (dirGood ? 'delta-pos' : 'delta-neg');
      const sign = d > 0 ? '+' : '';
      return `<tr>
        <td class="text-xs">${v.name}<br><span class="text-[10px] text-[var(--text-muted)]">${v.desc}</span></td>
        <td class="mono text-sm text-center">${typeof v1 === 'number' ? v1.toFixed(1) : '—'}<span class="text-[10px] text-[var(--text-muted)]">${v.unit}</span></td>
        <td class="mono text-sm text-center">${typeof v2 === 'number' ? v2.toFixed(1) : '—'}<span class="text-[10px] text-[var(--text-muted)]">${v.unit}</span></td>
        <td class="text-center"><span class="mono text-sm ${cls}">${sign}${d.toFixed(1)}</span></td>
      </tr>`;
    }).filter(Boolean).join('');
    if (rows) {
      keyVarDeltaHtml = `<div class="card p-4 mb-6">
        <div class="display text-base mb-3">🔬 핵심 메카닉 변수 H1 → H2 변화</div>
        <table class="cmp-table">
          <thead><tr><th>변수</th><th class="text-center">${labels[0]}</th><th class="text-center">${labels[1]}</th><th class="text-center">Δ</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="text-xs text-[var(--text-muted)] mt-2">녹색 = 발전 방향 / 빨강 = 역방향 / 회색 = 변화 미미</div>
      </div>`;
    }
  }

  // 3개 영역 레이더 (N개 dataset overlay)
  const radarSection = `
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      ${['fitness', 'mechanics', 'control'].map(area => {
        const labelMap = { fitness: '체력', mechanics: '메카닉', control: '제구' };
        const colorMap = { fitness: 'var(--fitness)', mechanics: 'var(--accent)', control: 'var(--control)' };
        return `<div class="card p-4">
          <div class="display text-base mb-3" style="color:${colorMap[area]}">${labelMap[area]}</div>
          <div class="relative" style="height:280px;"><canvas id="${prefix}-radar-${area}"></canvas></div>
        </div>`;
      }).join('')}
    </div>`;

  // 카테고리별 비교 표 — N개 칼럼 + Range, 영역별 옅은 배경색
  const allAreas = [
    { name: '체력', cats: COHORT.fitness_cats, cls: 'area-fitness' },
    { name: '메카닉', cats: COHORT.mechanics_cats, cls: 'area-mech' },
    { name: '제구', cats: COHORT.control_cats, cls: 'area-ctrl' },
  ];
  const truncateLabel = (s) => s.length > 10 ? s.slice(0, 10) + '…' : s;
  const tableHtml = `
    <div class="card p-4 mb-6">
      <div class="display text-base mb-3">📊 카테고리별 점수 비교</div>
      <table class="cmp-table">
        <thead><tr>
          <th>영역</th><th>카테고리</th>
          ${reports.map((_, i) => `<th class="text-right" style="color:${_CMP_COLORS[i]}">${truncateLabel(labels[i])}</th>`).join('')}
          ${N >= 3 ? '<th class="text-right">Range</th>' : '<th class="text-right">Δ (B−A)</th>'}
        </tr></thead>
        <tbody>
          ${allAreas.flatMap(area => area.cats.map(catId => {
            const meta = CATEGORY_DETAILS[catId] || {};
            const vals = reports.map(r => r.scores.cat_scores?.[catId]);
            const validVals = vals.filter(v => v != null);
            let rangeOrDelta = '—';
            if (N === 2 && vals[0] != null && vals[1] != null) {
              const d = vals[1] - vals[0];
              const cls = Math.abs(d) < 0.5 ? 'delta-neu' : (d > 0 ? 'delta-pos' : 'delta-neg');
              const sign = d > 0 ? '+' : '';
              rangeOrDelta = `<span class="${cls} mono">${sign}${d.toFixed(1)}</span>`;
            } else if (validVals.length >= 2) {
              rangeOrDelta = `<span class="mono">${(Math.max(...validVals) - Math.min(...validVals)).toFixed(1)}</span>`;
            }
            const valCells = vals.map(v => `<td class="cmp-num" style="color:${scoreColor(v)}">${fmt(v)}</td>`).join('');
            return `<tr class="${area.cls}">
              <td class="text-[var(--text-muted)] text-xs">${area.name}</td>
              <td>${meta.name || catId}</td>
              ${valCells}
              <td class="cmp-num">${rangeOrDelta}</td>
            </tr>`;
          })).join('')}
        </tbody>
      </table>
    </div>`;

  // 잠재 구속 비교 카드 — 3 시나리오 × N 선수
  const ceilingCmp = renderCeilingComparisonCard(reports, labels);

  // 총평 텍스트
  const summaryText = generateComparisonSummary(reports, labels, prefix);

  return header + summaryRow + ceilingCmp + keyVarDeltaHtml + radarSection + tableHtml + summaryText;
}

// 잠재 구속 비교 카드 — 3가지 시나리오 (F100, M100, FM100)
function renderCeilingComparisonCard(reports, labels) {
  const validReports = reports.filter(r => r.measuredVelo != null && r.scores.ceiling_FM100 != null);
  if (validReports.length < 2) return '';
  const fmt = (v) => v != null ? Number(v).toFixed(1) : '—';
  const scenarios = [
    { name: '체력만 100점',     key: 'ceiling_F100',  color: 'var(--fitness)' },
    { name: '메카닉만 100점',   key: 'ceiling_M100',  color: 'var(--accent)' },
    { name: '체력+메카닉 100점', key: 'ceiling_FM100', color: 'var(--good)' },
  ];
  return `
    <div class="card p-4 mb-6">
      <div class="display text-base mb-3">📈 잠재 구속 비교 — 3가지 시나리오</div>
      <table class="cmp-table">
        <thead><tr>
          <th>시나리오</th>
          ${reports.map((r, i) => `<th class="text-right" style="color:${_CMP_COLORS[i]}">${labels[i].length > 10 ? labels[i].slice(0,10)+'…' : labels[i]}<br><span class="text-[10px] text-[var(--text-muted)] font-normal">측정 ${r.measuredVelo != null ? r.measuredVelo.toFixed(1) : '—'} km/h</span></th>`).join('')}
        </tr></thead>
        <tbody>
          ${scenarios.map(s => {
            const vals = reports.map(r => r.scores[s.key]);
            const cells = vals.map((v, i) => {
              if (v == null) return '<td class="cmp-num">—</td>';
              const measured = reports[i].measuredVelo;
              const gain = measured != null ? v - measured : null;
              const gainTxt = gain != null ? `<div class="text-[9px] text-[var(--text-muted)]">+${gain.toFixed(1)}</div>` : '';
              return `<td class="cmp-num" style="color:${s.color}"><strong>${v.toFixed(1)}</strong> km/h${gainTxt}</td>`;
            }).join('');
            return `<tr>
              <td><strong style="color:${s.color}">${s.name}</strong></td>
              ${cells}
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

// 비교 총평 텍스트 — 자동 분석
function generateComparisonSummary(reports, labels, prefix) {
  if (reports.length < 2) return '';
  const isHvsH = prefix === 'h1h2';

  // 종합 점수 ranking
  const score = (r, k) => r.scores[k];
  const findLeader = (key) => {
    const valid = reports.map((r, i) => ({ idx: i, v: score(r, key) })).filter(x => x.v != null);
    if (valid.length < 2) return null;
    valid.sort((a, b) => b.v - a.v);
    return { leader: valid[0], laggard: valid[valid.length - 1], all: valid };
  };
  const findLeaderVelo = (key) => {
    const valid = reports.map((r, i) => ({ idx: i, v: r[key] })).filter(x => x.v != null);
    if (valid.length < 2) return null;
    valid.sort((a, b) => b.v - a.v);
    return { leader: valid[0], laggard: valid[valid.length - 1], all: valid };
  };

  const veloR = findLeaderVelo('measuredVelo');
  const fitR  = findLeader('Fitness_Score');
  const mechR = findLeader('Mechanics_Score');
  const ctrlR = findLeader('Control_Score');
  const ceilR = findLeader('ceiling');

  // 카테고리별 가장 큰 차이
  const allCats = [...COHORT.fitness_cats, ...COHORT.mechanics_cats, ...COHORT.control_cats];
  let biggestGap = 0, biggestGapCat = null, biggestGapLeader = null;
  for (const cat of allCats) {
    const vals = reports.map((r, i) => ({ idx: i, v: r.scores.cat_scores?.[cat] })).filter(x => x.v != null);
    if (vals.length < 2) continue;
    const minV = Math.min(...vals.map(x => x.v));
    const maxV = Math.max(...vals.map(x => x.v));
    const gap = maxV - minV;
    if (gap > biggestGap) {
      biggestGap = gap;
      biggestGapCat = cat;
      biggestGapLeader = vals.find(x => x.v === maxV);
    }
  }

  // 텍스트 생성
  const lines = [];
  if (isHvsH) {
    // 1차 ↔ 2차 (시간 변화 관점)
    if (veloR) {
      const d = reports[1].measuredVelo - reports[0].measuredVelo;
      const sign = d >= 0 ? '+' : '';
      lines.push(`📅 측정 구속: ${reports[0].measuredVelo?.toFixed(1)} → ${reports[1].measuredVelo?.toFixed(1)} km/h (<strong>${sign}${d.toFixed(1)} km/h</strong>)`);
    }
    if (mechR) {
      const d = reports[1].scores.Mechanics_Score - reports[0].scores.Mechanics_Score;
      const sign = d >= 0 ? '+' : '';
      lines.push(`💪 메카닉 종합: ${reports[0].scores.Mechanics_Score?.toFixed(1)} → ${reports[1].scores.Mechanics_Score?.toFixed(1)}점 (<strong>${sign}${d.toFixed(1)}점</strong>)`);
    }
    if (ceilR) {
      const d = reports[1].scores.ceiling - reports[0].scores.ceiling;
      const sign = d >= 0 ? '+' : '';
      lines.push(`🚀 잠재 구속: ${reports[0].scores.ceiling?.toFixed(1)} → ${reports[1].scores.ceiling?.toFixed(1)} km/h (<strong>${sign}${d.toFixed(1)} km/h</strong>)`);
    }
    if (biggestGapCat && biggestGapLeader) {
      const meta = CATEGORY_DETAILS[biggestGapCat] || {};
      const dir = biggestGapLeader.idx === 1 ? '향상' : '하락';
      lines.push(`🔍 가장 큰 변화: <strong>${meta.name || biggestGapCat}</strong> — ${biggestGap.toFixed(1)}점 ${dir}`);
    }
    return `
      <div class="card p-4 mb-4" style="background: linear-gradient(135deg, rgba(74,222,128,0.04) 0%, rgba(96,165,250,0.04) 100%); border: 1px solid rgba(74,222,128,0.2);">
        <div class="display text-base mb-3">📋 1차 ↔ 2차 종합 평가</div>
        <ul class="list-none space-y-2 text-sm leading-relaxed">
          ${lines.map(l => `<li>${l}</li>`).join('')}
        </ul>
      </div>`;
  } else {
    // 선수간 비교
    if (veloR) {
      lines.push(`⚡ 측정 구속 1위: <strong style="color:${_CMP_COLORS[veloR.leader.idx]}">${labels[veloR.leader.idx]}</strong> (${veloR.leader.v.toFixed(1)} km/h)${veloR.all.length >= 2 ? ` · 최저 ${labels[veloR.laggard.idx]} (${veloR.laggard.v.toFixed(1)} km/h, 차 ${(veloR.leader.v - veloR.laggard.v).toFixed(1)})` : ''}`);
    }
    if (fitR) {
      lines.push(`💪 체력 1위: <strong style="color:${_CMP_COLORS[fitR.leader.idx]}">${labels[fitR.leader.idx]}</strong> (${fitR.leader.v.toFixed(1)}점)`);
    }
    if (mechR) {
      lines.push(`🌀 메카닉 1위: <strong style="color:${_CMP_COLORS[mechR.leader.idx]}">${labels[mechR.leader.idx]}</strong> (${mechR.leader.v.toFixed(1)}점)`);
    }
    if (ctrlR) {
      lines.push(`🎯 제구 1위: <strong style="color:${_CMP_COLORS[ctrlR.leader.idx]}">${labels[ctrlR.leader.idx]}</strong> (${ctrlR.leader.v.toFixed(1)}점)`);
    }
    if (ceilR) {
      lines.push(`🚀 잠재 구속 1위: <strong style="color:${_CMP_COLORS[ceilR.leader.idx]}">${labels[ceilR.leader.idx]}</strong> (${ceilR.leader.v.toFixed(1)} km/h)`);
    }
    if (biggestGapCat && biggestGapLeader) {
      const meta = CATEGORY_DETAILS[biggestGapCat] || {};
      lines.push(`🔍 가장 큰 격차: <strong>${meta.name || biggestGapCat}</strong> (최대 ${biggestGap.toFixed(1)}점 차) — <strong style="color:${_CMP_COLORS[biggestGapLeader.idx]}">${labels[biggestGapLeader.idx]}</strong>가 우세`);
    }
    return `
      <div class="card p-4 mb-4" style="background: linear-gradient(135deg, rgba(96,165,250,0.04) 0%, rgba(255,107,53,0.04) 100%); border: 1px solid rgba(96,165,250,0.2);">
        <div class="display text-base mb-3">📋 선수간 비교 종합 평가</div>
        <ul class="list-none space-y-2 text-sm leading-relaxed">
          ${lines.map(l => `<li>${l}</li>`).join('')}
        </ul>
      </div>`;
  }
}

// 비교용 레이더 — 한 차트에 N개 dataset overlay (최대 4명)
function renderComparisonRadars(prefix, reports, labels) {
  if (typeof Chart === 'undefined') return;
  const sets = [
    { area: 'fitness',   cats: COHORT.fitness_cats },
    { area: 'mechanics', cats: COHORT.mechanics_cats },
    { area: 'control',   cats: COHORT.control_cats },
  ];
  for (const s of sets) {
    const canvas = document.getElementById(`${prefix}-radar-${s.area}`);
    if (!canvas) continue;
    const labelsTxt = s.cats.map(c => CATEGORY_DETAILS[c]?.name || c);
    const datasets = reports.map((r, i) => ({
      label: labels[i],
      data: s.cats.map(c => r.scores.cat_scores?.[c] != null ? Math.round(r.scores.cat_scores[c]) : 0),
      backgroundColor: _CMP_COLORS[i] + '20',
      borderColor: _CMP_COLORS[i],
      borderWidth: 2,
      pointRadius: 3,
      pointBackgroundColor: _CMP_COLORS[i],
    }));
    if (_RADAR_INSTANCES[`${prefix}-${s.area}`]) {
      try { _RADAR_INSTANCES[`${prefix}-${s.area}`].destroy(); } catch(e) {}
    }
    _RADAR_INSTANCES[`${prefix}-${s.area}`] = new Chart(canvas, {
      type: 'radar',
      data: { labels: labelsTxt, datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: { r: { min: 0, max: 100,
          ticks: { color: '#5f636b', stepSize: 25, backdropColor: 'transparent', font: { size: 9 } },
          grid: { color: 'rgba(95,99,107,0.2)' },
          angleLines: { color: 'rgba(95,99,107,0.3)' },
          pointLabels: { color: '#b3b5b9', font: { size: 11 } } } },
        plugins: { legend: { display: true, position: 'bottom', labels: { color: '#b3b5b9', font: { size: 10 }, boxWidth: 12, padding: 8 } } }
      }
    });
  }
}

// ════════════════════════════════════════════════════════════════════
// 오프라인 패키지 다운로드 — 모든 자료(영상·이미지·라이브러리)를 base64로 인라인
// 인터넷 없이 브라우저에서 그대로 작동 (메카닉 토글·아코디언·차트 모두)
// ════════════════════════════════════════════════════════════════════
function _urlToDataUrl(url) {
  return fetch(url).then(r => {
    if (!r.ok) throw new Error('fetch 실패: ' + url + ' (' + r.status + ')');
    return r.blob();
  }).then(blob => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  }));
}

async function downloadOfflineReport() {
  if (!CURRENT_REPORT_RESULT) {
    alert('먼저 리포트를 생성해주세요.');
    return;
  }

  // 진행 안내 박스
  const progress = document.createElement('div');
  progress.id = '_offline_progress';
  progress.style.cssText = 'position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); background:#141518; padding:24px 32px; border:2px solid var(--accent); border-radius:8px; z-index:99999; color:#e8e9ec; font-size:14px; box-shadow:0 20px 60px rgba(0,0,0,0.6); min-width:340px; text-align:center;';
  progress.innerHTML = '📦 오프라인 패키지 만드는 중...';
  document.body.appendChild(progress);

  try {
    // 1) Chart.js 라이브러리
    progress.innerHTML = '📦 (1/4) Chart.js 라이브러리 다운로드 중...';
    const chartJsSrc = await fetch('https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js').then(r => r.text());

    // 2) max-layback.png
    progress.innerHTML = '📦 (2/4) 시각화 이미지 인코딩 중...';
    const maxLaybackUrl = 'https://raw.githubusercontent.com/kkl0511/BBL_Pitching_Report1/main/assets/max-layback.png';
    let maxLaybackB64 = null;
    try { maxLaybackB64 = await _urlToDataUrl(maxLaybackUrl); }
    catch (e) { console.warn('max-layback 인라인 실패:', e); }

    // 3) 현재 로드된 영상 (파일 또는 URL) → base64
    progress.innerHTML = '📦 (3/4) 영상 인코딩 중... (영상 크기에 따라 10~60초 소요)';
    const videoEl = document.getElementById('coach-video');
    let videoOriginalSrc = null;
    let videoB64 = null;
    if (videoEl && videoEl.src && !videoEl.src.startsWith('about:') && videoEl.src !== window.location.href) {
      videoOriginalSrc = videoEl.src;
      try { videoB64 = await _urlToDataUrl(videoOriginalSrc); }
      catch (e) {
        console.warn('영상 인라인 실패:', e);
        progress.innerHTML += '<br><small style="color:#fbbf24">⚠️ 영상 인라인 실패 — 영상 없이 진행</small>';
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    // 4) HTML 패키지 조립
    progress.innerHTML = '📦 (4/4) HTML 패키지 조립 중...';

    // 모든 inline <style> 텍스트 + Tailwind 컴파일된 styleSheet 모두 수집
    let allStyles = '';
    Array.from(document.querySelectorAll('style')).forEach(s => { allStyles += s.textContent + '\n'; });
    // Tailwind CDN이 동적으로 추가하는 styleSheet (style 태그가 아니라면)
    Array.from(document.styleSheets).forEach(sheet => {
      try {
        for (const rule of sheet.cssRules) allStyles += rule.cssText + '\n';
      } catch (e) { /* CORS skip */ }
    });

    // 리포트 영역 HTML
    let reportHtml = document.getElementById('report-area').innerHTML;

    // 외부 URL → base64 치환
    if (maxLaybackB64) reportHtml = reportHtml.split(maxLaybackUrl).join(maxLaybackB64);
    if (videoB64 && videoOriginalSrc) reportHtml = reportHtml.split(videoOriginalSrc).join(videoB64);

    // 오프라인 패키지에는 저장·다운로드·인쇄 버튼 의미 없으니 제거
    // 하단 다운로드 버튼 div 통째로 제거 (saveCurrentReport, downloadOfflineReport, downloadHtmlReport, window.print 모두 포함)
    reportHtml = reportHtml.replace(
      /<div class="text-center mt-6 space-x-2 space-y-2">[\s\S]*?<\/div>\s*$/,
      ''
    );

    // 다운로드 시점의 메카닉 모드 데이터 캐시
    const radarDataFinal = (window.__BBL_RADAR_DATA__ || []).map(d => {
      if (d && d.isMechanics && MECH_VIEW_MODE === '5') {
        return { ...d, labels: d.drivelineLabels, values: d.drivelineValues };
      }
      return d;
    });

    // 인라인 함수들 (오프라인에서 메카닉 토글·아코디언·차트 작동 위함)
    // COHORT는 무거우니 필요 부분만 슬림화
    const slimCohort = {
      mechanics_cats: COHORT.mechanics_cats,
      fitness_cats:   COHORT.fitness_cats,
      control_cats:   COHORT.control_cats,
      category_meta:  COHORT.category_meta,
      category_vars:  COHORT.category_vars,
      var_distributions: Object.fromEntries(Object.keys(COHORT.var_distributions).map(k => [k, true])),
    };

    const inlineFns = [
      scoreColor, scoreToWord,
      drivelineFiveCatScores,
      renderCategoryAccordion,
      renderDrivelineCategoryAccordion,
      renderMechCardInner,
      setMechMode,
      setVideoSpeed, videoFrameStep, videoTogglePlay, loadVideoLocal, loadVideoSample,
      renderRadarCharts,
    ].map(fn => fn.toString()).join('\n\n');

    // JSON 안에 닫는 script 태그가 있으면 파싱 깨지므로 < 를 모두 < 로 escape
    const safeJson = (obj) => JSON.stringify(obj).replace(/</g, '\\u003c');

    const inlineDataAndInit = `
const COHORT = ${safeJson(slimCohort)};
const CATEGORY_DETAILS = ${safeJson(CATEGORY_DETAILS)};
const DRIVELINE_5_ORDER = ${safeJson(DRIVELINE_5_ORDER)};
const DRIVELINE_5_LABELS_KO = ${safeJson(DRIVELINE_5_LABELS_KO)};
const DRIVELINE_5_CATS = ${safeJson(DRIVELINE_5_CATS)};
const DRIVELINE_5_DETAILS = ${safeJson(DRIVELINE_5_DETAILS)};
const CURRENT_INPUT = ${safeJson(CURRENT_INPUT)};
const CURRENT_REPORT_RESULT = ${safeJson(CURRENT_REPORT_RESULT)};
let MECH_VIEW_MODE = '${MECH_VIEW_MODE}';
const COACH_VIDEO_FPS = 240;
const COACH_VIDEO_DEFAULT_SPEED = 0.1;
const _RADAR_INSTANCES = {};
window.__BBL_RADAR_DATA__ = ${safeJson(radarDataFinal)};
`;

    const playerName = document.getElementById('player-name').value || '신규 선수';
    const playerDate = document.getElementById('player-date').value || '';
    const playerVelo = document.getElementById('player-velo').value || '';

    // 안전한 inline (closing script 처리)
    const safeChartJs = chartJsSrc.replace(/<\/script>/gi, '<\\/script>');

    const fullHtml = '<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">'
      + '<title>BBL Report — ' + playerName + '</title>'
      + '<meta name="viewport" content="width=device-width, initial-scale=1.0">'
      + '<meta name="robots" content="noindex, nofollow">'
      + '<style>' + allStyles + '</style>'
      + '<script>' + safeChartJs + '<\/script>'
      + '</head>'
      + '<body class="min-h-screen" style="background:#f5f7fa; color:#1a1a1a; font-family: \'Inter\', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;">'
      + '<div class="max-w-7xl mx-auto px-6 py-8">'
      + '<header class="border-b border-[#2a2c31] mb-6 pb-4">'
      +   '<div class="display text-2xl">📋 BBL 피칭 리포트 — ' + playerName + '</div>'
      +   '<div class="text-xs text-[var(--text-muted)] mt-1 mono">오프라인 패키지 · ' + playerDate + (playerVelo ? ' · 측정 ' + playerVelo + ' km/h' : '') + ' · 생성 ' + new Date().toLocaleString('ko-KR') + '</div>'
      +   '<div class="text-xs text-[var(--text-muted)] mt-1">인터넷 없이 작동 — 영상·시각화·메카닉 토글·아코디언 모두 사용 가능</div>'
      + '</header>'
      + reportHtml
      + '</div>'
      + '<script>' + inlineDataAndInit + inlineFns
      + `
window.addEventListener("DOMContentLoaded", function(){
  setTimeout(renderRadarCharts, 100);
  // 영상 디폴트: 0.1배속, fps 240 (Uplift 표준) — 모든 가능한 시점에 강제 적용
  const v = document.getElementById('coach-video');
  const fpsInput = document.getElementById('coach-video-fps');
  if (fpsInput) fpsInput.value = COACH_VIDEO_FPS;
  if (v) {
    var firstPlay = true;
    function forceDefaultSpeed(){
      try { v.playbackRate = COACH_VIDEO_DEFAULT_SPEED; } catch(e){}
      document.querySelectorAll('.video-speed-btn').forEach(function(b){
        b.classList.toggle('active', parseFloat(b.dataset.rate) === COACH_VIDEO_DEFAULT_SPEED);
      });
    }
    // 즉시 시도 + 모든 로드 단계마다 적용
    forceDefaultSpeed();
    v.addEventListener('loadstart',     forceDefaultSpeed);
    v.addEventListener('loadedmetadata',forceDefaultSpeed);
    v.addEventListener('loadeddata',    forceDefaultSpeed);
    v.addEventListener('canplay',       forceDefaultSpeed);
    v.addEventListener('canplaythrough',forceDefaultSpeed);
    // 첫 재생 직전에도 강제 — 그 이후엔 사용자가 변경한 속도 유지
    v.addEventListener('play', function(){
      if (firstPlay) {
        v.playbackRate = COACH_VIDEO_DEFAULT_SPEED;
        document.querySelectorAll('.video-speed-btn').forEach(function(b){
          b.classList.toggle('active', parseFloat(b.dataset.rate) === COACH_VIDEO_DEFAULT_SPEED);
        });
        firstPlay = false;
      }
    });
    // 안전망 — 200ms마다 5초간 강제 (base64 디코딩 지연 대응)
    var attempts = 0;
    var iv = setInterval(function(){
      forceDefaultSpeed();
      attempts++;
      if (attempts >= 25 || v.playbackRate === COACH_VIDEO_DEFAULT_SPEED) clearInterval(iv);
    }, 200);
  }
});`
      + '<\/script>'
      + '</body></html>';

    document.body.removeChild(progress);

    const blob = new Blob([fullHtml], {type: 'text/html;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = playerName.replace(/[^\w가-힣]/g, '_') + '_offline.html';
    a.click();
    URL.revokeObjectURL(url);

    const sizeMb = (blob.size / 1024 / 1024).toFixed(1);
    alert('✅ 오프라인 패키지 다운로드 완료!\n\n파일 크기: ' + sizeMb + ' MB\n파일명: ' + a.download
      + '\n\nUSB·이메일·메신저로 선수에게 보내면 인터넷 없이 브라우저에서 그대로 볼 수 있습니다.\n(영상·시각화·메카닉 토글·아코디언·레이더 차트 모두 작동)');

  } catch (err) {
    if (document.body.contains(progress)) document.body.removeChild(progress);
    console.error('오프라인 패키지 생성 오류:', err);
    alert('❌ 오프라인 패키지 생성 실패\n\n' + (err.message || err)
      + '\n\n원인: 네트워크 연결 또는 CORS 정책 문제일 수 있습니다.\n브라우저 개발자 콘솔(F12)에서 자세한 내용 확인.');
  }
}

function downloadHtmlReport() {
  const reportHtml = document.getElementById('report-area').innerHTML;
  // 다운로드 시점의 메카닉 모드(6각형/5각형)를 반영해 데이터 고정
  const radarData = (window.__BBL_RADAR_DATA__ || []).map(d => {
    if (d && d.isMechanics && MECH_VIEW_MODE === '5') {
      return { ...d, labels: d.drivelineLabels, values: d.drivelineValues };
    }
    return d;
  });
  const radarInitJs = `
const __BBL_RADAR_DATA__ = ${JSON.stringify(radarData)};
window.addEventListener('DOMContentLoaded', () => {
  if (typeof Chart === 'undefined') return;
  for (const d of __BBL_RADAR_DATA__) {
    if (!d) continue;
    const canvas = document.getElementById(d.canvasId);
    if (!canvas) continue;
    new Chart(canvas, {
      type: 'radar',
      data: { labels: d.labels, datasets: [
        { label: '코호트 평균 (50)', data: d.labels.map(()=>50),
          backgroundColor: 'rgba(95,99,107,0.08)', borderColor: 'rgba(95,99,107,0.4)',
          borderWidth: 1, borderDash: [3,3], pointRadius: 0 },
        { label: '선수 점수', data: d.values,
          backgroundColor: d.color + '33', borderColor: d.color, borderWidth: 2,
          pointRadius: 4, pointBackgroundColor: d.color,
          pointBorderColor: '#ffffff', pointBorderWidth: 1 }
      ]},
      options: { responsive: true, maintainAspectRatio: false,
        scales: { r: { min: 0, max: 100,
          ticks: { color: '#5f636b', stepSize: 25, backdropColor: 'transparent', font: { size: 9 } },
          grid: { color: 'rgba(95,99,107,0.2)' },
          angleLines: { color: 'rgba(95,99,107,0.3)' },
          pointLabels: { color: '#b3b5b9', font: { size: 11 } } } },
        plugins: { legend: { display: false } }
      }
    });
  }
});`;
  const fullHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>BBL Report — ${(document.getElementById('player-name').value || '신규 선수')}</title>
    <script src="https://cdn.tailwindcss.com"><\/script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"><\/script>
    <style>${document.querySelector('style').textContent}</style>
    </head><body class="min-h-screen p-8">${reportHtml}
    <script>${radarInitJs}<\/script>
    </body></html>`;
  const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const name = document.getElementById('player-name').value || 'BBL_Report';
  a.download = `${name}_report.html`;
  a.click();
  URL.revokeObjectURL(url);
}

// ════════════════════════════════════════════════════════════════════
// 초기화
// ════════════════════════════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', () => {
  renderInputs();
  selectAge('고교');
  setupDropZone('fitness-drop-zone', 'fitness');
  setupDropZone('mech-drop-zone', 'mechanics');
  loadSavedReports();
  // 알고리즘 변경에 대응해 저장된 모든 리포트를 현재 calculateScores로 재계산 + UI 토스트 알림
  const _recomputeResult = recomputeAllSavedReports();
  refreshPlayerSelector();
  setTimeout(() => showRecomputeToast(_recomputeResult), 500);
  // ★ Phase 3 v33.7.4 — Phase 3 변수 누락 saved 자동 감지 안내 토스트 (재계산 토스트 다음에)
  setTimeout(() => showPhase3MissingToast(), 1500);
  // 마스터 DB 자동 로드 (이전 업로드한 게 있으면 힌트 표시)
  _autoLoadMasterDB();
  // 헤더 산식 버전 stamp 동적 갱신 (코드 변경에 자동 추적)
  const algoStamp = document.getElementById('algo-version-stamp');
  if (algoStamp) algoStamp.textContent = ALGORITHM_VERSION;
  const algoDateStamp = document.getElementById('algo-date-stamp');
  if (algoDateStamp) algoDateStamp.textContent = ALGORITHM_DATE;  // 약간 지연시켜 토스트 표시
});
