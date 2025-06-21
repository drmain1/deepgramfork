# Medical Transcription Application - Complete Architecture Analysis

## Executive Summary

This is a HIPAA-compliant medical transcription application that converts audio recordings into structured medical notes using speech-to-text services and LLM-based formatting. The application currently uses AWS services (Cognito, S3, Bedrock) and is being evaluated for migration to Google Cloud Platform.

## 1. Complete Project Structure

```
github_fork/
├── backend/                    # FastAPI backend server
│   ├── main.py                # Main API server with all endpoints
│   ├── auth_middleware.py     # JWT authentication using AWS Cognito
│   ├── aws_utils.py           # AWS S3 and Bedrock utilities
│   ├── gcp_utils.py           # Google Cloud Vertex AI integration
│   ├── deepgram_utils.py      # Deepgram speech-to-text integration
│   ├── speechmatics_utils.py  # Speechmatics multilingual STT
│   ├── core_models.py         # Pydantic data models
│   └── requirements.txt       # Python dependencies
│
├── my-vite-react-app/         # React frontend application
│   ├── src/
│   │   ├── components/        # React components
│   │   ├── contexts/          # React contexts (Auth, Recordings, Templates)
│   │   ├── pages/             # Page components (Home, Settings, Transcription)
│   │   ├── templates/         # Medical note templates
│   │   ├── utils/             # Utility functions
│   │   ├── App.jsx            # Main app component with routing
│   │   ├── amplifyconfigure.js # AWS Cognito configuration
│   │   └── firebaseConfig.js  # Firebase/GCP auth config (prepared)
│   │
│   ├── public/                # Static assets
│   └── package.json           # Node dependencies
│
├── cognito-config.json        # AWS Cognito configuration
├── gcp-config.json           # GCP configuration template
├── HIPAA_COMPLIANCE_TECH_DEBT.md # HIPAA compliance tracking
└── rules.js                   # Security rules

```

## 2. Current AWS Services Usage

### 2.1 AWS Cognito (Authentication)
- **User Pool ID**: `us-east-1_c2pePFAr6`
- **Client ID**: `34qvlmvb253ne4gvb25hh59pf4`
- **Region**: `us-east-1`
- **Features**:
  - Email-based authentication with auto-verification
  - JWT token-based authorization
  - Advanced Security Mode ENFORCED for HIPAA compliance
  - Password policy: Min 8 chars, uppercase, lowercase, numbers
  - MFA capability (not yet enforced)

### 2.2 AWS S3 (Storage)
- **Primary Data Storage**: All user data, transcripts, and settings
- **Bucket Structure**:
  ```
  {bucket_name}/
  ├── {user_id}/
  │   ├── transcripts/
  │   │   ├── original/      # Raw transcripts
  │   │   └── polished/      # LLM-processed transcripts
  │   ├── metadata/          # Session metadata JSON files
  │   └── user_settings/     # User preferences and profiles
  ```
- **Security Features**:
  - Server-side encryption (AES-256/KMS)
  - Bucket versioning for audit trails
  - CORS configuration required
  - IAM-based access control

### 2.3 AWS Bedrock (LLM Processing)
- **Model**: Claude (Anthropic) via Bedrock Runtime
- **Region**: Same as S3 region
- **Usage**: Polish and format medical transcripts
- **Features**:
  - Custom instruction templates
  - Medical specialty-specific formatting
  - HIPAA-compliant processing

## 3. All API Endpoints

### 3.1 WebSocket Endpoints
- `WS /stream?token={jwt_token}` - Real-time audio streaming for Deepgram transcription
- `WS /stream/multilingual?token={jwt_token}` - Multilingual streaming via Speechmatics

### 3.2 REST API Endpoints

#### Authentication Required (All endpoints require JWT bearer token)

**User Settings**
- `GET /api/v1/user_settings/{user_id}` - Fetch user settings and preferences
- `POST /api/v1/user_settings` - Save user settings
- `POST /api/v1/upload_logo` - Upload clinic logo (base64 storage)
- `DELETE /api/v1/delete_logo` - Remove clinic logo

