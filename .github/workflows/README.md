# CI/CD Pipeline Documentation

## Overview

This repository uses GitHub Actions for automated CI/CD pipeline with HIPAA-compliant security scanning and deployment to Google Cloud Platform (GCP) Cloud Run.

## Pipeline Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Security Scan   │    │ Build & Test     │    │ Deploy to GCP   │
│ with Trivy      │───▶│ with Chainguard  │───▶│ Cloud Run       │
│                 │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ SARIF Upload    │    │ Container Tests  │    │ Health Checks   │
│ to GitHub       │    │ & Compliance     │    │ & Cleanup       │
│ Security        │    │ Verification     │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Workflows

### 1. Main Deployment Pipeline: `deploy-to-gcp.yml`

**Triggers:**
- Push to `main` or `gcp-migration` branches
- Pull requests to `main` or `gcp-migration` branches
- Manual trigger via workflow dispatch

**Jobs:**

#### Security Scan with Trivy
- **Purpose**: Vulnerability scanning of source code and dependencies
- **Tools**: Trivy scanner, SARIF upload to GitHub Security
- **HIPAA Compliance**: Scans for CRITICAL and HIGH severity vulnerabilities
- **Permissions**: `contents: read`, `security-events: write`

#### Build and Test with Chainguard
- **Purpose**: Build Docker image using HIPAA-compliant Chainguard base images
- **Requirements**: 
  - Verifies `Dockerfile.chainguard` uses Chainguard Wolfi base
  - Builds with `cgr.dev/chainguard/wolfi-base:latest`
  - Runs security scan on built image
  - Performs container health checks
- **Test Mode**: Uses environment variables to disable GCP during testing:
  - `TESTING=true`
  - `DISABLE_GCP=true`
  - `GOOGLE_APPLICATION_CREDENTIALS=""`

#### Deploy to GCP Cloud Run
- **Purpose**: Deploy to Google Cloud Run service
- **Requirements**: 
  - Only runs on push events (not PRs)
  - Requires `GCP_SA_KEY` secret
- **Steps**:
  1. Authenticate with GCP using service account
  2. Build production image with metadata labels
  3. Push to Google Container Registry (GCR)
  4. Deploy to Cloud Run with specific configuration
  5. Run post-deployment health checks
  6. Create deployment audit record

#### Cleanup Old Images
- **Purpose**: Maintain container registry hygiene
- **Action**: Keeps only the last 5 images for rollback capability

### 2. Pull Request Checks: `pr-checks.yml`

**Triggers:**
- Pull request events (opened, synchronize, reopened)
- Only for changes in `backend/`, `my-vite-react-app/`, or `.github/workflows/`

**Jobs:**

#### Backend Code Quality & Security
- Python formatting (Black)
- Linting (Flake8)
- Security scanning (Bandit)
- Hardcoded secrets detection
- Chainguard usage verification

#### Frontend Code Quality
- ESLint checks
- Build verification
- Console.log detection

#### Docker Build Test
- Test Chainguard Docker build without deployment

#### Security Vulnerability Scan
- Trivy filesystem scan
- Python dependency vulnerability check (Safety)

#### HIPAA Compliance Check
- PHI pattern detection
- Security middleware verification
- Audit logging verification

#### PR Summary Report
- Automated comment with check results
- Visual status indicators

## Configuration

### Environment Variables

#### Production (Cloud Run)
```bash
PORT=8080
ENVIRONMENT=production
BUILD_SHA=${GITHUB_SHA}
BUILD_DATE=${BUILD_DATE}
WEBSOCKET_INACTIVITY_ENABLED=true
WEBSOCKET_INACTIVITY_WARNING=8
WEBSOCKET_INACTIVITY_TIMEOUT=15
```

#### CI/CD Testing
```bash
PORT=8080
TESTING=true
DISABLE_GCP=true
GOOGLE_APPLICATION_CREDENTIALS=""
```

### GitHub Secrets Required

#### `GCP_SA_KEY`
Service account JSON key with permissions:
- `roles/run.admin` - Deploy Cloud Run services
- `roles/iam.serviceAccountUser` - Act as service account
- `roles/storage.admin` - Push to Container Registry
- `roles/containerregistry.ServiceAgent` - Container Registry access
- `roles/cloudbuild.builds.editor` - Cloud Build (if used)

**To create:**
```bash
# Run the setup script
./scripts/setup-github-actions-sa.sh

# Or manually:
gcloud iam service-accounts create github-actions-cicd \
  --display-name="GitHub Actions CI/CD" \
  --project=medlegaldoc-b31df

gcloud iam service-accounts keys create github-actions-key.json \
  --iam-account=github-actions-cicd@medlegaldoc-b31df.iam.gserviceaccount.com

# Add to GitHub: Settings → Secrets and variables → Actions → New repository secret
# Name: GCP_SA_KEY
# Value: [entire JSON content]
```

### GCP Configuration

