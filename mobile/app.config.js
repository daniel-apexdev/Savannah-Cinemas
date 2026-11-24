// Adds the web base path when building for GitHub Pages, e.g.
//   EXPO_BASE_URL=/Savannah-Cinemas npx expo export -p web
// Phones and local development are unaffected (no EXPO_BASE_URL set).
module.exports = ({ config }) => {
  const baseUrl = process.env.EXPO_BASE_URL;
  if (!baseUrl) return config;
  return { ...config, experiments: { ...config.experiments, baseUrl } };
};
