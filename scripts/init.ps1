# REFERENCE CODE. Copy to scripts/init.ps1 unchanged. Task 001 creates it.
# Run at the start of every implementer session: pwsh scripts/init.ps1
# Exit code 0 means the project is ready to work on.

$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)

function Step($name, [scriptblock]$action) {
  Write-Host "== $name"
  & $action
  if ($LASTEXITCODE -ne 0) {
    Write-Host "FAILED: $name" -ForegroundColor Red
    exit 1
  }
}

Step 'Node version' {
  $version = (node --version)
  if (-not $version.StartsWith('v24.')) { Write-Host "Node 24 is required, found $version"; $global:LASTEXITCODE = 1 } else { $global:LASTEXITCODE = 0 }
}
Step 'Git hook' { git config core.hooksPath scripts/hooks }
Step 'Install' { npm ci --no-audit --no-fund }
Step 'Type check' { npm run typecheck }
Step 'Smoke test' { npm test -- tests/smoke }

Write-Host ''
Write-Host '== Last progress entry'
if (Test-Path PROGRESS.md) {
  $text = Get-Content PROGRESS.md -Raw
  $last = $text.LastIndexOf("`n## ")
  if ($last -ge 0) { $text.Substring($last).Trim() } else { $text.Trim() }
}
Write-Host ''
Write-Host '== Recent commits'
git log --oneline -10
exit 0
