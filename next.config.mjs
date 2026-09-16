/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // pdfkit lee sus .afm con fs; si se empaqueta, __dirname apunta al bundle y
  // falla con ENOENT. Como externo usa el node_modules real (ver Dockerfile).
  serverExternalPackages: ["pdfkit"],
  experimental: {
    serverActions: {
      bodySizeLimit: "15mb",
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