**Transcription Sessions**
- `POST /api/v1/save_session_data` - Save completed transcription session
- `GET /api/v1/user_recordings/{user_id}` - List user's recordings (last 15 days)
- `DELETE /api/v1/recordings/{user_id}/{session_id}` - Delete a recording
- `GET /api/v1/s3_object_content?s3_key={key}` - Retrieve transcript content

**Testing/Debug Endpoints**
- `GET /api/v1/test-gcp` - Test GCP Vertex AI connection
- `GET /api/v1/debug/transcription_profiles/{user_id}` - Debug user profiles
- `GET /api/v1/debug_logo/{user_id}` - Debug logo status

## 4. Frontend Components and Responsibilities

### 4.1 Page Components
- **HomePage** - Dashboard with recent recordings and quick actions
- **TranscriptionPage** - Main recording interface with audio capture
- **SettingsPage** - User preferences and configuration

### 4.2 Key Components
- **AudioRecorder** - WebRTC audio capture and streaming
- **TranscriptViewer** - Real-time transcript display and editing
- **EditableNote** - Post-recording note editing interface
- **SettingsTabs** - Tabbed settings interface:
  - Office Information
  - Transcription Profiles
  - Custom Vocabulary
  - Macro Phrases
  - Note Structure

### 4.3 Context Providers
- **AuthContext** - AWS Cognito authentication state
- **RecordingsContext** - Manage recording sessions and data
- **TemplateContext** - Medical note templates and profiles
- **UserSettingsContext** - User preferences and configuration

## 5. Data Flow and Storage Patterns

### 5.1 Recording Flow
1. **Audio Capture**: Browser WebRTC → WebSocket connection
2. **Real-time Transcription**: 
   - Deepgram (English medical)
   - Speechmatics (multilingual)
3. **Session Storage**: Temporary in-memory during recording
4. **Post-Processing**: 
   - Save raw transcript to S3
   - Process with LLM (Bedrock/Vertex AI)
   - Save polished transcript
5. **Metadata**: Session info, patient details, timestamps

### 5.2 Data Storage Pattern
```
User Data Hierarchy:
- User Authentication (Cognito)
  └── User Settings (S3: user_settings/{user_id}/settings.json)
      └── Transcription Sessions
          ├── Original Transcript (S3: {user_id}/transcripts/original/)
          ├── Polished Transcript (S3: {user_id}/transcripts/polished/)
          └── Session Metadata (S3: {user_id}/metadata/)
```

## 6. Authentication and Authorization

### 6.1 Current Implementation
- **Provider**: AWS Cognito
- **Method**: JWT tokens (ID and Access tokens)
- **Token Verification**: 
  - JWKS public key validation
  - Audience and issuer verification
  - Token expiry checking
- **Authorization**: User-level isolation (users can only access their own data)

### 6.2 Security Flow
1. User logs in via Cognito-hosted UI or custom form
2. Receives JWT tokens (ID + Access)
3. Frontend includes token in Authorization header
4. Backend validates token on each request
5. User ID extracted from token for data isolation

## 7. Third-Party Services and APIs

### 7.1 Speech-to-Text Services
- **Deepgram**
  - Primary STT provider
  - Medical model with smart formatting
  - Real-time streaming via WebSocket
  - Features: punctuation, medical vocabulary

- **Speechmatics**
  - Multilingual support (Spanish/English)
  - Code-switching capabilities
  - Real-time streaming
  - Translation features

### 7.2 LLM Services
- **AWS Bedrock (Claude)**
  - Primary LLM for note formatting
  - Custom medical templates
  - HIPAA-compliant processing

- **Google Vertex AI (Gemini)**
  - Alternative LLM provider
  - Model: gemini-1.5-pro / gemini-2.0
  - Test integration implemented

### 7.3 Required Business Associate Agreements (BAAs)
- AWS (for Cognito, S3, Bedrock)
- Deepgram
- Speechmatics
- Google Cloud (if migrating)

## 8. Security Measures

