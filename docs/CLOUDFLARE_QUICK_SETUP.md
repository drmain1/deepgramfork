# Cloudflare Quick Setup Guide

## Step 1: After Login
1. Click **"Add a Site"**
2. Enter: `medlegaldoc.com`
3. Click **Continue**

## Step 2: Select Plan
- Choose **FREE** plan ($0/month)
- Click **Continue**

## Step 3: DNS Records
Cloudflare will scan and import your existing Route 53 records. 

**Important**: Look for these and ensure they're set:
- `scribe.medlegaldoc.com` → A record → `34.110.238.208` → Proxy status: **Orange cloud ON**
- Any other existing records (MX, TXT, etc.) - keep them as is

## Step 4: Nameservers
Cloudflare will show you 2 nameservers. They'll look like:
```
something.ns.cloudflare.com
something-else.ns.cloudflare.com
```

### To Update Nameservers:

Since your domain is at AWS Route 53, let's check the registrar:

```bash
# Check where domain is registered
aws route53domains get-domain-detail --domain-name medlegaldoc.com
```

You'll need to update nameservers at your domain registrar (not Route 53 unless Route 53 is also your registrar).

## Step 5: Quick Settings (After NS Propagation)

### SSL/TLS Settings:
1. Go to **SSL/TLS** → **Overview**
2. Set to **Flexible** (for now)

### Speed Settings:
1. Go to **Speed** → **Optimization**
2. Enable **Auto Minify** for JS, CSS, HTML
3. Enable **Brotli** compression

### Security Settings:
1. Go to **Security** → **Settings**
2. Security Level: **Medium**
3. Challenge Passage: **30 minutes**

## Step 6: Create Page Rule
1. Go to **Rules** → **Page Rules**
2. Create rule:
   - URL: `*medlegaldoc.com/*`
   - Setting: **Always Use HTTPS**
3. Save and Deploy

## What Happens Next:

1. **Immediately**: Your site gets Cloudflare's shared SSL certificate
2. **5-10 minutes**: DNS starts propagating
3. **Up to 24 hours**: Full propagation (usually much faster)

## To Test:
```bash
# Check if using Cloudflare
curl -I https://scribe.medlegaldoc.com

# Look for headers like:
# cf-ray: xxxxx
# server: cloudflare
```

## Backend Update Needed:

Add to your allowed origins in `backend/main.py`:
```python
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173", 
    "https://scribe.medlegaldoc.com",
    "https://medlegaldoc.com",
    "https://www.medlegaldoc.com",  # Add this too
]
```

Let me know once you've:
1. Added the site to Cloudflare
2. Seen the nameservers they want you to use

I'll help you update them via AWS CLI!