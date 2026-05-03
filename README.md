# BBL v30.28 — Task #74 키네틱 체인 5단계 GIF 시각화 통합
**Build**: 2026-05-03 / **Patch**: v30.27 → v30.28 / **Type**: visualization

---

## 변경 요약

### 🎬 NEW — 키네틱 체인 5단계 시각화

**위치**: 결함 진단 카드 바로 위 (선수가 결함을 보기 전 키네틱 체인 흐름을 먼저 이해)

**자료**: 사용자 제공 `MLB_Velocity_Kinetic_Chain_COMPRESSED_v5.gif`
- 1200×676, 8.5MB, 206 프레임 (~14.4초 루프)
- P1 Set/Lift → P2 Load → P3 Drive → P4 FC(Front Foot Contact) → P5 Release/Follow Through

**구현**:
```html
<div class="card p-4 mb-6">
  <div class="display text-base">⚡ 키네틱 체인 5단계 — 에너지 흐름</div>
  <img src="kinetic_chain.gif" loading="lazy" decoding="async" ... />
  <div class="text-xs">다리 → 골반 → 몸통 → 팔로 이어지는 운동량 전달이 핵심...</div>
</div>
```

- `loading="lazy"` 첫 화면 로드 영향 최소화
- `decoding="async"` 메인 스레드 블로킹 방지
- 파일명을 `kinetic_chain.gif`로 단순화

### 🎯 통합 흐름 (선수가 보는 순서)

```
구속 종합 점수
  ↓
모드 코칭
  ↓
⚡ 키네틱 체인 GIF (NEW) ← 시각적 컨텍스트 제공
  ↓
🔬 결함 진단 카드 ← "내가 이 체인 어디가 약한지" 즉시 이해
  ↓
카테고리별 점수 + 코칭
```

---

## 변경 사항 (코드)

- `BBL_신규선수_리포트.html`
  - `ALGORITHM_VERSION`: 'v30.27' → 'v30.28'
  - line ~4712 직전: `kineticChainGifHtml` 신규 변수 정의
  - line ~5161: `${kineticChainGifHtml}` 렌더 위치 추가
- `kinetic_chain.gif` 신규 파일 (8.5MB)

---

## 배포 절차 ⚠ GIF 파일 동시 업로드 필요

```bash
# GitHub Pages에 다음 3개 파일 모두 업로드:
1. index.html
2. cohort_v29.js  (변경 없음 — 기존 유지 가능)
3. kinetic_chain.gif  (★ 신규 — 반드시 업로드 안하면 깨진 이미지)
```

---

## 향후 작업 (사용자 의향)

사용자 메시지: *"마네킹을 그리더라도 이 시각화 자료를 이용해 그리면 될 것 같아"*

→ Task #74의 SVG 마네킹 시각화는 향후 옵션으로 두고, 우선 이 GIF로 운영. SVG 변환이 필요한 시점에 이 GIF를 reference로 활용 가능.

---

## v30.25 → v30.28 누적 변경

| 버전 | 유형 | 변경 |
|---|---|---|
| v30.26 | bug fix | FlyingOpen 좌완 좌표계 분기 |
| v30.26 | label | InsufficientCounterRot 영문 보조 추가 |
| v30.27 | threshold | OpenFrontSide 임계 30° → 40° |
| v30.28 | viz | 키네틱 체인 5단계 GIF 통합 (Task #74) |

---

**END OF v30.28 PATCH NOTES**
