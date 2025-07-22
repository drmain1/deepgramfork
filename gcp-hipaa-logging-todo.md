# GCP HIPAA Logging Compliance To-Do List

This checklist will guide you through enabling the necessary logs, ensuring they are stored for the required duration, and securing them appropriately.

## Current Status Summary (Last Updated: 2025-07-20)

| Task | Status | Notes |
|------|--------|-------|
| Task 1: Enable Data Access Audit Logs | ✅ Complete | Enabled for Datastore, Storage, and Cloud Run |
| Task 2: Create Secure Log Storage Bucket | ✅ Complete | Created `gs://medlegaldoc-hipaa-audit-logs` |
| Task 3: Configure Log Sink | ✅ Complete | Sink `hipaa-master-audit-sink` configured |
| Task 4: Set & Lock Retention Policy | 🟡 Partial | 6-year policy SET, locking pending |
| Task 5: Restrict Access to Logs | ✅ Complete | Owner-only access, instructions for future |

## ⚠️ IMPORTANT WARNING
The command `gcloud projects add-iam-policy-binding medlegaldoc-b31df --member="allUsers" --role="roles/logging.viewer"` would make your logs publicly viewable, which is a major security risk and a direct violation of HIPAA. DO NOT use this command.

## ✅ Task 1: Enable Data Access Audit Logs for Critical Services

**Status:** Complete ✅ (Completed 2025-07-20)  
**Goal:** To record every time someone accesses sensitive data (Protected Health Information - PHI) in Firestore, Cloud Storage, and Cloud Run. This is a primary requirement for HIPAA audits.

**Action:** You need to enable Data Access audit logs for each critical service. This cannot be done with a single command.

1. Get your project's current IAM policy and save it to a file. This ensures you don't accidentally overwrite other important settings.
   ```bash
   gcloud projects get-iam-policy medlegaldoc-b31df --format=json > /tmp/iam_policy.json
   ```

