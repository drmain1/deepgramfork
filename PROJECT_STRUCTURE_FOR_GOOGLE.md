# Medical Transcription Application - Project Structure for GCP Migration

## Executive Summary
HIPAA-compliant medical transcription application currently running on AWS, requiring migration to Google Cloud Platform. The application provides real-time speech-to-text transcription with AI-powered medical note generation.

## Current Architecture Overview

### Technology Stack
- **Frontend**: React 18 + Vite, Material-UI, AWS Amplify
- **Backend**: Python 3.11, FastAPI, WebSockets
- **Authentication**: AWS Cognito
- **Storage**: AWS S3
- **AI/ML**: AWS Bedrock (Claude), Google Vertex AI (Gemini)
- **Speech-to-Text**: Deepgram, Speechmatics

### Application Features
1. Real-time audio transcription via WebSocket
2. AI-powered medical note formatting
3. User settings and templates management
4. PDF generation for medical documents
5. Signature capture functionality
6. Multi-language support

## Detailed Project Structure

```
github_fork/
├── backend/
│   ├── main.py                    # FastAPI application with WebSocket endpoints
│   ├── auth_middleware.py         # JWT validation using Cognito
│   ├── aws_utils.py              # S3 operations for data storage
│   ├── gcp_utils.py              # Vertex AI integration (already implemented)
│   ├── deepgram_utils.py         # Primary speech-to-text service
│   ├── speechmatics_utils.py     # Alternative speech service
│   ├── core_models.py            # Data models and schemas
│   └── requirements.txt          # Python dependencies
│
├── my-vite-react-app/
│   ├── src/
│   │   ├── components/           # React components
│   │   │   ├── AudioRecorder.jsx # WebRTC audio capture
│   │   │   ├── CustomAuthenticator.jsx # Cognito auth UI
│   │   │   ├── TranscriptionViewer.jsx # Real-time transcript display
│   │   │   └── [20+ other components]
│   │   ├── contexts/             # React Context providers
│   │   │   ├── AuthContext.jsx   # Authentication state management
│   │   │   ├── RecordingsContext.jsx # Recording data management
│   │   │   └── UserSettingsContext.jsx # User preferences
│   │   ├── templates/            # Medical note templates
│   │   ├── utils/               # Utility functions
│   │   └── amplifyconfigure.js   # AWS Amplify configuration
│   └── package.json             # Frontend dependencies
│
├── cognito-config.json          # Cognito user pool configuration
├── gcp-config.json             # GCP services configuration (new)
└── HIPAA_COMPLIANCE_TECH_DEBT.md # Compliance requirements

```

## Current AWS Services Usage

### 1. Amazon Cognito
- **Purpose**: User authentication and authorization
- **Configuration**:
  ```json
  {
    "UserPoolId": "us-east-1_c2pePFAr6",
    "ClientId": "34qvlmvb253ne4gvb25hh59pf4",
    "Region": "us-east-1",
    "AdvancedSecurityMode": "ENFORCED"
  }
  ```
- **Features Used**:
  - Email-based authentication
  - JWT token generation
  - Password policies (8+ chars, complexity requirements)
  - Auto-verification of email addresses

### 2. Amazon S3
- **Purpose**: All application data storage
- **Bucket**: `deeepgramtrans1`
- **Data Structure**:
  ```
  /{user_id}/
    ├── transcripts/
    │   ├── original/{session_id}.txt
    │   └── polished/{session_id}.txt
    ├── metadata/{session_id}.txt
    └── settings.json
  ```
- **Security**: Server-side encryption, versioning enabled

### 3. Amazon Bedrock
- **Purpose**: LLM processing for medical notes
- **Model**: Claude Sonnet 4 (`us.anthropic.claude-sonnet-4-20250514-v1:0`)
- **Usage**: Formatting transcripts into structured medical notes

## API Endpoints Structure

### WebSocket Endpoints
1. `/api/v1/ws/transcribe/{user_id}` - Real-time transcription
2. `/api/v1/ws/transcribe-speechmatics/{user_id}` - Alternative transcription

### REST Endpoints
1. `/api/v1/health` - Health check
2. `/api/v1/sessions` - List user sessions
3. `/api/v1/session/{session_id}` - Get/Delete session
4. `/api/v1/transcripts/{session_id}/original` - Get original transcript
5. `/api/v1/transcripts/{session_id}/polished` - Get polished transcript
6. `/api/v1/transcripts/{session_id}/polish` - Process transcript with LLM
7. `/api/v1/transcripts/{session_id}/metadata` - Get/Update metadata
8. `/api/v1/user-settings` - Get/Update user settings
9. `/api/v1/test-gcp` - Test Vertex AI integration

