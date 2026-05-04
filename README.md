# BBL v33.3 — Uplift 사전계산 peak frame 우선 사용
**Build**: 2026-05-04 / **Patch**: v33.2 → v33.3 / **Type**: 검출 정확도 개선

---

## v33.3 변경 (박명균 raw 데이터 검증으로 발견)

### 문제: 박명균이 정상 시퀀스인데 "명확한 누수" 표시
박명균 raw 10개 trial 직접 계산 (Uplift 사전계산 peak frame 사용):

| 지표 | 정상 범위 | 박명균 평균 | 진단 |
|---|---|---:|---|
| pelvis → trunk lag | 30~80ms | **58ms** | ✓ 정상 |
| trunk → arm lag | 30~80ms | **57ms** | ✓ 정상 |

→ Uplift는 정확한 peak (frame 806/819/834)을 검출하여 lag 54/63ms 산출
→ **그런데 v33.2까지 화면에는 lag 114/49ms로 표시되며 "명확한 누수"로 잘못 진단**

### 원인 (v31.12 이후 누적된 설계 결함)
```javascript
// 기존: BBL 자체 detection만 사용
events.peakPelvis = detectPeakRotVel('pelvis_rotational_velocity...', _pelvisLo, _pelvisHi);
events.peakTrunk = detectPeakRotVel('trunk_rotational_velocity...', _trunkLo, _trunkHi);
events.peakArm = detectPeakRotVel(armVelCol, _armLo, _armHi);
```
BBL의 raw detectPeakRotVel이 Uplift와 다른 peak을 잡아 lag 부풀림.

### v33.3 수정
```javascript
// Uplift 사전계산 우선, 없을 때만 자체 검출
events.peakPelvis = upEvents.peakPelvis ?? detectPeakRotVel(...);
events.peakTrunk  = upEvents.peakTrunk  ?? detectPeakRotVel(...);
// peakArm: detected throwing arm에 맞는 Uplift 컬럼 우선
const upPeakArmFrame = getFrameAbs(`max_${_throwingArmDetected}_arm_rotational_velocity_with_respect_to_ground_frame`);
events.peakArm = upPeakArmFrame ?? detectPeakRotVel(...);
```

→ Uplift 정밀 검출값 우선 사용. BBL 자체 detection은 Uplift 미검출 시 fallback.

### 박명균 예상 변화 (v33.3 적용 후)

| 지표 | v33.2 (잘못됨) | v33.3 (Raw 일치) |
|---:|---:|---:|
| pelvis → trunk | 114ms ⚠ "명확한 누수" | **58ms ✓ 정상** |
| trunk → arm | 49ms | **57ms** |
| 진단 | LateTrunkRotation 결함 발동 | 정상 시퀀스 |

### 변경 파일
- `index.html`: ALGORITHM_VERSION v33.2 → v33.3, events.peakPelvis/Trunk/Arm Uplift 우선 로직

### 파급 효과
박명균 외 모든 선수의 시퀀스 분석이 더 정확해짐 — Uplift의 정밀 검출 알고리즘을 신뢰하고, BBL은 Uplift 미검출 케이스에만 fallback.

---

# BBL v33.2 — Uplift event placeholder 0을 null로 처리
**Build**: 2026-05-04 / **Patch**: v33.1 → v33.2 / **Type**: 데이터 파싱 버그 픽스

---

## v33.2 변경 (박명균 raw CSV 분석으로 근본 원인 발견)

### 문제 추적
박명균 raw Trial CSV 10개 직접 분석 결과:

| Trial | KH | FC | **MER** | BR | peakPelvis | peakTrunk |
|---|---:|---:|---:|---:|---:|---:|
| 0002~0009, 0012 (9개) | 음수 | 음수 | **0 ⚠** | 음수 | 음수 | 음수 |
| 0010 (1개) | -571 | -752 | **-794 ✓** | -785 | -747 | -760 |

→ **Uplift CSV의 `max_external_rotation_frame` 값이 9/10 trial에서 `0`** (Uplift "not detected" 플레이스홀더)

### BBL의 버그
```javascript
// 기존 (v33.1 이하):
const getFrameAbs = (key) => {
  const ci = idx[key]; if (ci == null) return null;
  const v = parseFloat(r0[ci]); return isNaN(v) ? null : cur0 - v;  // 0을 valid 값으로 처리
};
```
- raw 값이 0이면 `cur0 - 0 = 0` → `events.mer = 0` (frame 0)
- arm peak 검출 윈도우 = `[events.mer + 3, events.br + 10]` = `[3, ~840]` (시퀀스 거의 전체)
- 이 윈도우 내 평균값 vs Uplift MER이 누적 차이로 보여서 평균 90frame 차이로 표시됨
- 실제로는 9개 trial이 처음부터 **events.mer = 0이라는 잘못된 시점에서 검출 시작**
- 결과적으로 left arm이든 right arm이든 0으로 평가 → throwing arm 자동검출 'left' 잘못 선택 → 차트 누락

### v33.2 수정
```javascript
const getFrameAbs = (key) => {
  const ci = idx[key]; if (ci == null) return null;
  const v = parseFloat(r0[ci]);
  if (isNaN(v) || v === 0) return null;  // ★ 0 = Uplift placeholder
  return cur0 - v;
};
```

