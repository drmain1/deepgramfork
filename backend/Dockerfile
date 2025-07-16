# Multi-stage build for optimized image
FROM python:3.11-slim-bookworm AS builder

# Install build dependencies and security updates
RUN apt-get update && apt-get upgrade -y && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    libffi-dev \
    libcairo2-dev \
    libgdk-pixbuf2.0-dev \
    libpango1.0-dev \
    libglib2.0-dev \
    libxml2-dev \
    libxslt1-dev \
    zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

# Set work directory
WORKDIR /app

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir setuptools>=70.0.0 wheel && \
    pip install --no-cache-dir -r requirements.txt

# Stage 2: Runtime stage
FROM python:3.11-slim-bookworm

# Install runtime dependencies for WeasyPrint and security updates
# Pin package versions and apply all security updates
RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get dist-upgrade -y && \
    apt-get install -y --no-install-recommends \
    libcairo2 \
    libgdk-pixbuf2.0-0 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libglib2.0-0 \
    libxml2 \
    libxslt1.1 \
    fonts-liberation \
    # FFmpeg for audio processing
    ffmpeg \
    # Additional security patches
    && apt-get install -y --no-install-recommends \
    ca-certificates \
    && apt-get autoremove -y \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# Upgrade pip and setuptools in runtime image
RUN pip install --no-cache-dir --upgrade pip setuptools>=70.0.0

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8080

# Set work directory
WORKDIR /app

# Copy Python dependencies from builder
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin/* /usr/local/bin/

# Copy application files
COPY main.py models.py core_models.py config.py ./
COPY firebase_auth_simple.py gcp_auth_middleware.py websocket_auth.py ./
COPY firestore_client.py firestore_endpoints.py firestore_models.py ./
COPY firestore_session_manager.py memory_session_manager.py ./
COPY gcp_utils.py gcs_utils.py secret_manager.py ./
COPY patient_endpoints.py extraction_prompts_simple.py ./
COPY image_handler.py deepgram_utils.py ./
COPY audit_logger.py rate_limiter.py account_lockout.py base_billing_rules.py ./
COPY routers/ ./routers/
COPY services/ ./services/
COPY middleware/ ./middleware/
COPY fonts/ ./fonts/

# Create non-root user with minimal privileges
RUN useradd -m -u 1000 -s /usr/sbin/nologin appuser && \
    chown -R appuser:appuser /app && \
    # Set restrictive permissions for HIPAA compliance
    chmod -R 750 /app && \
    find /app -type f -name "*.py" -exec chmod 640 {} \;

# Security hardening for HIPAA compliance
# Clean up package manager caches
RUN rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/* /usr/share/doc/* /usr/share/man/*

# Switch to non-root user
USER appuser

# Add health check for container monitoring (HIPAA requirement)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8080/health').read()" || exit 1

# Expose port (documentation only)
EXPOSE 8080

# Add Cloud Run signal handling
STOPSIGNAL SIGTERM

# Use exec form for proper signal handling and security
ENTRYPOINT ["python", "-m", "uvicorn"]
CMD ["main:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1", "--access-log", "--log-level", "info"]