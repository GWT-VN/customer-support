import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Có nhiều lockfile trên máy (một cái ở ~/); ghim root về đúng thư mục app này
  // để Turbopack không suy ra nhầm workspace root.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