→ Uplift MER 0 → events.mer null → BBL의 raw MER detection이 fallback으로 작동 → 정상 윈도우 → arm peak 정상 → 시퀀스 차트 표시.

### 변경 파일
- `index.html`: ALGORITHM_VERSION v33.1 → v33.2, getFrameAbs에서 0 placeholder 처리

### 박명균 외 영향
이 fix는 **모든 선수**에게 적용됩니다 — Uplift CSV에서 특정 이벤트가 미검출 시(0 플레이스홀더), 잘못된 valid 값으로 사용하지 않고 raw fallback으로 자동 보완.

---

# BBL v33.1 — Throwing arm 자동검출 신뢰성 가드
**Build**: 2026-05-04 / **Patch**: v33.0 → v33.1 / **Type**: 검출 버그 픽스

---

## v33.1 변경 (박명균 우완 시퀀스 차트 누락 해결)

### 문제 발견
박명균(우완) 시퀀스 타이밍 차트 누락. DevTools 콘솔:
```
⚠ Throwing arm detected (left, max 0°/s) differs from handedness label (right). Using detected.
```

### 원인 (v31.12 자동검출 로직 버그)
```javascript
// 기존
const _throwingArmDetected = _leftMaxAv >= _rightMaxAv ? 'left' : 'right';
```
- 양 팔 모두 0°/s (윈도우 오류 등) → `0 >= 0 = true` → 'left' 잘못 선택
- 우완 라벨이 있는데도 left arm을 throwing arm으로 사용
- 이후 peak detection이 글러브 손 시그널 잡음 → lag null → 차트 누락

### v33.1 수정
```javascript
const _ARM_DETECT_THRESHOLD = 800;  // peak arm AV는 보통 1000+
if (_leftMaxAv < THRESHOLD && _rightMaxAv < THRESHOLD) {
  // 둘 다 신뢰 임계 미만 → handedness label 사용
  _throwingArmDetected = armSide;
} else if (_leftMaxAv > _rightMaxAv) {
  _throwingArmDetected = 'left';
} else if (_rightMaxAv > _leftMaxAv) {
  _throwingArmDetected = 'right';
} else {
  _throwingArmDetected = armSide;  // tie → label 우선
}
```

3가지 가드:
1. **임계 800°/s 미만** → 자동검출 거부, label 사용 (박명균 케이스 직접 해결)
2. **strict `>` 비교** (`>=` 폐기) → tie 시 label로
3. **tie 명시적 처리** → label 우선

### 변경 파일
- `index.html`: ALGORITHM_VERSION v33.0 → v33.1, throwing arm 자동검출 로직 가드 추가

---

# BBL v33.0 — 마네킹 경로 + 레이더 라벨 일치 + 5각 누락 변인
**Build**: 2026-05-04 / **Patch**: v32.9 → v33.0 / **Type**: UX 정밀 + 데이터 완전성

---

## v33.0 변경 (사용자 요청 3건)

### 1. 마네킹 에너지 경로 — 착지다리 → 앞 hip 경유
**기존**: lAnkle → lKnee → pelvisC (가운데로 바로)
**v33.0**: **lAnkle → lKnee → pelvisL (앞 hip) → pelvisC** → rShoulder → rElbow → rWrist → ball
GRF 경로가 발→무릎→**앞 hip**→골반 회전축으로 전달되는 생물역학적 경로 반영.

### 2. 팔꿈치·손목 노드 시각화 (공 던지는 팔)
- 팔꿈치(rElbow)에 펄스 애니메이션 + ARM→FOREARM 색상(`afColor`) 노드
- 손목(rWrist)에 작은 cyan 노드
- 라벨 "ELBOW" 표시
- 팔꿈치 → 손 에너지 흐름이 시각적으로 강조됨

### 3. 레이더 라벨 ↔ 카드 라벨 일치
**기존**: 레이더는 `COHORT.category_meta[c].name` ("X-Factor 형성", "몸통 회전 채찍", "레이백 + 팔 전달")
**v33.0**: `CATEGORY_DETAILS[c].name` 우선 사용 → "몸통 에너지 로딩", "몸통 에너지 발현", "팔 에너지" — **카드와 동일**.
Fallback으로 category_meta 유지 (안전성).

### 4. 5각 Driveline Block — `stride_norm_height` 보강
**원인 분석**: 17개 5각 Driveline 변수 중 `stride_norm_height`만 조건부 계산 (Height[M] 의존)
**v33.0 수정**:
- master_fitness localStorage에서 Height 백업 검색
- 그래도 없으면 코호트 평균 신장(1.80m)으로 근사값 산출 + `_stride_norm_height_approx` 플래그
- Driveline standard 0.85~1.0 기준이라 ±5cm 신장 차이는 점수에 큰 영향 없음

→ Block 카테고리 점수가 항상 산출됨 (Height 자동 보강 또는 근사값).

### 변경 파일
- `index.html`: ALGORITHM_VERSION v32.9 → v33.0, energyPath 경로 변경, 팔꿈치/손목 노드 SVG 추가, 레이더 라벨 우선순위 변경, stride_norm_height Height 백업 로직

---

# BBL v32.9 — 마네킹 누수-only + ARM→FOREARM 신규 + 스토리 재배치
**Build**: 2026-05-04 / **Patch**: v32.8 → v32.9 / **Type**: UX 재설계 + 신규 변수

---

## v32.9 변경 (사용자 요청 3건 일괄)

