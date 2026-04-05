/// <reference types="@tanstack/react-start" />

declare module "*.css" {
  const content: Record<string, string>;
  export default content;
}

declare type ValueOf<T> = T[keyof T];
