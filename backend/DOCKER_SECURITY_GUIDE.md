# Docker Security Guide for HIPAA-Compliant Application
*Last Updated: July 15, 2025*

## Overview
This document outlines the security measures implemented in our Docker configuration to ensure HIPAA compliance and address security vulnerabilities.

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

As of July 15, 2025, after applying security updates:
- **1 CRITICAL severity (CVE-2023-45853)** - zlib1g integer overflow in ZIP handling
  - Status: will_not_fix by Debian
  - Impact: Heap buffer overflow when processing malicious ZIP files
  - Mitigation: Application does not process ZIP files; read-only filesystem
- 2 High severity (7.8) - libxslt and PAM
- 4 Medium severity - gnutls28 and tar packages

These are upstream Debian package vulnerabilities awaiting patches. Options:
1. Accept and document the risk in security assessment
2. Consider Alpine Linux migration (requires testing with WeasyPrint)
3. Implement compensating controls (WAF, runtime protection)

## Critical Vulnerability Mitigation (CVE-2023-45853)

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

## Best Practices

1. **Regular Updates**:
   - Rebuild images weekly with latest security patches
   - Monitor Debian security advisories
   - Use automated dependency updates (Dependabot)

2. **Runtime Security**:
   - Use container runtime security tools (Falco, Sysdig)
   - Implement network policies
   - Enable Docker Content Trust: `export DOCKER_CONTENT_TRUST=1`

3. **Monitoring**:
   - Implement centralized logging
   - Set up alerts for security events
   - Regular security audits

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