# CI/CD Pipeline Documentation

## Overview

This repository uses GitHub Actions for automated CI/CD with a focus on HIPAA compliance and security. All Docker images are built using **Chainguard Wolfi** base images for enhanced security.

## Workflows

### 1. Deploy to GCP Cloud Run (`deploy-to-gcp.yml`)

**Triggers:**
- Push to `main` or `gcp-migration` branches
- Manual trigger via GitHub UI

**What it does:**
1. **Security Scan** - Scans code with Trivy for vulnerabilities
2. **Build & Test** - Builds Docker image with Chainguard base and runs tests
3. **Deploy** - Pushes to GCP Container Registry and deploys to Cloud Run
4. **Cleanup** - Removes old images (keeps last 5 for rollback)

**Key features:**
- ✅ Uses Chainguard Wolfi base images (HIPAA compliant)
- ✅ Runs as non-root user
- ✅ Security vulnerability scanning
- ✅ Health checks before deployment
- ✅ Audit trail for deployments

### 2. Pull Request Checks (`pr-checks.yml`)

**Triggers:**
- Any pull request to `main` or `gcp-migration`

**What it does:**
1. **Backend checks** - Python linting, formatting, security checks
2. **Frontend checks** - ESLint, build verification
3. **Docker build test** - Ensures Dockerfile builds successfully
4. **Security scan** - Comprehensive vulnerability scanning
5. **HIPAA compliance** - Checks for PHI exposure, security headers

## Setup Instructions

### 1. Create GitHub Secrets

Go to Settings → Secrets and variables → Actions, then add:

```
GCP_SA_KEY - Your GCP service account JSON key
```

To create a service account key:
```bash
# Create service account
gcloud iam service-accounts create github-actions \
  --display-name="GitHub Actions CI/CD"

# Grant necessary permissions
gcloud projects add-iam-policy-binding medlegaldoc-b31df \
  --member="serviceAccount:github-actions@medlegaldoc-b31df.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding medlegaldoc-b31df \
  --member="serviceAccount:github-actions@medlegaldoc-b31df.iam.gserviceaccount.com" \
  --role="roles/storage.admin"

# Create and download key
gcloud iam service-accounts keys create github-actions-key.json \
  --iam-account=github-actions@medlegaldoc-b31df.iam.gserviceaccount.com

# Copy contents to GitHub secret GCP_SA_KEY
cat github-actions-key.json
```

### 2. Enable Required APIs

```bash
gcloud services enable \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  containerregistry.googleapis.com \
  secretmanager.googleapis.com
```

### 3. First Deployment

1. Push to `main` or `gcp-migration` branch
2. Monitor in Actions tab
3. Check deployment at: https://console.cloud.google.com/run

## Manual Deployment

To trigger manual deployment:
1. Go to Actions tab
2. Select "Deploy to GCP Cloud Run"
3. Click "Run workflow"
4. Select branch and environment

## Security Features

### Chainguard Wolfi Base
- Minimal attack surface
- Regular security updates
- HIPAA-compliant container runtime
- Non-root user by default

### Vulnerability Scanning
- Trivy scans on every build
- Blocks deployment if critical vulnerabilities found
- Results uploaded to GitHub Security tab

### Access Control
- Service account with minimal permissions
- No hardcoded secrets
- All sensitive data in GitHub Secrets

## Monitoring Deployments

### View logs:
```bash
gcloud run logs read --service medlegaldoc-backend --region us-central1
```

### Check service status:
```bash
gcloud run services describe medlegaldoc-backend --region us-central1
```

### Rollback if needed:
```bash
# List revisions
gcloud run revisions list --service medlegaldoc-backend --region us-central1

# Rollback to previous
gcloud run services update-traffic medlegaldoc-backend \
  --to-revisions=<previous-revision>=100 \
  --region us-central1
```

## Troubleshooting

### Build fails with "Chainguard base image not found"
- Ensure Dockerfile.chainguard uses: `FROM cgr.dev/chainguard/wolfi-base:latest`

### Deployment fails with permission errors
- Check service account has correct roles
- Verify GCP_SA_KEY secret is properly formatted JSON

### Container fails health checks
- Ensure PORT=8080 is set in environment
- Check /health endpoint returns 200 OK

## Cost Optimization

The pipeline includes:
- Image cleanup (keeps only last 5 versions)
- Minimum instances set to 1 (scales to 0 when idle)
- Efficient multi-stage Docker builds

## Local Testing

Test the Chainguard build locally:
```bash
cd backend
docker build -f Dockerfile.chainguard -t test-local .
docker run -p 8080:8080 -e PORT=8080 test-local
```

## Future Enhancements

- [ ] Add staging environment
- [ ] Implement blue/green deployments
- [ ] Add performance testing
- [ ] Set up monitoring alerts
- [ ] Add database migration automation