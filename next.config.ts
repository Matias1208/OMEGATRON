import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Permite un build de verificación en otra carpeta sin pisar el servidor en ejecución:
  // NEXT_DIST_DIR=.next-check npx next build
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