#### Project Settings
- **Project ID**: `medlegaldoc-b31df`
- **Region**: `us-central1`
- **Service Name**: `medlegaldoc-backend`
- **Container Registry**: `gcr.io/medlegaldoc-b31df`

#### Cloud Run Configuration
- **Memory**: 2Gi
- **CPU**: 2
- **Timeout**: 300s
- **Max Instances**: 10
- **Min Instances**: 1
- **Concurrency**: 80
- **Port**: 8080

## Security & HIPAA Compliance

### Container Security
- **Base Images**: Chainguard Wolfi (minimal, secure, regularly updated)
- **Non-root User**: All containers run as `nonroot` user
- **Vulnerability Scanning**: Trivy scans for CRITICAL/HIGH CVEs
- **Image Signing**: OCI labels with build metadata

### Access Controls
- **Service Account**: Minimal required permissions
- **IAM**: Principle of least privilege
- **Secrets**: GitHub Secrets for sensitive data
- **Network**: Cloud Run with IAM-based access control

### Audit & Compliance
- **Deployment Records**: JSON audit logs for each deployment
- **Build Metadata**: SHA, timestamp, and source tracking
- **Health Monitoring**: Automated health checks
- **Retention**: Image cleanup with rollback capability

## Troubleshooting

### Common Issues

#### 1. Security Scan Failures
```
Error: Resource not accessible by integration
```
**Solution**: Enable GitHub Advanced Security or add `continue-on-error: true`

#### 2. Container Health Check Failures
```
curl: (7) Failed to connect to localhost:8080
```
**Solutions**:
- Verify health endpoints exist (`/health`, `/api/pdf-service-health`)
- Check startup time (increase sleep/timeout values)
- Review container logs for application errors
- Ensure test mode properly disables GCP dependencies

#### 3. GCP Authentication Errors
```
Error: google-github-actions/auth failed
```
**Solutions**:
- Verify `GCP_SA_KEY` secret exists and is valid JSON
- Check service account has required permissions
- Ensure project ID matches in workflow and service account

#### 4. Image Build Failures
```
ERROR: Dockerfile.chainguard must use Chainguard base image
```
**Solution**: Ensure Dockerfile uses `FROM cgr.dev/chainguard/wolfi-base:latest`

#### 5. Deployment Failures
```
Cloud Run deployment failed
```
**Solutions**:
- Check Cloud Run service limits and quotas
- Verify container image was pushed successfully
- Review Cloud Run logs for application startup errors
- Confirm environment variables are set correctly

### Debug Commands

#### Local Testing
```bash
# Test container locally
docker build -f Dockerfile.chainguard -t test-app .
docker run -p 8080:8080 -e TESTING=true -e DISABLE_GCP=true test-app

# Test health endpoints
curl http://localhost:8080/health
curl http://localhost:8080/api/pdf-service-health
```

#### GitHub Actions Debugging
```bash
# Re-run failed workflow
gh run rerun <run-id>

# View workflow logs
gh run view <run-id> --log

# List workflow runs
gh run list --workflow=deploy-to-gcp.yml
```

#### GCP Debugging
```bash
# Check Cloud Run service
gcloud run services describe medlegaldoc-backend --region=us-central1

# View Cloud Run logs
gcloud logs read "resource.type=cloud_run_revision AND resource.labels.service_name=medlegaldoc-backend" --limit=50

# List container images
gcloud container images list --repository=gcr.io/medlegaldoc-b31df

# Check service account permissions
gcloud projects get-iam-policy medlegaldoc-b31df \
  --filter="bindings.members:serviceAccount:github-actions-cicd@medlegaldoc-b31df.iam.gserviceaccount.com"
```

## Best Practices

### Development Workflow
1. **Feature Branch**: Create feature branch from `main`
2. **PR Creation**: Opens automated PR checks
3. **Review**: Code review with security/compliance checks
4. **Merge**: Merge to `main` triggers deployment
5. **Monitor**: Check deployment status and health

### Security
- Never commit service account keys
- Rotate secrets every 90 days
- Review security scan results
- Monitor for PHI exposure
- Use HIPAA-compliant base images only

### Performance
- Optimize Docker layers for faster builds
- Use build caching where possible
- Monitor Cloud Run cold starts
- Set appropriate resource limits

## Monitoring & Alerts

### Health Checks
- **Container Health**: Docker HEALTHCHECK directive
- **Application Health**: `/health` endpoint
- **Service Health**: `/api/pdf-service-health` endpoint
- **Post-deployment**: Automated verification

### Metrics to Monitor
- Build success/failure rates
- Deployment frequency
- Security scan results
- Container startup times
- Health check response times

## Support

For issues with the CI/CD pipeline:
1. Check the troubleshooting section above
2. Review GitHub Actions logs
3. Verify GCP service status
4. Check service account permissions
5. Review Cloud Run service configuration

For urgent issues:
- Cloud Console: https://console.cloud.google.com
- GitHub Actions: Repository → Actions tab
- Cloud Run logs: GCP Console → Cloud Run → Service logs