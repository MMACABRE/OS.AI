# HSOS shell init for Claude Code. Written by claude-link to linkDir\shell-init.ps1 and loaded
# into PowerShell shells by the TERM-7 loader (LINK-3, LINK-4, SESS-1).
# Works in Windows PowerShell 5.1 and PowerShell 7. Copy unchanged to
# src/modules/claude-link/service/shell-init.ps1.

if ($Global:__HsosShellInit) { return }
$Global:__HsosShellInit = $true

# Flags after which Claude Code does not start a new interactive conversation of its own.
$Global:__HsosNotFresh = @(
    '-r', '--resume', '-c', '--continue', '--session-id', '--fork-session', '--from-pr',
    '-p', '--print', '--bg', '--background', '--cloud', '--desktop', '-h', '--help', '-v', '--version'
)
# Claude Code 2.1.327 subcommands. A first argument equal to one of these is not a prompt.
$Global:__HsosSubcommands = @(
    'agents', 'attach', 'auth', 'auto-mode', 'doctor', 'gateway', 'import', 'install', 'logs', 'mcp',
    'plugin', 'plugins', 'purge', 'respawn', 'rm', 'setup-token', 'stop', 'kill', 'ultrareview',
    'update', 'upgrade'
)

function Global:Get-HsosLaunch([string[]] $OwnerArgs) {
    $first = if ($OwnerArgs.Count -gt 0) { $OwnerArgs[0] } else { '' }
    if ($Global:__HsosSubcommands -contains $first) { return $null }

    $resumeId = $null
    $continue = $false
    $fresh = $true
    for ($i = 0; $i -lt $OwnerArgs.Count; $i++) {
        $arg = $OwnerArgs[$i]
        $name = ($arg -split '=', 2)[0]
        if ($Global:__HsosNotFresh -contains $name) { $fresh = $false }
        if ($name -eq '-p' -or $name -eq '--print' -or $name -eq '--bg' -or $name -eq '--background') { return $null }
        if ($name -eq '-c' -or $name -eq '--continue') { $continue = $true }
        if ($name -eq '-r' -or $name -eq '--resume') {
            if ($arg -like '*=*') { $resumeId = ($arg -split '=', 2)[1] }
            elseif ($i + 1 -lt $OwnerArgs.Count -and -not $OwnerArgs[$i + 1].StartsWith('-')) { $resumeId = $OwnerArgs[$i + 1] }
        }
    }
    if ($resumeId -and $resumeId -notmatch '^[0-9a-fA-F-]{36}$') { $resumeId = $null }

    $sessionId = $null
    if ($fresh) { $sessionId = [guid]::NewGuid().ToString() }
    return [pscustomobject]@{ SessionId = $sessionId; ResumeId = $resumeId; Continue = $continue }
}

function Global:Write-HsosLaunch($Launch, [string[]] $OwnerArgs) {
    $dir = $env:HSOS_SESSIONS_LAUNCH_DIR
    if (-not $dir -or -not $env:HSOS_TERMINAL_ID) { return }
    try {
        if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
        $record = [ordered]@{
            version    = 1
            sessionId  = $Launch.SessionId
            resumeId   = $Launch.ResumeId
            continue   = $Launch.Continue
            terminalId = $env:HSOS_TERMINAL_ID
            cwd        = (Get-Location).ProviderPath
            at         = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
            args       = @($OwnerArgs)
        }
        $bytes = [System.Text.UTF8Encoding]::new($false).GetBytes(($record | ConvertTo-Json -Compress -Depth 3))
        $name = '{0}-{1}' -f $record.at, [guid]::NewGuid().ToString('N')
        $temp = Join-Path $dir "$name.tmp"
        $final = Join-Path $dir "$name.json"
        $stream = [System.IO.File]::Open($temp, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
        try { $stream.Write($bytes, 0, $bytes.Length); $stream.Flush($true) } finally { $stream.Dispose() }
        [System.IO.File]::Move($temp, $final)
    } catch {
        Write-Host "HSOS: could not record this Claude session for recovery: $($_.Exception.Message)"
    }
}

function Global:claude {
    $exe = Get-Command claude -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $exe) { Write-Host 'Claude Code is not installed or not on PATH.'; return }

    $ownerArgs = @($args)
    # A subcommand such as `claude doctor` runs as typed: session flags before it would be refused.
    if ($ownerArgs.Count -gt 0 -and $Global:__HsosSubcommands -contains $ownerArgs[0]) { & $exe.Source @ownerArgs; return }

    # --mcp-config takes several values, so it comes first: anything after it up to the next flag would be read as a config.
    $hsosArgs = @()
    if ($env:HSOS_MCP_CONFIG -and (Test-Path -LiteralPath $env:HSOS_MCP_CONFIG)) { $hsosArgs += @('--mcp-config', $env:HSOS_MCP_CONFIG) }
    $hsosArgs += @('--plugin-dir', $env:HSOS_PLUGIN_DIR, '--settings', $env:HSOS_SESSION_SETTINGS)

    $launch = Get-HsosLaunch $ownerArgs
    if ($launch) {
        if ($launch.SessionId) { $hsosArgs += @('--session-id', $launch.SessionId) }
        Write-HsosLaunch $launch $ownerArgs
    }
    & $exe.Source @hsosArgs @ownerArgs
}
