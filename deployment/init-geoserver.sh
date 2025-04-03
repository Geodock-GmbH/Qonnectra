#!/bin/bash

# GeoServer Configuration Script
# Waits for GeoServer, then ensures workspace, datastore, and layer exist.

# --- Configuration ---
# Adjust GEOSERVER_URL if your Caddy/Nginx setup exposes it differently
# or if running this script from *inside* the docker network (use http://geoserver:8080/geoserver)
GEOSERVER_URL="${GEOSERVER_URL:-http://geoserver:8080/geoserver}"

# Credentials (use environment variables, fallback to defaults)
ADMIN_USER="${GEOSERVER_ADMIN_USER:-admin}"
ADMIN_PASS="${GEOSERVER_ADMIN_PASSWORD:-geoserver}"

# GeoServer Names
WORKSPACE="kritgis"
STORE_NAME="postgis-kritgis"
LAYER_NAME="trench" 
FEATURE_TYPE_TITLE="Trench Layer"

# Database Connection Details (use environment variables from .env, fallback to defaults/docker-internal names)
# IMPORTANT: If running this script *outside* the Docker network (e.g., on your host machine),
# DB_HOST should be 'localhost' or '127.0.0.1', and DB_PORT should be the *exposed* port (5440).
# If running *inside* the network (e.g., from another container), use the service name 'db' and internal port '5432'.
DB_HOST="${DB_HOST:-db}" # Defaulting to internal Docker service name
DB_PORT="${DB_PORT:-5432}"     # Defaulting to internal PostGIS port
DB_NAME="${DB_NAME:-krit_gis_db}"
DB_USER="${DB_USER:-krit_gis_user}"
DB_PASSWORD="${DB_PASSWORD:-krit_gis_password}"
DB_SCHEMA="${DB_SCHEMA:-public}" # Assuming 'public' schema for the table

# Layer Configuration
NATIVE_SRS="EPSG:${DEFAULT_SRID:-4326}" # Use DEFAULT_SRID from .env or fallback to EPSG:4326

# Authentication string for curl
AUTH="${ADMIN_USER}:${ADMIN_PASS}"

# --- Wait for GeoServer ---
echo "Waiting for GeoServer at ${GEOSERVER_URL}..."
MAX_WAIT=120 # Maximum wait time in seconds (e.g., 2 minutes)
WAIT_INTERVAL=5
elapsed=0
while true; do
    # Check GeoServer readiness (using the login page as an indicator)
    http_code=$(curl -s -o /dev/null -w "%{http_code}" "${GEOSERVER_URL}/web/")
    if [[ "$http_code" == "200" ]]; then
        echo "GeoServer is up!"
        break
    fi

    if [[ $elapsed -ge $MAX_WAIT ]]; then
        echo "GeoServer did not become ready within ${MAX_WAIT} seconds. Exiting."
        exit 1
    fi

    echo -n "."
    sleep $WAIT_INTERVAL
    elapsed=$((elapsed + WAIT_INTERVAL))
done


# --- Helper function for REST calls ---
# Usage: geoserver_rest METHOD URL [DATA] [CONTENT_TYPE]
# Returns HTTP status code. Response body is piped to stderr for debugging.
geoserver_rest() {
    local method="$1"
    local url="$2"
    local data="$3"
    local content_type="$4"
    local headers=(-s -u "$AUTH" --fail-with-body) # Fail fast and show body on error
    local response_code
    local curl_opts=()

    # Use proxy if defined
    [[ -n "$http_proxy" ]] && curl_opts+=("--proxy" "$http_proxy")
    [[ -n "$https_proxy" ]] && curl_opts+=("--proxy" "$https_proxy")
    [[ -n "$NO_PROXY" ]] && curl_opts+=("--noproxy" "$NO_PROXY")


    if [[ -n "$content_type" ]]; then
        headers+=(-H "Content-Type: $content_type")
    fi

    # Send request and capture HTTP code, pipe body to stderr
    exec 3>&1 # Save stdout
    response_code=$(curl "${curl_opts[@]}" "${headers[@]}" -X "$method" ${data:+--data "$data"} -w "%{http_code}" -o >(cat >&2) "$url" 2>&1 >&3)
    local curl_exit_code=$?
    exec 3>&- # Restore stdout

    # Check curl exit code (0 is success)
    if [[ $curl_exit_code -ne 0 && $curl_exit_code -ne 22 ]]; then # 22 is HTTP error >= 400, handled by status code check
       echo "Curl command failed with exit code $curl_exit_code for $method $url" >&2
       # Return a non-standard code to indicate curl failure vs. HTTP error
       if [[ "$response_code" =~ ^[0-9]+$ ]]; then # If we got a status code despite error
           echo "$response_code"
       else
           echo "999" # Indicate generic curl error
       fi
       return 1 # Signal function failure
    fi

    echo "$response_code"
    # Check if the HTTP code indicates success (2xx)
    if [[ "$response_code" =~ ^2[0-9]{2}$ ]]; then
      return 0 # Success
    else
      return 1 # Failure (non-2xx code)
    fi
}


