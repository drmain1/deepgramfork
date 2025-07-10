#!/bin/bash

# Deployment script for scribe.medlegaldoc.com
# This script deploys both frontend and backend to Google Cloud Platform

set -e  # Exit on any error

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID="medlegaldoc-b31df"
REGION="us-central1"
FRONTEND_BUCKET="scribe.medlegaldoc.com"
BACKEND_SERVICE="scribe-api"

echo -e "${GREEN}Starting deployment for scribe.medlegaldoc.com${NC}"
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}Error: gcloud CLI is not installed${NC}"
    exit 1
fi

# Set the project
echo -e "${YELLOW}Setting GCP project...${NC}"
gcloud config set project $PROJECT_ID

# Deploy Backend
echo -e "${GREEN}Deploying backend to App Engine...${NC}"
cd backend

# Ensure requirements are up to date
pip install -r requirements.txt

# Deploy to App Engine
gcloud app deploy app.yaml \
    --quiet \
    --promote \
    --version=$(date +%Y%m%d-%H%M%S)

echo -e "${GREEN}Backend deployment complete!${NC}"

# Get the backend URL
BACKEND_URL=$(gcloud app browse --no-launch-browser 2>&1 | grep -o 'https://[^ ]*')
echo "Backend URL: $BACKEND_URL"

# Deploy Frontend
echo -e "${GREEN}Building frontend...${NC}"
cd ../my-vite-react-app

# Install dependencies
npm install

# Build with production environment
npm run build

echo -e "${GREEN}Deploying frontend to Cloud Storage...${NC}"

# Create bucket if it doesn't exist
if ! gsutil ls -b gs://$FRONTEND_BUCKET &> /dev/null; then
    echo "Creating bucket gs://$FRONTEND_BUCKET..."
    gsutil mb -p $PROJECT_ID -c STANDARD -l $REGION gs://$FRONTEND_BUCKET
fi

# Enable website configuration
gsutil web set -m index.html -e 404.html gs://$FRONTEND_BUCKET

# Deploy files to bucket
gsutil -m rsync -r -d dist/ gs://$FRONTEND_BUCKET/

# Set proper cache headers
gsutil -m setmeta -h "Cache-Control:public, max-age=3600" gs://$FRONTEND_BUCKET/**.js
gsutil -m setmeta -h "Cache-Control:public, max-age=3600" gs://$FRONTEND_BUCKET/**.css
gsutil -m setmeta -h "Cache-Control:public, max-age=31536000" gs://$FRONTEND_BUCKET/assets/**
gsutil -m setmeta -h "Cache-Control:no-cache" gs://$FRONTEND_BUCKET/index.html

# Make bucket publicly readable
gsutil iam ch allUsers:objectViewer gs://$FRONTEND_BUCKET

echo -e "${GREEN}Frontend deployment complete!${NC}"

# Set up load balancer (if not already configured)
echo -e "${YELLOW}Load balancer setup instructions:${NC}"
echo "1. Create a load balancer with the following backends:"
echo "   - Frontend: Cloud Storage bucket gs://$FRONTEND_BUCKET"
echo "   - Backend API: App Engine service at path /api/*"
echo "2. Configure SSL certificate for scribe.medlegaldoc.com"
echo "3. Set up Cloud Armor for DDoS protection"
echo "4. Configure Identity-Aware Proxy for additional security"

# Post-deployment tasks
echo -e "${GREEN}Post-deployment tasks:${NC}"
echo "1. Update DNS records to point to load balancer IP"
echo "2. Update Secret Manager with production API keys:"
echo "   - gcloud secrets versions add deepgram-api-key --data-file=-"
# echo "   - gcloud secrets versions add speechmatics-api-key --data-file=-"  # removed
echo "3. Test the application at https://scribe.medlegaldoc.com"
echo "4. Monitor logs:"
echo "   - gcloud app logs tail -s default"
echo "   - gcloud logging tail"

echo -e "${GREEN}Deployment script completed!${NC}"