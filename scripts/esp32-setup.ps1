param([string]$Cli='arduino-cli')
$ErrorActionPreference='Stop'
& $Cli core update-index --additional-urls https://espressif.github.io/arduino-esp32/package_esp32_index.json
if($LASTEXITCODE -ne 0){throw '보드 인덱스 다운로드 실패'}
& $Cli core install esp32:esp32@3.3.2 --additional-urls https://espressif.github.io/arduino-esp32/package_esp32_index.json
if($LASTEXITCODE -ne 0){throw 'ESP32 보드 패키지 설치 실패'}
& $Cli lib install 'OneWire@2.3.8' 'DallasTemperature@4.0.6' 'ArduinoJson@7.4.2'
if($LASTEXITCODE -ne 0){throw '센서 라이브러리 설치 실패'}
& $Cli board list
