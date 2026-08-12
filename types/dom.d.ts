interface Document {
  /** Chrome Page Lifecycle prerender state used by the production Probe/Gate/Engine guards. */
  readonly prerendering?: boolean;
}
