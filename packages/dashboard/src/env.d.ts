interface ImportMetaEnv {
  readonly VITE_DEMO_RESOURCES_DOMAIN?: string;
  readonly [key: string]: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
