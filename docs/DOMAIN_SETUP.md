# Domain Setup Guide for scribe.medlegaldoc.com

## Current Status
- Domain: medlegaldoc.com (on AWS Route 53)
- Reserved GCP Static IP: 34.110.238.208
- Subdomain: scribe.medlegaldoc.com (to be configured)

## Quick Setup (Keep DNS on Route 53)

### 1. Add A Record in Route 53
1. Log into AWS Console → Route 53
2. Find hosted zone for `medlegaldoc.com`
3. Create new record:
   - Record name: `scribe`
   - Record type: `A`
   - Value: `34.110.238.208`
   - TTL: 300

### 2. SSL Certificate Setup

For HTTPS, you'll need an SSL certificate. Options:

#### Option A: Google-managed SSL (Recommended)
```bash
# For Cloud Run
gcloud beta run domain-mappings create \
  --service [YOUR-SERVICE] \
  --domain scribe.medlegaldoc.com \
  --region us-central1

# For Load Balancer
gcloud compute ssl-certificates create scribe-medlegaldoc-cert \
  --domains=scribe.medlegaldoc.com \
  --global
```

#### Option B: Let's Encrypt
Use certbot for free SSL certificates

### 3. Deployment Options

#### Cloud Run (Recommended for your FastAPI backend)
```bash
# Build and push your container
docker build -t gcr.io/healthcare-forms-prod/medlegaldoc-backend .
docker push gcr.io/healthcare-forms-prod/medlegaldoc-backend

# Deploy
gcloud run deploy medlegaldoc-backend \
  --image gcr.io/healthcare-forms-prod/medlegaldoc-backend \
  --port 8000 \
  --region us-central1 \
  --allow-unauthenticated \
  --max-instances 10
```

#### App Engine
```bash
# In your backend directory
gcloud app deploy
```

### 4. Frontend Deployment

For your React app, consider:
- Cloud Storage + CDN for static hosting
- Or include in Cloud Run container

## Testing

After DNS propagation (5-10 minutes):
```bash
# Test DNS resolution
nslookup scribe.medlegaldoc.com

# Test with curl
curl -I https://scribe.medlegaldoc.com
```

## Migration Timeline

1. **Now**: Reserve IP ✓
2. **Next**: Add DNS record in Route 53
3. **Before Go-Live**: 
   - Deploy application to GCP
   - Configure SSL certificate
   - Update frontend API URLs
   - Test thoroughly
4. **Go-Live Day**:
   - Deploy production version
   - Monitor logs
   - Have rollback plan ready

## Important Considerations

1. **CORS**: Update backend CORS settings to include `https://scribe.medlegaldoc.com`
2. **Environment Variables**: Update `VITE_API_URL` in frontend
3. **Firebase**: Add domain to authorized domains
4. **Monitoring**: Set up uptime checks in GCP

## Future Option: Migrate to Cloud DNS

If you want everything on GCP later:
```bash
# Export Route 53 zone file
# Import to Cloud DNS
gcloud dns managed-zones create medlegaldoc-zone \
  --dns-name="medlegaldoc.com." \
  --description="medlegaldoc.com DNS zone"
```

Then update name servers at your domain registrar.