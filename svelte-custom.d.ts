declare namespace svelteHTML {
  interface HTMLAttributes<T> {
    'on:click_outside'?: (ev: CustomEvent) => void
  }
}
