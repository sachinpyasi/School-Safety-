/** @type {import('next').NextConfig} */
const nextConfig = {
  // Nothing to configure. This app deliberately has NO private dependencies (no design-system
  // package, no Tailwind); its pages are styled by app/globals.css. That is what lets it build and be
  // tested with no GITHUB_TOKEN anywhere. See CLAUDE.md §Why no design system.
};

export default nextConfig;
