# BBL Pitching Report — 신규 선수 리포트

국민대학교 BBL Lab. (Baseball Biomechanics Lab.) 야구 바이오메카닉스 평가 도구.
신규 투수의 체력·메카닉·구속·제구 측정값을 입력하면 v29 코호트(고교 134명) 기준으로
점수·예상 구속·잠재 구속·코칭 해설을 자동 산출하는 단일 HTML 웹앱입니다.

## 사용법

브라우저에서 [https://kkl0511.github.io/BBL_Pitching_Report1/](https://kkl0511.github.io/BBL_Pitching_Report1/)
에 접속한 뒤,

1. **Step 1 — 연령군 선택**: 중학·고교·대학·프로 중 하나 (이름·날짜·구속은 CSV가 자동 채움)
2. **Step 2 — 체력 + 구속 CSV 업로드**: Hawkin/포스플레이트 와이드 CSV를 드래그앤드롭
3. **Step 3 — 메카닉 CSV 업로드**: Uplift Capture raw CSV (`Trial_XXXX.csv`) — **여러 개 동시 업로드 지원** (10개 trial 평균·SD 자동 계산)
4. **(선택) 코칭 세션 동영상 업로드**: 240fps · 0.1배속 디폴트로 프레임 단위 분석
5. **리포트 생성** → 종합 점수, 예상/잠재 구속, 강점·약점, 코칭 해설 자동 출력
6. 결과는 자동 저장되어 좌측 상단 **저장된 선수** 드롭다운에서 다시 불러오기 가능

## 4가지 뷰

상단 탭으로 전환:

| 뷰 | 설명 |
|---|---|
| **개별 선수** | 새 선수 입력 + 종합 리포트 |
| **1차 ↔ 2차 비교** | 같은 선수 두 시점 점수·구속 변화 (Δ 표시) |
| **선수간 비교** | 최대 4명 동시 비교 (레이더 overlay + 카테고리표 + 총평) |
| **저장 관리** | 저장된 선수 목록 / 삭제 |

## 오프라인 패키지 다운로드

세 가지 뷰에서 각각 **📦 오프라인 패키지 다운로드** 버튼 제공:
- **개별 리포트**: Chart.js · 동영상까지 base64 인라인 → 인터넷 없이 그대로 재생 가능 (240Hz · 0.1× 디폴트)
- **1차↔2차 비교**: 두 시점 비교 + 레이더 차트 + 총평
- **선수간 비교**: 2~4명 비교 + 레이더 overlay + 카테고리별 비교표

선수·지도자에게 단일 HTML 파일로 전달하면 PC·태블릿 어디서나 동일한 결과를 볼 수 있습니다.

## 지원 CSV 형식

### Step 2 (체력 + 구속)
- **Hawkin/포스플레이트 와이드 포맷** — 한 행 = 한 선수, 컬럼이 변수 (예: `CMJ Peak Power [W]`, `IMTP Peak Vertical Force [N]`, `Grip Strength`, `Max Velocity`, `Name`, `Date`)
- **BBL 템플릿 (롱 포맷)** — `field_key, value` 형식
- 코호트에 매칭되는 컬럼만 자동 적용 (Shoulder IR, 30m Sprint 등 미사용 컬럼은 무시)
- `Name` / `Date` / `Max Velocity` 컬럼은 Step 1 필드를 자동으로 채움

### Step 3 (메카닉)
- **Uplift Capture raw CSV** (`Trial_XXXX.csv`) — 시계열 1500+ 프레임 그대로 업로드, 여러 trial 동시 가능
- **모든 변수가 raw 시계열에서 직접 산출됩니다** (2026-05-03 — Uplift 사전계산 메트릭 의존 제거)
  - 골반/몸통 회전속도 max, X-factor, 스트라이드 길이, 릴리스 높이, 팔 슬롯 등
  - handedness(좌투/우투) 자동 인식 → lead leg/arm 변수 정확히 추출
  - 다중 trial 시: 평균 + SD (제구 변수의 일관성 측정에 사용)
- **이벤트 자동 검출** (KH/FC/MER/BR): Uplift 컬럼 우선, raw 시계열 fallback
- **QC 필터**: Uplift vs raw 검출 차이가 30ms 초과인 trial 자동 제외
- **BBL 메카닉 템플릿 (롱 포맷)** — `field_key, value`
- **와이드 포맷** — 컬럼명에 BBL 변수 키

## 평가 체계

### 3 영역 × 6 카테고리 = 18 카테고리

| 영역 | 카테고리 |
|---|---|
| 체력 (F1–F6) | 근력 / 절대파워 / 반응성 / 체격 / 체중당파워 / 복합폭발력 |
| 메카닉 (C1–C6) | FC자세 / 하체드라이브 / 몸통출력 / 앞다리블록 / 시퀀싱 / 코킹 |
| 제구 (P1–P6) | 릴리스점 / 팔슬롯 / 릴리스높이 / 타이밍 / Stride / 몸통기울기 |

### 메카닉 모드 토글

리포트 화면에서 **BBL 6각형 ↔ Driveline 5각형** 전환 가능:
- BBL 6각: C1~C6 표준 평가
- Driveline 5각: Posture / Block / Rotation / ArmAction / CoG (PPTX 가중치 기반 weighted scoring)

## 잠재 구속 산출

세 가지 시나리오 자동 계산:
- **F100**: 체력 100점 가정 → 메카닉 그대로
- **M100**: 메카닉 100점 가정 → 체력 그대로
- **FM100**: 체력·메카닉 모두 100점 (이론적 최대)

학습 곡선 페널티 (`pow(score/100, 2)`) + 연령군 상한선 적용으로 비현실적 과대 추정 방지.

## 코호트 기준

- 고교 1년 투수 134명 × H1(Spring 2025) + H2(Fall 2025) = 268 측정
- 다중 회귀 (Driveline 방법론 참조), 75/25 split, MAE + R² 검증
- 종합 회귀:
  - 체력 → 구속: PV = 0.1703 × F + 117.81 (R² = 0.166)
  - 메카닉 → 구속: MV = 0.2882 × M + 111.47 (R² = 0.235)

## 연령군 스케일링

| 연령군 | 구속 보정 | 점수 보정 | 비고 |
|---|---|---|---|
| 중학 | −5 km/h | −10 | 고교 상위 50% 기준 |
| 고교 | 0 | 0 | BBL 기준 |
| 대학 | +5 km/h | +10 | 고교 상위 10% 대비 |
| 프로 | +10 km/h | +20 | 대학 +5/+10 |

## 데이터 품질 관리 (2026-05-03 추가)

### 변수별 사용 Trial 수 (n) 표시
- 각 변수별로 실제 사용된 trial 수가 점수표에 자동 노출 (예: `n=8/10`)
- SD 변수는 n<5, 평균 변수는 n<3이면 빨간색 "n부족" 경고

### 비상식 값 결측 처리 + 50점 폴백
- 28개 변수에 plausibility 범위 정의 (예: `mer_to_br_sd_ms` ≤ 50ms, `trunk_tilt_sd_deg` ≤ 15°)
- 범위 밖 값은 자동으로 50점(중립) + "결측 보정" 노란 배지 표시

### 이벤트 일치도 패널
- KH/FC/MER/BR 자체 검출 vs Uplift 검출 차이를 ms 단위로 즉시 표시
- 색상: 녹색 ≤15ms · 노랑 15–30ms · 빨강 >30ms

### QC 필터 (자동 trial 제외)
- 임계값 30ms 초과 차이 trial은 자동 제외하고 사용자에게 사유 표시
- 임계값 조정은 코드 상단 `QC_THRESHOLD_MS` 상수

## 코칭 세션 (선택)

동영상 업로드 시 자동 활성화:
- **240fps · 0.1배속 디폴트** 동영상 플레이어 (프레임 단위 좌우 이동)
- **키네매틱 시퀀스 차트**: 골반→몸통→어깨→팔꿈치 피크 속도 시간차 시각화 (Gaussian)
- **3D 마네킹 다이어그램**: 핵심 변수(레이백, 무릎 무너짐, X-factor 등) 라벨
- **자동 코칭 해설 카드**

## 기술 스택

- **HTML 메인 파일** (`index.html`): 268KB — UI shell + 모든 산출/점수화/렌더링 로직
- **코호트 데이터** (`cohort_v29.js`): 188KB — 134명 코호트 통계·회귀·정렬 lookup (외부 분리 2026-05-03)
- Tailwind CSS (CDN) + Chart.js — 서버·빌드 과정 없이 브라우저에서 바로 동작
- 드래그 앤 드롭 업로드, CSV 자동 포맷 감지(Uplift / 롱 / 와이드), 다중 trial 처리
- 저장된 선수는 브라우저 localStorage에 보관되어 알고리즘 변경 시 자동 재계산

## 변경 이력

### 2026-05-03 v30 — Raw 시계열 기반 산출 + QC
- **모든 메카닉/제구 변수를 raw 시계열에서 직접 산출** (Uplift 사전계산값 의존 제거)
  - peak_pelvis/trunk_av: max\|시계열\| in [KH, BR+30]
  - max_x_factor: signed max(pelvis_rot − trunk_rot) in [KH, FC+5] (FC 후 부호 뒤집힘 방지)
  - max_cog_velo: trunk_COM 3D 합성 속도 미분
  - arm_slot, release_height, stride: 좌표계 검증(y=up, z=forward) 후 직산
- **이벤트 자동 검출** (KH/FC/MER/BR): raw 시계열 + 윈도우 제약. Uplift 우선, raw fallback
- **QC 필터**: Uplift vs raw 차이 >30ms trial 자동 제외
- **이벤트 일치도 패널**: 두 검출 방법 차이 즉시 노출
- **시퀀싱 판단**: peak frame 시간 순서 직접 비교 (kinematic_sequence_order 문자열 의존 제거)
- **Trial-N 투명화**: 변수별 사용 trial 수 + 부족 경고 배지
- **비상식 값 결측 처리**: 28개 변수에 plausibility 범위 + 50점 폴백
- **무릎 신전량 점수식 수정**: min −15° → 0° (0°=중립, 음수만 페널티)
- **트렁크 SD 산식 변경**: forward 단일 평면 (기존 lateral+forward 합성 폐지)
- **시퀀싱 UI 라벨 분리**: P4 "적정 시퀀스 trial 비율" vs C5 "Pelvis→Trunk→Arm 시퀀스 충족"
- **코호트 데이터 외부화**: `cohort_v29.js` 별도 파일로 분리 (HTML 32% 감량)

### 2026-05-02 v29.6 — 잠재구속 monotonic 보장
- 학습 곡선 quadratic (`pow(s/100, 2)`)
- 절대 회귀 항 제거 (개인화 anchor만)
- 현실 cap을 quality 기반으로

## 데이터 보호

- 본 저장소에는 **익명화된 통계 분포만** 포함됩니다 (개별 선수 식별 정보 없음).
- 코호트 원본 데이터(P001~P133 ↔ 실명 매핑)는 비공개입니다.
- 사용자가 입력한 신규 선수 데이터는 브라우저 메모리·localStorage 안에서만 처리되며 외부로 전송되지 않습니다.
- `<meta name="robots" content="noindex, nofollow">`로 검색 엔진 색인을 차단합니다.

## 파일 구조

```
BBL_Pitching_Report1/
├── index.html        ← 메인 웹앱 (268KB)
├── cohort_v29.js     ← 코호트 통계 데이터 (188KB)
└── README.md         ← 이 문서
```

**중요**: `index.html`과 `cohort_v29.js`는 **반드시 같은 디렉토리**에 두어야 합니다.
GitHub Pages는 자동으로 함께 서빙합니다.

## 라이선스

연구·교육 목적 사용 한정. 상업적 재배포 금지.
문의: kklee@kookmin.ac.kr (국민대학교 스포츠과학과)
