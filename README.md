# 온실 · Smart Farm Monitoring

ESP32 + SHT31의 온습도를 수집하는 Next.js 15 PWA입니다. 모니터링만 수행하며 환기·가습·관수 전기 장치를 제어하지 않습니다.

## 구성

- `apps/web`: Next.js App Router, React 19, TypeScript, Tailwind, shadcn 방식 Button, TanStack Query, RHF/Zod, Recharts, Lucide, Pretendard
- `supabase/migrations`: PostgreSQL 스키마, 인덱스, 사용자 RLS, 원자적 장치 등록/키 회전/측정 수집/알림/집계 함수
- `scripts/simulator.ts`: 실제 장치와 같은 HTTPS API 계약을 쓰는 개발 전용 시뮬레이터
- `firmware/esp32-sht31`: Arduino 펌웨어, 로컬 설정 예시, PlatformIO 설정
- `tests`: 계약 검증과 PGlite PostgreSQL 실행 테스트

Zustand는 전역 클라이언트 상태가 필요하지 않아 추가하지 않았습니다. 측정 데이터는 Query 캐시에만 보관하며 localStorage에 저장하지 않습니다.

## 빠른 실행 (PowerShell)

Node.js 22.12 이상, npm 10.9.4, Docker Desktop을 준비합니다. Windows에서는 Docker Linux 엔진을 시작하세요. 의존성 override를 일관되게 적용하기 위해 아래처럼 고정 npm으로 설치합니다.

```powershell
npx --yes npm@10.9.4 ci
docker info
npx --yes supabase@2.58.5 start
# 새 로컬 DB에는 migrations가 자동 적용됩니다.
# 기존 로컬 DB만 새로 만들려면: npx --yes supabase@2.58.5 db reset --local
# reset은 해당 프로젝트 로컬 데이터를 삭제하므로 필요한 데이터는 먼저 백업하세요.
Copy-Item apps/web/.env.example apps/web/.env.local
npx --yes supabase@2.58.5 status
```

`status`의 로컬 API URL, anon key, service_role key를 `.env.local`의 대응 변수에 넣으세요. 공개 키 변수는 로컬 legacy anon key도 지원합니다. `APP_ORIGIN=http://localhost:3000`으로 설정하고 무작위 `CRON_SECRET`도 추가하세요. 실제 키는 커밋하지 않습니다.

```powershell
npm run dev
```

http://localhost:3000 에 접속합니다. 로컬 Studio의 Auth Users에서 이메일/비밀번호 사용자를 만들고 이메일 확인을 완료하세요. 로컬 개발용 계정 생성은 아래 통합 테스트 준비 스크립트로도 할 수 있습니다.

```powershell
npm run local:prepare
```

이 명령은 **로컬 127.0.0.1 Supabase만** 사용하며 `.local/test-account.json`에 생성된 개발 계정을 기록합니다. 운영/외부 Supabase에는 실행하지 않습니다. `.local`은 Git에서 제외됩니다.

로그인 → 농장 생성 → 구역 생성 → 장치 등록 → 한 번 표시되는 키 보관 → 시뮬레이터 전송 → 대시보드 순으로 확인하세요.

## 가상 센서

```powershell
$env:SIMULATOR_ENV='development'
$env:SIMULATOR_URL='http://localhost:3000'
$env:SIMULATOR_DEVICE_ID='등록한 UUID'
$env:SIMULATOR_DEVICE_KEY='한 번 발급된 키'
npm run simulate -- normal
# hot / cold / humid / dry / offline / auth-fail / sensor-error
# 한 번만 전송: npm run simulate -- hot --once
```

기본 30초 간격입니다. 같은 장치의 인증된 요청은 DB 잠금과 10초 간격 제한을 적용합니다. 여러 시뮬레이터를 한 장치로 동시에 실행하지 마세요. `offline`은 전송 없이 종료하므로 다른 송신 프로세스도 중지하세요. 원격 개발 서버는 `SIMULATOR_ALLOW_REMOTE=development-only`를 추가해야 하며 운영 환경 사용은 금지합니다.

## 검사 명령

```powershell
npm run typecheck
npm run lint
npm test
npm run build
# 로컬 Supabase + 웹 서버가 실행 중일 때:
npm run test:e2e
```

`npm test`는 외부 계정 없이 PGlite에서 실제 SQL과 RLS를 실행합니다. 이것만으로 Supabase Auth/REST/브라우저가 검증되지는 않습니다. `test:e2e`는 자동으로 로컬 개발 계정과 `.env.local`을 준비한 뒤 브라우저 → API → DB → 대시보드, API 거부 응답, 모바일 폭과 SW를 검증합니다. 기본 브라우저는 Windows Edge입니다. 다른 환경에서는 `npx playwright install chromium` 후 `E2E_BROWSER_CHANNEL=chromium`을 설정하세요. 실행 기록과 남은 항목은 [검증 보고서](docs/VERIFICATION.md)에 정리합니다.

프로덕션 서버 검증은 먼저 `npm run build` 후 `$env:E2E_PRODUCTION='1'; npm run test:e2e`로 실행합니다. 테스트는 3000 포트에서 서버를 시작/종료하므로 별도 개발 서버는 중지하세요. 테스트 네트워크에는 인증 정보가 포함되므로 trace 기록은 비활성화했습니다.

## 환경변수

| 변수                                 | 용도                                          | 공개 여부      |
| ------------------------------------ | --------------------------------------------- | -------------- |
| NEXT_PUBLIC_SUPABASE_URL             | Supabase API URL                              | 공개           |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Publishable 또는 로컬 anon key                | 공개, RLS 필수 |
| SUPABASE_SERVICE_ROLE_KEY            | 장치 수집/키 회전 서버 전용                   | 비밀           |
| APP_ORIGIN                           | 브라우저 요청의 정확한 origin (후행 `/` 제외) | 서버 설정      |
| CRON_SECRET                          | 오프라인 검사 HTTP 인증                       | 비밀           |

## 문서

[아키텍처](docs/ARCHITECTURE.md) · [데이터베이스](docs/DATABASE.md) · [API](docs/API.md) · [ESP32 초보자 가이드](docs/ESP32_SETUP.md) · [PWA 설치](docs/PWA_SETUP.md) · [배포 및 롤백](docs/DEPLOYMENT.md) · [장애 대응](docs/TROUBLESHOOTING.md)

실제 Vercel/Supabase 배포, 휴대폰 홈 화면 설치, 하드웨어 측정은 계정·기기 설정 이후 별도 검증 대상입니다.
