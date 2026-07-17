import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

Object.defineProperty(globalThis, "scrollTo", { value: () => undefined, writable: true });
afterEach(cleanup);
