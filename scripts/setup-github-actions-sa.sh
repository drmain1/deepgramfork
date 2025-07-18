#!/bin/bash

# Script to create GitHub Actions service account with proper permissions

PROJECT_ID="medlegaldoc-b31df"
SERVICE_ACCOUNT_NAME="github-actions-cicd"
SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
KEY_FILE="github-actions-key.json"

echo "🔧 Setting up GitHub Actions service account for project: $PROJECT_ID"

# Set the project
gcloud config set project $PROJECT_ID

# Create the service account
echo "📝 Creating service account..."
gcloud iam service-accounts create $SERVICE_ACCOUNT_NAME \
    --display-name="GitHub Actions CI/CD" \
    --description="Service account for GitHub Actions automated deployments" \
    2>/dev/null || echo "Service account may already exist"

# Wait a moment for propagation
sleep 2

# Grant necessary roles
echo "🔐 Granting necessary permissions..."

# Cloud Run Admin (to deploy services)
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
    --role="roles/run.admin" \
    --quiet

# Service Account User (to act as service account)
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
    --role="roles/iam.serviceAccountUser" \
    --quiet

# Storage Admin (for Container Registry)
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
    --role="roles/storage.admin" \
    --quiet

# Container Registry Service Agent
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
    --role="roles/containerregistry.ServiceAgent" \
    --quiet

# Cloud Build Editor (if using Cloud Build)
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
    --role="roles/cloudbuild.builds.editor" \
    --quiet

echo "✅ Permissions granted"

# Create service account key
echo "🔑 Creating service account key..."
gcloud iam service-accounts keys create $KEY_FILE \
    --iam-account=$SERVICE_ACCOUNT_EMAIL

if [ -f "$KEY_FILE" ]; then
    echo ""
    echo "✅ Service account key created successfully!"
    echo ""
    echo "📋 Copy the following JSON and add it as GitHub secret 'GCP_SA_KEY':"
    echo "=================================================="
    cat $KEY_FILE
    echo "=================================================="
    echo ""
    echo "🔒 Security reminder:"
    echo "1. Add this as a GitHub secret named 'GCP_SA_KEY'"
    echo "2. Delete the local key file after copying: rm $KEY_FILE"
    echo "3. Never commit this key to your repository"
else
    echo "❌ Failed to create service account key"
    exit 1
fi

# List current service account keys
echo ""
echo "📋 Current keys for this service account:"
gcloud iam service-accounts keys list --iam-account=$SERVICE_ACCOUNT_EMAIL