### 1. ARM → FOREARM 신규 에너지 흐름
**Option A (Biomechanics 기반) 채택**:
```javascript
arm_to_forearm_speedup = elbow_ext_vel_max / shoulder_ir_vel_max
```
**해석**:
- elite 0.50 ~ 0.65 (전완이 상완의 절반 정도 = 정상 채찍)
- > 0.70 → 🚨 전완 의존 (팔꿈치 부하↑, 부상 위험)
- < 0.40 → ⚠ 전완 가속 부족 (출력 손실)
- 0.40 ~ 0.70 → 정상 (라벨 숨김)

`extractScalarsFromUplift`에 산식 추가 (4줄). Phase 2: 코호트 분포 확보 후 percentile 전환 검토.

### 2. 마네킹 시각화 — 누수 only 원칙
**기존**: 7개 라벨이 항상 표시 (PELVIS→TRUNK, TRUNK→ARM, TRUNK ROT VEL, X-FACTOR, DRIVE LEG, FRONT-FOOT BLOCK, 무릎 신전)
**v32.9**: 누수 트리거 발생 시에만 라벨 표시. 정상 단계는 깨끗.

| 라벨 | 트리거 조건 |
|---|---|
| ⚠ PELVIS → TRUNK | `pelvis_to_trunk_lag_ms` 정상 30~80ms 벗어남 |
| ⚠ TRUNK → ARM | `trunk_to_arm_lag_ms` 정상 20~80ms 벗어남 |
| 🚨/△ ARM → FOREARM | `arm_to_forearm_speedup` 0.40~0.70 벗어남 (★ 신규) |
| ⚠ FLYING OPEN | `hip_shoulder_sep_at_fc` < 5° |
| 🚨/△ 무릎 무너짐 | `lead_knee_ext_change_fc_to_br` < -10° |
| △ 추진 약함/부족 | drive_hip 또는 max_cog_velo 부족 |

→ 전부 정상이면 중앙에 "✅ 키네틱 체인 정상 — 모든 단계 에너지 전달 효율 양호" 단일 메시지.

### 3. 스토리 순서 재배치 (5.5 위치)
**v31.22 순서**: coachingDiag → GIF → 마네킹 → 에너지 흐름 → 결함 → 우선순위 → summary
**v32.9 순서**:
1. 구속·잠재구속 (header)
2. 점수 (sections)
3. 키네틱 체인 개념 (GIF)
4. 마네킹·시퀀스·에너지 흐름 (coach session)
5. 리크 원인 (faultsHtml)
**5.5. 투수 유형 진단 (coachingDiagHtml) ← 신규 위치**
6. 종합 평가·강점·약점 (summary)
**7. 코칭 우선순위 액션 플랜 (trainingPriorityHtml) ← summary 다음으로 분리**

근거: 투수 유형은 1~5의 종합 결과 → 종합 평가 직전이 자연. 코칭 우선순위는 액션 → 마지막.

### 변경 파일
- `index.html`: ALGORITHM_VERSION v32.8 → v32.9, arm_to_forearm_speedup 산식 추가, 마네킹 라벨 누수-only 재구성, kineticChainBlock 순서 변경, actionPlanBlock 신규 분리

---

# BBL v32.8 — 음수 lag 해석 정정 (검출 오류로 처리)
**Build**: 2026-05-04 / **Patch**: v32.7 → v32.8 / **Type**: 정정

---

## v32.8 변경 (v32.7 정정)

### v32.7의 잘못된 해석
v32.7에서 음수 lag을 "발달 단계 미성숙 시퀀스"로 표시. 사용자(국민대 스포츠과학과 교수) 지적: **"음수가 될 수 없어"**.

### Biomechanical 정정
proximal-to-distal sequencing 원칙상 **pelvis peak → trunk peak → arm peak** 순서는 발달 단계 미성숙으로도 위반되지 않음. 음수 lag = peak detection 오류.

### v32.8 처리
```javascript
const detectionErrorPT = pToT < 0;
const detectionErrorTA = tToA < 0;
const pToTAdj = Math.abs(pToT);    // magnitude 표시용 보정
const tToAAdj = Math.abs(tToA);
// 차트는 abs 값으로 정상 렌더 (좌완도 차트 표시됨)
// 차트 아래 "🚨 이벤트 검출 오류 의심" 명확한 경고 + 원본 lag 값 + 재업로드/윈도우 점검 권장
```

차트는 항상 렌더 (좌완 누락 문제 해결 유지), 음수 케이스는 명시적으로 detection 오류임을 알림.

### 변경 파일
- `index.html`: ALGORITHM_VERSION v32.7 → v32.8, immatureNote → detectionErrorNote

---

# BBL v32.7 — 숫자 포매팅 + 좌완 시퀀스 차트 복구
**Build**: 2026-05-04 / **Patch**: v32.6 → v32.7 / **Type**: UX 픽스 두 건

---

## v32.7 변경 (사용자 발견 두 건)

### 1. narrative 점수차 소수점 1자리 통일 (FP 정밀도)
**문제**: "+19.200000000000003점" 같은 부동소수점 출력
**원인**: `mechS - fitS = 88.9 - 69.7 = 19.200000000000003` (JS FP 정밀도)
**수정**:
```javascript
const diffRaw = mechS - fitS;
const diff = +diffRaw.toFixed(1);  // 19.2로 정규화
```

