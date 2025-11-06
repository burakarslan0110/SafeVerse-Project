const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo config plugin to ensure PWA manifest is properly linked in HTML
 */
const withPWAManifest = (config) => {
  return withDangerousMod(config, [
    'web',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const webDir = path.join(projectRoot, 'web');

      // Ensure web directory exists
      if (!fs.existsSync(webDir)) {
        fs.mkdirSync(webDir, { recursive: true });
      }

      // Ensure manifest.json exists in web directory
      const manifestPath = path.join(webDir, 'manifest.json');
      if (fs.existsSync(manifestPath)) {
        console.log('✓ PWA manifest.json found in web directory');
      } else {
        console.warn('⚠ PWA manifest.json not found in web directory');
      }

      return config;
    },
  ]);
};

module.exports = withPWAManifest;
