#!/bin/bash

# Script to create and configure a GCP bucket for medlegaldoc.com landing page
# This sets up a bucket for static website hosting

set -e  # Exit on any error

# Configuration
BUCKET_NAME="www.medlegaldoc.com"
PROJECT_ID="medlegaldoc-b31df"
LOCATION="us-central1"  # Change if you want a different region
STORAGE_CLASS="STANDARD"

echo "🚀 Setting up GCP bucket for landing page..."
echo "Bucket name: $BUCKET_NAME"
echo "Project: $PROJECT_ID"
echo "Location: $LOCATION"

# Create the bucket
echo ""
echo "📦 Creating bucket..."
gsutil mb -p $PROJECT_ID -c $STORAGE_CLASS -l $LOCATION gs://$BUCKET_NAME/ || {
    echo "Bucket might already exist, continuing..."
}

# Make bucket publicly readable
echo ""
echo "🌐 Configuring public access..."
gsutil iam ch allUsers:objectViewer gs://$BUCKET_NAME

# Set website configuration
echo ""
echo "🌍 Configuring static website settings..."
cat > website-config.json << EOF
{
  "mainPageSuffix": "index.html",
  "notFoundPage": "404.html"
}
EOF

gsutil web set -m index.html -e 404.html gs://$BUCKET_NAME
rm website-config.json

# Enable CORS if needed (adjust as necessary)
echo ""
echo "🔧 Setting CORS configuration..."
cat > cors-config.json << EOF
[
  {
    "origin": ["https://medlegaldoc.com", "https://www.medlegaldoc.com", "http://localhost:5173"],
    "method": ["GET", "HEAD"],
    "responseHeader": ["Content-Type"],
    "maxAgeSeconds": 3600
  }
]
EOF

gsutil cors set cors-config.json gs://$BUCKET_NAME
rm cors-config.json

# Set cache control for better performance
echo ""
echo "⚡ Setting cache control defaults..."
gsutil setmeta -h "Cache-Control:public, max-age=3600" gs://$BUCKET_NAME/*.html 2>/dev/null || true
gsutil setmeta -h "Cache-Control:public, max-age=86400" gs://$BUCKET_NAME/*.css 2>/dev/null || true
gsutil setmeta -h "Cache-Control:public, max-age=86400" gs://$BUCKET_NAME/*.js 2>/dev/null || true
gsutil setmeta -h "Cache-Control:public, max-age=2592000" gs://$BUCKET_NAME/*.jpg 2>/dev/null || true
gsutil setmeta -h "Cache-Control:public, max-age=2592000" gs://$BUCKET_NAME/*.png 2>/dev/null || true
gsutil setmeta -h "Cache-Control:public, max-age=2592000" gs://$BUCKET_NAME/*.webp 2>/dev/null || true

echo ""
echo "✅ Bucket setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Upload your landing page files:"
echo "   gsutil -m cp -r ./landing-page/* gs://$BUCKET_NAME/"
echo ""
echo "2. Your website will be available at:"
echo "   https://storage.googleapis.com/$BUCKET_NAME/index.html"
echo ""
echo "3. To set up custom domain (medlegaldoc.com):"
echo "   - Add a CNAME record pointing www to c.storage.googleapis.com"
echo "   - Verify domain ownership in Google Search Console"
echo "   - Consider using Cloud CDN for better performance"
echo ""
echo "4. For HTTPS with custom domain, you'll need to:"
echo "   - Set up a Cloud Load Balancer with SSL certificate"
echo "   - Or use Cloudflare as a proxy (recommended)"