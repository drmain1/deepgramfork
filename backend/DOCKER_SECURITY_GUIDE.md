# Docker Security Guide for HIPAA-Compliant Application
*Last Updated: July 16, 2025*

## Overview
This document outlines the security measures implemented in our Docker configuration to ensure HIPAA compliance and address security vulnerabilities.

## Executive Summary - Vulnerability Status

| Severity | Count (GCP) | Count (Backend) | Key Risks | Mitigation Status |
|----------|-------------|-----------------|-----------|-------------------|
| CRITICAL | 4 | 3 | Memory corruption, DoS | Cloudflare WAF + controls |
| HIGH | 38 | 16 | Auth bypass, XML attacks | Cloudflare + app hardening |
| TOTAL | 42 | 19 | - | Risk accepted with controls |

**Key Finding**: Most vulnerabilities are in system libraries awaiting Debian patches. Application implements defense-in-depth with Cloudflare WAF as primary protection layer.

## Base Image
- **Current**: `python:3.11-slim-bookworm` (Debian 12)
- **Architecture**: Multi-stage build to minimize final image size and attack surface

## Security Vulnerabilities Addressed

### Initial Scan Results
The following vulnerabilities were identified and addressed:
- **deb/debian/pam** (1.5.2-6+deb12u1) - Severity: 7.8 (High)
- **deb/debian/gnutls28** (3.7.9-2+deb12u4) - Severity: 6.5 (Medium)
- **deb/debian/tar** (1.34+dfsg-1.2+deb12u1) - Severity: 4.1-5.3 (Medium)
- **libxslt vulnerabilities** - Severity: 7.8 (High)

### Mitigation Strategy
1. **Security Updates**: Added `apt-get upgrade` and `apt-get dist-upgrade` to both build and runtime stages
2. **Package Management**: Removed unnecessary packages and cleaned up package caches
3. **User Permissions**: Running as non-root user with restricted shell access
4. **File Permissions**: Set restrictive permissions (750 for directories, 640 for Python files)

## Dockerfile Security Features

### Build Stage
```dockerfile
# Install build dependencies and security updates
RUN apt-get update && apt-get upgrade -y && apt-get install -y --no-install-recommends \
    [build dependencies] \
    && rm -rf /var/lib/apt/lists/*
```

### Runtime Stage
```dockerfile
# Apply all security updates
RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get dist-upgrade -y && \
    apt-get install -y --no-install-recommends \
    [runtime dependencies] \
    && apt-get autoremove -y \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*
```

### Security Hardening
1. **Non-root User**:
   - Created with UID 1000 and `/usr/sbin/nologin` shell
   - All application files owned by appuser:appuser

2. **File Permissions**:
   - Directories: 750 (rwxr-x---)
   - Python files: 640 (rw-r-----)

3. **Health Check**:
   - Implemented for container monitoring (HIPAA requirement)
   - Runs every 30 seconds with 10-second timeout

4. **Logging**:
   - Access logging enabled
   - Log level set to "info" for audit trails

## Cloudflare Protection Layer

Cloudflare serves as our primary defense against exploitation of system-level vulnerabilities:

### Security Features Enabled
- **Web Application Firewall (WAF)**
  - OWASP Core Rule Set enabled
  - Custom rules for XML/HTML payload filtering
  - Automatic blocking of known attack patterns
  
- **DDoS Protection**
  - Layer 7 DDoS mitigation
  - Rate limiting: 100 requests/minute per IP
  - Challenge suspicious traffic patterns
  
- **Bot Management**
  - Block automated exploitation attempts
  - CAPTCHA challenges for suspicious behavior
  - JavaScript challenge for headless browsers

- **Security Headers**
  - Automatic HSTS enforcement
  - X-Content-Type-Options: nosniff
  - X-Frame-Options: DENY

