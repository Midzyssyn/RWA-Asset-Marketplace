$ErrorActionPreference = "Continue"
$out = "d:\Code\data-coin-marketplace\docs\ui-acceptance"
New-Item -ItemType Directory -Force -Path $out | Out-Null
$log = "d:\Code\data-coin-marketplace\_shot.log"
"" | Set-Content $log -Encoding utf8
function L($m){ Add-Content $log $m -Encoding utf8 }

$edge = @(
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $edge) { L "NO_EDGE"; exit 1 }
L "edge=$edge"

# taller window to capture Admin two zones
$pages = @(
  @{ name = "market"; url = "http://127.0.0.1:5173/"; w = 1440; h = 1100 },
  @{ name = "admin"; url = "http://127.0.0.1:5173/admin"; w = 1440; h = 2200 },
  @{ name = "project0"; url = "http://127.0.0.1:5173/project/0"; w = 1440; h = 1800 }
)

foreach ($p in $pages) {
  $file = Join-Path $out ($p.name + ".png")
  if (Test-Path $file) { Remove-Item $file -Force }
  L "shot $($p.name)"
  $args = @(
    "--headless=new",
    "--disable-gpu",
    "--allow-insecure-localhost",
    "--window-size=$($p.w),$($p.h)",
    "--virtual-time-budget=10000",
    "--screenshot=$file",
    $p.url
  )
  & $edge @args
  Start-Sleep -Seconds 3
  if (Test-Path $file) { L "OK $($p.name) size=$((Get-Item $file).Length)" } else { L "FAIL $($p.name)" }
}
L "DONE"