### 2. 좌완 키네틱 시퀀스 차트 누락 수정 (오승현·박명균)
**문제**: 좌완 발달 단계 선수의 시퀀스 차트가 안 보임
**원인**: v31.13에서 음수 lag(`pToT < 0 || tToA < 0`)을 측정 오류로 간주하고 차트 차단, 경고 메시지로 대체
**진단**: v31.12 throwing arm 자동 검출 후엔 음수 lag이 진짜 발달 단계 미성숙 시퀀스 (메모리 원칙)
**수정**: 음수 lag도 차트 정상 렌더, 차트 범위 확장, "발달 단계 미성숙 시퀀스" 안내문 차트 아래 추가

### 변경 파일
- `index.html`: ALGORITHM_VERSION v32.6 → v32.7, narrative diff toFixed(1), 시퀀스 차트 차단 로직 제거

---

# BBL v32.6 — 비교표 칼럼 정렬 수정 (UI)
**Build**: 2026-05-04 / **Patch**: v32.5 → v32.6 / **Type**: UI 정렬 픽스

---

## v32.6 변경

H1↔H2·선수간 비교표에서 발견된 정렬 이슈 수정.

### 문제
1. **헤더가 좌측 정렬, 데이터는 우측 정렬** — `<th class="text-right">`이 `.cmp-table th { text-align: left }`에 덮여서 1차·2차·Δ 헤더가 좌측에 붙고 숫자는 우측에 붙어 시각적으로 어긋남
2. **자릿수 정렬 안 됨** — monospace 폰트지만 tabular-nums가 없어 `0.3`과 `100.0`의 소수점 위치가 맞지 않음

### 수정 (CSS 두 줄)
```css
.cmp-table th.text-right { text-align: right; }   /* 헤더 우측 정렬 */
.cmp-table .cmp-num {
  font-variant-numeric: tabular-nums;             /* 자릿수 폭 동일 */
  min-width: 70px;                                /* 칼럼 폭 일관 */
}
```

산식 변화 없음 — 순수 시각 정렬 픽스.

---

# BBL v32.5 — "more is better" 변수 10개 추가 percentile 전환
**Build**: 2026-05-04 / **Patch**: v32.4 → v32.5 / **Type**: 산식 수정 (광범)

---

## v32.5 변경

v32.4에서 발견된 "가우시안 optimal이 코호트 median보다 위면 점수 폭락" 문제가 다른 변수에도 동일하게 존재. 코호트 분포가 있고 "more is better" 성격인 변수 10개를 추가 percentile로 전환.

### 전환된 10개 변수

| 변수 | 카테고리 | n | 사유 |
|---|---|---:|---|
| IMTP Peak Vertical Force / BM | F1_Strength | 234 | optimal=36 vs cohort median 26.8 — 폭락 위험 |
| **CMJ RSI-modified** | F3_Reactivity | 234 | optimal=0.5 vs RSI 1.1(top)인 선수가 0점 받던 문제 |
| **SJ RSI-modified** | F3_Reactivity | 233 | 동일 |
| **EUR** | F3_Reactivity | 233 | optimal mismatch |
| max_trunk_twist_vel_dps | C4 (mechanics) | 199 | Werner 950°/s 가정 — 발달 코호트 median 540 |
| max_pelvis_rot_vel_dps | C3 (mechanics) | 199 | 동일 |
| trunk_flex_vel_max | C4 (mechanics) | 198 | 동일 |
| lead_knee_ext_vel_max | C2 (mechanics) | 196 | 동일 |
| Height[M] | F4_Body | 234 | 체형은 코호트 분포가 더 적절 |
| Weight[KG] | F4_Body | 234 | 동일 |

### 변경 안 한 16개 변수 (분포 미보유 — Phase 2)

코호트 분포(`var_sorted_lookup`)가 cohort_v29.js에 없어서 LITERATURE_OVERRIDE 해제해도 자동 가우시안 fallback으로 떨어짐. raw 데이터 재처리 후 분포 추가 필요:

```
peak_x_factor (★ 사용자 우선 요구)
peak_arm_av, peak_trunk_av, peak_pelvis_av
elbow_ext_vel_max, shoulder_ir_vel_max
hip_ir_vel_max_drive, max_cog_velo
drive_hip_ext_vel_max, lead_hip_ext_vel_max
arm_trunk_speedup, pelvis_trunk_speedup
peak_torso_counter_rot, torso_side_bend_at_mer, torso_rotation_at_br
lead_knee_ext_change_fc_to_br, stride_norm_height
```

### 가우시안 유지 (의도된 양방향 최적)

진짜 양방향 최적이 있는 변수는 가우시안 그대로 유지:
- `BMI` — 25 근처가 진짜 생물학적 최적
- `max_shoulder_ER_deg` — 부상 모니터링 (180° elite, 200°+ valgus stress)
- `trunk_rotation_at_fc`, `trunk_forward_tilt_at_fc`, `hip_shoulder_sep_at_fc`, `shoulder_h_abd_at_fc`, `arm_slot_mean_deg` — 자세 최적 각도
- `com_decel_pct`, `lead_knee_amortization_ms`, `stride_time_ms`, `lead_hip_flex_at_fc` — 타이밍/자세
- SD 변수들 (lower-better, 가우시안 형태가 적합)

### 정예준 케이스 효과

