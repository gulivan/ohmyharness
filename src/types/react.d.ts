/**
 * Satori accepts React elements and imports `ReactNode` for its public types.
 * This project does not use React (the card objects are plain data), so this
 * shim lets TypeScript resolve that type without pulling in React itself.
 */
declare module "react" {
  export type ReactNode = unknown;
}