### 8.1 Application Security
- **HTTPS Only**: All communication encrypted
- **Security Headers**:
  - Strict-Transport-Security (HSTS)
  - Content-Security-Policy (CSP)
  - X-Frame-Options: DENY
  - X-Content-Type-Options: nosniff
  - X-XSS-Protection
  - Referrer-Policy

### 8.2 Data Security
- **Encryption at Rest**: S3 server-side encryption (AES-256/KMS)
- **Encryption in Transit**: TLS 1.2+ for all connections
- **Access Control**: IAM policies, user isolation
- **Token Security**: Short-lived JWTs, secure storage

### 8.3 CORS Configuration
- Restricted origins (localhost for dev, production domain)
- Specific allowed methods and headers
- Credentials required

## 9. HIPAA Compliance Status

### 9.1 Implemented
- ✅ Encryption at rest (S3)
- ✅ Encryption in transit (HTTPS/TLS)
- ✅ User authentication (Cognito)
- ✅ Security headers
- ✅ Data isolation per user
- ✅ Secure session management

### 9.2 Required for Production
- ❌ Comprehensive audit logging
- ❌ Role-Based Access Control (RBAC)
- ❌ Automated data retention policies
- ❌ Rate limiting
- ❌ Session timeout management
- ❌ MFA enforcement
- ❌ Break-glass access procedures
- ❌ Employee training tracking

### 9.3 Technical Debt Priority
1. **Critical**: Audit logging system
2. **Critical**: RBAC implementation
3. **High**: Data retention automation
4. **Medium**: Rate limiting
5. **Medium**: Session management

## 10. Environment Variables

### 10.1 Backend (.env)
```
# Speech-to-Text
deepgram_api_key=
SPEECHMATICS_API_KEY=

# AWS Services
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
AWS_S3_BUCKET_NAME=

# Authentication
COGNITO_USER_POOL_ID=
COGNITO_CLIENT_ID=

# Google Cloud (for migration)
GCP_PROJECT_ID=
GCP_LOCATION=
GCP_CREDENTIALS_PATH=
```

### 10.2 Frontend (.env)
```
# API Configuration
VITE_API_URL=http://localhost:8000

# AWS Cognito
VITE_COGNITO_USER_POOL_ID=
VITE_COGNITO_CLIENT_ID=

# Firebase/GCP (prepared for migration)
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
```

## Migration Considerations for Google Cloud

### Current AWS Services → GCP Equivalents
1. **AWS Cognito** → Firebase Auth / Identity Platform
2. **AWS S3** → Google Cloud Storage
3. **AWS Bedrock** → Vertex AI (Gemini Pro)
4. **AWS CloudWatch** → Google Cloud Logging
5. **AWS IAM** → Google Cloud IAM

### Migration Challenges
1. **Authentication Migration**: User accounts and passwords
2. **Data Migration**: ~15 days of recordings per user
3. **URL Changes**: S3 presigned URLs → GCS signed URLs
4. **API Compatibility**: Minimal changes needed (abstractions in place)
5. **HIPAA Compliance**: Ensure GCP BAA covers all services

### Migration Advantages
1. **Unified Platform**: Single cloud provider
2. **Vertex AI**: Native Gemini integration (already tested)
3. **Identity Platform**: HIPAA-compliant authentication
4. **Cost Optimization**: Potential for better pricing
5. **Global Infrastructure**: Better international support

### Recommended Migration Path
1. **Phase 1**: Set up GCP infrastructure (IAM, Storage, Vertex AI)
2. **Phase 2**: Implement dual-write for new data
3. **Phase 3**: Migrate historical data
4. **Phase 4**: Switch authentication provider
5. **Phase 5**: Update frontend configuration
6. **Phase 6**: Decommission AWS resources

## Conclusion

The application is well-architected with clear separation of concerns and abstraction layers that facilitate cloud provider migration. The existing GCP integration (Vertex AI) demonstrates the feasibility of migration. Key considerations are HIPAA compliance maintenance, data migration strategy, and minimal user disruption during the transition.