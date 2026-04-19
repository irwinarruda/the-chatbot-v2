/// <reference types="@tanstack/react-start" />

interface ImportMetaEnv {
  readonly DEV: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*.css" {
  const content: Record<string, string>;
  export default content;
}

declare module "*.css?url" {
  const url: string;
  export default url;
}

declare type ValueOf<T> = T[keyof T];
