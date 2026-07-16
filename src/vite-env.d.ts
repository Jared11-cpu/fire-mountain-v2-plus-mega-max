/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AMAP_ENABLED?: string;
  readonly VITE_AMAP_KEY?: string;
  readonly VITE_AMAP_SECURITY_CODE?: string;
  readonly VITE_TRANSPORT_API_URL?: string;
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  AMap?: any;
  _AMapSecurityConfig?: { securityJsCode: string };
}
