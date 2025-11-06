#!/bin/sh
set -e

# Replace environment variables in built files at runtime
if [ -f /usr/share/nginx/html/index.html ]; then
    echo "Injecting environment variables and PWA meta tags..."

    # Create runtime environment configuration
    cat > /usr/share/nginx/html/env-config.js << EOL
window.ENV = {
  EXPO_PUBLIC_API_BASE_URL: '${EXPO_PUBLIC_API_BASE_URL:-https://api.safeverse.tech/api}'
};
EOL

    # Find the actual hashed icon path
    ICON_PATH=$(find /usr/share/nginx/html/assets -name "icon.*.png" | head -1 | sed 's|/usr/share/nginx/html||')
    ADAPTIVE_ICON_PATH=$(find /usr/share/nginx/html/assets -name "adaptive-icon.*.png" | head -1 | sed 's|/usr/share/nginx/html||')

    if [ -z "$ICON_PATH" ]; then
        echo "⚠ Warning: Icon file not found in assets"
        ICON_PATH="/favicon.png"
    else
        echo "✓ Found icon at: $ICON_PATH"
    fi

    if [ -z "$ADAPTIVE_ICON_PATH" ]; then
        echo "⚠ Warning: Adaptive icon file not found in assets"
        ADAPTIVE_ICON_PATH="$ICON_PATH"
    else
        echo "✓ Found adaptive icon at: $ADAPTIVE_ICON_PATH"
    fi

    # Update manifest.json with correct icon paths
    if [ -f /usr/share/nginx/html/manifest.json ]; then
        echo "Updating manifest.json with correct icon paths..."
        sed -i "s|/assets/images/icon.png|$ICON_PATH|g" /usr/share/nginx/html/manifest.json
        sed -i "s|/assets/images/adaptive-icon.png|$ADAPTIVE_ICON_PATH|g" /usr/share/nginx/html/manifest.json
        echo "✓ Manifest.json updated successfully"
    fi

    # Inject PWA meta tags into HTML head if not already present
    if ! grep -q "manifest.json" /usr/share/nginx/html/index.html; then
        echo "Injecting PWA meta tags into index.html..."

        # Use sed to inject PWA meta tags before </head>
        sed -i "s|</head>|  <meta name=\"application-name\" content=\"SafeVerse\">\n  <meta name=\"apple-mobile-web-app-capable\" content=\"yes\">\n  <meta name=\"apple-mobile-web-app-status-bar-style\" content=\"default\">\n  <meta name=\"apple-mobile-web-app-title\" content=\"SafeVerse\">\n  <meta name=\"description\" content=\"SafeVerse ile deprem güvenliği, aile iletişimi ve acil durum hazırlığını tek platformdan yönetin.\">\n  <meta name=\"mobile-web-app-capable\" content=\"yes\">\n  <meta name=\"theme-color\" content=\"#0ea5e9\">\n  <link rel=\"manifest\" href=\"/manifest.json\">\n  <link rel=\"icon\" type=\"image/png\" sizes=\"192x192\" href=\"$ICON_PATH\">\n  <link rel=\"apple-touch-icon\" href=\"$ICON_PATH\">\n</head>|" /usr/share/nginx/html/index.html

        echo "✓ PWA meta tags injected successfully"
    else
        echo "✓ PWA meta tags already present in index.html"
    fi

    echo "✓ Environment variables and PWA setup completed successfully"
fi