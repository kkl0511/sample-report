# BBL v31.5 — UI 클린업: 제거된 변수 모든 노출 차단
**Build**: 2026-05-03 / **Patch**: v31.4 → v31.5

---

## 변경 요약

v31.4에서 카테고리에서 제거한 15개 변수가 강점/약점 등 다른 UI에 노출되지 않도록 **점수 산출 자체를 차단**.

### 1) calculateScores 추가 변수 산출에 카테고리 체크

**Before**: `EXTRA_VAR_SCORING`의 모든 변수 점수 산출 → var_scores에 등록 → 카테고리에 없어도 점수 보유
**After**: 카테고리에 없는 변수는 점수 산출 자체 스킵 → var_scores에 등록 안 됨 → 모든 UI에서 자동 제외

```javascript
// v31.5 추가
const _allCatVars = new Set(/* 모든 카테고리의 변수 키 */);
for (const k of Object.keys(EXTRA_VAR_SCORING)) {
  if (!_allCatVars.has(k)) continue;  // ★ 카테고리에 없는 변수 차단
  ...
}
```

### 2) FAULT_COHORT_VAR 정리

**Before**: 16개 결함 모두 코호트 변수 매핑 (제거된 변수 7개 포함)
**After**: 카테고리에 남은 9개 결함만 코호트 비교 활성화

| 제거된 매핑 (카테고리 변수 빠진 결함) |
|---|
| SlowDriveHip (drive_hip_ext_vel_max) |
| ShortStride (stride_norm_height) |
| SoftBlock (com_decel_pct) |
| LateBlock (lead_knee_amortization_ms) |
| InsufficientCounterRot (peak_torso_counter_rot) |
| TrunkArmDisconnect (arm_trunk_speedup) |
| TrunkFallingForward (trunk_forward_tilt_at_br) |

→ 위 결함이 발동되어도 "한국 고교 코호트 비교" 카드 표시 안 됨 (자연스럽게 처리).

### 3) 강점/약점 영역별 카드 — 자동 정리 확인

기존 `varStrengths/varWeaknesses` 산출 로직이 이미 `for (const cat of allCatsAll)` 통해 **카테고리 변수만 순회** → 카테고리에서 제거된 15개 변수는 자동 제외 ✓

---

## UI 위치별 자동 제외 검증

| UI 위치 | 처리 |
|---|---|
| 종합 평가 → 강점 영역별 카드 | ✓ 카테고리 변수만 순회 → 자동 제외 |
| 종합 평가 → 약점 영역별 카드 | ✓ 동일 |
| 카테고리 아코디언 (체력·메카닉·제구) | ✓ category_vars 기반 |
| 5단계 결함 카드 → 코호트 비교 | ✓ FAULT_COHORT_VAR 정리됨 |
| 결함 진단 (KINETIC_FAULTS) | △ 변수 입력 있으면 결함 발동 (UI 표시) |

→ 결함 진단은 카테고리와 별도 도메인이므로 그대로 유지 (사용자가 입력 안 하면 어차피 발동 안 됨).

---

## 정예준 케이스 예상 변화

**Before (v31.4)**: 제거된 변수도 var_scores에 점수 등록 → "강점" 카드에 노출 가능성
**After (v31.5)**: 카테고리 변수만 점수 산출 → 강점/약점 카드에 17개 메카닉 + 11개 체력 + 11개 제구 변수만 표시

---

## 변경 사항 (코드)

- `BBL_신규선수_리포트.html`
  - `ALGORITHM_VERSION` v31.4 → v31.5
  - `calculateScores` 1.5절: 카테고리 외 변수 점수 산출 차단
  - `FAULT_COHORT_VAR`: 7개 매핑 항목 제거 (카테고리 빠진 결함)
- `cohort_v29.js`: 변경 없음
- `kinetic_chain.gif`: 변경 없음

---

## 배포 절차

GitHub Pages에 다음 3개 파일 덮어쓰기:
1. `index.html`
2. `cohort_v29.js` (변경 없음 — 기존 유지)
3. `kinetic_chain.gif` (변경 없음)

→ Cmd+Shift+R → v31.5 확인

---

## v31.0 → v31.5 누적

| 버전 | 핵심 |
|---|---|
| v31.0 | MLB·문헌 표준 대비 점수 |
| v31.1 | 점수(MLB) + 코칭(코호트) 분리 |
| v31.2 | 결측 50% 초과 카테고리 점수 보류 |
| v31.3 | CMJ Impulse 제거 |
| v31.4 | 메카닉 14개 + 체력 1개 정리 |
| **v31.5** | **카테고리 외 변수 UI 노출 차단 (강점/약점 등)** |

---

**END OF v31.5 PATCH NOTES**