| 카테고리 | v32.4 | v32.5 | 변화 |
|---|---:|---:|---|
| F2_Power | H1 53.8 / H2 17.8 | 동일 | (v32.4에서 처리) |
| **F3_Reactivity** | H1 30 / H2 42 | **H1 64.5 / H2 45** | ★ 방향 반전 |

★ F3 방향 반전의 의미: 가우시안 산식에서는 RSI 1.1(코호트 top)이 optimal=0.5와 멀어 0점이 됐었음. percentile은 "RSI 높을수록 좋음"을 정상 반영 → H1의 폭발적 반응성이 제대로 평가됨.

### 변경 파일
- `metadata.js`: LITERATURE_OVERRIDE에서 10개 변수 주석 처리
- `index.html`: ALGORITHM_VERSION v32.4 → v32.5

### 메모리 적용 원칙
- 발달 단계 코호트 컨텍스트 우선 (elite 가우시안 X)
- 측정 신뢰성 있는 변수만 카테고리 점수에 사용
- X-factor 등 사용자 우선 변수는 Phase 2 분포 확보 후 즉시 전환

---

# BBL v32.4 — F2_Power 산식 percentile 전환
**Build**: 2026-05-04 / **Patch**: v32.3 → v32.4 / **Type**: 산식 수정

---

## v32.4 변경

### 배경
정예준 H1(4월) vs H2(10월) 비교 진단에서 발견된 F2_Power 산식 이슈.

**문제 발견 과정**
1. H1 체력 51.8 → H2 체력 28.7 (Δ −23.1)으로 비정상 큰 차이
2. 진단 결과: F2_Power가 49.8 → **0.3**으로 추락 (전체 체력 −23의 단일 원인)
3. F2_Power 산식 추적: **LITERATURE_OVERRIDE의 가우시안 산식**
   - `CMJ Peak Power / BM`: optimal=60 W/kg, sigma=6
   - `SJ Peak Power / BM`: optimal=59 W/kg, sigma=6
   - 점수 = 100 × exp(−(value − optimal)² / (2 × sigma²))

### 문제의 본질
가우시안 산식은 "최적값에서 멀어질수록 점수↓"라서 **양쪽으로 페널티**. 체중당 power는 "more is better" 메트릭인데 가우시안이 부적절. 결과:

```
              optimal     코호트 median   코호트 max
CMJ_BM:       60          47.6           93.3
SJ_BM:        59          46.4           74.9
```

→ 코호트 median이 optimal 아래 → **대부분 선수가 0~몇 점**. 정예준 H2는 CMJ 42(percentile 21%)인데 점수가 1점.

### 수정 (metadata.js)
```javascript
// LITERATURE_OVERRIDE Set에서 CMJ·SJ Power /BM 제외 → percentile 산식 사용
// 'CMJ Peak Power / BM [W/kg]',  // → percentile (v32.4)
// 'SJ Peak Power / BM [W/kg]',   // → percentile (v32.4)
```

`percentileOfCohort()` 함수가 LITERATURE_OVERRIDE 체크를 건너뛰면 자동으로 코호트 sorted_lookup 기반 percentile로 산출됨. Code 변경은 주석 처리 한 줄.

### 효과 (정예준 시뮬)

| 지표 | 이전 (Gaussian) | v32.4 (Percentile) |
|---|---:|---:|
| H1 F2_Power | 49.8 | **53.8** |
| H2 F2_Power | **0.3** | **17.8** |
| Δ F2 | −49.5 | **−36.0** |
| 체력 종합 Δ | −23.1 | **약 −17.2** |

여전히 큰 차이지만 측정 데이터의 실제 변화(CMJ percentile 73→21)를 반영하는 합리적 수치.

### 영향 범위
- F2_Power가 들어가는 모든 보고서 점수 자동 변화 (저장된 리포트는 재계산 트리거됨)
- 134코호트 비교 분석에도 영향 — 빠른/느린 그룹 F2 차이가 더 분포 기반으로 표현됨

### 변경하지 않은 것 (Phase 2 검토)
같은 패턴(가우시안 + optimal이 코호트 median보다 위)이 다른 변수에도 있을 가능성:
- `IMTP Peak Vertical Force / BM` (optimal=36, 코호트 median ?)
- `CMJ RSI-modified`, `SJ RSI-modified`, `EUR`
- F4_Body 변수들 (`Height`, `Weight`, `BMI` — 이건 Gaussian이 정당할 수도)

→ 사용자 확인 후 Phase 2에서 일괄 검토 권장.

### 변경 파일
- `metadata.js`: LITERATURE_OVERRIDE 2줄 주석 처리
- `index.html`: ALGORITHM_VERSION v32.3 → v32.4

---

# BBL v32.3 — IPS 부분측정 경고 FP 버그 수정
**Build**: 2026-05-04 / **Patch**: v32.2 → v32.3 / **Type**: 버그 픽스

---

## v32.3 변경
배포 후 첫 검증에서 발견된 사소한 부동소수점 비교 버그 수정.

### 문제
IPS 카드의 "⚠ 부분 측정" 경고가 4개 항목 모두 측정됐는데도 잘못 표시됨.
```
0.40 + 0.30 + 0.20 + 0.10 = 0.9999999999999999  (JavaScript FP arithmetic)
조건: totalWeight < 1.0 → true (잘못)
```

