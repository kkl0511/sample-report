# BBL Pitching Report — 신규 선수 리포트 (Phase 1)

국민대학교 BBL Lab. (Baseball Biomechanics Lab.) 야구 바이오메카닉스 평가 도구.
신규 투수의 체력·메카닉·구속·제구 측정값을 입력하면 v29 코호트(고교 134명) 기준으로
점수·예상 구속·잠재 구속·코칭 해설을 자동 산출하는 단일 HTML 웹앱입니다.

## 사용법 (CSV 드래그 앤 드롭)

브라우저에서 [https://kkl0511.github.io/BBL_Pitching_Report1/](https://kkl0511.github.io/BBL_Pitching_Report1/)
에 접속한 뒤,

1. **Step 1 — 연령군 선택**: 중학·고교·대학·프로 중 하나 (이름·날짜·구속은 CSV가 자동 채움)
2. **Step 2 — 체력 + 구속 CSV 업로드**: Hawkin/포스플레이트 와이드 CSV를 드래그앤드롭
3. **Step 3 — 메카닉 CSV 업로드**: Uplift Capture raw CSV (`Trial_XXXX.csv`)를 드래그앤드롭
4. **리포트 생성** 버튼 클릭 → 종합 점수, 예상 구속, 강점·약점, 코칭 해설 자동 출력
5. 결과는 HTML 다운로드 또는 브라우저 인쇄(PDF 저장) 가능

## 지원 CSV 형식

### Step 2 (체력 + 구속)
- **Hawkin/포스플레이트 와이드 포맷** — 한 행 = 한 선수, 컬럼이 변수 (예: `CMJ Peak Power [W]`, `IMTP Peak Vertical Force [N]`, `Grip Strength`, `Max Velocity`, `Name`, `Date`)
- **BBL 템플릿 (롱 포맷)** — `field_key, value` 형식
- 코호트에 매칭되는 컬럼만 자동 적용 (Shoulder IR, 30m Sprint 등 미사용 컬럼은 무시)
- `Name` / `Date` / `Max Velocity` 컬럼은 Step 1 필드를 자동으로 채움

### Step 3 (메카닉)
- **Uplift Capture raw CSV** (`Trial_XXXX.csv`) — 시계열 1500+ 프레임 그대로 업로드
  - 자동으로 이벤트 프레임(KH·FC·MER·MIR·BR) 검출
  - 요약 메트릭(`peak_pelvis_angular_velocity`, `max_layback_angle`, `max_x_factor` 등) 직접 매핑
  - FC 시점에서 시계열 추출 (`trunk_global_rotation`, `pelvis_global_rotation` 등)
  - handedness(좌투/우투) 자동 인식 → lead leg 변수 정확히 추출
- **BBL 메카닉 템플릿 (롱 포맷)** — `field_key, value`
- **와이드 포맷** — 컬럼명에 BBL 변수 키

## 평가 체계

3 영역 × 6 카테고리 = 18 카테고리

| 영역 | 카테고리 |
|---|---|
| 체력 (F1–F6) | 근력 / 절대파워 / 반응성 / 체격 / 체중당파워 / 복합폭발력 |
| 메카닉 (C1–C6) | FC자세 / 하체드라이브 / 몸통출력 / 앞다리블록 / 시퀀싱 / 코킹 |
| 제구 (P1–P6) | 릴리스점 / 팔슬롯 / 릴리스높이 / 타이밍 / Stride / 몸통기울기 |

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

## 기술 스택

단일 HTML 파일 — Tailwind CSS (CDN) + 순수 JavaScript.
v29 134명 코호트 통계·회귀·보정값을 JSON으로 임베드 (`cohort_v29_export.json` 기반).
서버·빌드 과정 없이 브라우저에서 바로 동작.
드래그 앤 드롭 업로드, CSV 자동 포맷 감지(Uplift / 롱 / 와이드).

## 데이터 보호

- 본 저장소에는 **익명화된 통계 분포만** 포함됩니다 (개별 선수 식별 정보 없음).
- 코호트 원본 데이터(P001~P133 ↔ 실명 매핑)는 비공개입니다.
- 사용자가 입력한 신규 선수 데이터는 브라우저 메모리 안에서만 처리되며 외부로 전송되지 않습니다.
- `<meta name="robots" content="noindex, nofollow">`로 검색 엔진 색인을 차단합니다.

## 라이선스

연구·교육 목적 사용 한정. 상업적 재배포 금지.
문의: kklee@kookmin.ac.kr (국민대학교 스포츠과학과)
