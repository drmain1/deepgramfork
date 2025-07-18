# GitHub Secrets Setup Guide

## Adding the GCP Service Account Key

### Step-by-Step Instructions with Current GitHub UI (2024)

1. **Navigate to your repository on GitHub**
   - Go to: https://github.com/[your-username]/[your-repo-name]

2. **Access Settings**
   - Click on **Settings** tab (it's in the top menu bar of your repository)
   - Note: You need admin/owner permissions to see this tab

3. **Find Secrets in the sidebar**
   - In the left sidebar, scroll down to the **Security** section
   - Click on **Secrets and variables**
   - Then click on **Actions**

   The full path is: `Settings → Secrets and variables → Actions`

4. **Add New Repository Secret**
   - Click the green **New repository secret** button
   - You'll see two fields:
     - **Name**: Enter `GCP_SA_KEY` (must match exactly)
     - **Secret**: Paste your entire service account JSON

5. **Get your Service Account JSON**
   If you don't have it yet, create one:
   ```bash
   # Create service account
   gcloud iam service-accounts create github-actions \
     --display-name="GitHub Actions CI/CD" \
     --project=medlegaldoc-b31df

   # Grant necessary permissions
   gcloud projects add-iam-policy-binding medlegaldoc-b31df \
     --member="serviceAccount:github-actions@medlegaldoc-b31df.iam.gserviceaccount.com" \
     --role="roles/run.admin"

   gcloud projects add-iam-policy-binding medlegaldoc-b31df \
     --member="serviceAccount:github-actions@medlegaldoc-b31df.iam.gserviceaccount.com" \
     --role="roles/storage.admin"

   gcloud projects add-iam-policy-binding medlegaldoc-b31df \
     --member="serviceAccount:github-actions@medlegaldoc-b31df.iam.gserviceaccount.com" \
     --role="roles/artifactregistry.writer"

   # Create and download key
   gcloud iam service-accounts keys create ~/github-actions-key.json \
     --iam-account=github-actions@medlegaldoc-b31df.iam.gserviceaccount.com

   # Display the key to copy
   cat ~/github-actions-key.json
   ```

6. **Copy and Paste the JSON**
   - Copy the ENTIRE JSON output (including the curly braces)
   - It should look like:
   ```json
   {
     "type": "service_account",
     "project_id": "medlegaldoc-b31df",
     "private_key_id": "...",
     "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
     "client_email": "github-actions@medlegaldoc-b31df.iam.gserviceaccount.com",
     "client_id": "...",
     "auth_uri": "https://accounts.google.com/o/oauth2/auth",
     "token_uri": "https://oauth2.googleapis.com/token",
     "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
     "client_x509_cert_url": "..."
   }
   ```

7. **Save the Secret**
   - Click **Add secret**
   - You should see `GCP_SA_KEY` in your secrets list

## Verify It's Working

1. **Trigger a workflow run**:
   ```bash
   git commit --allow-empty -m "Test CI/CD pipeline"
   git push origin gcp-migration
   ```

2. **Check the Actions tab**
   - Go to the Actions tab in your repository
   - You should see the workflow running
   - If it fails with "Error: google-github-actions/auth failed with: the GitHub Action workflow must specify..."
   - This means the secret is not found or incorrectly named

## Troubleshooting

### Can't see Settings tab?
- You need admin permissions on the repository
- If it's an organization repo, check with the org admin

### Secret not working?
1. Verify the name is exactly `GCP_SA_KEY` (case sensitive)
2. Make sure you copied the ENTIRE JSON including `{` and `}`
3. Check there are no extra spaces or line breaks before/after the JSON

### Alternative: Repository Settings Direct Link
Try this direct link (replace with your repo):
```
https://github.com/[username]/[repo]/settings/secrets/actions
```

### Still having issues?
The secret might be added but the service account might lack permissions. Run:
```bash
# Check service account exists
gcloud iam service-accounts list --project=medlegaldoc-b31df

# Check its roles
gcloud projects get-iam-policy medlegaldoc-b31df \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:github-actions@medlegaldoc-b31df.iam.gserviceaccount.com" \
  --format="table(bindings.role)"
```

## Security Notes

- GitHub Secrets are encrypted and only exposed to workflows during runtime
- Never commit service account keys to your repository
- Rotate keys periodically (every 90 days recommended)
- Delete the local key file after adding to GitHub:
  ```bash
  rm ~/github-actions-key.json
  ```

## Using Organization Secrets (if applicable)

If this is an organization repository:
1. Organization owner goes to: `Organization Settings → Secrets and variables → Actions`
2. Can create organization-wide secrets
3. Choose which repositories can access each secret