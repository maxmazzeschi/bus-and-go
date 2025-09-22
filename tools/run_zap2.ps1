param(
    [Parameter(Mandatory=$false)]
    [string]$Target = "http://host.docker.internal:5000",
    
    [Parameter(Mandatory=$false)]
    [int]$TimeoutMinutes = 30,
    
    [Parameter(Mandatory=$false)]
    [string]$ScanType = "full"  # Options: full, quick, api
)

# Create output directory if it doesn't exist
if (!(Test-Path -Path ".\output")) {
    New-Item -ItemType Directory -Path ".\output" -Force | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$reportPrefix = "zap_extensive_${timestamp}"

Write-Host "=== ZAP Extensive Security Scan ===" -ForegroundColor Cyan
Write-Host "Target: $Target" -ForegroundColor White
Write-Host "Scan Type: $ScanType" -ForegroundColor White
Write-Host "Timeout: $TimeoutMinutes minutes" -ForegroundColor White
Write-Host "Output Directory: $(Get-Location)\output" -ForegroundColor White
Write-Host "Report Prefix: $reportPrefix" -ForegroundColor White
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# Function to run ZAP scan with error handling
function Run-ZapScan {
    param(
        [string]$ScanCommand,
        [string]$Description
    )
    
    Write-Host "Running $Description..." -ForegroundColor Yellow
    Write-Host "Command: $ScanCommand" -ForegroundColor Gray
    Write-Host ""
    
    try {
        Invoke-Expression $ScanCommand
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[SUCCESS] $Description completed successfully" -ForegroundColor Green
        } else {
            Write-Host "[WARNING] $Description completed with warnings (exit code: $LASTEXITCODE)" -ForegroundColor Yellow
        }
    }
    catch {
        Write-Host "[ERROR] $Description failed: $($_.Exception.Message)" -ForegroundColor Red
    }
    Write-Host ""
}

# Prepare scan configurations based on scan type
switch ($ScanType.ToLower()) {
    "quick" {
        $scanDuration = 5
        $spiderDuration = 2
        $activeScanPolicy = "Light"
    }
    "api" {
        $scanDuration = 15
        $spiderDuration = 5
        $activeScanPolicy = "API-minimal-example"
    }
    default { # full
        $scanDuration = $TimeoutMinutes
        $spiderDuration = [math]::Min(10, [math]::Floor($TimeoutMinutes / 3))
        $activeScanPolicy = "Default Policy"
    }
}

Write-Host "Scan Configuration:" -ForegroundColor Cyan
Write-Host "  Spider Duration: $spiderDuration minutes" -ForegroundColor White
Write-Host "  Active Scan Duration: $scanDuration minutes" -ForegroundColor White
Write-Host "  Active Scan Policy: $activeScanPolicy" -ForegroundColor White
Write-Host ""

# 1. Full Scan with Spider and Active Scan
$fullScanCommand = @"
docker run -v "${PWD}/output:/zap/wrk:rw" -t zaproxy/zap-stable zap-full-scan.py ``
  -t $Target ``
  -m $scanDuration ``
  -J ${reportPrefix}_full.json ``
  -r ${reportPrefix}_full.html ``
  -x ${reportPrefix}_full.xml ``
  -d
"@

Run-ZapScan -ScanCommand $fullScanCommand -Description "Full Security Scan (Spider + Active Scan)"

# 2. API Scan (if endpoints detected)
Write-Host "Checking for API endpoints..." -ForegroundColor Yellow
$apiEndpoints = @(
    "/get_available_countries",
    "/get_available_cities",
    "/get_routes_info"
)

foreach ($endpoint in $apiEndpoints) {
    $apiScanCommand = @"
docker run -v "${PWD}/output:/zap/wrk:rw" -t zaproxy/zap-stable zap-api-scan.py ``
  -t ${Target}${endpoint} ``
  -f openapi ``
  -J ${reportPrefix}_api_${endpoint.Replace('/', '_')}.json ``
  -r ${reportPrefix}_api_${endpoint.Replace('/', '_')}.html ``
  -d
"@
    
    Run-ZapScan -ScanCommand $apiScanCommand -Description "API Scan for $endpoint"
}

# 3. AJAX Spider Scan (for JavaScript-heavy content)
$ajaxSpiderCommand = @"
docker run -v "${PWD}/output:/zap/wrk:rw" -t zaproxy/zap-stable zap-baseline.py ``
  -t $Target ``
  -j ``
  -m $spiderDuration ``
  -J ${reportPrefix}_ajax.json ``
  -r ${reportPrefix}_ajax.html ``
  -d
"@

Run-ZapScan -ScanCommand $ajaxSpiderCommand -Description "AJAX Spider Scan"

# 4. Passive Scan Only (for comparison)
$passiveScanCommand = @"
docker run -v "${PWD}/output:/zap/wrk:rw" -t zaproxy/zap-stable zap-baseline.py ``
  -t $Target ``
  -J ${reportPrefix}_passive.json ``
  -r ${reportPrefix}_passive.html ``
  -d
"@

Run-ZapScan -ScanCommand $passiveScanCommand -Description "Passive Scan Only"

