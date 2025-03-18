# Path to your JSON file
$jsonFile = "tfl.json"

# Read the JSON file
$jsonData = Get-Content $jsonFile | ConvertFrom-Json

# Function to flatten nested objects
function Flatten-Object {
    param (
        [Parameter(Mandatory=$true)]
        [psobject]$obj,
        
        [Parameter(Mandatory=$true)]
        [string]$parentKey
    )
    
    $flattened = @{}
    
    foreach ($property in $obj.PSObject.Properties) {
        $newKey = if ($parentKey) { "$parentKey.$($property.Name)" } else { $property.Name }
        
        if ($property.Value -is [pscustomobject]) {
            $flattened += Flatten-Object -obj $property.Value -parentKey $newKey
        }
        elseif ($property.Value -is [System.Collections.IEnumerable] -and !$property.Value.GetType().IsPrimitive) {
            # Handle arrays or lists, flattening them too
            $index = 0
            foreach ($item in $property.Value) {
                $flattened += Flatten-Object -obj $item -parentKey "$newKey[$index]"
                $index++
            }
        }
        else {
            $flattened[$newKey] = $property.Value
        }
    }

    return $flattened
}

# Flatten the JSON data
$flattenedData = $jsonData | ForEach-Object { Flatten-Object -obj $_ -parentKey "" }

# Convert to CSV and export
$flattenedData | Export-Csv -Path "tfl.csv" -NoTypeInformation
# Path to your JSON file
$jsonFile = "tfl.json"

# Read the JSON file
$jsonData = Get-Content $jsonFile | ConvertFrom-Json

# Function to flatten nested objects
function Flatten-Object {
    param (
        [Parameter(Mandatory=$true)]
        [psobject]$obj,
        
        [Parameter(Mandatory=$true)]
        [string]$parentKey
    )
    
    $flattened = @{}
    
    foreach ($property in $obj.PSObject.Properties) {
        $newKey = if ($parentKey) { "$parentKey.$($property.Name)" } else { $property.Name }
        
        if ($property.Value -is [pscustomobject]) {
            $flattened += Flatten-Object -obj $property.Value -parentKey $newKey
        }
        elseif ($property.Value -is [System.Collections.IEnumerable] -and !$property.Value.GetType().IsPrimitive) {
            # Handle arrays or lists, flattening them too
            $index = 0
            foreach ($item in $property.Value) {
                $flattened += Flatten-Object -obj $item -parentKey "$newKey[$index]"
                $index++
            }
        }
        else {
            $flattened[$newKey] = $property.Value
        }
    }

    return $flattened
}

# Flatten the JSON data
$flattenedData = $jsonData | ForEach-Object { Flatten-Object -obj $_ -parentKey "" }

# Convert to CSV and export
$flattenedData | Export-Csv -Path "tfl.csv" -NoTypeInformation
