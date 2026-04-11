function normalizeBasePath(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const lowered = raw.toLowerCase();
  if (
    lowered === "/"
    || lowered === "."
    || lowered === "false"
    || lowered === "0"
    || lowered === "none"
    || lowered === "null"
    || lowered === "off"
  ) {
    return "";
  }

  const normalizedSlashes = raw.replace(/\\/g, "/");
  const looksLikeWindowsPath = /^[A-Za-z]:\//.test(normalizedSlashes);
  const baseSource = looksLikeWindowsPath
    ? (normalizedSlashes.split("/").filter(Boolean).pop() || "")
    : normalizedSlashes;

  const clean = baseSource.replace(/^\/+|\/+$/g, "");
  return clean ? `/${clean}` : "";
}

const hasExplicitBasePath = Object.prototype.hasOwnProperty.call(process.env, "NEXT_BASE_PATH");
const defaultBasePath = "";
const basePath = normalizeBasePath(hasExplicitBasePath ? process.env.NEXT_BASE_PATH : defaultBasePath);
const withBasePath = !!basePath;
const isDev = process.env.NODE_ENV !== "production";

/** @type {import('next').NextConfig} */
module.exports = {
  output: "export",
  ...(withBasePath ? { basePath, assetPrefix: basePath } : {}),
  trailingSlash: true,
  reactStrictMode: false,
  images: {
    unoptimized: true,
  },
  ...(isDev && !withBasePath
    ? {
        async redirects() {
          return [
            {
              source: "/item_key",
              destination: "/",
              permanent: false,
            },
            {
              source: "/item_key/:path*",
              destination: "/:path*",
              permanent: false,
            },
          ];
        },
      }
    : {}),
};
