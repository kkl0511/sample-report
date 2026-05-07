# 바이오모션 투수 리포트 — Electron 데스크탑 앱

브라우저가 아닌 독립 데스크탑 앱(.dmg / .exe)으로 실행할 수 있는 패키지.
오프라인 단일 HTML(`바이오모션_투수리포트_offline.html`)을 BrowserWindow에 로드.

---

## 사전 준비

Node.js 18+ 설치되어 있어야 함. 확인:

```bash
node --version  # v18 이상
npm --version
```

설치되어 있지 않으면 https://nodejs.org/ 에서 LTS 다운로드.

---

## 사용 방법

### 1. 의존성 설치 (첫 1회만)

```bash
cd electron
npm install
```

→ Electron + electron-builder 다운로드 (~250 MB, 5~10분 소요).

### 2. 개발 모드 실행 (앱 미리보기)

```bash
npm start
```

→ Electron 윈도우가 열리고 앱이 실행됨. 코드 수정 → 재시작.

### 3. 배포용 빌드 (패키징)

**현재 OS용 빌드:**

```bash
npm run dist
```

**macOS .dmg 빌드 (Mac에서 실행):**

```bash
npm run dist:mac
```

→ `dist/바이오모션 투수 리포트-1.0.0-arm64.dmg` (Apple Silicon)
→ `dist/바이오모션 투수 리포트-1.0.0.dmg` (Intel)
→ 약 10~15분 소요, 결과 파일 약 100~120 MB

**Windows .exe 빌드 (Windows에서 또는 Wine 설치된 Mac에서):**

```bash
npm run dist:win
```

→ `dist/바이오모션 투수 리포트 Setup 1.0.0.exe`

---

## 코드 업데이트 시

상위 폴더 코드를 수정한 뒤:

```bash
# 상위 폴더에서 오프라인 HTML 재빌드
cd ..
node build_offline.js

# Electron 폴더로 결과물 복사
cp 바이오모션_투수리포트_offline.html electron/

# 앱 재빌드
cd electron
npm run dist:mac
```

---

## 파일 구성

```
electron/
├── main.js                  # Electron 메인 프로세스
├── package.json             # Electron + electron-builder 설정
├── 바이오모션_투수리포트_offline.html   # 단일 자급자족 HTML
├── icon.png                 # 앱 아이콘 (1024x1024)
├── biomotion_logo.svg       # 원본 SVG (참고용)
├── .gitignore               # node_modules, dist 제외
└── README.md                # 이 문서
```

---

## macOS code signing 안내

기본 설정(`identity: null`)은 code signing을 건너뛰는 ad-hoc signing 모드입니다.
- 본인 Mac에서는 정상 실행
- 다른 Mac으로 배포 시 첫 실행에 "확인되지 않은 개발자" 경고 → 우클릭 → 열기로 우회

정식 배포가 필요하면 Apple Developer Program 가입 후 `package.json`의 `mac.identity`를 본인 인증서 ID로 변경:

```json
"mac": {
  "identity": "Developer ID Application: 본인 이름 (TEAMID)"
}
```

---

## 트러블슈팅

| 증상 | 해결 |
|---|---|
| `npm install` 실패 | Node 18+ 확인, `npm cache clean --force` 후 재시도 |
| 빌드 결과물이 너무 큼 (200+ MB) | 정상. Electron 자체가 ~150 MB |
| 영상이 재생 안 됨 | webPreferences.sandbox=false 확인 (이미 main.js에 설정) |
| 한글 폰트 깨짐 | 시스템 폰트 사용 — 한글 OS면 자동, 영문 OS는 한글 폰트 설치 필요 |
