#!/bin/bash
set -e

echo "Validating environment variables..."

# Check required environment variables
REQUIRED_VARS=(
    "EXPO_PUBLIC_API_BASE_URL"
)

MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        MISSING_VARS+=("$var")
    fi
done

if [ ${#MISSING_VARS[@]} -ne 0 ]; then
    echo "ERROR: Missing required environment variables:"
    printf ' - %s\n' "${MISSING_VARS[@]}"
    echo ""
    echo "Please set the following environment variables:"
    echo "EXPO_PUBLIC_API_BASE_URL: API base URL (e.g., https://api.safeverse.tech/api)"
    exit 1
fi

# Validate API URL format
if [[ ! "$EXPO_PUBLIC_API_BASE_URL" =~ ^https?:// ]]; then
    echo "ERROR: EXPO_PUBLIC_API_BASE_URL must be a valid HTTP/HTTPS URL"
    echo "Current value: $EXPO_PUBLIC_API_BASE_URL"
    exit 1
fi

echo "✓ All environment variables are valid"
echo "✓ API Base URL: $EXPO_PUBLIC_API_BASE_URL"