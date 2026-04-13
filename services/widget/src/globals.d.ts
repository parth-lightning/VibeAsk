declare module "*.css" {
  const content: Record<string, string>;
  export default content;
}

/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_ENDPOINT?: string;
  readonly VITE_COLLEGE_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
