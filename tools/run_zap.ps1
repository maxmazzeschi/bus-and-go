# Create output directory if it doesn't exist
if (!(Test-Path -Path ".\output")) {
    New-Item -ItemType Directory -Path ".\output" -Force | Out-Null
}

Write-Host "=== ZAP Security Scan ===" -ForegroundColor Cyan
Write-Host "Target: http://host.docker.internal:5000" -ForegroundColor White
Write-Host "Output Directory: $(Get-Location)\output" -ForegroundColor White
Write-Host "=========================" -ForegroundColor Cyan

Write-Host ""
Write-Host "Running ZAP baseline security scan..." -ForegroundColor Yellow

# Run ZAP baseline scan - using host.docker.internal to access host machine
docker run -v "${PWD}/output:/zap/wrk:rw" -t zaproxy/zap-stable zap-baseline.py -t http://host.docker.internal:5000 -J basic_report.json -r basic_report.html -d

Write-Host ""
Write-Host "=== ZAP Scan Results ===" -ForegroundColor Cyan

# Check if files were created
if (Test-Path ".\output\basic_report.html") {
    Write-Host "✓ HTML Report: $(Get-Location)\output\basic_report.html" -ForegroundColor Green
} else {
    Write-Host "✗ HTML Report not found" -ForegroundColor Red
}

if (Test-Path ".\output\basic_report.json") {
    Write-Host "✓ JSON Report: $(Get-Location)\output\basic_report.json" -ForegroundColor Green
} else {
    Write-Host "✗ JSON Report not found" -ForegroundColor Red
}

Write-Host ""
Write-Host "Scan completed!" -ForegroundColor Green

# Optional: Open HTML report in default browser
$openReport = Read-Host "Open HTML report in browser? (y/N)"
if ($openReport -eq 'y' -or $openReport -eq 'Y') {
    if (Test-Path ".\output\basic_report.html") {
        Start-Process ".\output\basic_report.html"
    } else {
        Write-Host "HTML report not found to open" -ForegroundColor Red
    }
}