2. Edit the `/tmp/iam_policy.json` file to include audit configurations for the required services. Find the `auditConfigs` section (or add it if it doesn't exist) and modify it to look like this:
   ```json
   "auditConfigs": [
     {
       "service": "firestore.googleapis.com",
       "auditLogConfigs": [
         { "logType": "ADMIN_READ" },
         { "logType": "DATA_READ" },
         { "logType": "DATA_WRITE" }
       ]
     },
     {
       "service": "storage.googleapis.com",
       "auditLogConfigs": [
         { "logType": "ADMIN_READ" },
         { "logType": "DATA_READ" },
         { "logType": "DATA_WRITE" }
       ]
     },
     {
       "service": "run.googleapis.com",
       "auditLogConfigs": [
         { "logType": "ADMIN_READ" },
         { "logType": "DATA_READ" },
         { "logType": "DATA_WRITE" }
       ]
     }
   ]
   ```

3. Apply the updated IAM policy to your project.
   ```bash
   gcloud projects set-iam-policy medlegaldoc-b31df /tmp/iam_policy.json
   ```

## ✅ Task 2: Create a Secure, Long-Term Log Storage Bucket

**Status:** Complete ✅ (Completed 2025-07-20)  
**Goal:** HIPAA requires logs to be retained for a minimum of six years. You need a secure Cloud Storage bucket to archive these logs.

**Action:**
1. Create a dedicated Cloud Storage bucket for your logs. Choose a descriptive name.
   ```bash
   gsutil mb -p medlegaldoc-b31df -l US-CENTRAL1 gs://medlegaldoc-hipaa-audit-logs
   ```

## ✅ Task 3: Configure a Log Sink for Archiving

**Status:** Complete ✅ (Completed 2025-07-20)  
**Goal:** Automatically export your audit logs from Cloud Logging to your new long-term storage bucket.

**Action:**
1. Create a log sink that filters for all audit logs and sends them to your bucket.
   ```bash
   gcloud logging sinks create hipaa-master-audit-sink \
     storage.googleapis.com/medlegaldoc-hipaa-audit-logs \
     --log-filter='logName:"cloudaudit.googleapis.com"' \
     --description="Master sink for all HIPAA audit logs" \
     --project=medlegaldoc-b31df
   ```

2. Grant the sink's service account permission to write to the bucket.
   
   First, get the sink's writer identity:
   ```bash
   gcloud logging sinks describe hipaa-master-audit-sink --project=medlegaldoc-b31df --format='value(writerIdentity)'
   ```
   
   Copy the `serviceAccount:` email address from the output.
   
   Grant it the Storage Object Creator role:
   ```bash
   gsutil iam ch <WRITER_IDENTITY_FROM_PREVIOUS_COMMAND>:objectCreator gs://medlegaldoc-hipaa-audit-logs
   ```

## ✅ Task 4: Set and Lock Log Retention Policy

**Status:** Partially Complete 🟡 (Retention set, locking pending)  
**Goal:** Enforce the six-year retention period on your log archive bucket to meet HIPAA requirements.

**Action:**
1. Set a retention policy of six years (2190 days) on the bucket.
   ```bash
   gsutil retention set 2190d gs://medlegaldoc-hipaa-audit-logs
   ```

2. Lock the retention policy. **This is an irreversible action.** It provides a strong guarantee for compliance that the logs cannot be deleted prematurely.
   ```bash
   gsutil retention lock gs://medlegaldoc-hipaa-audit-logs
   ```
   You will have to confirm this action in the CLI.
   
   **⚠️ IMPORTANT: Retention policy has been SET but NOT LOCKED yet. The locking step is pending user confirmation due to its irreversible nature.**

## ✅ Task 5: Restrict Access to Logs

**Status:** Complete ✅ (Completed 2025-07-20)  
**Goal:** Ensure that only authorized personnel can view sensitive audit logs, following the principle of least privilege.

**Current Configuration:**
- Only the project owner (DTMain@gmail.com) has access to view logs
- No additional logging viewer roles have been granted
- This follows the principle of least privilege

**Future Action Required - When Adding Security Officer:**
When you hire or designate a security officer who needs access to HIPAA audit logs, grant them the `roles/logging.privateLogsViewer` role:

```bash
# Replace 'security-officer@example.com' with the actual email
gcloud projects add-iam-policy-binding medlegaldoc-b31df \
  --member="user:security-officer@example.com" \
  --role="roles/logging.privateLogsViewer"
```

**Important Notes:**
- The `roles/logging.privateLogsViewer` role is specifically designed for viewing logs that may contain sensitive data
- Only grant this role to users who have a legitimate need to review audit logs for compliance
- Regularly review who has access using:
  ```bash
  gcloud projects get-iam-policy medlegaldoc-b31df --flatten="bindings[].members" --format="table(bindings.role,bindings.members)" | grep logging
  ```

**Verification completed:** No overly permissive roles like `allUsers` or `allAuthenticatedUsers` have been granted.

By completing this to-do list, you will have a robust logging setup that aligns with HIPAA's security and audit control requirements.

## 🎯 Next Steps & Important Reminders

### Immediate Action Required:
1. **Lock the retention policy** when you're ready to make it permanent:
   ```bash
   gsutil retention lock gs://medlegaldoc-hipaa-audit-logs
   ```
   ⚠️ Remember: This is IRREVERSIBLE!

### Ongoing Maintenance:
1. **Monitor log storage costs** - Audit logs can accumulate quickly
2. **Regularly verify logs are being written** to your bucket:
   ```bash
   gsutil ls -r gs://medlegaldoc-hipaa-audit-logs | head -20
   ```
3. **Review access permissions quarterly** to ensure least privilege
4. **Test log retrieval** periodically to ensure you can access logs when needed

### When Adding Team Members:
1. Grant `roles/logging.privateLogsViewer` only to those who need audit log access
2. Document who has access and why
3. Review and revoke access when roles change

### For Full HIPAA Compliance:
- This logging setup is just one component of HIPAA compliance
- Ensure you also have:
  - Encryption at rest and in transit
  - Access controls on all PHI data
  - Business Associate Agreements (BAAs) with Google Cloud
  - Incident response procedures
  - Regular security assessments