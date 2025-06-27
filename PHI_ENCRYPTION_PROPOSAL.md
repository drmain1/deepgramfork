# PHI Encryption at Rest Implementation Proposal

## Executive Summary

This document outlines a comprehensive approach to implement field-level encryption for Protected Health Information (PHI) in our HIPAA-compliant medical transcription application. The proposal adds an additional layer of security by encrypting sensitive data at the application level before storing it in Firestore or Google Cloud Storage.

## Current Architecture Overview

### Data Storage
- **Firestore**: Primary database for patient profiles, transcripts, and user settings
- **Google Cloud Storage**: Audio files, signatures, and logos
- **Authentication**: Firebase Auth with JWT tokens
- **Infrastructure**: Google Cloud Platform (App Engine, Cloud Storage, Firestore, Vertex AI)

### Sensitive Data Types Currently Stored

1. **Patient Information**:
   - Names (first_name, last_name)
   - Date of Birth
   - Date of Accident
   - Medical notes and context
   - Patient-transcript associations

2. **Medical Transcripts**:
   - Original transcriptions
   - AI-polished transcriptions
   - Patient context information
   - Session metadata

3. **Provider Information**:
   - Doctor names
   - Medical specialties
   - Clinic information

## Proposed Encryption Solution

### 1. Application-Level Field Encryption

Implement AES-256-GCM encryption at the application layer for specific PHI fields before storing in Firestore.

**Advantages**:
- Data encrypted before reaching database
- Protection against database-level breaches
- Granular control over which fields are encrypted
- Maintains query capabilities for non-encrypted fields
- Can be implemented without infrastructure changes

**Key Components**:
- Encryption service using Google Cloud KMS for key management
- Field-level encryption/decryption
- Key rotation capabilities
- Audit logging for all encryption operations

### 2. Architecture Design

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────┐
│   Frontend      │────▶│   Backend API    │────▶│  Encryption  │
│  (React/Vite)   │     │   (FastAPI)      │     │   Service    │
└─────────────────┘     └──────────────────┘     └──────┬───────┘
                                                          │
                                ┌─────────────────────────▼───────┐
                                │        Google Cloud KMS         │
                                │    (Key Management Service)     │
                                └─────────────────────────────────┘
                                                          │
                        ┌─────────────────────────────────┴───────┐
                        │                                         │
                   ┌────▼──────┐                          ┌──────▼──────┐
                   │ Firestore │                          │    GCS      │
                   │(Encrypted) │                          │ (Encrypted) │
                   └───────────┘                          └─────────────┘
```

## Implementation Plan

### Phase 1: Core Encryption Infrastructure (Week 1)

#### 1.1 Create Encryption Service (`backend/encryption_service.py`)

```python
# Key features to implement:
- AES-256-GCM encryption/decryption
- Google Cloud KMS integration
- Key versioning and rotation
- Encryption context for data integrity
- Performance optimization with caching
- Comprehensive error handling
```

#### 1.2 Environment Configuration

```bash
# New environment variables needed:
GOOGLE_CLOUD_KMS_KEY_RING="medical-transcription-keys"
GOOGLE_CLOUD_KMS_KEY_NAME="phi-encryption-key"
GOOGLE_CLOUD_KMS_LOCATION="us-east1"
ENCRYPTION_ENABLED="true"
ENCRYPTION_MIGRATION_MODE="dual"  # read both, write encrypted
```

#### 1.3 KMS Setup and Key Creation

```bash
# Create key ring
gcloud kms keyrings create medical-transcription-keys \
  --location=us-east1

# Create encryption key
gcloud kms keys create phi-encryption-key \
  --location=us-east1 \
  --keyring=medical-transcription-keys \
  --purpose=encryption \
  --rotation-period=90d \
  --next-rotation-time=2024-04-01T00:00:00Z
```

### Phase 2: Model and Data Layer Updates (Week 1-2)

#### 2.1 Update Firestore Models (`backend/firestore_models.py`)

Fields to encrypt by collection:

**Patients Collection**:
- `first_name` → `first_name_encrypted`
- `last_name` → `last_name_encrypted`
- `date_of_birth` → `date_of_birth_encrypted`
- `notes_private` → `notes_private_encrypted`
- `notes_ai_context` → `notes_ai_context_encrypted`

**Transcripts Collection**:
- `patient_name` → `patient_name_encrypted`
- `transcript_original` → `transcript_original_encrypted`
- `transcript_polished` → `transcript_polished_encrypted`
- `patient_context` → `patient_context_encrypted`

**Users Collection** (Lower Priority):
- `name` → `name_encrypted`
- `doctor_name` → `doctor_name_encrypted`

#### 2.2 Modify Data Access Layer (`backend/firestore_client.py`)

```python
# Pseudocode for transparent encryption/decryption
class FirestoreClient:
    def save_patient(self, patient_data):
        # Encrypt sensitive fields
        encrypted_data = self.encryption_service.encrypt_patient_fields(patient_data)
        # Save to Firestore
        return self.db.collection('patients').add(encrypted_data)
    
    def get_patient(self, patient_id):
        # Retrieve from Firestore
        doc = self.db.collection('patients').document(patient_id).get()
        # Decrypt sensitive fields
        return self.encryption_service.decrypt_patient_fields(doc.to_dict())
