export {};

declare global {
  interface Window {
    getIdToken: () => Promise<string | null>;
    // Optional helper if you decide to add it later
    printIdToken?: () => Promise<void>;
  }
}
