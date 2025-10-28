# Build Caddy with WebDAV plugin
FROM caddy:2-builder AS builder

# Build Caddy with the WebDAV module
RUN xcaddy build \
    --with github.com/mholt/caddy-webdav

# Final stage - use official Caddy base image
FROM caddy:2

# Copy the custom-built Caddy binary from the builder stage
COPY --from=builder /usr/bin/caddy /usr/bin/caddy

# Verify the build includes the webdav module
RUN caddy list-modules | grep webdav

# Standard Caddy entrypoint and command are inherited from base image
