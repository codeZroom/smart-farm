param([Parameter(Mandatory=$true)][ValidatePattern('^COM[0-9]+$')][string]$Port,[string]$Cli='arduino-cli',[string]$Fqbn='esp32:esp32:esp32',[switch]$ConfirmedTarget)
$ErrorActionPreference='Stop'
if(!$ConfirmedTarget){throw '보드와 포트를 확인한 뒤 -ConfirmedTarget을 지정하세요.'}
& $Cli board list
Write-Host "선택된 포트: $Port / 보드: $Fqbn"
$root=Split-Path -Parent $PSScriptRoot
$sketch=Join-Path $root 'firmware/esp32-smart-farm'
& $Cli compile --fqbn $Fqbn $sketch
if($LASTEXITCODE -ne 0){throw '빌드 실패: 업로드하지 않았습니다.'}
& $Cli upload --fqbn $Fqbn --port $Port $sketch
if($LASTEXITCODE -ne 0){throw 'ESP32 업로드 실패'}
