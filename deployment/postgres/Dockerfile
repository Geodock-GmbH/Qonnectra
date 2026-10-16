FROM postgres:17-trixie

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        postgresql-$PG_MAJOR-postgis-3 \
        postgresql-$PG_MAJOR-postgis-3-scripts \
        postgresql-$PG_MAJOR-pgrouting && \
    rm -rf /var/lib/apt/lists/*