```

### Phase 3: Migration Strategy (Week 2)

#### 3.1 Create Migration Script (`backend/migrate_encrypt_phi.py`)

```python
# Migration script features:
- Batch processing with configurable batch size
- Progress tracking and resumability
- Dry-run mode for testing
- Rollback capabilities
- Detailed logging and reporting
- Zero-downtime migration support
```

#### 3.2 Migration Modes

1. **Dual-Write Mode** (Initial):
   - Write both encrypted and unencrypted fields
   - Read from unencrypted fields
   - Allows testing without breaking existing functionality

2. **Dual-Read Mode** (Transition):
   - Write only encrypted fields
   - Read from encrypted fields, fallback to unencrypted
   - Ensures smooth transition

3. **Encrypted-Only Mode** (Final):
   - Write only encrypted fields
   - Read only from encrypted fields
   - Remove unencrypted fields after verification

### Phase 4: Testing and Validation (Week 2-3)

#### 4.1 Unit Tests (`backend/tests/test_encryption_service.py`)

```python
# Test cases to implement:
- Encryption/decryption roundtrip
- Key rotation scenarios
- Error handling (KMS failures, invalid data)
- Performance benchmarks
- Concurrent access patterns
```

#### 4.2 Integration Tests

```python
# Test scenarios:
- End-to-end data flow with encryption
- API endpoint compatibility
- Frontend functionality preservation
- Backup and restore procedures
- Performance impact assessment
```

#### 4.3 HIPAA Compliance Validation

- Verify encryption meets HIPAA requirements
- Document encryption procedures
- Update security policies
- Conduct security audit

### Phase 5: Deployment and Monitoring (Week 3)

#### 5.1 Deployment Steps

1. **Pre-deployment**:
   - Create KMS keys and set permissions
   - Deploy encryption service
   - Enable dual-write mode
   - Monitor for errors

2. **Migration**:
   - Run migration script in batches
   - Monitor progress and performance
   - Verify data integrity

3. **Post-migration**:
   - Switch to encrypted-only mode
   - Remove unencrypted fields
   - Update documentation

#### 5.2 Monitoring and Alerts

```yaml
# Monitoring metrics to track:
- Encryption/decryption latency
- KMS API usage and errors
- Failed encryption attempts
- Key rotation events
- Migration progress
```

## Security Considerations

### 1. Key Management

- **Key Rotation**: Automatic 90-day rotation via KMS
- **Key Access**: Restricted to App Engine service account
- **Key Versioning**: Support for multiple key versions during rotation
- **Emergency Access**: Break-glass procedures for key recovery

### 2. Performance Impact

- **Expected Latency**: ~5-10ms per field encryption/decryption
- **Caching Strategy**: Cache decrypted data in memory (with TTL)
- **Batch Operations**: Optimize for bulk operations
- **Async Processing**: Use async operations where possible

### 3. Compliance Features

- **Audit Logging**: Log all encryption operations
- **Access Control**: Field-level access restrictions
- **Data Residency**: Ensure keys and data remain in compliant regions
- **Crypto-shredding**: Ability to delete keys for data destruction

## Risk Assessment and Mitigation

### Risks

1. **Performance Degradation**
   - Mitigation: Implement caching, optimize batch operations

2. **Key Loss or Corruption**
   - Mitigation: KMS handles key backup, implement key versioning

3. **Migration Failures**
   - Mitigation: Implement rollback procedures, use dual-mode approach

4. **Application Complexity**
   - Mitigation: Transparent encryption layer, minimal code changes

### Rollback Plan

1. **During Dual-Write Mode**: Simply disable encryption flag
2. **During Migration**: Stop migration, revert to unencrypted reads
3. **Post-Migration**: Restore from encrypted backups, decrypt data

## Cost Analysis

### Estimated Monthly Costs

1. **Google Cloud KMS**:
   - Key storage: $0.06/month per key version
   - Operations: $0.03 per 10,000 operations
   - Estimated: ~$50-100/month for typical usage

2. **Additional Compute**:
   - Increased CPU usage: ~10-15%
   - Estimated: ~$20-40/month additional

3. **Storage Overhead**:
   - Encrypted fields slightly larger (~5-10%)
   - Estimated: Negligible (<$10/month)

**Total Estimated Cost**: $80-150/month

## Implementation Timeline

### Week 1: Foundation
- [ ] Set up KMS infrastructure
- [ ] Implement encryption service
- [ ] Unit tests for encryption service

### Week 2: Integration
- [ ] Update Firestore models
- [ ] Modify data access layer
- [ ] Create migration script
- [ ] Integration testing

### Week 3: Migration & Deployment
- [ ] Deploy to staging environment
- [ ] Run migration on test data
- [ ] Performance testing
- [ ] Production deployment

### Week 4: Monitoring & Optimization
- [ ] Monitor production performance
- [ ] Optimize based on metrics
- [ ] Complete documentation
- [ ] Security audit

## Success Criteria

1. **Functional Requirements**:
   - All PHI fields encrypted at rest
   - No degradation in user experience
   - Backward compatibility maintained

2. **Performance Requirements**:
   - API response time increase <10%
   - Encryption/decryption <20ms per operation
   - Migration completed within 24 hours

3. **Security Requirements**:
   - HIPAA compliance maintained
   - Successful security audit
   - Zero data loss during migration

## Conclusion

This encryption-at-rest implementation provides a robust additional layer of security for PHI data while maintaining system performance and user experience. The phased approach ensures minimal disruption and allows for thorough testing at each stage. The use of Google Cloud KMS provides enterprise-grade key management with built-in compliance features suitable for healthcare applications.

## Appendix A: Code Examples

### Encryption Service Example

```python
from google.cloud import kms
import base64
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import os

