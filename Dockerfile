# Multi-stage build for smaller production image
FROM python:3.13.7-slim AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Add cache-busting argument
ARG CACHEBUST=1

# Copy and install requirements
COPY ./app/requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt && \
    pip install --no-cache-dir --user gunicorn

# Production stage
FROM python:3.13.7-slim

LABEL org.opencontainers.image.source=https://github.com/maxmazzeschi/bus-and-go

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV FLASK_ENV=production
ENV PATH=/home/app/.local/bin:$PATH

# Create non-root user
RUN useradd --create-home --shell /bin/bash app

# Create logs directory with proper permissions
RUN mkdir -p /logs && \
    chown -R app:app /logs && \
    chmod 755 /logs

# Copy installed packages from builder stage
COPY --from=builder /root/.local /home/app/.local

# Set work directory and copy app
WORKDIR /app
COPY ./app .
RUN chown -R app:app /app

USER app

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:5000/')" || exit 1

# Run gunicorn with logging configuration
CMD ["gunicorn", \
     "--bind", "0.0.0.0:5000", \
     "--workers", "2", \
     "--threads", "2", \
     "--worker-class", "gthread", \
     "--timeout", "120", \
     "--access-logfile", "/logs/access.log", \
     "--error-logfile", "/logs/error.log", \
     "--log-level", "debug", \
     "--capture-output", \
     "--enable-stdio-inheritance", \
     "app:app"]