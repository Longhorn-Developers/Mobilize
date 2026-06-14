$ErrorActionPreference = "Stop"

param(
  [int]$MetroPort = 8081,
  [int]$ApiPort = 54321
)

function Get-ProcessIdOnPort {
  param([int]$Port)

  try {
    $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop | Select-Object -First 1
    if ($null -ne $conn) {
      return [int]$conn.OwningProcess
    }
  } catch {
    # Fallback below.
  }

  $line = netstat -ano | Select-String -Pattern "LISTENING\s+(\d+)$" | Where-Object {
    $_.Line -match "[:\.]$Port\s+"
  } | Select-Object -First 1

  if ($line -and $line.Line -match "LISTENING\s+(\d+)$") {
    return [int]$Matches[1]
  }

  return $null
}

function Stop-ProcessOnPort {
  param([int]$Port)

  $targetPid = Get-ProcessIdOnPort -Port $Port
  if ($null -eq $targetPid) {
    return
  }

  try {
    Stop-Process -Id $targetPid -Force -ErrorAction Stop
    Write-Host "Stopped stale process $targetPid on port $Port"
  } catch {
    Write-Warning ("Could not stop process ${targetPid} on port ${Port}: {0}" -f $_.Exception.Message)
  }
}

Stop-ProcessOnPort -Port $MetroPort

Write-Host "Reversing adb ports..."
& adb reverse "tcp:$MetroPort" "tcp:$MetroPort" | Out-Null
& adb reverse "tcp:$ApiPort" "tcp:$ApiPort" | Out-Null

Write-Host "Starting Android run..."
& expo run:android
