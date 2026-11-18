# HSOS terminal init. Loaded into every PowerShell shell HSOS starts (TERM-7).
# HSOS loads it as a script block, not a script file, so it runs under any execution policy.
# Works in Windows PowerShell 5.1 (PSReadLine 2.0) and PowerShell 7.
# Copy unchanged to src/modules/terminal/service/terminal-init.ps1.

if ($Global:__HsosTerminalInit) { return }
$Global:__HsosTerminalInit = $true

$Global:__HsosEsc = [char]0x1b
$Global:__HsosBel = [char]0x07
$Global:__HsosCommandRunning = $false

# TERM-45. HSOS sends ESC CR for Shift+Enter. ConPTY turns it into Alt+Enter,
# which PSReadLine leaves unbound, so a second line would be glued onto the first.
# AddLine starts a new input line instead, as Shift+Enter does in Windows Terminal.
if (Get-Module -Name PSReadLine) {
    Set-PSReadLineKeyHandler -Chord 'Alt+Enter' -Function AddLine
}

# TERM-70. Prompt marks (OSC 133) and the current folder (OSC 7).
$Global:__HsosOriginalPrompt = $function:prompt

function Global:prompt {
    $succeeded = $?
    $exitCode = $Global:LASTEXITCODE
    $marks = ''

    # D carries only success (0) or failure (1). $LASTEXITCODE can be stale after a cmdlet fails.
    if ($Global:__HsosCommandRunning) {
        $Global:__HsosCommandRunning = $false
        $code = 0
        if (-not $succeeded) { $code = 1 }
        $marks += "$($Global:__HsosEsc)]133;D;$code$($Global:__HsosBel)"
    }

    $marks += "$($Global:__HsosEsc)]133;A$($Global:__HsosBel)"
    if ($PWD.Provider.Name -eq 'FileSystem') {
        $uri = ([System.Uri]$PWD.ProviderPath).AbsoluteUri
        $marks += "$($Global:__HsosEsc)]7;$uri$($Global:__HsosBel)"
    }

    $text = & $Global:__HsosOriginalPrompt
    $Global:LASTEXITCODE = $exitCode
    return "$marks$text$($Global:__HsosEsc)]133;B$($Global:__HsosBel)"
}

if (Get-Module -Name PSReadLine) {
    $Global:__HsosOriginalReadLine = $function:PSConsoleHostReadLine
    function Global:PSConsoleHostReadLine {
        $line = $Global:__HsosOriginalReadLine.Invoke()
        $Global:__HsosCommandRunning = $true
        [Console]::Write("$($Global:__HsosEsc)]133;C$($Global:__HsosBel)")
        return $line
    }
}
