# Create logs directory locally
New-Item -ItemType Directory -Force -Path ".\logs"

Write-Host "Starting bus-and-go container..." -ForegroundColor Green
Write-Host "Logs will be available in: $(Get-Location)\logs" -ForegroundColor Yellow
Write-Host "Access the app at: http://localhost:5000" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop and remove the container" -ForegroundColor Yellow
Write-Host ""

# Run with volume mount and auto-remove on exit
docker run --rm --memory=640m -p 5000:5000 `
  -v "${PWD}/logs:/logs" `
  --name bus-and-go-container `
  bus-and-go