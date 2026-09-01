// Worker environment types for TypeScript
/// <reference types="@cloudflare/workers-types" />

declare module '*.md' {
  const content: string;
  export default content;
}
