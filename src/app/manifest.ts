import type { MetadataRoute } from "next";

/** Installable on phones ("Add to Home Screen"); the web app itself works on laptops and phones alike. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dossierly",
    short_name: "Dossierly",
    description: "Your private AI caseworker for life abroad.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#f5f6f7",
    theme_color: "#f5f6f7",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
