/**
 * Where data comes from: the real gateway (`api`) or the in-browser mocks (`mock`).
 *
 * `NEXT_PUBLIC_DATA_SOURCE=api|mock` is the switch. The older
 * `NEXT_PUBLIC_API_MOCKING=disabled` still means `api`, so a build configured the
 * old way keeps behaving the same. Anything else — including nothing at all — is
 * `mock`: the demo must never start sending real requests because a variable was
 * forgotten.
 *
 * NEXT_PUBLIC_* values are inlined at build time, so this is a constant per build.
 */
export type DataSource = "api" | "mock";

function resolve(): DataSource {
  const explicit = process.env.NEXT_PUBLIC_DATA_SOURCE;
  if (explicit === "api" || explicit === "mock") return explicit;
  if (process.env.NEXT_PUBLIC_API_MOCKING === "disabled") return "api";
  return "mock";
}

export const DATA_SOURCE: DataSource = resolve();
export const IS_MOCK = DATA_SOURCE === "mock";
