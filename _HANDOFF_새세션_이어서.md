# BBL 피칭 리포트 — 새 세션 인수인계 문서

**최종 작업일**: 2026-05-05
**현재 버전**: **v33.9**
**작업자 컨텍스트**: 국민대 스포츠과학과 교수 (야구 바이오메카닉스 전문, 코딩 초보자)
**Phase 3 완료**: Output(출력) vs Transfer(전달) vs Injury(부상) 분리 진단 시스템 구축 완료

---

## 0. 새 세션 시작 시 첫 메시지 (사용자에게)

새 채팅창에서 첫 메시지로 다음을 보내주세요 (Claude가 컨텍스트를 빠르게 잡습니다):

```
이전 세션에서 BBL 피칭 리포트 v33.9까지 작업 완료한 상태야.
작업 폴더의 _HANDOFF_새세션_이어서.md 파일을 먼저 읽어줘.
이번 세션 목적: [원하는 작업 — 예: "정예준 마네킹 좌·우 시각화 검증" 또는 "신규 학술 보고용 자동 텍스트 생성"]
```

Claude가 자동 메모리(MEMORY.md) + 이 인수인계 문서 + 갱신된 README.md 패치노트를 읽어 모든 컨텍스트를 복원합니다.

---

## 1. 프로젝트 개요

**대상**: github.com/kkl0511/BBL_Pitching_Report1 (배포: kkl0511.github.io/BBL_Pitching_Report1/)
**용도**: 야구 투수 메카닉·체력·제구 분석 리포트 (Uplift Capture 데이터 활용)
**코호트**: 134명 고교 1학년 투수 × Spring/Fall 2025 = 268 측정 (실효 n≈186 세션)

**핵심 진단 프레임 (★ Phase 3 신설)**:
- **출력 (Output)** — 각 분절(하체→몸통→팔)이 만들어내는 절대 회전·선형 출력
- **전달 (Transfer)** — 분절 간 에너지가 효율적으로 흐르는가 (시퀀싱·증폭률·저장방출)
- **부상 위험 (Injury)** — 출력의 비용 (UCL stress, knee stress)

4사분면 진단으로 **"낭비형"(② 출력↑전달↓)** 같은 코칭 효과 가장 큰 케이스 자동 식별.

**파일 구조**:
```
index.html       (661라인) — UI 마크업 + 스타일
app.js          (~7,000라인) — 메인 로직 (v33.4에서 분리, v33.9까지 누적)
metadata.js       (~870라인) — KINETIC_FAULTS, EXTRA_VAR_SCORING, LITERATURE_OVERRIDE,
                                INJURY_LITERATURE_THRESHOLDS, OUTPUT_VS_TRANSFER, OUTPUT_VS_TRANSFER_VAR_META
cohort_v29.js   (~9,000라인) — 코호트 통계 (v33.9 stride_norm_height master Height 매핑 갱신 포함)
player_meta.js    (321라인) — 선수 메타 CSV 파서
```

---

## 2. v33.5~v33.9 작업 요약 (이번 세션)

