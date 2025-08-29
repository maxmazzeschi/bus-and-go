#!/bin/bash

# Create output directory if it doesn't exist
mkdir -p ./output

echo "=== ZAP Security Scan ==="
echo "Target: http://host.docker.internal:8000"
echo "Output Directory: $(pwd)/output"
echo "========================="

echo ""
echo "Running ZAP baseline security scan..."

# Run ZAP baseline scan using current directory - fix the volume mount
docker run -v "$(pwd)/output:/zap/wrk:rw" -t zaproxy/zap-stable \
  zap-baseline.py \
  -t http://host.docker.internal:8000 \
  -J basic_report.json \
  -r basic_report.html \
  -d

echo ""
echo "=== ZAP Scan Results ==="

# Check if files were actually created
if [ -f "$(pwd)/output/basic_report.html" ]; then
    echo "✓ HTML Report: $(pwd)/output/basic_report.html"
else
    echo "✗ HTML Report not found"
fi

if [ -f "$(pwd)/output/basic_report.json" ]; then
    echo "✓ JSON Report: $(pwd)/output/basic_report.json"
else
    echo "✗ JSON Report not found"
fi

echo ""
echo "Scan completed!"