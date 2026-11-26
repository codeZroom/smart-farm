param([string]$Cli='arduino-cli',[string]$Fqbn='esp32:esp32:esp32')
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$sketch=Join-Path $root 'firmware/esp32-smart-farm'
if(!(Test-Path -LiteralPath (Join-Path $sketch 'config.local.h'))){throw 'config.example.h를 config.local.h로 복사하고 설정하세요.'}
& $Cli compile --fqbn $Fqbn $sketch
if($LASTEXITCODE -ne 0){throw 'ESP32 빌드 실패'}
