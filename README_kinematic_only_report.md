# Kinematic-Only Report 빌더 — 개발자 README

**파일**: `kinematic_only_report.js` (93 KB)
**버전**: v33.22 (2026-05-07)
**의존성**: `metadata.js` (VELO_REGRESSION_v33_22, predictMaxVelocity)

## 개요

Theia Offline 6 페이지 narrative + KBO light 디자인 + Kinematic-only 안전 처리를 단일 모듈로 통합한 빌더.
박명균 같은 Uplift kinematic 데이터 입력만으로 P1~P6 6 페이지 자동 렌더링.

## 빠른 사용

```js
// 1. 의존성 로드 (브라우저 / Node)
//   - metadata.js: VELO_REGRESSION_v33_22, predictMaxVelocity
//   - kinematic_only_report.js: buildKinematicOnlyReport

// 2. input 객체 준비
const input = {
  playerId: 'parkmyeonggyun',
  ageGroup: '고교 우투',
  measuredVelocity: 140.5,        // km/h (선택, 없으면 모델 예측만)
  fitness: { ... },                // master_fitness.xlsx 키 사용
  mechanics: { ... },              // bbl_per_session.csv 키 사용
  video: { ... },                  // 영상 통합 (선택)
};

// 3. HTML 생성
const html = buildKinematicOnlyReport(input);
//   → 6 페이지 (P1~P6) + sticky nav + 영상 player + sanitize 모두 포함된 HTML 문자열

// 4. KBO CSS와 함께 wrapping (build_park_offline_v2.js 참조)
```

## 핵심 함수

| 함수 | 역할 |
|---|---|
| `buildKinematicOnlyReport(input)` | 메인 — 6 페이지 + nav + sanitize 통합 HTML 반환 |
| `getDataAvailability(input)` | kinematics·grf·jointPower·ballTracking·forcePlate·cogDecel·video 자동 판별 |
| `sanitizeUnsupportedMetrics(html, da)` | GRF / Joint Power 라벨 자동 "미측정"으로 치환 |
| `renderCoachDelivery({message, cue, videoPoint, kpi})` | kbo-plain 박스 (P1·P2·P3·P4·P6 재사용) |
| `renderDataBadge(da)` | 데이터 가용성 pill 그룹 |
| `renderP1ExecutiveSummaryKinematic(input, da)` | P1 — Hero + Velocity Waterfall + 3 카드 + Coach Delivery |
| `renderP2KinematicOutput(input, da)` | P2 — 분절 회전 속도 3 막대 + 속도 증폭 + 손목 속도 |
| `renderP3KinematicTransferProxy(input, da)` | P3 — Dynamic Sequence SVG + 시간차/증폭 카드 |
| `renderP4FlowLeakTimeline(input, da)` | P4 — 5단계 timeline (Drive→Landing→Torso→Arm→Release) + 영상 jump |
| `renderP5EvidenceDashboardKinematic(input, da)` | P5 — Evidence 6 카드 + 펼침 details (전체 변수표) |
| `renderP6ActionRetestKinematic(input, da)` | P6 — Athlete Card + Drill 패키지 + Retest KPI 표 + Video Checkpoint |
| `renderGlobalVideoPlayer(video, idSuffix)` | 영상 player + frame-step·slow motion 컨트롤 |
| `renderVideoJumpButton(video, stageKey, label, idSuffix)` | P4 단계별 jump 버튼 |
| `renderVideoEventJump(video, eventKey, label, idSuffix)` | P6 이벤트 일시정지 버튼 |

## input 스키마

### `input.fitness` (master_fitness.xlsx 키 그대로)

| 키 | 단위 | 예시 |
|---|---|---|
| `Height[M]` | m | 1.77 |
| `Weight[KG]` | kg | 78 |
| `BMI` | — | 24.9 |
| `CMJ Peak Power / BM [W/kg]` | W/kg | 59.7 |
| `IMTP Peak Vertical Force / BM [N/kg]` | N/kg | 25.87 |
| `Grip Strength` | kg | 51.2 |

### `input.mechanics` (bbl_per_session.csv 키 — `_mean` 제거하고 사용 권장)

| 키 | 단위 | 예시 (박명균) |
|---|---|---|
| `peak_x_factor` 또는 `max_x_factor_mean` | ° | 40.73 |
| `max_pelvis_rot_vel_dps` 또는 `peak_pelvis_av` | °/s | 516.88 |
| `max_trunk_twist_vel_dps` 또는 `peak_trunk_av` | °/s | 791.94 |
| `elbow_ext_vel_max` 또는 `peak_arm_av` | °/s | 1854.92 |
| `shoulder_ir_vel_max` | °/s | 1637.98 |
| `max_shoulder_ER` 또는 `max_shoulder_ER_deg` | ° | 203.58 |
| `pelvis_to_trunk_lag_ms` | ms | 54.28 |
| `trunk_to_arm_lag_ms` | ms | 35 (없으면 빌더에서 50 추정) |
| `pelvis_trunk_speedup` | 배 | 1.53 |
| `arm_trunk_speedup` | 배 | 1.91 |
| `proper_sequence_pct` | % | 100 |
| `_proper_seq_x_of_n` | "n/m" 문자열 | "10/10" |
| `cog_decel` | m/s | 1.18 (★ v33.22 신규 — Driveline 검증 채택) |
| `max_cog_velo` | m/s | 3.17 |
| `lead_knee_ext_change_fc_to_br` | ° | 8.61 |
| `trunk_forward_tilt_at_fc` | ° | 4.16 |
| `arm_slot_mean_deg` | ° | 25.01 |
| `arm_slot_sd_deg` | ° | 1.04 |
| `release_height_m` | m | 1.12 |
| `release_height_sd_cm` | cm | 0.64 |
| `wrist_release_speed` | m/s | 14.97 |