# --- Check/Create Workspace ---
echo "Checking workspace '${WORKSPACE}'..."
WS_URL="${GEOSERVER_URL}/rest/workspaces/${WORKSPACE}.json"
WS_EXISTS_CODE=$(geoserver_rest GET "$WS_URL")

if [[ "$WS_EXISTS_CODE" == "404" ]]; then
    echo "Workspace '${WORKSPACE}' not found. Creating..."
    CREATE_WS_URL="${GEOSERVER_URL}/rest/workspaces"
    WS_PAYLOAD="{\"workspace\":{\"name\":\"${WORKSPACE}\"}}"
    CREATE_WS_CODE=$(geoserver_rest POST "$CREATE_WS_URL" "$WS_PAYLOAD" "application/json")
    if [[ "$CREATE_WS_CODE" == "201" ]]; then
        echo "Workspace '${WORKSPACE}' created successfully."
    else
        echo "Error creating workspace '${WORKSPACE}'. Status code: ${CREATE_WS_CODE}." >&2
        exit 1
    fi
elif [[ "$WS_EXISTS_CODE" == "200" ]]; then
     echo "Workspace '${WORKSPACE}' already exists."
else
    echo "Error checking workspace '${WORKSPACE}'. Status code: ${WS_EXISTS_CODE}." >&2
    exit 1
fi


# --- Check/Create Data Store ---
echo "Checking data store '${STORE_NAME}' in workspace '${WORKSPACE}'..."
STORE_URL="${GEOSERVER_URL}/rest/workspaces/${WORKSPACE}/datastores/${STORE_NAME}.json"
STORE_EXISTS_CODE=$(geoserver_rest GET "$STORE_URL")

if [[ "$STORE_EXISTS_CODE" == "404" ]]; then
    echo "Data store '${STORE_NAME}' not found. Creating..."
    CREATE_STORE_URL="${GEOSERVER_URL}/rest/workspaces/${WORKSPACE}/datastores"
    # Ensure XML characters in passwords etc. are handled (although curl usually manages this)
    # Using a heredoc for readability
    read -r -d '' STORE_PAYLOAD << EOF || true
<dataStore>
  <name>${STORE_NAME}</name>
  <enabled>true</enabled>
  <workspace>
    <name>${WORKSPACE}</name>
  </workspace>
  <connectionParameters>
    <entry key="host">${DB_HOST}</entry>
    <entry key="port">${DB_PORT}</entry>
    <entry key="database">${DB_NAME}</entry>
    <entry key="schema">${DB_SCHEMA}</entry>
    <entry key="user">${DB_USER}</entry>
    <entry key="passwd">${DB_PASSWORD}</entry>
    <entry key="dbtype">postgis</entry>
    <entry key="Loose bbox">true</entry>
    <entry key="Estimated extends">false</entry>
    <entry key="validate connections">true</entry>
    <entry key="Connection timeout">20</entry>
    <entry key="preparedStatements">false</entry> <!-- Safer default -->
    <entry key="Max connections">10</entry>
    <entry key="Min connections">1</entry>
  </connectionParameters>
  <__default>false</__default> <!-- Make sure it's not the default store -->
</dataStore>
EOF

    CREATE_STORE_CODE=$(geoserver_rest POST "$CREATE_STORE_URL" "$STORE_PAYLOAD" "application/xml")
    if [[ "$CREATE_STORE_CODE" == "201" ]]; then
        echo "Data store '${STORE_NAME}' created successfully."
    else
        echo "Error creating data store '${STORE_NAME}'. Status code: ${CREATE_STORE_CODE}." >&2
        exit 1
    fi
