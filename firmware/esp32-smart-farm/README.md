# ESP32 다중 센서

ESP32 DevKitC V4: DS18B20 DATA GPIO4 (3.3V pull-up 저항 필요), MH-Z19C TX→GPIO16 / RX←GPIO17 (9600 baud, 전원과 로직 전압은 제조사 사양 확인), GUVA SIG→GPIO34 (ADC1, 3.3V). 모든 저전압 장치의 GND를 공통으로 연결합니다. 고전압 회로는 연결하지 않습니다.

`config.example.h`를 `config.local.h`로 복사하고 Wi-Fi, 장치 UUID/키, HTTPS 호스트의 공식 루트 CA를 넣으세요. 예시의 PEM은 인증서가 아니므로 실제 사용 전 교체가 필수입니다. 키는 표시 직후 안전하게 보관하고 커밋하지 마세요.

DS18B20은 비동기 변환을 사용하고 -127°C는 오류로 보냅니다. MH-Z19C는 180초 예열 상태를 전송하고 UART 9바이트 프레임·체크섬·타임아웃을 검사합니다. GUVA는 보정되지 않은 ADC 원시값과 mV만 보내며 UV 지수로 변환하지 않습니다. **ADC 입력만으로 센서가 물리적으로 연결되었는지 판정할 수 없습니다.** 높은 고정 전압은 연결 불량, 배선 또는 입력 포화 등 원인 점검이 필요합니다.

RS485 센서는 미구현 상태로 보고합니다. GPIO25/26은 후보이며, 트랜시버의 3.3V 호환성, 별도 전원, 장치별 Slave ID, 레지스터, 스케일은 실제 제조사 자료 확인 전 연결·구현하지 마세요. 릴레이 제어는 포함하지 않습니다.

30초마다 유효 센서 값을 하나의 HTTPS 요청으로 전송하고 오류 센서는 null과 상태로 표시합니다. HTTPS 검증을 끄지 않으며 NTP 시간 동기화 전 요청을 보내지 않습니다. 통신 실패 시 다음 주기에 새로운 측정을 전송하며, 실패 측정의 오프라인 큐는 없습니다. 센서가 모두 실패하면 API 계약상 저장되지 않습니다. HTTP 연결에 최대 10초가 걸릴 수 있으며 그동안 센서 loop가 잠시 멈춥니다.

PowerShell 예: `./scripts/esp32-setup.ps1`, `./scripts/esp32-build.ps1`, `arduino-cli board list`, `./scripts/esp32-upload.ps1 -Port COM3 -ConfirmedTarget`, `./scripts/esp32-monitor.ps1 -Port COM3`. COM3은 예시이며 실제 보드와 포트를 확인한 후 업로드하세요.
