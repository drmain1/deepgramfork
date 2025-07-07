# Cloudflare SSL Setup for scribe.medlegaldoc.com

## Quick Setup (15 minutes)

### 1. Create Cloudflare Account
- Go to https://cloudflare.com
- Sign up for free account

### 2. Add Your Domain
- Click "Add a Site" 
- Enter: `medlegaldoc.com`
- Select FREE plan

### 3. Update Nameservers
Cloudflare will show you 2 nameservers like:
- `alex.ns.cloudflare.com`
- `nina.ns.cloudflare.com`

Update these at your domain registrar (where you bought the domain)

### 4. Configure DNS in Cloudflare
Once nameservers propagate (5-60 minutes), in Cloudflare:

| Type | Name | Content | Proxy Status |
|------|------|---------|--------------|
| A | scribe | 34.110.238.208 | Proxied (orange cloud ON) |
| A | @ | [your main site IP or parking page] | Proxied |

### 5. SSL Settings
In Cloudflare dashboard:
- Go to SSL/TLS
- Set encryption mode to "Full (strict)" if you have backend SSL, or "Flexible" if not
- Edge Certificates are automatic and free

### 6. Page Rules (Optional)
Create a page rule for:
- URL: `*medlegaldoc.com/*`
- Setting: Always Use HTTPS

## Benefits You Get

1. **Free SSL Certificate** - Auto-renewed
2. **Global CDN** - Faster loading worldwide
3. **DDoS Protection** - Built-in
4. **Caching** - Reduce backend load
5. **Analytics** - See traffic patterns
6. **No GCP Project Confusion** - Works with any backend

## Backend Changes Needed

Since Cloudflare will proxy requests, update your backend:

```python
# In main.py, add Cloudflare's IPs to trusted hosts
from fastapi.middleware.trustedhost import TrustedHostMiddleware

app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["scribe.medlegaldoc.com", "*.medlegaldoc.com", "localhost"]
)
```

## Testing

After setup:
```bash
# Test HTTPS
curl -I https://scribe.medlegaldoc.com

# Should see:
# HTTP/2 200
# cf-ray: [cloudflare ray id]
```

## Alternative: Keep Route 53 + Use Cloudflare SSL Only

If you want to keep Route 53 DNS:
1. In Cloudflare, click your domain
2. Go to SSL/TLS > Origin Server
3. Create Origin Certificate (15 years free)
4. Install this certificate on your backend
5. Keep DNS at Route 53, just use Cloudflare's origin cert

This gives you SSL without changing nameservers!