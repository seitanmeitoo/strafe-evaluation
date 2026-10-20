import { afterEach } from "vitest";

// Every test starts with an empty localStorage.
afterEach(() => {
  localStorage.clear();
});
