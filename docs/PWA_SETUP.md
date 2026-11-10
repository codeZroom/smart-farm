# PWA 설치와 검증

manifest는 Next.js `src/app/manifest.ts`가 `/manifest.webmanifest`로 제공합니다. PNG 192/512 및 maskable 아이콘, standalone 모드, 앱 이름/언어/테마를 포함합니다. `node scripts/generate-icons.mjs`로 아이콘을 재생성할 수 있습니다.

SW `/sw.js`는 모든 화면에서 등록됩니다. 캐시는 버전별로 교체하며 `/offline.html`과 아이콘만 저장합니다. 로그인/관리/API 데이터를 캐시하지 않으므로 로그아웃 후 다른 사용자에게 데이터를 보여 주지 않습니다. 네트워크가 끊긴 열린 탭에는 마지막 조회 데이터와 오프라인 배너를 표시하며, 재접속 시 갱신합니다. 재실행 시 데이터는 보존하지 않고 오프라인 안내를 표시합니다.

## Android Chrome

1. 실제 HTTPS 배포 URL을 열고 로그인합니다. LAN의 HTTP 주소는 설치 검증에 적합하지 않습니다. localhost는 개발 예외입니다.
2. 사용자 설정 → 앱 설치 또는 Chrome 메뉴 → 홈 화면에 추가/앱 설치를 선택합니다.
3. 홈 아이콘으로 실행하고 주소창 없이 standalone으로 표시되는지 확인합니다.
4. 대시보드의 장치/측정값/마지막 측정 시각을 확인합니다.
5. 비행기 모드에서 열린 화면의 오프라인 배너를 확인하고 재실행하여 안내 화면을 확인합니다.
6. 연결 복구 후 다시 연결하기로 새 측정값을 확인합니다.

## iOS Safari

1. Safari에서 HTTPS URL을 열고 로그인합니다.
2. 공유 → 홈 화면에 추가 → 추가를 선택합니다. beforeinstallprompt 버튼은 iOS에서 나타나지 않을 수 있습니다.
3. 홈 아이콘에서 앱 이름/아이콘/standalone/로그인 세션을 확인합니다.
4. 가로·세로 회전, 작은 화면, 확대 글꼴, 키보드 열기/닫기, 비행기 모드와 복구를 확인합니다.

## 데스크톱 자동 점검

브라우저 DevTools Application에서 manifest 오류가 없고 SW가 activated인지 확인합니다. 아이콘 응답이 PNG인지 확인합니다. 자동 테스트는 320/390/768/1440px overflow, 로그인과 폼, SW 등록과 오프라인 안내를 점검합니다. Chromium 테스트는 실제 iOS/Android 설치 동작의 대체가 아닙니다.
