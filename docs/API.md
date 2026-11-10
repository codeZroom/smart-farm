# API v1

모든 오류는 `{ "error": "안내 문구" }` 형태입니다. 비밀값·SQL 오류·Authorization을 응답이나 로그에 출력하지 않습니다.

## 장치 측정 수집

`POST /api/v1/devices/readings`

```
Authorization: Bearer sf_장치별_256비트_키
Content-Type: application/json
```

```json
{
  "deviceId": "00000000-0000-4000-8000-000000000001",
  "temperature": 24.5,
  "humidity": 65.2,
  "firmwareVersion": "1.0.0"
}
```

온도 -40~125°C, 습도 0~100%RH, 유한 number만 허용합니다. timestamp는 클라이언트가 지정할 수 없습니다. 측정 실패는 두 측정값을 생략하고 `sensorError:true`로 보냅니다. 통신 시각과 실패 알림은 갱신하되 가짜 측정값을 저장하지 않습니다.

```json
{
  "deviceId": "00000000-0000-4000-8000-000000000001",
  "sensorError": true,
  "firmwareVersion": "1.0.0"
}
```

| 상태 | 의미                                                  |
| ---- | ----------------------------------------------------- |
| 201  | DB 트랜잭션 완료, `{ok:true,recordedAt:서버수신시각}` |
| 400  | 잘못된 JSON                                           |
| 401  | 미등록/비활성/폐기/틀린 장치 인증 (동일 응답)         |
| 413  | 본문 4KiB 초과, 스트림 크기 포함                      |
| 415  | JSON Content-Type 필요                                |
| 422  | 센서 값/UUID/필드 오류                                |
| 429  | 같은 장치의 인증된 전송 간격 10초 미만                |
| 503  | 저장 장애, 키를 바꿔 재시도하지 말고 다음 주기 재시도 |

## 사용자 API

`POST /api/auth`: `{email,password}` → Supabase Auth 로그인. 실패는 401이며 내부 원인을 노출하지 않습니다. `DELETE /api/auth`: 로그아웃. 쿠키 세션은 middleware가 갱신하고 서버는 getUser로 검증합니다.

`GET /api/manage?device=UUID&period=1h|24h|7d|30d`: 로그인된 사용자의 농장/구역/장치/임계값/최신값/최근 100개 알림/선택 장치 집계. 사용자 RLS로 조회합니다. 응답은 `private, no-store`입니다.

`POST /api/manage`: `{action,id?,data?}`. same-origin과 사용자 세션을 요구합니다.

| action          | 입력                                                                                          |
| --------------- | --------------------------------------------------------------------------------------------- |
| farm            | data: name, description                                                                       |
| zone            | data: farm_id, name, description                                                              |
| device          | data: farm_zone_id, name (장치와 키 동시 생성)                                                |
| update-device   | id, data: farm_zone_id, name, device_type, is_active                                          |
| thresholds      | id, data: min_temperature, max_temperature, min_humidity, max_humidity, offline_after_seconds |
| rotate / revoke | 장치 id, 키 회전 또는 폐기                                                                    |
| resolve         | 알림 id, acknowledged_at만 갱신                                                               |
| profile         | data: password (12자 이상)                                                                    |

device/rotate의 성공 응답만 `{ok:true,key:원문}`을 포함합니다. 서버에서 원문을 재조회할 수 없습니다. 응답을 저장하거나 로그로 남기지 마세요.

## 오프라인 검사

`GET /api/cron/offline`, `Authorization: Bearer CRON_SECRET`. 스케줄러 전용이며 사용자 쿠키로 호출할 수 없습니다. 1분 주기 권장, 동일 열린 알림은 중복 생성되지 않습니다. 마지막 통신이 임계시간을 초과한 활성 장치를 검사합니다. 키 비교는 timingSafeEqual을 사용합니다.
