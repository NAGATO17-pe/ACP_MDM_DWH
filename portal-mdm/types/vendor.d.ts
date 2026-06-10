// Type declarations for packages that ship without their own .d.ts files.

// plotly.js-dist-min is the minified distribution bundle of plotly.js.
// It exposes the same runtime object as plotly.js, so we re-export those types.
declare module "plotly.js-dist-min" {
  export * from "plotly.js";
  export { default } from "plotly.js";
}