| 버전 | 핵심 변경 | 비고 |
|---|---|---|
| **v33.5** | Phase 2: 16개 메카닉 변수 134 코호트 분포 산출 + LITERATURE_OVERRIDE 해제 | Python 1810 trial 일괄 처리 |
| **v33.6** | Phase 3: Output·Transfer·Injury 7변수 신설 (wrist_release_speed, elbow_to_wrist_speedup, angular_chain_amplification, elbow_valgus_torque_proxy, stride_to_pelvis_lag_ms, x_factor_to_peak_pelvis_lag_ms, knee_varus_max_drive) + metadata.js OUTPUT_VS_TRANSFER 카테고리 신설 | |
| **v33.7** | Phase 3 UI: 출력 vs 전달 사분면 진단 카드 + 자동 코칭 + KINETIC_FAULTS 부상 항목 2개 (HighElbowValgus, DriveKneeVarus) | |
| **v33.7.1** | hotfix: applyMultiTrialUplift meanFields에 v33.6 신규 7변수 누락 → 사분면 카드 빈 상태 해결 | 긴급 |
| **v33.7.2** | hotfix: calculateScores return에 mechanics raw 객체 누락 → r.mechanics 접근 실패 해결 | 긴급 |
| **v33.7.3** | 사분면 카드 가독성 강화: "이 차트 읽는 법" 박스 + OUTPUT/TRANSFER/INJURY 폴더 카드 (변수별 한글명·해석) + OUTPUT_VS_TRANSFER_VAR_META 신설 (29변수) | 사용자 피드백 |
| **v33.7.4** | (A) INJURY_LITERATURE_THRESHOLDS — 코호트 ranking + 문헌 절대 임계 동시 표시 + (B) SAVED_REPORTS Phase 3 누락 자동 안내 토스트 + 자동 저장 명시 토스트 | 사용자 피드백 |
| **v33.7.5** | 좌·우투 평가 통일 (UNIFIED_ELITE_THRESHOLD = 140 km/h, getPlayerMode·getModeTarget이 armSide 무시). 좌투수 좌표 정규화는 유지 | 사용자 요청 |
| **v33.8** | (A) Python 코호트: master_fitness Height 매핑 (1790 trial 정확) → stride_norm_height 분포 갱신 + (B) BBL 매칭 로직 강화: sessionFolder(Lab_ID) 자동 산출 + 0차 Lab_ID/3차 fuzzy 추가 | 사용자 옵션 C |
| **v33.9** | computeCategoryScore 신설 — OUTPUT/TRANSFER/INJURY 카테고리별 종합 점수 (variables percentile 평균). 사분면 차트 위치 = 카테고리 평균 (단일 변수 outlier 영향 감소) | 사용자 옵션 E |

---

## 3. 자동 메모리 (이번 세션 신규 등록)

`/spaces/.../memory/MEMORY.md`에 신규 추가된 핵심 원칙들:

1. **Phase 2 134 코호트 raw CSV 처리 파이프라인** — 1810 trial → 16+2 변수 분포 산출. Python 포팅 = BBL JS 1:1 매핑, 변경 시 두 곳 동시
2. **Output vs Transfer vs Injury 분리 분석 컨셉** — 사용자 핵심 진단 프레임. 4사분면 진단으로 "낭비형"(②) 케이스 식별 가능

기존 메모리에 정예준 사례 추가됨 (`feedback_master_fitness_handedness_critical.md`):
- 박명균 (2026-05-04) + **정예준 (2026-05-05)** — 둘 다 master 'L' 표기 → 실제 우투. 동일 패턴.

---

## 4. Phase 3 시스템 컴포넌트 안내

### A. metadata.js의 핵심 객체
- `OUTPUT_VS_TRANSFER` — OUTPUT/TRANSFER/INJURY 카테고리 정의 (variables 배열 + integration_var)
- `OUTPUT_VS_TRANSFER_VAR_META` — 29개 변수 한글명·단위·hint
- `INJURY_LITERATURE_THRESHOLDS` — 부상 변수 문헌 절대 임계 (Werner 2008, Davis 2013, Pollard 2017)
- `KINETIC_FAULTS` — Phase 3에서 부상 fault 2개 추가 (HighElbowValgus, DriveKneeVarus)

### B. app.js의 핵심 함수
- `extractScalarsFromUplift` (line 471~) — trial CSV → 16+8 변수 산출 (Phase 2 + Phase 3). sessionFolder 자동 산출 (v33.8)
- `applyMultiTrialUplift` (line 1370~) — 다중 trial 평균 집계. meanFields에 신규 변수 등록 필수
- `calculateScores` (line 3796~) — return에 `mechanics: input.mechanics, fitness: input.fitness` 보존 (v33.7.2 hotfix)
- `getPlayerMode`·`getModeTarget` (line 130~140) — armSide 무시, UNIFIED_ELITE_THRESHOLD 사용 (v33.7.5)
- `computeCategoryScore(r, catKey)` (line 4378~) — OUTPUT/TRANSFER/INJURY variables percentile 평균
- `renderOutputTransferCardInner`·`renderOutputTransferChart`·`renderOutputTransferAccordion`·`getQuadrantCoaching` — 사분면 카드 렌더링
- `showPhase3MissingToast`·`showAutoSavedToast` — SAVED_REPORTS 마이그레이션 안내·자동 저장 토스트

### C. Python 처리 파이프라인 (`outputs/` 폴더)
- `extract_uplift_scalars.py` — 단일 trial 처리 (BBL JS 1:1 포팅)
- `batch_process_cohort.py` — 1810 trial 일괄 처리 (multiprocessing 4-worker, 20초)
- `master_height_mapping.json` — 268 Lab_ID → Height 매핑 (재처리 재현 가능)
- `per_trial.csv` / `per_session.csv` / `distributions.json` — 산출 결과

