import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["firebase-admin"],
  outputFileTracingIncludes: {
    '/api/**/*': ['./runix-core/bin/**/*'],
  },
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "firebase/auth",
      "firebase/firestore",
      "firebase/app",
    ],
  },
};

export default nextConfig;
