#!/bin/bash

# Script to set up Cloud Monitoring alerts for HIPAA compliance
# Run this script with: bash setup_monitoring_alerts.sh

PROJECT_ID="medlegaldoc-b31df"
NOTIFICATION_EMAIL="dtmain@gmail.com"  # Update this with your email

echo "Setting up Cloud Monitoring alerts for project: $PROJECT_ID"

# Create a notification channel (email)
echo "Creating notification channel..."
CHANNEL_ID=$(gcloud alpha monitoring channels create \
  --display-name="HIPAA Security Alerts" \
  --type=email \
  --channel-labels=email_address=$NOTIFICATION_EMAIL \
  --description="Email notifications for HIPAA security events" \
  --format="value(name)" 2>/dev/null || echo "existing")

if [ "$CHANNEL_ID" == "existing" ]; then
  echo "Using existing notification channel"
  CHANNEL_ID=$(gcloud alpha monitoring channels list \
    --filter="displayName:'HIPAA Security Alerts'" \
    --format="value(name)" | head -1)
fi

echo "Notification channel: $CHANNEL_ID"

# 1. Failed Login Attempts Metric
echo "Creating failed login attempts metric..."
gcloud logging metrics create failed_login_attempts \
  --description="Count of failed login attempts" \
  --log-filter='
    resource.type="gae_app"
    severity="WARNING"
    textPayload=~"AUDIT: Failed login attempt"
  ' || echo "Metric already exists"

# 2. Account Lockout Metric
echo "Creating account lockout metric..."
gcloud logging metrics create account_lockouts \
  --description="Count of account lockouts" \
  --log-filter='
    resource.type="gae_app"
    severity="WARNING"
    textPayload=~"Account locked due to"
  ' || echo "Metric already exists"

# 3. Successful Login Metric
echo "Creating successful login metric..."
gcloud logging metrics create successful_logins \
  --description="Count of successful logins" \
  --log-filter='
    resource.type="gae_app"
    severity="INFO"
    textPayload=~"AUDIT:.*logged in successfully"
  ' || echo "Metric already exists"

# 4. PHI Access Metric
echo "Creating PHI access metric..."
gcloud logging metrics create phi_access \
  --description="Count of PHI data access" \
  --log-filter='
    resource.type="gae_app"
    severity="INFO"
    textPayload=~"AUDIT:.*accessed patient data"
  ' || echo "Metric already exists"

# 5. Security Errors Metric
echo "Creating security errors metric..."
gcloud logging metrics create security_errors \
  --description="Count of security-related errors" \
  --log-filter='
    resource.type="gae_app"
    severity="ERROR"
    (textPayload=~"authentication" OR textPayload=~"authorization" OR textPayload=~"security")
  ' || echo "Metric already exists"

# Create Alert Policies

# 1. Alert for excessive failed login attempts
echo "Creating alert for failed login attempts..."
gcloud alpha monitoring policies create \
  --notification-channels=$CHANNEL_ID \
  --display-name="Excessive Failed Login Attempts" \
  --condition="
    display_name='Failed login rate',
    condition_threshold={
      filter='metric.type=\"logging.googleapis.com/user/failed_login_attempts\" resource.type=\"gae_app\"',
      comparison='COMPARISON_GT',
      threshold_value=10,
      duration='300s',
      aggregations=[{
        alignment_period='60s',
        per_series_aligner='ALIGN_RATE'
      }]
    }
  " || echo "Alert policy already exists"

# 2. Alert for account lockouts
echo "Creating alert for account lockouts..."
gcloud alpha monitoring policies create \
  --notification-channels=$CHANNEL_ID \
  --display-name="Account Lockout Alert" \
  --condition="
    display_name='Account lockouts',
    condition_threshold={
      filter='metric.type=\"logging.googleapis.com/user/account_lockouts\" resource.type=\"gae_app\"',
      comparison='COMPARISON_GT',
      threshold_value=0,
      duration='60s',
      aggregations=[{
        alignment_period='60s',
        per_series_aligner='ALIGN_RATE'
      }]
    }
  " || echo "Alert policy already exists"

# 3. Alert for unusual login patterns
echo "Creating alert for unusual login patterns..."
gcloud alpha monitoring policies create \
  --notification-channels=$CHANNEL_ID \
  --display-name="Unusual Login Activity" \
  --condition="
    display_name='Login spike',
    condition_threshold={
      filter='metric.type=\"logging.googleapis.com/user/successful_logins\" resource.type=\"gae_app\"',
      comparison='COMPARISON_GT',
      threshold_value=50,
      duration='300s',
      aggregations=[{
        alignment_period='60s',
        per_series_aligner='ALIGN_RATE'
      }]
    }
  " || echo "Alert policy already exists"

# 4. Alert for security errors
echo "Creating alert for security errors..."
gcloud alpha monitoring policies create \
  --notification-channels=$CHANNEL_ID \
  --display-name="Security Error Alert" \
  --condition="
    display_name='Security errors',
    condition_threshold={
      filter='metric.type=\"logging.googleapis.com/user/security_errors\" resource.type=\"gae_app\"',
      comparison='COMPARISON_GT',
      threshold_value=5,
      duration='300s',
      aggregations=[{
        alignment_period='60s',
        per_series_aligner='ALIGN_RATE'
      }]
    }
  " || echo "Alert policy already exists"

echo "Cloud Monitoring setup complete!"
echo ""
echo "You can view your alerts at:"
echo "https://console.cloud.google.com/monitoring/alerting/policies?project=$PROJECT_ID"
echo ""
echo "Log-based metrics can be viewed at:"
echo "https://console.cloud.google.com/logs/metrics?project=$PROJECT_ID"