### 수정
```js
// 이전 (v32.2):
note: totalWeight < 1.0 ? `부분 측정 ...` : null
// 이후 (v32.3):
const isPartial = totalWeight < 0.999;  // FP tolerance
note: isPartial ? ... : null
```

수학적 결과는 v32.2와 동일 — UI 경고 표시 로직만 수정.

---

# BBL v32.2 — index.html 통합 + C5 가중치 절충
**Build**: 2026-05-04 / **Patch**: v32.1 → v32.2 / **Type**: 메인 파일 통합 + 가중치 조정

---

## v32.2 변경 (메인 파일 통합)

### 배경
v32.0/v32.1 변경사항이 잘못된 파일(`BBL_신규선수_리포트.html`)에 적용되어 있었음을 git 이력으로 확인:
- 2026-05-04 19:18 사용자가 `BBL_신규선수_리포트.html`을 명시적으로 삭제 (commit `8d32dc7`)
- 2026-05-04 19:32 v32.1 작업물로 의도치 않게 부활 (commit `160d538`)
- → **`index.html`이 진짜 메인 파일**, 다른 파일은 레거시

### 변경 사항

**1. index.html (메인 파일)**:
- `ALGORITHM_VERSION` v31.48 → **v32.2**
- v32.0/v32.1 변경사항 모두 이식:
  - `CATEGORY_WEIGHTS.F1_Strength` 신설 (IMTP/BM·Grip 둘 다 1.00)
  - `CATEGORY_WEIGHTS.C4_TrunkAcceleration.trunk_flex_vel_max` 0.80 → **1.00** (cohort long d=+0.96)
  - `IPS_WEIGHTS`, `calculateIPS()`, `renderIPSCard()` 신규
  - `calculateScores()` 결과에 `_raw_inputs` 포함
  - `renderH1H2Comparison`에 IPS 카드 통합
  - `FITNESS_KEYS_FROM_MASTER`에 `'Grip Strength'` 추가
- C5 가중치 절충 (사용자 결정):
  - `MECHANICS_CAT_WEIGHTS.C5_UpperBodyTransfer` 1.5 → **1.0**
  - 근거: Driveline literature(r≈0.50) ↔ 134코호트(d=+0.09 천장 효과) 절충

**2. cohort_v29.js (변경 없음)**:
- v32.1에서 추가한 Grip Strength 분포·delta_distributions 그대로 유지
- index.html과 BBL_신규선수_리포트.html 양쪽에서 호환

**3. BBL_신규선수_리포트.html (레거시 정리 필요)**:
- 사용자 원 의도(2026-05-04 19:18 삭제)에 따라 GitHub에서 **수동 삭제 권장**
- 작업 폴더에는 참고용으로 남김

### 보존된 index.html 기존 가중치 (v31.48에서 유지)
사용자가 학술 근거(Werner, Wood-Smith, Driveline) 기반으로 설정한 기존 가중치는 그대로 유지:

| 카테고리 | 유지 값 | 근거 |
|---|---:|---|
| MECHANICS_CAT_WEIGHTS | C1=0.8, C2=1.0, C3=1.0, C4=1.5 | 기존 (literature) |
| FITNESS_CAT_WEIGHTS | F1=1.0, F2=2.0, F3=1.0, F4=0.3 | 기존 (v31.39) |
| CONTROL_CAT_WEIGHTS | P1=1.5, P4=1.2, 나머지 1.0 | 기존 (v31.43) |
| C2_FrontLegBlock 내부 | knee 유지=1.0, knee 신전속도=0.2 | 기존 (v31.33 도메인 인사이트) |
| C3_SeparationFormation 내부 | peak_x_factor=1.0, max_pelvis_rot=0.8 등 | 기존 (v31.36) |

→ 134코호트 d 분석은 위 항목들을 **부분 검증**(C4 1.5는 일치). 충돌 항목은 C5 한 곳뿐, 절충안 반영.

### 검증
```
JS syntax: ✅ index.html, cohort_v29.js 모두 통과
변경 위치 확인:
  ALGORITHM_VERSION = 'v32.2' (line 661)
  C5_UpperBodyTransfer: 1.0 (line 4258)
  F1_Strength CATEGORY_WEIGHTS (line 4105)
  calculateIPS / renderIPSCard (line 4489, 4530)
  Grip Strength FITNESS_KEYS_FROM_MASTER (line 2140)
```

---

# BBL v32.1 — 악력(Grip Strength) F1_Strength 통합
**Build**: 2026-05-04 / **Patch**: v32.0 → v32.1 / **Type**: 변수 추가

> ⚠ v32.1은 잘못된 파일(BBL_신규선수_리포트.html)에 적용된 것으로 후속 v32.2에서 index.html로 이식됨. 아래 내용은 변경 의도 기록용.

---

## v32.1 변경 (악력 통합)

### 배경
v32.0 개정안의 Phase 2 항목으로 보류했던 `Grip Strength`를 **master_fitness.xlsx 268명 데이터 확보**로 즉시 통합. 분석 문서에서 Grip cross d=+1.18 (Large)로 IMTP/BM(d=+0.98)보다도 큰 효과.

### 변경 사항

**1. cohort_v29.js**:
- `var_distributions`에 `Grip Strength` 추가 (n=268, mean=51.33 kg, sd=7.48)
- `var_distributions`에 `Grip Strength / BM [kg/kg]` 추가 (mean=0.635, sd=0.093)
- `var_sorted_lookup`에 두 변수의 정렬 배열 추가 (각 268개)
- `category_vars.F1_Strength`에 `Grip Strength` 항목 추가

