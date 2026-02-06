import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactCompiler: true,
  // colorthief nicht bündeln, damit Node zur Laufzeit die CJS-Node-Version (dist/color-thief.js) lädt (Buffer-Support für accent.ts).
  serverExternalPackages: ["colorthief"],
  // Bilder von R2 (toPublicUrl) werden mit unoptimized geladen → Caching über
  // R2/Cloudflare (Cache-Control am Bucket/Zone). Precache: warmKeys() in lib/precache.ts.
};

export default nextConfig;
