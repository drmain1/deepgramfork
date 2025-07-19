# Multi-Environment Deployment Strategy

## Overview

This document outlines the deployment strategy for managing multiple environments to ensure safe deployments and protect production users.

## Environment Structure

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│   Local     │────▶│  Staging    │────▶│  Production  │
│ Development │     │   (Cloud)   │     │   (Cloud)    │
└─────────────┘     └─────────────┘     └──────────────┘
```

## Environments

### 1. Local Development
- **Purpose**: Developer testing and debugging
- **URL**: http://localhost:8080
- **Database**: Local Firestore emulator or dev project
- **Deployment**: Manual via Docker

### 2. Staging Environment
- **Purpose**: Integration testing, QA, feature preview
- **URL**: https://medlegaldoc-backend-staging-[hash].a.run.app
- **Database**: Separate Firestore database (staging project or namespace)
- **Deployment**: Automatic on push to `develop` or `feature/*` branches
- **Access**: Restricted (requires authentication)

### 3. Production Environment
- **Purpose**: Live system for actual users
- **URL**: https://medlegaldoc-backend-[hash].a.run.app
- **Database**: Production Firestore
- **Deployment**: Automatic on push to `main` branch (after approval)
- **Access**: Restricted (requires authentication)

## Branch Strategy

```
main (production)
  └── develop (staging)
       └── feature/new-feature (staging)
```

- **main**: Production-ready code only
- **develop**: Integration branch for staging
- **feature/***: Individual feature branches

## Deployment Process

### 1. Feature Development
```bash
# Create feature branch
git checkout -b feature/audio-improvements

# Make changes and test locally
# Push to trigger staging deployment
git push origin feature/audio-improvements
```

### 2. Staging Testing
- Automatic deployment to staging
- Run integration tests
- QA verification
- Stakeholder review

### 3. Production Deployment
```bash
# After staging approval
git checkout develop
git merge feature/audio-improvements
git push origin develop

# After final testing
git checkout main
git merge develop
git push origin main  # Triggers production deployment
```

## Quick Setup Guide

### Step 1: Create Staging Service
```bash
# One-time setup
gcloud run deploy medlegaldoc-backend-staging \
  --image gcr.io/medlegaldoc-b31df/medlegaldoc-backend:latest \
  --region us-central1 \
  --platform managed \
  --memory 2Gi \
  --cpu 2 \
  --max-instances 5 \
  --service-account backend-service@medlegaldoc-b31df.iam.gserviceaccount.com \
  --set-env-vars ENVIRONMENT=staging \
  --no-allow-unauthenticated
```

### Step 2: Create Staging Database
Option A: Separate Firestore namespace
```javascript
// In your code, use namespace based on environment
const db = admin.firestore();
const collection = process.env.ENVIRONMENT === 'staging' 
  ? db.collection('staging_users') 
  : db.collection('users');
```

Option B: Separate GCP project (recommended for complete isolation)
```bash
# Create new project for staging
gcloud projects create medlegaldoc-staging
# Copy Firestore rules and data
```

### Step 3: Environment Variables

#### Staging
```bash
ENVIRONMENT=staging
FIREBASE_PROJECT_ID=medlegaldoc-b31df  # or separate staging project
API_BASE_URL=https://medlegaldoc-backend-staging-[hash].a.run.app
ENABLE_DEBUG_LOGGING=true
```

#### Production
```bash
ENVIRONMENT=production
FIREBASE_PROJECT_ID=medlegaldoc-b31df
API_BASE_URL=https://medlegaldoc-backend-[hash].a.run.app
ENABLE_DEBUG_LOGGING=false
```

## Testing Strategy

### Staging Tests
1. **Smoke Tests**: Basic health checks
2. **Integration Tests**: Full user workflows
3. **Load Tests**: Performance validation
4. **Security Tests**: HIPAA compliance verification

### Production Tests
1. **Canary Deployment**: Deploy to small % of traffic first
2. **Health Monitoring**: Real-time alerts
3. **Rollback Plan**: Quick reversion if issues

## Rollback Procedures

### Quick Rollback
```bash
# List recent revisions
gcloud run revisions list --service medlegaldoc-backend --region us-central1

# Rollback to previous revision
gcloud run services update-traffic medlegaldoc-backend \
  --region us-central1 \
  --to-revisions [PREVIOUS-REVISION]=100
```

### Emergency Procedures
1. **Immediate**: Route traffic to previous revision
2. **Investigation**: Check logs and metrics
3. **Fix**: Deploy hotfix through staging first
4. **Post-mortem**: Document issue and prevention

## Monitoring

### Key Metrics
- Response times
- Error rates
- CPU/Memory usage
- Active users
- WebSocket connections

### Alerts
```yaml
# Example Cloud Monitoring alert
- name: high-error-rate
  condition: error_rate > 5%
  duration: 5 minutes
  notification: pagerduty, email
```

## Best Practices

### DO:
- ✅ Always test in staging first
- ✅ Use feature flags for gradual rollouts
- ✅ Monitor deployments for 30 minutes
- ✅ Have rollback plan ready
- ✅ Document all changes

### DON'T:
- ❌ Deploy directly to production
- ❌ Skip staging for "small" changes
- ❌ Deploy on Fridays (unless critical)
- ❌ Ignore monitoring alerts
- ❌ Share staging URLs publicly

## Migration Path (This Week)

Since you're onboarding users this week:

### Day 1-2: Set Up Staging
1. Create staging Cloud Run service
2. Update CI/CD workflows
3. Test deployment pipeline

### Day 3-4: Test Critical Features
1. Audio recording/transcription
2. User authentication
3. PDF generation
4. Data persistence

### Day 5: Production Prep
1. Final staging verification
2. Update documentation
3. Prepare rollback procedures
4. Schedule deployment window

### Onboarding Week:
1. Deploy stable version to production
2. Feature freeze (no new features)
3. Monitor closely
4. Quick fixes through staging->production

## Future Enhancements

### Phase 2 (Month 2)
- Blue/Green deployments
- Automated rollbacks
- Feature flags system
- A/B testing capability

### Phase 3 (Month 3)
- Multi-region deployment
- Database replication
- CDN integration
- Advanced monitoring

## Commands Reference

```bash
# Deploy to staging
git push origin develop

# Deploy to production
git push origin main

# Manual deployment to staging
gcloud run deploy medlegaldoc-backend-staging \
  --image gcr.io/medlegaldoc-b31df/medlegaldoc-backend:staging-latest

# Check service status
gcloud run services describe medlegaldoc-backend-staging --region us-central1

# View logs
gcloud logs read --service medlegaldoc-backend-staging --limit 50

# Rollback production
gcloud run services update-traffic medlegaldoc-backend \
  --to-revisions [REVISION]=100
```