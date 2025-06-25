#!/bin/bash

# Simple deployment script for GCP App Engine (no containerization needed)

echo "🚀 Deploying medlegaldoc to GCP..."

# Backend deployment
echo "📦 Deploying backend to App Engine..."
cd backend

# Create app.yaml if it doesn't exist
if [ ! -f app.yaml ]; then
    echo "Creating app.yaml for backend..."
    cat > app.yaml << EOF
runtime: python39
entrypoint: gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app --bind :8080

automatic_scaling:
  target_cpu_utilization: 0.65
  min_instances: 1
  max_instances: 10

env_variables:
  USE_FIRESTORE: "true"
  # Other env vars will come from Secret Manager

handlers:
- url: /.*
  script: auto
  secure: always
EOF
fi

# Deploy backend
gcloud app deploy --quiet

cd ..

# Frontend deployment to Cloud Storage + CDN
echo "📦 Deploying frontend to Cloud Storage..."
cd my-vite-react-app

# Build the frontend
npm run build

# Create bucket if it doesn't exist
gsutil mb -p healthcare-forms-prod gs://scribe-medlegaldoc-frontend || true

# Upload files
gsutil -m rsync -r -d dist/ gs://scribe-medlegaldoc-frontend/

# Make bucket public
gsutil iam ch allUsers:objectViewer gs://scribe-medlegaldoc-frontend

# Set up load balancer with the static IP we reserved
echo "🔧 Setting up load balancer..."

# This part would need manual configuration in GCP Console for:
# 1. Backend service pointing to App Engine
# 2. Frontend bucket as a backend bucket
# 3. URL map to route /api/* to App Engine and /* to bucket
# 4. HTTPS load balancer using the static IP 34.110.238.208

echo "✅ Deployment complete!"
echo ""
echo "⚠️  Manual steps required:"
echo "1. Set up HTTPS load balancer in GCP Console"
echo "2. Configure SSL certificate for scribe.medlegaldoc.com"
echo "3. Update Firebase authorized domains"
echo "4. Set up Secret Manager for sensitive env variables"