### `input.video` (선택 — 없으면 영상 영역 자동 숨김)

```js
input.video = {
  src: 'parkmg_pitch.mp4',  // 파일 또는 URL
  fps: 240,                  // 캡처 fps (선택, 기본 240)
  stages: {                  // P4 5단계 jump 시점 (초)
    drive:   { peak: 0.50 },
    landing: { peak: 1.10 },
    torso:   { peak: 1.30 },
    arm:     { peak: 1.45 },
    release: { peak: 1.55 },
  },
  events: {                  // P6 이벤트 일시정지 시점 (초)
    kh:  0.40,
    fc:  1.10,
    mer: 1.40,
    br:  1.55,
  },
};
```

## dataAvailability 자동 처리

```js
const da = getDataAvailability(input);
//   da.kinematics   — true (Uplift 데이터 있을 때)
//   da.grf          — false (항상 — Uplift는 GRF 측정 안 함)
//   da.jointPower   — false (항상)
//   da.ballTracking — true if measuredVelocity exists
//   da.forcePlate   — true if Height·Weight·Grip 모두 있음
//   da.cogDecel     — true if cog_decel exists (v33.22)
//   da.video        — true if input.video.src exists
```

`sanitizeUnsupportedMetrics`는 `da.grf=false` / `da.jointPower=false`일 때
GRF / vGRF / braking impulse / Joint Power / kW / J / ETE direct 등 라벨을 자동으로 "미측정"으로 치환.

## 영상 컨트롤 (240 fps 기준)

각 player 아래에 자동 추가:
- `⏮ −5f` (5프레임 뒤로, 240 Hz 기준 ≈20.83ms)
- `◀ −1f` (1프레임 뒤로, ≈4.17ms)
- `▶ / ⏸` (재생/일시정지)
- `+1f ▶` / `+5f ⏭` (앞으로)
- 속도: `0.1×` / `0.25×` / `0.5×` / `1×`
- 실시간 표시: `0.450s · frame 108 / 240 fps · 0.10×`

전역 헬퍼 `kboVideoStep` / `kboVideoSpeed` / `kboVideoTogglePlay` / `kboVideoBindInfo`는
한 번만 등록 (중복 가드 `window._kboVideoHelpersInit`).

## 빌드 예시

`build_park_offline_v2.js`:
```bash
node build_park_offline_v2.js
# → _v33_22_upload/박명균_offline_v2_phaseB.html 생성
```

스크립트 안에서:
1. `metadata.js`에서 `VELO_REGRESSION_v33_22` + `predictMaxVelocity` eval
2. `kinematic_only_report.js`에서 빌더 eval
3. `PARK_INPUT` 객체 정의
4. `buildKinematicOnlyReport(PARK_INPUT)` 호출
5. KBO CSS와 함께 standalone HTML 출력

## 다른 선수 빌드 방법

```js
// build_OOO_offline.js (참고: build_park_offline_v2.js 복제 후 PARK_INPUT만 교체)
const OOO_INPUT = {
  playerId: 'kimgangyeon',
  ageGroup: '고교 좌투',
  measuredVelocity: 146.3,
  fitness: { ... },     // master_fitness.xlsx에서 해당 선수 줄 복사
  mechanics: { ... },   // bbl_per_session.csv에서 해당 세션 줄 복사
  video: { src: 'kgy_pitch.mp4', fps: 240, stages: {...}, events: {...} },
};
const html = buildKinematicOnlyReport(OOO_INPUT);
```

## 가이드 §9 QA 자동 통과 항목

| 항목 | 자동 처리 |
|---|---|
| GRF / Joint Power 라벨 primary 노출 | `sanitizeUnsupportedMetrics`로 일괄 제거 |
| Kinematic Output / Transfer Proxy 용어 | 페이지 제목에 적용됨 |
| "보장" 표현 | 모두 "참고값" / "보장값 아닌"으로 negative phrase |
| Coach Delivery (P1·P2·P3·P4·P6 5곳) | 자동 |
| Athlete Card (P6) | 자동 |
| Video Checkpoint (FC/MER/BR) | 자동 |
| 펼침 details (전체 변수표) | P5 자동 |
| 모바일 반응형 | KBO CSS 미디어 쿼리 |
| UCL / 부상 위험 표시 금지 | 코드에 없음 |

## 향후 확장 (선택)

- `input.cohortVarDist`로 원하는 cohort 분포 넘기기 (기본은 v33.22 BBL 분포)
- P3 Dynamic Sequence를 raw time-series 데이터로 그리기 (현재는 가우시안 시뮬레이션)
- 다국어 지원 (한글 → 영어 / 일본어 자동 번역 레이어)
- PDF print mode (print-safe CSS 추가)

## 연락처

질문·이슈 발생 시 BBL 랩 (kklee@kookmin.ac.kr).