### Specific CVE Mitigations via Cloudflare
1. **XML/HTML vulnerabilities** (CVE-2025-49794, CVE-2025-49796): Payload inspection and blocking
2. **DoS vulnerabilities**: Rate limiting and DDoS protection
3. **Authentication bypass attempts**: Geographic restrictions and bot blocking
4. **Large payload attacks**: Request size limits (100MB max)

## Docker Compose Security (docker-compose.prod.yml)

### Security Options
```yaml
security_opt:
  - no-new-privileges:true
  - apparmor:docker-default
cap_drop:
  - ALL
cap_add:
  - NET_BIND_SERVICE
read_only: true
tmpfs:
  - /tmp:noexec,nosuid,size=100M
```

### Environment Variables for Security
- `SECURE_HEADERS_ENABLED=true`
- `CORS_ALLOW_CREDENTIALS=false`
- `SESSION_COOKIE_SECURE=true`
- `SESSION_COOKIE_HTTPONLY=true`
- `SESSION_COOKIE_SAMESITE=strict`

### Resource Limits
- CPU: 2.0 cores (limit), 0.5 cores (reservation)
- Memory: 2GB (limit), 512MB (reservation)

## Building and Scanning

### Build Command
```bash
docker build -t backend-app:latest .
```

### Security Scanning
```bash
# Docker Scout (built into Docker Desktop)
docker scout cves backend-app:latest

# Alternative scanners
trivy image backend-app:latest
grype backend-app:latest
```

## HIPAA Compliance Checklist

### Technical Safeguards
- [x] Access Control (non-root user, restricted permissions)
- [x] Audit Controls (logging enabled)
- [x] Integrity Controls (read-only filesystem)
- [x] Transmission Security (TLS configuration in app)
- [x] Encryption (handled at application level)

### Administrative Safeguards
- [ ] Regular vulnerability scanning (implement weekly scans)
- [ ] Security patches applied within 30 days
- [ ] Document all security decisions in risk assessment
- [ ] Incident response plan for container breaches

### Physical Safeguards
- [ ] Ensure host systems are physically secured
- [ ] Implement proper disposal of container images with PHI

## Remaining Vulnerabilities

### Latest Trivy Scan Results (July 16, 2025)

After applying security updates, the following vulnerabilities remain:

#### CRITICAL Vulnerabilities (4 total)
1. **CVE-2023-45853 (zlib1g)** - Integer overflow in ZIP handling
   - Status: will_not_fix by Debian
   - Impact: Heap buffer overflow when processing malicious ZIP files
   - Mitigation: Application does not process ZIP files; read-only filesystem

2. **CVE-2025-49794 (libxml2)** - Heap use after free (UAF)
   - Impact: Denial of service (DoS)
   - Status: Awaiting upstream patch
   - **Mitigation**: Cloudflare WAF provides DDoS protection and rate limiting, preventing exploitation attempts from reaching the application

3. **CVE-2025-49796 (libxml2)** - Type confusion
   - Impact: Denial of service (DoS) 
   - Status: Awaiting upstream patch

4. **CVE-2023-6879 (libaom3)** - Heap buffer overflow on frame size change
   - Impact: Memory corruption in AV1 codec
   - Note: Only in GCP image, part of FFmpeg dependencies

#### HIGH Severity Vulnerabilities (38 in GCP image, 16 in backend-app)
Key packages affected:
- **FFmpeg libraries** (libavcodec59, libavformat59, etc.) - 2 CVEs each
- **glibc (libc6/libc-bin)** - CVE-2025-4802: LD_LIBRARY_PATH search issue
- **libexpat1** - CVE-2023-52425, CVE-2024-8176: XML parsing vulnerabilities
- **libpam** - CVE-2025-6020: Directory traversal vulnerability
- **libxslt1.1** - CVE-2025-7424, CVE-2025-7425: Type confusion and UAF
- **libgdk-pixbuf** - CVE-2025-7345: Heap buffer overflow
- **libtiff6** - CVE-2023-52355: Integer overflow
- **perl-base** - CVE-2023-31484: TLS certificate verification issue

