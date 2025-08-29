param(
    [Parameter(Mandatory=$false)]
    [string]$Version = "latest",
    
    [Parameter(Mandatory=$false)]
    [string]$GitHubUsername = "maxmazzeschi",
    
    [Parameter(Mandatory=$false)]
    [string]$ImageName = "bus-and-go"
)

# GitHub Container Registry configuration
$REGISTRY = "ghcr.io"
$FULL_IMAGE_NAME = "${REGISTRY}/${GitHubUsername}/${ImageName}"

Write-Host "=== GitHub Container Registry Push ===" -ForegroundColor Cyan
Write-Host "Registry: $REGISTRY" -ForegroundColor White
Write-Host "Image: $FULL_IMAGE_NAME" -ForegroundColor White
Write-Host "Version: $Version" -ForegroundColor White
Write-Host "=======================================" -ForegroundColor Cyan

# Check if we're logged in to GitHub Container Registry
Write-Host ""
Write-Host "Checking GitHub Container Registry login..." -ForegroundColor Yellow

$loginCheck = docker info 2>&1 | Select-String "ghcr.io"
if (-not $loginCheck) {
    Write-Host "Not logged in to GitHub Container Registry" -ForegroundColor Yellow
    Write-Host "Please login first with:" -ForegroundColor White
    Write-Host "docker login ghcr.io -u $GitHubUsername" -ForegroundColor Cyan
    Write-Host ""
    
    $shouldLogin = Read-Host "Do you want to login now? (y/N)"
    if ($shouldLogin -eq 'y' -or $shouldLogin -eq 'Y') {
        Write-Host "Please enter your GitHub Personal Access Token (PAT) when prompted..." -ForegroundColor Yellow
        docker login ghcr.io -u $GitHubUsername
        
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Login failed!" -ForegroundColor Red
            Write-Host "Make sure you have a Personal Access Token with 'write:packages' scope" -ForegroundColor Yellow
            Write-Host "Create one at: https://github.com/settings/tokens" -ForegroundColor Cyan
            exit 1
        }
    } else {
        Write-Host "Cannot push without authentication" -ForegroundColor Red
        exit 1
    }
}

# Check if local image exists
Write-Host ""
Write-Host "Checking if local image exists..." -ForegroundColor Yellow

$imageExists = docker images --format "table {{.Repository}}:{{.Tag}}" | Select-String "^bus-and-go:latest"
if (-not $imageExists) {
    Write-Host "Local image 'bus-and-go:latest' not found!" -ForegroundColor Red
    Write-Host "Build the image first with: .\build.ps1" -ForegroundColor Yellow
    exit 1
}

Write-Host "Local image found" -ForegroundColor Green

# Tag the image for GitHub Container Registry
Write-Host ""
Write-Host "Tagging image for GitHub Container Registry..." -ForegroundColor Yellow

docker tag bus-and-go:latest "${FULL_IMAGE_NAME}:${Version}"

if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to tag image!" -ForegroundColor Red
    exit 1
}

Write-Host "Image tagged as ${FULL_IMAGE_NAME}:${Version}" -ForegroundColor Green

# Also tag as latest if not already latest
if ($Version -ne "latest") {
    docker tag bus-and-go:latest "${FULL_IMAGE_NAME}:latest"
    Write-Host "Image also tagged as ${FULL_IMAGE_NAME}:latest" -ForegroundColor Green
}

# Push the image
Write-Host ""
Write-Host "Pushing image to GitHub Container Registry..." -ForegroundColor Yellow

docker push "${FULL_IMAGE_NAME}:${Version}"

if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to push image!" -ForegroundColor Red
    exit 1
}

Write-Host "Successfully pushed ${FULL_IMAGE_NAME}:${Version}" -ForegroundColor Green

# Push latest tag if we created it
if ($Version -ne "latest") {
    Write-Host ""
    Write-Host "Pushing latest tag..." -ForegroundColor Yellow
    
    docker push "${FULL_IMAGE_NAME}:latest"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Successfully pushed ${FULL_IMAGE_NAME}:latest" -ForegroundColor Green
    } else {
        Write-Host "Failed to push latest tag" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "=== Push Complete ===" -ForegroundColor Cyan
Write-Host "Your image is now available at:" -ForegroundColor White
Write-Host "  ${FULL_IMAGE_NAME}:${Version}" -ForegroundColor Cyan

if ($Version -ne "latest") {
    Write-Host "  ${FULL_IMAGE_NAME}:latest" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "To pull and run:" -ForegroundColor White
Write-Host "  docker pull ${FULL_IMAGE_NAME}:${Version}" -ForegroundColor Cyan
Write-Host "  docker run --memory=512m -p 5000:5000 ${FULL_IMAGE_NAME}:${Version}" -ForegroundColor Cyan

Write-Host ""
Write-Host "View on GitHub: https://github.com/${GitHubUsername}?tab=packages" -ForegroundColor White