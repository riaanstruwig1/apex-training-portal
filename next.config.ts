import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Default is 1MB, too small once sign-up carries an ID copy, a CAA
    // licence PDF and a profile picture in one submit. Also has to clear
    // the single-file study-material upload, which the app itself allows
    // up to 50MB (lib/study-material-uploads.ts) -- 25MB used to sit below
    // that, so any slide deck over ~25MB was silently rejected by this
    // framework-level limit before the upload's own 50MB check ever ran,
    // which is exactly what happened 29 Sep 2026 (CFI's PPTX uploads stuck
    // on "Saving..." forever, never actually saved). 60MB clears the
    // documented 50MB cap with headroom for multipart overhead.
    serverActions: {
      bodySizeLimit: "60mb",
    },
    // 6 Oct 2026 (Riaan: saving a ~20MB study note crashed the page with
    // "This page couldn't load"). proxy.ts runs on every page, including
    // the POSTs that carry server-action uploads, and Next buffers those
    // bodies for the proxy only up to 10MB by default -- anything bigger
    // reached the upload action cut short ("Unexpected end of form") and
    // the page crashed. Same headroom as bodySizeLimit above.
    proxyClientMaxBodySize: "60mb",
  },
};

export default nextConfig;