class PHIEncryptionService:
    def __init__(self, project_id, location_id, key_ring_id, key_id):
        self.kms_client = kms.KeyManagementServiceClient()
        self.key_name = self.kms_client.crypto_key_path(
            project_id, location_id, key_ring_id, key_id
        )
        
    def encrypt_field(self, plaintext: str, context: dict = None) -> str:
        """Encrypt a single field using envelope encryption"""
        # Generate DEK (Data Encryption Key)
        dek = os.urandom(32)
        
        # Encrypt DEK with KEK (Key Encryption Key) from KMS
        encrypt_response = self.kms_client.encrypt(
            request={
                "name": self.key_name,
                "plaintext": dek,
                "additional_authenticated_data": str(context).encode() if context else None
            }
        )
        
        # Encrypt data with DEK
        aesgcm = AESGCM(dek)
        nonce = os.urandom(12)
        ciphertext = aesgcm.encrypt(nonce, plaintext.encode(), None)
        
        # Combine encrypted DEK + nonce + ciphertext
        return base64.b64encode(
            encrypt_response.ciphertext + nonce + ciphertext
        ).decode()
```

### Firestore Integration Example

```python
class EncryptedFirestoreClient(FirestoreClient):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.encryption = PHIEncryptionService(
            project_id=os.getenv('GOOGLE_CLOUD_PROJECT'),
            location_id=os.getenv('KMS_LOCATION'),
            key_ring_id=os.getenv('KMS_KEY_RING'),
            key_id=os.getenv('KMS_KEY_NAME')
        )
        
    def save_patient(self, patient_data: dict) -> str:
        # Define fields to encrypt
        encrypted_fields = ['first_name', 'last_name', 'date_of_birth', 
                          'notes_private', 'notes_ai_context']
        
        # Encrypt sensitive fields
        for field in encrypted_fields:
            if field in patient_data and patient_data[field]:
                encrypted_value = self.encryption.encrypt_field(
                    patient_data[field],
                    context={'field': field, 'collection': 'patients'}
                )
                patient_data[f'{field}_encrypted'] = encrypted_value
                # Keep original during migration (remove later)
                if os.getenv('ENCRYPTION_MIGRATION_MODE') != 'encrypted_only':
                    patient_data[field] = None
        
        return super().save_patient(patient_data)
```

## Appendix B: Testing Checklist

- [ ] Encryption/decryption accuracy
- [ ] Performance benchmarks completed
- [ ] Key rotation tested
- [ ] Migration script validated
- [ ] API backwards compatibility verified
- [ ] Frontend functionality preserved
- [ ] Error handling comprehensive
- [ ] Monitoring alerts configured
- [ ] Documentation updated
- [ ] Security audit passed