These are upstream Debian package vulnerabilities awaiting patches. Options:
1. Accept and document the risk in security assessment
2. Consider Alpine Linux migration (requires extensive testing with WeasyPrint and other dependencies)
3. Implement compensating controls (WAF, runtime protection, strict input validation)

## Vulnerability Mitigation Strategies

### CRITICAL Vulnerabilities

#### CVE-2023-45853 (zlib1g)
Since zlib1g cannot be removed (required by system packages), implement these controls:

1. **Application-Level Protection**:
   - No ZIP file uploads allowed
   - File upload validation enforced
   - MIME type restrictions in place
   - File extension whitelist (PDF, PNG, JPG only)

2. **Runtime Protection**:
   - Read-only filesystem prevents ZIP file creation
   - No tools that create ZIP files (no zip, unzip, tar -z)
   - AppArmor profile restricts file operations

#### CVE-2025-49794 & CVE-2025-49796 (libxml2)
libxml2 is required by WeasyPrint for PDF generation:

1. **Cloudflare Protection** (Primary Defense):
   - WAF rules block malicious XML/HTML patterns
   - DDoS protection prevents exploitation at scale
   - Rate limiting (100 req/min) prevents brute force attempts
   - Payload size limits block oversized XML documents
   - Bot protection challenges suspicious traffic

2. **Input Validation** (Secondary Defense):
   - Sanitize all XML/HTML input before processing
   - Use strict DTD validation
   - Disable external entity resolution
   - Limit XML document size and complexity (max 5MB)

3. **Process Isolation** (Tertiary Defense):
   - PDF generation runs in isolated process
   - Resource limits enforced (CPU: 30s, Memory: 512MB)
   - Automatic process termination on timeout
   - Crash recovery with error handling

#### CVE-2023-6879 (libaom3/FFmpeg) & FFmpeg HIGH Severity CVEs
FFmpeg is **REQUIRED** for Deepgram audio transcription (converts audio streams to PCM format):

1. **Why FFmpeg is needed**:
   - Deepgram requires audio in PCM 16-bit, 16kHz, mono format
   - FFmpeg converts various audio formats from client WebSocket streams
   - Used in production for real-time medical transcription

2. **Primary Security Control - Economic Barrier**:
   - **Paid medical service**: Doctors pay for subscriptions
   - **Identity verification**: Real medical licenses required
   - **Financial deterrent**: Attack cost >> potential gain
   - **Audit trail**: Payment records link to real identities
   - **Business logic**: No anonymous access to transcription

3. **Technical Mitigations** (Defense in Depth):
   - **Authentication**: Firebase Auth required for WebSocket
   - **Process isolation**: FFmpeg runs as subprocess with pipes only
   - **Resource limits**: Container memory/CPU caps
   - **Minimal attack surface**: Simple PCM conversion only
   - **No file access**: Input/output via pipes exclusively
   - **Cloudflare protection**: Rate limiting and DDoS mitigation

### HIGH Severity Vulnerabilities

#### Authentication & Access Control (PAM, glibc)
1. **CVE-2025-6020 (PAM)**: Directory traversal
   - Restrict PAM configuration access
   - Use minimal PAM modules
   - Monitor authentication logs

2. **CVE-2025-4802 (glibc)**: LD_LIBRARY_PATH vulnerability
   - Never run as setuid
   - Clear environment variables in startup
   - Use absolute paths for libraries

#### XML/XSLT Processing (libexpat1, libxslt1.1)
1. **Input Sanitization**:
   - Pre-validate all XML input
   - Use safe XML parsing libraries where possible
   - Implement depth limits for XML parsing

2. **Resource Controls**:
   - Set memory limits for XML operations
   - Implement timeouts
   - Monitor for unusual XML processing patterns

#### Image Processing (libgdk-pixbuf, libtiff6)
1. **File Validation**:
   - Verify image headers before processing
   - Limit image dimensions and file sizes
   - Use image format allowlist

