$ErrorActionPreference = "Continue"
$log = "d:\Code\data-coin-marketplace\_chain.log"
"" | Set-Content $log -Encoding utf8
function L($m){ Add-Content $log $m -Encoding utf8 }
Set-Location "d:\Code\data-coin-marketplace"

L "=== $(Get-Date -Format o) ==="
# start node in background job writing to file
Start-Process -FilePath "npx" -ArgumentList "hardhat","node" -WorkingDirectory "d:\Code\data-coin-marketplace" -RedirectStandardOutput "d:\Code\data-coin-marketplace\_hh-node.out" -RedirectStandardError "d:\Code\data-coin-marketplace\_hh-node.err" -WindowStyle Hidden
L "hardhat node starting..."
Start-Sleep -Seconds 5

L "deploying..."
npx hardhat run scripts/deploy.js --network localhost *>&1 | ForEach-Object { L ($_ | Out-String).TrimEnd() }
L "deploy exit=$LASTEXITCODE"

if (Test-Path "scripts/seed-demo.js") {
  L "seeding..."
  npx hardhat run scripts/seed-demo.js --network localhost *>&1 | ForEach-Object { L ($_ | Out-String).TrimEnd() }
  L "seed exit=$LASTEXITCODE"
}
L "CHAIN_READY"