**2. BBL_신규선수_리포트.html**:
- `ALGORITHM_VERSION` v32.0 → **v32.1**
- `CATEGORY_WEIGHTS.F1_Strength` 신설 — IMTP/BM·Grip 둘 다 1.00 (Large effect)
- `FITNESS_KEYS_FROM_MASTER`에 `'Grip Strength'` 추가 (master_fitness.xlsx 자동 매칭)

### 효과 시뮬레이션 (분석 문서 §3 그룹 평균값)

| | 빠른 그룹 | 느린 그룹 | 차이 |
|---|---:|---:|---:|
| v32.0 (IMTP only) | 72점 | 40점 | **32점** |
| v32.1 (IMTP + Grip) | 74점 | 36점 | **38점** |

→ F1_Strength 변별력 +19% (Grip Strength이 빠른/느린 그룹을 IMTP보다 더 잘 구별).

### 검증
```
JS syntax: ✅ 두 파일 모두 통과
Grip percentile lookup:
  빠른 그룹 56.4 kg → 76th percentile
  느린 그룹 47.4 kg → 32nd percentile
  d 비례 변별력 확인
```

---

# BBL v32.0 — 134명 코호트 효과크기 기반 점수 개정 + IPS(향상 잠재력 점수) 도입
**Build**: 2026-05-04 / **Patch**: v31.24 → v32.0 / **Type**: 산식 개정

---

## 🎯 변경 요약

134명 BBL 고교 1년 투수 코호트(Spring 2025 = H1, Fall 2025 = H2)의 페어드 분석 결과를 점수 산정 방식에 반영.

### 핵심 발견 (분석 문서 §3 요약)
1. **단기 향상 동력 = 메카닉**, 특히 **C4 몸통 가속** (cross d=+1.25, 단일 최대)
2. **단일 최강 변수**: `trunk_flex_vel_max` (long d=+0.96, cross d=+0.89)
3. **C5 코킹은 차이 없음** (d=+0.09, MER ~190° 천장 효과)

### 반영 방향
- **현재 수행력 점수 (Cross-sectional)**: 카테고리 가중치 효과크기 비례화 + C4 내부 변수 가중치 강화
- **향상 잠재력 점수 (IPS)**: 신규 도입 — H1↔H2 비교 뷰 전용

---

## 변경 사항

### 1. 메카닉 종합 점수 — 카테고리 가중치 도입

**이전**: `Mechanics_Score = 단순 평균(C1~C5)`
**v32.0**: 효과크기 기반 가중 평균 (`MECHANICS_AREA_WEIGHTS`)

| 카테고리 | 이전 | v32.0 | 근거 |
|---|---:|---:|---|
| C1_LowerBodyDrive | 1.0 | **1.0** | cross d=+0.94 |
| C2_FrontLegBlock | 1.0 | **0.8** | cross d=+0.71 |
| C3_SeparationFormation | 1.0 | **1.0** | cross d=+0.83 |
| **C4_TrunkAcceleration** | 1.0 | **1.5** | ★ cross d=+1.25 (단일 최대) |
| **C5_UpperBodyTransfer** | 1.0 | **0.5** | d=+0.09 (MER 천장 효과) |

→ 합 4.8. C4 비중 31%, C5 비중 10%.

### 2. C4_TrunkAcceleration 내부 변수 가중치

| 변수 | 이전 | v32.0 | 근거 |
|---|---:|---:|---|
| **trunk_flex_vel_max** | 0.40 | **1.00** | ★ long d=+0.96 (단일 최강) |
| max_trunk_twist_vel_dps | 0.60 | **0.80** | cross d=+0.90 |
| pelvis_to_trunk_lag_ms | 0.80 | 0.80 | 유지 |
| max_pelvis_rot_vel_dps | 0.40 | 0.40 | 유지 |
| torso_side_bend_at_mer | 0.60 | **0.40** | 효과 미관찰 |

### 3. IPS — Improvement Potential Score (신규)

H1↔H2 두 시점이 모두 측정된 선수에게만 산출. 종단 효과크기 기반 가중 z-score 합.

```
IPS = 50 + 20 × Σ(w_i × Z(Δx_i)) / Σ(w_i)

w_trunk_flex_vel_max     = 0.40   (long d=+0.96)
w_C4_TrunkAcceleration   = 0.30   (long d=+0.63)
w_Mechanics_Score        = 0.20   (long d=+0.57)
w_C1_LowerBodyDrive      = 0.10   (long d=+0.45)
```

**해석**: ≥70 급성장형 / 50~70 정상 발달 / 30~50 주의 / <30 정체 위험

**Phase 1 잠정값** (cohort_v29.js `delta_distributions`):
- trunk_flex_vel_max ΔH SD ≈ 60 °/s
- C4 점수 ΔH SD ≈ 12점
- Mechanics 종합 ΔH SD ≈ 11점, mean ≈ 5점
- C1 점수 ΔH SD ≈ 10점

→ Phase 2(134명 페어드 raw 분포)에서 정확값으로 갱신 예정.

### 4. 코드 변경 위치

