#!/bin/bash

# Build script for Chainguard Docker image with error handling

set -e  # Exit on error

echo "=== Starting Chainguard Docker build ==="
echo "Current directory: $(pwd)"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "ERROR: Docker daemon is not running. Please start Docker Desktop first."
    exit 1
fi

echo "Docker daemon is running ✓"

# Build with detailed output
echo "Building Docker image..."
docker build \
    --progress=plain \
    --no-cache \
    -f Dockerfile.chainguard \
    -t backend-app-chainguard:latest \
    . 2>&1 | tee chainguard-build.log

# Check if build was successful
if [ ${PIPESTATUS[0]} -eq 0 ]; then
    echo "✓ Build completed successfully!"
    echo ""
    echo "Image details:"
    docker images backend-app-chainguard:latest
    echo ""
    echo "To test the image:"
    echo "  docker run --rm backend-app-chainguard:latest python --version"
    echo "  docker run --rm backend-app-chainguard:latest ffmpeg -version"
    echo ""
    echo "To run with docker-compose:"
    echo "  docker-compose -f docker-compose.chainguard.yml up"
else
    echo "✗ Build failed. Check chainguard-build.log for details."
    echo ""
    echo "Common issues:"
    echo "1. Package not found: Check Wolfi package names"
    echo "2. Network issues: Retry or check proxy settings"
    echo "3. Base image issues: Try 'docker pull cgr.dev/chainguard/wolfi-base:latest'"
    exit 1
fi