2. **Processing Isolation**:
   - Process images in separate threads/processes
   - Implement crash recovery mechanisms
   - Log all image processing operations

## Comprehensive Remediation Plan

### Immediate Actions (Within 72 hours)

1. **Update Dockerfile** to minimize attack surface:
   ```dockerfile
   # Add security-focused package installation
   RUN apt-get update && \
       apt-get upgrade -y && \
       apt-get install -y --no-install-recommends \
       # Only essential packages
       && apt-get remove -y \
       # Remove FFmpeg if not needed
       ffmpeg libavcodec59 libavformat59 libavutil57 \
       && apt-get autoremove -y \
       && apt-get clean
   ```

2. **Implement Input Validation Layer**:
   - Add file upload validator middleware
   - Implement XML/HTML sanitization for PDF generation
   - Add image dimension and format validation

3. **Update docker-compose.prod.yml**:
   ```yaml
   # Add additional security constraints
   sysctls:
     - net.ipv4.ip_unprivileged_port_start=8000
   ulimits:
     nofile:
       soft: 65536
       hard: 65536
   ```

### Short-term Actions (Within 2 weeks)

1. **Implement Runtime Security Monitoring**:
   - Deploy Falco or similar runtime security tool
   - Set up alerts for suspicious activities
   - Monitor for exploitation attempts

2. **Create Vulnerability Exception Documentation**:
   - Document each unpatched vulnerability
   - Provide business justification for acceptance
   - Detail compensating controls

3. **Enhance Application Security**:
   - Implement rate limiting for all endpoints
   - Add request size limits
   - Enable strict Content Security Policy

### Medium-term Actions (Within 1 month)

1. **Evaluate Base Image Alternatives**:
   - Test Alpine Linux compatibility with WeasyPrint
   - Consider distroless images where possible
   - Benchmark performance differences

2. **Implement WAF (Web Application Firewall)**:
   - Deploy ModSecurity or cloud WAF
   - Configure rules for known vulnerabilities
   - Block malicious payloads

3. **Security Testing Pipeline**:
   - Integrate Trivy into CI/CD
   - Fail builds on new CRITICAL vulnerabilities
   - Weekly automated security reports

### Long-term Actions (Within 3 months)

1. **Container Hardening**:
   - Implement SELinux/AppArmor policies
   - Use gVisor or Kata Containers for isolation
   - Deploy admission controllers

2. **Zero Trust Architecture**:
   - Implement service mesh (Istio/Linkerd)
   - mTLS between all services
   - Network policies for pod communication

## Best Practices

1. **Regular Updates**:
   - Rebuild images weekly with latest security patches
   - Monitor Debian security advisories
   - Use automated dependency updates (Dependabot)
   - Subscribe to CVE alerts for critical packages

2. **Runtime Security**:
   - Use container runtime security tools (Falco, Sysdig)
   - Implement network policies
   - Enable Docker Content Trust: `export DOCKER_CONTENT_TRUST=1`
   - Regular penetration testing

3. **Monitoring & Compliance**:
   - Implement centralized logging (ELK/Splunk)
   - Set up alerts for security events
   - Monthly security audits
   - Maintain vulnerability tracking spreadsheet
   - HIPAA compliance reviews quarterly

## Emergency Response

If a critical vulnerability is discovered:
1. Immediately rebuild image with patches
2. Deploy to all environments within 24 hours
3. Document the incident and response
4. Review and update security procedures

## Additional Resources

- [Docker Security Best Practices](https://docs.docker.com/engine/security/)
- [HIPAA Security Rule](https://www.hhs.gov/hipaa/for-professionals/security/index.html)
- [Debian Security Tracker](https://security-tracker.debian.org/tracker/)
- [Python Security Advisories](https://python.org/dev/security/)

---
*This document should be reviewed and updated monthly or when significant changes occur to the Docker configuration.*