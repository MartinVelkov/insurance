import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["185.230.6.242"],
  experimental: {
    // The compiler API is reliable in restricted build environments where a
    // detached `tsc --showConfig` subprocess cannot return captured stdout.
    useTypeScriptCli: false,
  },
};

export default nextConfig;
