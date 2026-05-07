// main.js — Electron 메인 프로세스
//   바이오모션_투수리포트_offline.html 을 BrowserWindow에 로드해서 데스크탑 앱처럼 실행
const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 900,
    minHeight: 700,
    title: '바이오모션 투수 리포트',
    backgroundColor: '#0f1115',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      // 영상 file:// 접근 + Blob URL을 위해 sandbox 끄기
      sandbox: false,
    },
    icon: path.join(__dirname, 'icon.png'),
    show: false,
  });

  // 단일 자급자족 HTML 파일 로드
  const htmlPath = path.join(__dirname, '바이오모션_투수리포트_offline.html');
  mainWindow.loadFile(htmlPath);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // 외부 링크는 시스템 브라우저로 열기
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // 빈 메뉴(macOS는 기본 시스템 메뉴 유지) — 단순한 데스크탑 앱
  if (process.platform !== 'darwin') {
    Menu.setApplicationMenu(null);
  } else {
    // macOS: 최소 한글 메뉴 + 단축키 작동
    const template = [
      { label: app.name, submenu: [
        { role: 'about',    label: app.name + ' 정보' },
        { type: 'separator' },
        { role: 'hide',     label: app.name + ' 숨기기' },
        { role: 'hideOthers', label: '기타 숨기기' },
        { role: 'unhide',   label: '모두 표시' },
        { type: 'separator' },
        { role: 'quit',     label: app.name + ' 종료' },
      ]},
      { label: '편집',  submenu: [
        { role: 'undo',  label: '실행 취소' },
        { role: 'redo',  label: '다시 실행' },
        { type: 'separator' },
        { role: 'cut',   label: '잘라내기' },
        { role: 'copy',  label: '복사' },
        { role: 'paste', label: '붙여넣기' },
        { role: 'selectAll', label: '모두 선택' },
      ]},
      { label: '보기',  submenu: [
        { role: 'reload',     label: '새로고침' },
        { role: 'forceReload', label: '강제 새로고침' },
        { role: 'toggleDevTools', label: '개발자 도구' },
        { type: 'separator' },
        { role: 'resetZoom',   label: '실제 크기' },
        { role: 'zoomIn',      label: '확대' },
        { role: 'zoomOut',     label: '축소' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '전체화면' },
      ]},
      { label: '윈도우', submenu: [
        { role: 'minimize',  label: '최소화' },
        { role: 'zoom',      label: '확대/축소' },
        { role: 'close',     label: '닫기' },
      ]},
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  }
}

app.whenReady().then(createWindow);

// macOS: 모든 윈도우 닫혀도 앱 유지 (Dock 클릭 시 재오픈)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