# 5. Custom scan with specific rules
$customScanCommand = @"
docker run -v "${PWD}/output:/zap/wrk:rw" -t zaproxy/zap-stable zap-full-scan.py ``
  -t $Target ``
  -m $scanDuration ``
  -J ${reportPrefix}_custom.json ``
  -r ${reportPrefix}_custom.html ``
  -I ``
  -z "-configfile /zap/wrk/zap_custom_config.conf" ``
  -d
"@

# Create custom ZAP configuration
$customConfig = @"
# Custom ZAP Configuration for Bus-and-Go App
scanner.level=HIGH
scanner.strength=HIGH
spider.maxDuration=$spiderDuration
spider.maxDepth=10
spider.maxChildren=20
spider.acceptCookies=true
spider.handleODataParametersVisited=true
"@

$customConfig | Out-File -FilePath ".\output\zap_custom_config.conf" -Encoding ASCII

Run-ZapScan -ScanCommand $customScanCommand -Description "Custom High-Intensity Scan"

Write-Host ""
Write-Host "=== Extensive Scan Results ===" -ForegroundColor Cyan

# Check and list all generated reports
$reportFiles = Get-ChildItem -Path ".\output" -Filter "${reportPrefix}*" | Sort-Object Name

if ($reportFiles.Count -gt 0) {
    Write-Host "Generated Reports:" -ForegroundColor Green
    foreach ($file in $reportFiles) {
        $fileSize = [math]::Round($file.Length / 1KB, 2)
        Write-Host "  [OK] $($file.Name) ($fileSize KB)" -ForegroundColor White
    }
} else {
    Write-Host "[ERROR] No reports generated" -ForegroundColor Red
}

# Generate summary report
Write-Host ""
Write-Host "Generating summary report..." -ForegroundColor Yellow

$summaryReport = @"
# ZAP Extensive Security Scan Summary
Generated: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Target: $Target
Scan Type: $ScanType
Total Duration: $TimeoutMinutes minutes

## Reports Generated:
"@

foreach ($file in $reportFiles) {
    $summaryReport += "`n- $($file.Name)"
}

$summaryReport += @"

## Scan Types Performed:
1. Full Security Scan (Spider + Active Scan)
2. API Endpoint Scans
3. AJAX Spider Scan
4. Passive Scan Only
5. Custom High-Intensity Scan

## Next Steps:
1. Review HTML reports for detailed findings
2. Check JSON reports for programmatic analysis
3. Compare passive vs active scan results
4. Focus on high/medium severity issues first
5. Test API endpoints separately if needed

## Important Notes:
- Review all Medium and High severity findings
- Check for false positives in Low severity findings
- Consider implementing security headers
- Review input validation for API endpoints
"@

$summaryReport | Out-File -FilePath ".\output\${reportPrefix}_SUMMARY.md" -Encoding UTF8

Write-Host "[OK] Summary report saved: ${reportPrefix}_SUMMARY.md" -ForegroundColor Green
Write-Host ""
Write-Host "=== Scan Completed! ===" -ForegroundColor Green

# Optional: Open reports
$openReports = Read-Host "Open HTML reports in browser? (y/N)"
if ($openReports -eq 'y' -or $openReports -eq 'Y') {
    $htmlReports = Get-ChildItem -Path ".\output" -Filter "${reportPrefix}*.html"
    foreach ($report in $htmlReports) {
        Start-Process $report.FullName
        Start-Sleep -Seconds 2  # Delay to prevent overwhelming the browser
    }
}

# Optional: Generate consolidated report
$consolidate = Read-Host "Generate consolidated security report? (y/N)"
if ($consolidate -eq 'y' -or $consolidate -eq 'Y') {
    Write-Host "Generating consolidated report..." -ForegroundColor Yellow
    
    # This would require additional parsing of JSON reports
    # For now, just create a simple index file
    $indexHtml = @"
<!DOCTYPE html>
<html>
<head>
    <title>ZAP Security Scan Results - Bus-and-Go</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background-color: #f0f0f0; padding: 10px; border-radius: 5px; }
        .report-link { display: block; margin: 10px 0; padding: 10px; background-color: #e7f3ff; border-radius: 3px; text-decoration: none; }
        .report-link:hover { background-color: #d1ecf1; }
    </style>
</head>
<body>
    <div class="header">
        <h1>ZAP Security Scan Results</h1>
        <p><strong>Target:</strong> $Target</p>
        <p><strong>Scan Date:</strong> $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")</p>
        <p><strong>Scan Type:</strong> $ScanType</p>
    </div>
    <h2>Available Reports:</h2>
"@

    foreach ($htmlReport in $htmlReports) {
        $reportName = $htmlReport.BaseName -replace "${reportPrefix}_", ""
        $indexHtml += "<a href=`"$($htmlReport.Name)`" class=`"report-link`">Report: $reportName</a>`n"
    }

    $indexHtml += @"
    <h2>Additional Files:</h2>
    <a href="${reportPrefix}_SUMMARY.md" class="report-link">Summary Report (Markdown)</a>
</body>
</html>
"@

    $indexHtml | Out-File -FilePath ".\output\${reportPrefix}_INDEX.html" -Encoding UTF8
    Write-Host "[OK] Consolidated index created: ${reportPrefix}_INDEX.html" -ForegroundColor Green
    
    Start-Process ".\output\${reportPrefix}_INDEX.html"
}

Write-Host ""
Write-Host "All scans completed! Check the output directory for detailed reports." -ForegroundColor Green