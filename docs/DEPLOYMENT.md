# 배포와 롤백

이 문서는 절차이며 자동으로 클라우드 계정 생성·과금·운영 DB 변경·배포를 수행하지 않습니다.

## Supabase

1. 별도 개발 프로젝트를 만들고 DB 비밀번호와 서비스 키를 비밀 저장소에 보관합니다.
2. `supabase` CLI를 고정 버전으로 실행하고 `--help`로 명령을 확인합니다. 이 저장소는 CLI v2.58.5 설정 형식입니다. v3로 전환하면 [공식 변경사항](https://supabase.com/changelog/supabase-cli-v3)을 먼저 확인하세요.
3. 승인된 개발 프로젝트에만 연결하고 migration을 적용합니다. CLI 예: `npx --yes supabase@2.58.5 link --project-ref YOUR_DEV_REF`, `npx --yes supabase@2.58.5 db push --dry-run`, 검토 후 `db push`.
4. Auth Users에 관리자 계정을 생성하고 이메일 확인/안전한 비밀번호를 설정합니다. public sign-up은 비활성화하고 SMTP/비밀번호 정책/Auth rate limit을 운영 기준으로 설정하세요.
5. SQL/RLS와 사용자 A/B 격리, 서비스 전용 함수의 일반 사용자 호출 차단, 장치 전송을 개발 프로젝트에서 확인합니다. 대시보드 보안 Advisor도 확인하세요.

## Vercel

1. Git 저장소를 연결하고 Root Directory를 `apps/web`, 프레임워크 Next.js로 설정합니다. 저장소 루트 workspace lockfile을 포함하세요. 저장소 최상위에서 Install Command `npx --yes npm@10.9.4 ci`를 실행하도록 구성합니다. Build Command는 web workspace의 `npm run build`입니다. Next.js 15를 유지하면서 취약한 내부 PostCSS를 수정 버전으로 올린 root overrides를 제거하지 마세요.
2. README의 5개 환경변수를 Development/Preview/Production별로 분리해 입력합니다. `APP_ORIGIN`은 최종 HTTPS origin과 정확히 일치해야 합니다. Preview URL이 달라지면 해당 환경값을 수정하세요.
3. Supabase Auth Site URL/허용 URL에 배포 URL을 설정합니다. 실제 사용자 로그인과 비밀번호 변경을 검증합니다.
4. 배포 후 수집 API에 개발 장치 키로 정상/401/422/429를 테스트하고 DB 행, 그래프, 알림을 확인합니다. 비밀키를 curl 명령 이력에 직접 붙이지 말고 안전하게 환경변수로 전달하세요.
5. WAF/플랫폼 rate limit으로 수집 API의 인증 실패 요청 폭주를 제한하세요. DB 장치 rate limit은 유효 키에만 적용되며 IP별 DoS 방어를 대체하지 않습니다.

## 오프라인 스케줄러

1분마다 `GET https://배포도메인/api/cron/offline`을 `Authorization: Bearer CRON_SECRET`으로 호출하세요. Vercel Cron을 사용할 경우 해당 요금제의 최소 실행 주기를 확인하고 지원되지 않으면 외부 스케줄러를 사용하세요. 처음에는 개발 장치 전송 중단 후 임계시간 경과 → 미해결 offline 알림 1건 → 재전송 후 resolved_at 갱신을 검증합니다. 이 저장소는 사용자의 요금제/스케줄러를 임의 등록하지 않습니다.

## 운영

서비스 키/CRON_SECRET 유출 시 즉시 회전하고 재배포합니다. 개별 장치 키는 장치 관리에서 회전/폐기하고 새 로컬 설정을 업로드하세요. 원문 복구는 불가능합니다. 로그에는 HTTP 상태/오류 코드만 기록하세요. 백업/PITR, 데이터 보존, 활성 장치 수, 오래된 last_seen_at, API 401/429/5xx, DB 용량·쿼리 지연을 운영 지표로 관리하세요.

## 롤백

- 웹: Vercel에서 직전 정상 배포를 Promote/Rollback하고 환경변수도 당시 호환값인지 확인합니다. 단순 소스 롤백은 DB를 되돌리지 않습니다.
- DB: 적용 전 백업/PITR 복구 지점을 확보합니다. 기존 스키마를 삭제하지 말고 forward-fix migration을 우선합니다. 초기 migration을 되돌리면 전체 농장 이력을 잃을 수 있으므로 운영에서 DROP 스크립트를 자동 제공/실행하지 않습니다. 복구가 필요하면 별도 새 Supabase 프로젝트에 백업을 복원해 A/B 데이터와 RLS를 검증한 후 URL/키를 전환합니다.
- 로컬: `.local`의 계정·키는 폐기 가능한 개발 데이터입니다. 필요한 로컬 이력을 백업한 후에만 `supabase db reset --local`을 실행하세요.
- SW: 캐시 버전 상수를 올리면 앱 셸 캐시가 갱신됩니다. 개인 API/HTML은 캐시하지 않으므로 DB나 키 롤백과 분리됩니다.
