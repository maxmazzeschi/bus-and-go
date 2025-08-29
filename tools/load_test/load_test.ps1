param(
    [Parameter(Mandatory=$false)]
    [string]$BaseUrl = "http://localhost:5000",
    
    [Parameter(Mandatory=$false)]
    [int]$DelaySeconds = 1
)

Write-Host "=== Bus-and-Go Load Test ===" -ForegroundColor Cyan
Write-Host "Target: $BaseUrl" -ForegroundColor White
Write-Host "Delay between requests: ${DelaySeconds}s" -ForegroundColor White
Write-Host "=============================" -ForegroundColor Cyan
Write-Host ""

# Function to make HTTP request with error handling
function Invoke-ApiRequest {
    param(
        [string]$Url,
        [string]$Description
    )
    
    try {
        Write-Host "[REQUEST] $Description" -ForegroundColor Yellow
        Write-Host "   URL: $Url" -ForegroundColor Gray
        
        $response = Invoke-RestMethod -Uri $Url -Method GET -TimeoutSec 30
        Write-Host "   [SUCCESS]" -ForegroundColor Green
        
        Start-Sleep -Seconds $DelaySeconds
        return $response
    }
    catch {
        Write-Host "   [ERROR] $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}

# Step 1: Get available countries
Write-Host "Step 1: Getting available countries..." -ForegroundColor Cyan
$countriesUrl = "$BaseUrl/get_available_countries"
$countries = Invoke-ApiRequest -Url $countriesUrl -Description "Fetching countries"

if (-not $countries) {
    Write-Host "Failed to get countries. Exiting." -ForegroundColor Red
    exit 1
}

Write-Host "   [RESULT] Found $($countries.Count) countries: $($countries -join ', ')" -ForegroundColor White
Write-Host ""

# Step 2: Get cities for each country
Write-Host "Step 2: Getting cities for each country..." -ForegroundColor Cyan
$allCities = @()

foreach ($country in $countries) {
    $citiesUrl = "$BaseUrl/get_available_cities?country=$country"
    $cities = Invoke-ApiRequest -Url $citiesUrl -Description "Fetching cities for $country"
    
    if ($cities) {
        $allCities += $cities
        Write-Host "   [RESULT] Found $($cities.Count) cities for $country" -ForegroundColor White
    }
}

Write-Host ""
Write-Host "   [RESULT] Total cities collected: $($allCities.Count)" -ForegroundColor White

# Step 2.5: Merge cities with same datasetId
Write-Host "   [PROCESSING] Merging cities with same datasetId..." -ForegroundColor Yellow
$uniqueDatasets = @{}

foreach ($city in $allCities) {
    $datasetId = $city.id
    
    if ($uniqueDatasets.ContainsKey($datasetId)) {
        # Merge city names
        $existingName = $uniqueDatasets[$datasetId].name
        $newName = $city.name
        
        # Only add if not already included
        if ($existingName -notlike "*$newName*") {
            $uniqueDatasets[$datasetId].name = "$existingName, $newName"
        }
        
        # Add country to list if not already there
        if ($uniqueDatasets[$datasetId].countries -notcontains $city.country) {
            $uniqueDatasets[$datasetId].countries += $city.country
        }
    } else {
        # Create new entry
        $uniqueDatasets[$datasetId] = @{
            id = $datasetId
            name = $city.name
            countries = @($city.country)
        }
    }
}

# Convert hashtable to array
$mergedCities = $uniqueDatasets.Values

Write-Host "   [RESULT] After merging: $($mergedCities.Count) unique datasets (reduced from $($allCities.Count) cities)" -ForegroundColor White
Write-Host ""

# Step 3: Get routes info for each unique dataset
Write-Host "Step 3: Getting routes info for each unique dataset..." -ForegroundColor Cyan
$totalRoutes = 0
$successfulRequests = 0
$failedRequests = 0
$currentIndex = 0
$totalDatasets = $mergedCities.Count
$startTime = Get-Date

foreach ($dataset in $mergedCities) {
    $currentIndex++
    $percentComplete = [math]::Round(($currentIndex / $totalDatasets) * 100, 1)
    
    $datasetId = $dataset.id
    $datasetName = $dataset.name
    $datasetCountries = $dataset.countries -join ", "
    
    # Truncate dataset name for display if too long
    $displayName = if ($datasetName.Length -gt 80) { 
        $datasetName.Substring(0, 77) + "..." 
    } else { 
        $datasetName 
    }
    
    Write-Host "[$currentIndex/$totalDatasets - $percentComplete%] Processing dataset from: $datasetCountries" -ForegroundColor Cyan
    Write-Host "   Dataset: $displayName" -ForegroundColor White
    
    $routesUrl = "$BaseUrl/get_routes_info?datasetId=$datasetId"
    $routes = Invoke-ApiRequest -Url $routesUrl -Description "Fetching routes for dataset"
    
    if ($routes) {
        $successfulRequests++
        $routeCount = if ($routes -is [Array]) { $routes.Count } else { 1 }
        $totalRoutes += $routeCount
        Write-Host "   [RESULT] Found $routeCount routes" -ForegroundColor White
    } else {
        $failedRequests++
    }
    
    # Show estimated time remaining
    if ($currentIndex -gt 1) {
        $elapsedTime = (Get-Date) - $startTime
        $averageTimePerDataset = $elapsedTime.TotalSeconds / $currentIndex
        $remainingDatasets = $totalDatasets - $currentIndex
        $estimatedTimeRemaining = $remainingDatasets * $averageTimePerDataset
        
        Write-Host "   [INFO] Estimated time remaining: $([math]::Round($estimatedTimeRemaining, 0)) seconds" -ForegroundColor Gray
    }
    
    Write-Host ""
}

Write-Host ""
Write-Host "=== Load Test Summary ===" -ForegroundColor Cyan
Write-Host "Countries processed: $($countries.Count)" -ForegroundColor White
Write-Host "Original cities collected: $($allCities.Count)" -ForegroundColor White
Write-Host "Unique datasets processed: $($mergedCities.Count)" -ForegroundColor White
Write-Host "Dataset requests successful: $successfulRequests" -ForegroundColor Green
Write-Host "Dataset requests failed: $failedRequests" -ForegroundColor Red
Write-Host "Total routes found: $totalRoutes" -ForegroundColor White

if ($mergedCities.Count -gt 0) {
    Write-Host "Success rate: $([math]::Round(($successfulRequests / $mergedCities.Count) * 100, 2))%" -ForegroundColor $(if ($successfulRequests -gt $failedRequests) { "Green" } else { "Yellow" })
}

Write-Host "==========================" -ForegroundColor Cyan

# Optional: Save results to file
$saveResults = Read-Host "`nSave detailed results to file? (y/N)"
if ($saveResults -eq 'y' -or $saveResults -eq 'Y') {
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $outputFile = "load_test_results_$timestamp.json"
    
    $results = @{
        timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        baseUrl = $BaseUrl
        countries = $countries
        originalCities = $allCities
        mergedDatasets = $mergedCities
        summary = @{
            countriesCount = $countries.Count
            originalCitiesCount = $allCities.Count
            uniqueDatasetsCount = $mergedCities.Count
            successfulRequests = $successfulRequests
            failedRequests = $failedRequests
            totalRoutes = $totalRoutes
            successRate = if ($mergedCities.Count -gt 0) { [math]::Round(($successfulRequests / $mergedCities.Count) * 100, 2) } else { 0 }
        }
    }
    
    $results | ConvertTo-Json -Depth 10 | Out-File -FilePath $outputFile -Encoding UTF8
    Write-Host "Results saved to: $outputFile" -ForegroundColor Green
}

Write-Host ""
Write-Host "Load test completed!" -ForegroundColor Green