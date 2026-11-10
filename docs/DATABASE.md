# 데이터베이스

마이그레이션: `supabase/migrations/20261110105451_initial_smartfarm.sql` (트랜잭션).

| 테이블             | 관계 / 제약                                              |
| ------------------ | -------------------------------------------------------- |
| farms              | owner_id → auth.users, 이름 1–80자                       |
| farm_zones         | farm_id → farms                                          |
| devices            | farm_zone_id → farm_zones, ESP32_SHT31 유형, 활성 상태   |
| device_credentials | 장치별 살아 있는 키 1개, 64자리 SHA-256 hex, 원문 미저장 |
| sensor_readings    | bigint identity, 온도 -40~125, 습도 0~100, 서버 수신 UTC |
| device_thresholds  | 장치별 1개, 최소<최대, 오프라인 60~86400초               |
| alerts             | 6개 유형, warning/danger, 해결/확인 별도 시각            |

모든 테이블 RLS 활성화. 사용자 소유권 경로는 devices → zones → farms.owner_id입니다. credentials에는 사용자 정책/권한이 없고 서비스 전용입니다. 센서 이력은 사용자 SELECT만 허용합니다. farms/zones/thresholds는 소유 범위 내 생성·수정, devices는 등록 RPC와 제한된 열 UPDATE, alerts는 확인 시각만 UPDATE할 수 있습니다. DELETE는 앱에서 제공하지 않습니다.

주요 인덱스: 모든 관계 FK와 owner_id, readings `(device_id, recorded_at DESC)`, 활성 장치 last_seen_at, alerts `(device_id, created_at DESC)`, 미해결 알림 `(device_id, alert_type)` 부분 UNIQUE, 살아 있는 키 device_id 부분 UNIQUE.

`register_device`만 SECURITY DEFINER이며 고정 search_path와 명시적 auth.uid/소유권 검사를 수행합니다. 나머지 함수는 INVOKER입니다. 수집·키 회전·오프라인·알림 내부 함수 EXECUTE는 service_role에만 부여합니다. PUBLIC 기본 실행 권한을 회수합니다.

운영 반영은 배포 가이드를 따릅니다. migration은 로컬 새 DB에 먼저 적용하고 `npm test`와 `npm run test:e2e`를 실행하세요. 개발 테스트용 계정은 운영 seed에 포함하지 않습니다.

보존 기간은 서비스 운영자가 정해야 합니다. 삭제 전 백업하고, 장치별 기록 조회가 필요하면 원시 데이터 대신 집계 보존을 검토하세요. 대규모 데이터는 `EXPLAIN (ANALYZE, BUFFERS)`로 범위 조회와 인덱스를 확인하세요.
