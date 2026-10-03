/**
 * Vitest setup for the Member 1 crypto module.
 *
 * The crypto module uses window.crypto.subtle (Web Crypto) which the Node
 * test environment does not provide by default. Node 19+ exposes a global
 * `crypto` with a `subtle` property, so we alias it to `window` for the
 * module under test to pick up.
 */

import { beforeAll } from "vitest";

// The Web Crypto API is used as `window.crypto.subtle`; Node exposes a
// global `crypto` object that implements the same surface, so we alias it.
beforeAll(() => {
  if (!(globalThis as unknown as { window: unknown }).window) {
    (globalThis as unknown as { window: Record<string, unknown> }).window = globalThis as unknown as Record<string, unknown>;
  }
});
