# 데이터베이스

## 다중 센서 확장

신규 `sensor_measurements`는 device_id, sensor_type, value, status, 서버 수신 시각을 기록하는 센서별 행 구조입니다. 센서 추가와 개별 오류를 표현하기 쉽고 장치·종류·시간 인덱스로 조회합니다. 기존 `sensor_readings`는 변경하지 않고 기존 온습도 행을 backfill하며, 이후 기존 펌웨어의 온습도 INSERT를 트리거로 복사합니다. 다중 센서의 공기 온습도가 둘 다 있으면 기존 테이블에도 기록하여 알림과 기존 그래프를 유지합니다. 한쪽만 있는 경우 새 측정 테이블에만 기록되며 기존 온습도 알림은 두 값이 함께 도착할 때 갱신됩니다.

`ingest_multi_reading`은 service_role 전용이며 장치 행 잠금과 인증·10초 제한·저장·알림을 하나의 트랜잭션으로 처리합니다. 새 테이블은 사용자별 SELECT RLS만 허용합니다. 센서 종류당 최신값 및 1시간/24시간/7일/30일 구간 집계는 사용자 권한으로 조회합니다. null은 명시적 미연결/예열/오류를 뜻하고 생략은 이전 상태를 변경하지 않습니다.

롤백은 먼저 쓰기 중지와 백업을 수행하고 이전 웹/펌웨어로 복귀한 뒤 새 테이블과 함수 사용 여부를 확인해야 합니다. 다중 센서 이력은 기존 테이블에 완전히 표현되지 않으므로 삭제 전 별도 백업이 필수입니다. 기존 migration을 수정하거나 운영 DB에서 자동 DROP하지 마세요.

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
