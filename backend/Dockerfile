FROM python:3.10-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_SETTINGS_MODULE=core.settings

# Set work directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    binutils \
    libproj-dev \
    gdal-bin \
    gettext \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Docker CLI (for pg-error-parser to read container logs)
RUN curl -fsSL https://download.docker.com/linux/static/stable/x86_64/docker-24.0.7.tgz | \
    tar xz --strip-components=1 -C /usr/local/bin docker/docker

# Install Python dependencies
COPY pyproject.toml .
RUN pip install --no-cache-dir .

# Copy project
COPY . .

# Expose port
EXPOSE 8000