import { assertSafePublicUrl } from "../../core/url.ts";

export function resolveSafeRedirect(currentUrl: string | URL, location: string): URL {
  const resolved = new URL(location, currentUrl);
  return assertSafePublicUrl(resolved.toString());
}
