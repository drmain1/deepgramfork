#!/bin/bash

# Script to test Wolfi package availability

echo "=== Testing Wolfi Package Availability ==="

# List of packages to test
PACKAGES=(
    "python3"
    "python3-dev"
    "py3-pip"
    "cairo"
    "cairo-dev"
    "pango"
    "pango-dev"
    "gdk-pixbuf"
    "gdk-pixbuf-dev"
    "libxml2"
    "libxml2-dev"
    "libxslt"
    "libxslt-dev"
    "libjpeg-turbo"
    "libjpeg-turbo-dev"
    "ffmpeg"
    "liberation-fonts"
    "fontconfig"
)

echo "Testing package availability in Wolfi..."
echo ""

# Test each package
docker run --rm cgr.dev/chainguard/wolfi-base:latest sh -c "
apk update > /dev/null 2>&1
for pkg in ${PACKAGES[@]}; do
    if apk info -e \$pkg > /dev/null 2>&1; then
        echo '✓ \$pkg - available'
    else
        # Try to search for similar packages
        echo '✗ \$pkg - not found'
        echo '  Searching for similar packages...'
        apk search \$pkg 2>/dev/null | head -5 | sed 's/^/    /'
    fi
done
"