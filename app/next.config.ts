import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow importing from ../sdk/src
  transpilePackages: ["poseidon-lite", "@zk-kit/imt"],
  // Use webpack instead of turbopack (snarkjs needs Node polyfill fallbacks)
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        readline: false,
        path: false,
        crypto: false,
        os: false,
        stream: false,
        constants: false,
        worker_threads: false,
      };
    }
    config.experiments = { ...config.experiments, asyncWebAssembly: true };
    return config;
  },
  // Silence turbopack warning — we explicitly use webpack
  turbopack: {},
};

export default nextConfig;
