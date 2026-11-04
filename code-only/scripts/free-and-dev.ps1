$ErrorActionPreference = "SilentlyContinue"
$log = "d:\Code\data-coin-marketplace\_ui-run.log"
function L($m){ Add-Content -Path $log -Value $m -Encoding utf8 }

"" | Set-Content $log -Encoding utf8
L "=== $(Get-Date -Format o) ==="
$c = Get-PSDrive C; $d = Get-PSDrive D
L ("C free MB=" + [math]::Round($c.Free/1MB))
L ("D free MB=" + [math]::Round($d.Free/1MB))

# clear vite cache on D (rebuildable)
$vite = "d:\Code\data-coin-marketplace\frontend\node_modules\.vite"
if (Test-Path $vite) {
  Remove-Item -Recurse -Force $vite
  L "removed .vite cache"
}

Set-Location "d:\Code\data-coin-marketplace\frontend"
L "starting npm run build..."
npm run build *>&1 | ForEach-Object { L ($_ | Out-String).TrimEnd() }
L ("build exit=" + $LASTEXITCODE)

if ($LASTEXITCODE -eq 0) {
  L "BUILD_OK"
  L "starting vite..."
  npm run dev -- --host 127.0.0.1 --port 5173 *>&1 | ForEach-Object { L ($_ | Out-String).TrimEnd() }
} else {
  L "BUILD_FAIL"
}
