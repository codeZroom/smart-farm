param([Parameter(Mandatory=$true)][ValidatePattern('^COM[0-9]+$')][string]$Port,[string]$Cli='arduino-cli')
& $Cli monitor --port $Port --config baudrate=115200
if($LASTEXITCODE -ne 0){throw '시리얼 모니터 연결 실패'}
