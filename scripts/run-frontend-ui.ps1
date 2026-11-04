$ErrorActionPreference = "Continue"
Set-Location "d:\Code\data-coin-marketplace\frontend"
$log = "d:\Code\data-coin-marketplace\frontend-build.log"
"=== build start $(Get-Date -Format o) ===" | Out-File $log -Encoding utf8
npm run build 2>&1 | Tee-Object -FilePath $log -Append
if ($LASTEXITCODE -eq 0) {
  "BUILD_OK" | Out-File $log -Append -Encoding utf8
  npm run dev -- --host 127.0.0.1 --port 5173
} else {
  "BUILD_FAIL exit=$LASTEXITCODE" | Out-File $log -Append -Encoding utf8
  exit $LASTEXITCODE
}
