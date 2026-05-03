/// <reference types="vite/client" />

// Task #121 (step 9): build-time client identity. The web app defaults to
// CLIENT_KIND="web" / API_BASE="/api". Future native bundles set these to
// e.g. ios / https://poloclubhouse.app/api/v1 so a single codebase pattern
// works across web, iOS, tvOS, and Android.
interface ImportMetaEnv {
  readonly VITE_CLIENT_KIND?: "web" | "ios" | "android" | "tvos" | "obs";
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