elif [[ "$STORE_EXISTS_CODE" == "200" ]]; then
     echo "Data store '${STORE_NAME}' already exists."
else
    echo "Error checking data store '${STORE_NAME}'. Status code: ${STORE_EXISTS_CODE}." >&2
    exit 1
fi


# --- Check/Publish Feature Type (Layer) ---
echo "Checking feature type/layer '${LAYER_NAME}' in store '${STORE_NAME}'..."
FT_URL="${GEOSERVER_URL}/rest/workspaces/${WORKSPACE}/datastores/${STORE_NAME}/featuretypes/${LAYER_NAME}.json"
FT_EXISTS_CODE=$(geoserver_rest GET "$FT_URL")

if [[ "$FT_EXISTS_CODE" == "404" ]]; then
    echo "Feature type '${LAYER_NAME}' not found. Publishing..."
    PUBLISH_FT_URL="${GEOSERVER_URL}/rest/workspaces/${WORKSPACE}/datastores/${STORE_NAME}/featuretypes"
    # GeoServer requires nativeName, srs, and projectionPolicy at minimum.
    # It can often compute bounds, but providing rough lat/lon is safer.
    read -r -d '' FT_PAYLOAD << EOF || true
<featureType>
  <name>${LAYER_NAME}</name>
  <nativeName>${LAYER_NAME}</nativeName> <!-- Case-sensitive PostGIS table name -->
  <namespace>
    <name>${WORKSPACE}</name>
  </namespace>
  <title>${FEATURE_TYPE_TITLE}</title>
  <srs>${NATIVE_SRS}</srs>
  <!-- Provide basic lat/lon bounds; GeoServer will compute native bounds -->
   <nativeBoundingBox>
      <minx>-180.0</minx>
      <maxx>180.0</maxx>
      <miny>-90.0</miny>
      <maxy>90.0</maxy>
    <crs>EPSG:4326</crs>
  </nativeBoundingBox>
  <latLonBoundingBox>
    <minx>-180.0</minx>
    <maxx>180.0</maxx>
    <miny>-90.0</miny>
    <maxy>90.0</maxy>
    <crs>EPSG:4326</crs>
  </latLonBoundingBox>
  <projectionPolicy>FORCE_DECLARED</projectionPolicy>
  <enabled>true</enabled>
  <store class="dataStore">
    <name>${WORKSPACE}:${STORE_NAME}</name>
  </store>
  <maxFeatures>0</maxFeatures> <!-- 0 means unlimited -->
  <numDecimals>8</numDecimals> <!-- Adjust if needed -->
</featureType>
EOF

    PUBLISH_FT_CODE=$(geoserver_rest POST "$PUBLISH_FT_URL" "$FT_PAYLOAD" "application/xml")

    if [[ "$PUBLISH_FT_CODE" == "201" ]]; then
        echo "Feature type '${LAYER_NAME}' published successfully."
        # GeoServer automatically creates a layer when a feature type is published.
        # You might want to update layer settings like default style here if needed.
        # Example: Set default style to 'polygon'
        # LAYER_UPDATE_URL="${GEOSERVER_URL}/rest/layers/${WORKSPACE}:${LAYER_NAME}.xml"
        # LAYER_UPDATE_PAYLOAD='<layer><defaultStyle><name>polygon</name></defaultStyle><enabled>true</enabled></layer>'
        # geoserver_rest PUT "$LAYER_UPDATE_URL" "$LAYER_UPDATE_PAYLOAD" "application/xml"
    else
        echo "Error publishing feature type '${LAYER_NAME}'. Status code: ${PUBLISH_FT_CODE}." >&2
        # Optional: Try to GET the resource again to see if it was partially created despite error
        geoserver_rest GET "$FT_URL" > /dev/null 2>&1
        exit 1
    fi
elif [[ "$FT_EXISTS_CODE" == "200" ]]; then
    echo "Feature type/layer '${LAYER_NAME}' already exists."
else
    echo "Error checking feature type/layer '${LAYER_NAME}'. Status code: ${FT_EXISTS_CODE}." >&2
    exit 1
fi

echo "GeoServer configuration script finished successfully."
exit 0