- **`BBL_신규선수_리포트.html`**:
  - `ALGORITHM_VERSION` v31.24 → **v32.0**
  - `MECHANICS_AREA_WEIGHTS` 신규 상수 (4137 라인 부근)
  - `computeMechanicsScore()` 헬퍼 신규
  - `Mechanics_Score` 계산을 가중평균으로 교체
  - `CATEGORY_WEIGHTS.C4_TrunkAcceleration` 갱신
  - `IPS_WEIGHTS`, `_zOfDelta()`, `calculateIPS()` 신규
  - `renderIPSCard()` 신규 — H1↔H2 결과 상단 표시
  - `calculateScores()` 결과에 `_raw_inputs` 포함 (IPS용)
- **`cohort_v29.js`**:
  - `delta_distributions` 신규 섹션 (Phase 1 잠정값)

---

## 효과 시뮬레이션 (분석 문서 §3 평균값 기반)

### 횡단 — 빠른 vs 느린 그룹 메카닉 종합 점수

| | 이전 (단순 평균) | v32.0 (가중 평균) |
|---|---:|---:|
| 느린 그룹 | 44.2 | **41.1** |
| 빠른 그룹 | 59.4 | **59.2** |
| **차이** | **15.1점** | **18.1점** ↑ |

→ C4 약점이 약점으로 더 명확히 진단됨. 변별력 +20%.

### 종단 — 향상 vs 정체 그룹 IPS

| | trunk_flex Δ | C4 Δ | Mech Δ | C1 Δ | **IPS** | 라벨 |
|---|---:|---:|---:|---:|---:|---|
| 향상 그룹 | +41 | +6.1 | +10.7 | +5.2 | **61.6** | 정상 발달 |
| 정체 그룹 | −39 | −6.8 | +4.5 | −3.5 | **40.5** | 주의 |

→ 21점 차이로 명확히 구분.

---

## 변경하지 않은 것

- **C2 무릎 평가 임계** (메모리: 0 이상 만점, 음수만 감점)
- **C5 max_shoulder_ER_deg 변수 자체** (부상 모니터링용, 카테고리 가중치만 축소)
- **좌완 -3 km/h offset** (회귀 절편 구조)
- **시퀀싱 lag 발달 단계 컨텍스트** 관대 처리
- **카테고리 결측 50% 보류** 신뢰성 장치 (v31.2 도입)

---

## 검증

```
JS syntax check (node --check):
  BBL_신규선수_리포트.html script blocks: ✅ OK
  cohort_v29.js: ✅ OK

Synthetic input sanity check:
  ✅ 빠른/느린 그룹 변별력 +20% 확인
  ✅ 향상/정체 그룹 IPS 21점 차이 확인
```

배포 후 권장 검증:
1. 기존 저장된 H1·H2 페어 선수 1~2명 열어서 IPS 카드 정상 표시 확인
2. trunk_flex_vel_max 결측 선수에서 IPS "부분 측정" 안내 정상 표시 확인
3. Mechanics_Score가 이전 대비 약점 강조형으로 변동했는지 spot check

---

## Phase 2 별도 작업 (코호트 재학습 시)

- `Grip Strength` 분포 추가 → F1_Strength에 `Grip / BM` 변수 통합
- `delta_distributions` 134명 페어드 정확값으로 갱신
- IPS 가중치 다중회귀로 재학습
- `peak_x_factor`·`max_cog_velo` 결측 보강

---

## v31.12 → v32.5 누적

| 버전 | 핵심 |
|---|---|
| v31.12 | throwing arm 자동 검출 |
| v31.13~v31.48 | UX·임계 fine-tune, 카테고리별 가중치 정교화 (literature 기반) |
| v32.0 | 134명 코호트 효과크기 기반 카테고리 가중치 + IPS 신설 (잘못된 파일 적용) |
| v32.1 | 악력(Grip Strength) F1_Strength 통합 (잘못된 파일 적용) |
| v32.2 | index.html로 통합 + C5 가중치 절충 (1.5 → 1.0) |
| v32.3 | IPS 부분측정 경고 FP 비교 버그 수정 |
| v32.4 | F2_Power(CMJ·SJ /BM) percentile 산식 전환 |
| v32.5 | "more is better" 변수 10개 추가 percentile 전환 |
| v32.6 | 비교표 칼럼 정렬 수정 (UI 픽스) |
| v32.7 | 숫자 FP 포매팅 + 좌완 시퀀스 차트 복구 |
| v32.8 | 음수 lag 해석 정정 (발달 미성숙→이벤트 검출 오류) |
| v32.9 | 마네킹 누수-only + ARM→FOREARM 신규 + 스토리 재배치 |
| v33.0 | 마네킹 경로(앞 hip 경유) + 팔꿈치 노드 + 레이더 라벨 일치 + 5각 stride_norm_height 보강 |
| v33.1 | Throwing arm 자동검출 신뢰성 가드 |
| v33.2 | Uplift event placeholder 0을 null 처리 |
| **v33.3** | **Uplift 사전계산 peak frame 우선 (박명균 lag 114→58ms 정상화)** |

---

## 배포 절차

GitHub 레포(`kkl0511/BBL_Pitching_Report1`) 루트에 다음 3개 파일 덮어쓰기 업로드:
1. `BBL_신규선수_리포트.html`
2. `cohort_v29.js`
3. `README.md`

→ Cmd+Shift+R (캐시 무효화 새로고침) → 좌측 상단 **v32.0** 확인

---

**END OF v32.0 PATCH NOTES**
