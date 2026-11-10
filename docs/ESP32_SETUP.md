# ESP32 + SHT31 처음 연결하기

## 부품과 역할

ESP32는 Wi-Fi가 내장된 작은 마이크로컨트롤러입니다. PC처럼 운영체제를 설치하는 대신 펌웨어를 업로드해 센서 읽기와 전송을 반복합니다. SHT31은 온도와 상대습도를 측정하는 디지털 센서이며 I²C 두 통신선을 사용합니다. 이 시스템은 측정만 하며 전기 장치 제어를 하지 않습니다.

구매 목록: ESP32 DevKit(ESP32-WROOM-32 계열), SHT31 I²C 브레이크아웃 모듈, 데이터 통신 가능한 USB 케이블(보드에 맞는 Micro-USB/USB-C), 브레드보드, 점퍼선 4개 이상, 안정적인 USB 전원, PC, 2.4GHz Wi-Fi. USB 충전 전용 케이블로는 업로드할 수 없습니다. 보드가 ESP32-C3/S3이면 핀과 보드 설정이 다르므로 이 DevKit용 배선을 그대로 적용하지 마세요.

## 전압과 GPIO

GPIO는 보드의 입출력 핀입니다. ESP32 GPIO 신호는 3.3V 기준이며 5V 신호를 직접 넣으면 안 됩니다. USB 5V 전원 입력과 GPIO의 허용 전압은 다릅니다. SHT31 모듈 사양을 확인하고 초기 구성에서는 3.3V 전원을 사용하세요. GND는 공통 기준선입니다. 전원을 분리한 상태에서 배선하고 USB를 연결하세요. 이 안내는 저전압 센서용이며 220V 배선은 다루지 않습니다.

| ESP32 DevKit | SHT31                    |
| ------------ | ------------------------ |
| 3V3          | VIN/VCC (3.3V 지원 모듈) |
| GND          | GND                      |
| GPIO21       | SDA                      |
| GPIO22       | SCL                      |

I²C 기본 주소는 0x44입니다. ADDR 핀으로 0x45가 된 모듈은 firmware의 `sensor.begin(0x44)` 두 곳을 0x45로 변경하세요. 센서를 물/결로·직사광선·보드 발열에 노출시키지 말고 공기가 통하는 곳에 설치하세요.

## Arduino IDE 설치

1. [공식 Arduino IDE](https://www.arduino.cc/en/software)를 설치합니다.
2. 환경설정의 추가 보드 관리자 URL에 `https://espressif.github.io/arduino-esp32/package_esp32_index.json`을 등록합니다.
3. 보드 관리자에서 Espressif Systems의 esp32 패키지를 설치합니다. CLI 검증 기준은 3.3.2입니다.
4. 라이브러리 관리자에서 Adafruit SHT31 Library 2.2.2와 ArduinoJson 7.4.2를 설치하고 의존성(Adafruit BusIO)을 함께 설치합니다.
5. `firmware/esp32-sht31/esp32-sht31.ino`를 엽니다. 도구 → 보드 → ESP32 Dev Module과 연결된 포트를 선택합니다. 포트가 보이지 않으면 USB 데이터 케이블과 보드 USB-serial 칩(CP210x/CH340)의 공식 드라이버를 확인하세요.

## 로컬 설정

`config.example.h`를 같은 폴더의 `config.local.h`로 복사합니다. Wi-Fi SSID/비밀번호, HTTPS API_URL, 장치 등록 화면의 UUID/최초 키를 입력합니다. 키를 잃으면 장치 관리에서 재발급하세요. 이 파일은 .gitignore에 포함되어 있습니다.

`ROOT_CA`에는 API 호스트 인증서 체인의 **공식 루트 CA PEM**을 넣으세요. 호스팅/CA의 공식 저장소에서 구하고 호스트 인증서 체인과 일치하는지 확인하세요. 임시 leaf 인증서는 곧 만료될 수 있습니다. 예시의 PASTE_OFFICIAL_ROOT_CA_HERE는 배포 주소가 정해지면 반드시 교체해야 하며 그대로는 HTTPS 연결되지 않습니다. `setInsecure()`는 사용하지 않습니다. NTP 시간 동기화가 완료되지 않으면 전송하지 않습니다.

## 업로드와 확인

1. 검증(컴파일) 버튼을 누릅니다. 하드웨어가 없어도 이 단계는 가능합니다.
2. ESP32를 USB에 연결하고 업로드합니다. 연결 대기 상태가 계속되면 보드의 BOOT를 누른 상태에서 업로드 시작 후 놓으세요.
3. 시리얼 모니터를 115200 baud로 열고 재시작(EN)합니다.
4. `SHT31 ready`, 펌웨어 버전, 측정값, `API HTTP status: 201`을 확인합니다. 키와 비밀번호는 Serial에 출력하지 않습니다.
5. 대시보드에서 장치 이름, 최신 온습도, 마지막 통신/측정 시각을 확인합니다. 센서는 30초 주기로 전송하고 브라우저는 15초 주기로 갱신합니다.
6. 센서를 분리하면 sensorError:true 전송과 센서 실패 알림을 확인합니다. 복구 시 정상 수치가 저장되고 실패 알림이 해결됩니다.
7. 전원을 분리한 뒤 설정 임계시간이 지나면 오프라인 표시가 됩니다. 앱 내부 이력은 스케줄러 실행 후 생성됩니다.

## CLI / PlatformIO 빌드

```powershell
arduino-cli core update-index --additional-urls https://espressif.github.io/arduino-esp32/package_esp32_index.json
arduino-cli core install esp32:esp32@3.3.2 --additional-urls https://espressif.github.io/arduino-esp32/package_esp32_index.json
arduino-cli lib install "Adafruit SHT31 Library@2.2.2" "ArduinoJson@7.4.2"
arduino-cli compile --fqbn esp32:esp32:esp32 firmware/esp32-sht31
```

빌드 전 config.local.h가 필요합니다. 하드웨어 없는 CI에서는 비밀이 없는 config.example.h를 복사해 컴파일만 수행할 수 있습니다. 통신 검증에는 실제 설정과 장치가 필요합니다. PlatformIO는 해당 폴더에서 `pio run`을 사용하며 설정의 ESP32 Arduino core 버전은 Arduino CLI와 다를 수 있습니다. 두 도구의 검증 결과를 혼동하지 마세요.

## 연결 실패

Wi-Fi는 2.4GHz를 사용하세요. ESP32가 연결되어도 API에 도달하려면 DNS/인터넷/HTTPS가 가능해야 합니다. 인증 포털 Wi-Fi는 적합하지 않습니다. 펌웨어는 15초마다 재연결을 시도하고 센서 초기화 실패도 다시 시도합니다. HTTP 연결/응답 타임아웃은 각각 10초, TLS handshake는 10초입니다. 401은 키/UUID/활성화, 422는 계약, 429는 전송 간격을 확인하세요. 실패 데이터는 로컬 큐로 영구 보관하지 않으며 다음 주기 측정을 다시 전송합니다.
