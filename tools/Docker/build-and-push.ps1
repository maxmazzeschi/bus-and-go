param(
    [Parameter(Mandatory=$false)]
    [string]$Version = "latest",
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipBuild = $false
)

Write-Host "=== Build and Push to GitHub Container Registry ===" -ForegroundColor Cyan

# Build the image (unless skipped)
if (-not $SkipBuild) {
    Write-Host ""
    Write-Host "Step 1: Building Docker image..." -ForegroundColor Yellow
    .\build.ps1
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Build failed!" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "Build completed successfully" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "Skipping build step..." -ForegroundColor Yellow
}

# Push the image
Write-Host ""
Write-Host "Step 2: Pushing to GitHub Container Registry..." -ForegroundColor Yellow
.\push-to-github.ps1 -Version $Version

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Build and push completed successfully!" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "Push failed!" -ForegroundColor Red
    exit 1
}