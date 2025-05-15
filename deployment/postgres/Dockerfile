FROM postgis/postgis:17-3.5

# Update package lists and install pgRouting for PostgreSQL 17
RUN apt-get update && \
    apt-get install -y --no-install-recommends postgresql-17-pgrouting && \
    rm -rf /var/lib/apt/lists/*