## Required GCP Services Mapping

### AWS → GCP Service Mapping
1. **Cognito → Identity Platform + Identity-Aware Proxy (IAP)**
   - User authentication and management
   - Application-level security with IAP
   - Integration with Firebase Auth SDK

2. **S3 → Cloud Storage**
   - Same folder structure
   - Customer-managed encryption keys (CMEK) for HIPAA
   - Uniform bucket-level access

3. **Bedrock → Vertex AI**
   - Gemini 1.5 Pro model
   - Already implemented in `gcp_utils.py`

4. **CloudWatch → Cloud Logging + Cloud Monitoring**
   - Audit trails for HIPAA compliance
   - Performance monitoring

## HIPAA Compliance Requirements

### Current Implementation
- HTTPS only communication
- Encryption at rest (S3)
- User data isolation
- Security headers (HSTS, CSP, etc.)

### Required for GCP (per HIPAA_COMPLIANCE_TECH_DEBT.md)
1. **Access Controls**
   - Implement Role-Based Access Control (RBAC)
   - Multi-factor authentication (MFA)
   - Session timeout management

2. **Audit Logging**
   - Comprehensive audit trails
   - User activity logging
   - Access attempt logging

3. **Data Management**
   - Automated retention policies
   - Secure deletion procedures
   - Backup and recovery

4. **Infrastructure**
   - VPC with private subnets
   - Web Application Firewall (WAF)
   - DDoS protection

5. **Compliance Documentation**
   - Business Associate Agreement (BAA) with Google
   - Security policies and procedures
   - Incident response plan

## Environment Variables

### Backend (.env)
```
# AWS (to be replaced)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1
AWS_S3_BUCKET_NAME=deeepgramtrans1
COGNITO_USER_POOL_ID=us-east-1_c2pePFAr6
COGNITO_CLIENT_ID=34qvlmvb253ne4gvb25hh59pf4

# GCP (new)
GOOGLE_APPLICATION_CREDENTIALS=
GCP_PROJECT_ID=
GCP_STORAGE_BUCKET=
GCP_REGION=us-central1

# Third-party services
DEEPGRAM_API_KEY=
SPEECHMATICS_API_KEY=

# Application
ALLOWED_ORIGINS=http://localhost:5173
```

### Frontend (.env)
```
# AWS Amplify (to be replaced)
VITE_AWS_REGION=us-east-1
VITE_AWS_USER_POOL_ID=
VITE_AWS_USER_POOL_WEB_CLIENT_ID=

# Firebase (new)
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

## Data Flow Architecture

1. **Audio Capture**: Browser → WebSocket → Backend
2. **Transcription**: Backend → Deepgram/Speechmatics → Return to Frontend
3. **Storage**: Backend → Cloud Storage → Structured folders
4. **LLM Processing**: Backend → Vertex AI → Formatted medical note
5. **Authentication**: Frontend → Firebase Auth → IAP → Backend validation

## Migration Priority Order

1. **Phase 1**: Set up GCP project with required APIs
2. **Phase 2**: Implement Identity Platform + IAP for authentication
3. **Phase 3**: Migrate data storage to Cloud Storage
4. **Phase 4**: Update frontend to use Firebase SDK
5. **Phase 5**: Configure HIPAA compliance features
6. **Phase 6**: Data migration and cutover

## Critical Considerations for Google

1. **BAA Requirement**: Must sign Business Associate Agreement for HIPAA
2. **Data Residency**: Keep all data in US regions
3. **Encryption**: Use customer-managed encryption keys (CMEK)
4. **Audit Logging**: Enable comprehensive Cloud Audit Logs
5. **Network Security**: Configure VPC Service Controls
6. **Access Management**: Implement principle of least privilege
7. **Monitoring**: Set up alerts for security events
8. **Backup**: Implement automated backup with encryption

## Testing Requirements

1. End-to-end authentication flow
2. Data migration verification
3. Performance benchmarking
4. Security penetration testing
5. HIPAA compliance audit
6. Disaster recovery testing

## Questions for Google Team

1. Which GCP regions support all required services with HIPAA compliance?
2. What's the recommended approach for migrating Cognito users to Identity Platform?
3. Should we use Firebase Auth or Identity Platform SDK directly?
4. What's the best practice for WebSocket connections with IAP?
5. How to implement session timeout with Firebase Auth for HIPAA?
6. Recommended approach for audit logging of all user actions?
7. Best practices for CMEK key rotation?

---

This document provides the complete context needed for Google to create a comprehensive GCP migration plan while maintaining HIPAA compliance throughout the process.