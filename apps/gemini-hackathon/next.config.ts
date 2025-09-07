import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['corlena', '@corlena/wasm']
};

export default nextConfig;