---

## 5. 미해결 / 향후 검토 항목 (다음 세션 후보)

### 우선순위 높음
- **좌투수 마네킹 미러링** (Phase 1 미해결) — 좌투수의 K(joint center) 좌표가 우완 기준 하드코딩. 좌·우 반전 시각화 필요
- **학술 보고용 요약문 자동 생성** — 134명 그룹비교 분석 결과를 자동 텍스트로 (사용자가 v32.0 단계에서 언급)
- **Throwing arm mismatch 콘솔 경고를 UI 라벨로 노출** — DevTools 안 보면 알 수 없음

### 우선순위 중간
- **IPS Phase 2** — delta_distributions를 134명 페어드 raw 분포로 정확값 재학습
- **5각 Driveline 17개 변수 모두 분포 확보** 완료 (v33.5에서) — percentile 전환 일괄 적용 검토
- **OUTPUT_VS_TRANSFER 가중치 산식** — 현재 단순 평균. 실제 구속·부상 예측력에 따른 가중 평균 검토

### 후보 (사용자 요청 시)
- 사분면 차트에 코호트 분포 background scatter 추가 (선수 위치를 코호트와 비교)
- H1·H2 비교 카드에 사분면 변화 화살표 시각화 (개선 방향성 한눈에)
- 단체 비교 (vs 모드)에 OUTPUT/TRANSFER/INJURY 카테고리 추가

---

## 6. 사용자 작업 환경

- **OS**: Mac
- **GitHub 레포**: `kkl0511/BBL_Pitching_Report1`
- **배포**: GitHub Pages
- **업로드 방식**: GitHub 웹 직접 업로드 (Add file > Upload files)
- **검증**: 사이트 접속 + Cmd+Shift+R 강제 새로고침 + 좌상단 산식 버전 확인
- **데이터 위치 (이번 세션 기준)**:
  - Raw trial CSV: `/Users/kikwanglee/Downloads/uplift_pilot_zip/uplift_pilot_part1~10/{선수}_{날짜}/Trial_*.csv` (1810개)
  - master_fitness: `master_fitness(좌투 수정).xlsx` (사용자가 업로드)
- **마운트 폴더 (다음 세션에서 동일 사용 가능)**:
  - `/Users/kikwanglee/Documents/Claude/Projects/BBL 피칭 리포트(개별선수 입력)/` (코드)
  - `/Users/kikwanglee/Downloads/uplift_pilot_zip/` (raw CSV + drive_134_metrics.csv)
  - `/Users/kikwanglee/Library/Application Support/Claude/.../outputs/` (Python 산출물)

---

## 7. 핵심 파일 위치 (작업 폴더)

`/Users/kikwanglee/Documents/Claude/Projects/BBL 피칭 리포트(개별선수 입력)/`

```
index.html          v33.4 (661라인)
app.js              v33.9 (~7,000라인) — 메인 로직 + Phase 3 사분면 카드·코칭·종합 점수
metadata.js         v33.9 (~870라인) — Phase 3 카테고리·메타·부상 임계
cohort_v29.js       v33.8 (~9,000라인) — Phase 3 25변수 분포 + master Height 매핑 stride_norm_height
player_meta.js      (321라인)
README.md           v33.5~v33.9 패치노트 누적
BBL_점수개정안_134코호트반영_2026-05-04.md
_HANDOFF_새세션_이어서.md  ← 이 파일
```

---

## 8. 다음 세션 첫 작업 권장 순서

1. **컨텍스트 복원** — Claude가 MEMORY.md + 이 파일 읽음
2. **현재 상태 확인** — v33.9 GitHub 배포됐는지 확인
3. **사용자 의도 파악** — 새 작업 또는 위 미해결 항목 중 우선순위 결정
4. **trial CSV / master_fitness 필요 시 위 마운트 폴더에서 즉시 사용 가능**

---

**END OF HANDOFF (v33.9 마감, 2026-05-05)**

이 문서를 새 세션 시작 시 Claude에게 읽으라고 요청하면 모든 컨텍스트가 자동 복원됩니다.
Phase 3 시스템(Output·Transfer·Injury 분리 진단)이 안정 작동 중이며, 다음 단계는 사용자 의사결정에 따라 진행.
