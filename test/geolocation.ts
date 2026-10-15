/**
 * What the `dom` project's `navigator.geolocation` answers (test/setup-dom.ts).
 *
 * "denied" by default, the shape a round already handles (« Position
 * inconnue »), so a test that does not care about position never sees one.
 * setup-dom.ts resets it after every test.
 */
export type GeolocationFix =
  | "denied"
  /** Error code 2: the device could not get a fix. */
  | "unavailable"
  | {
      lat: number;
      lng: number;
      /** Metres. Defaults to a pavement fix. */
      accuracy?: number;
      /** When the device took the fix; defaults to the moment of the call. */
      timestamp?: number;
    };

let fix: GeolocationFix = "denied";

export function setGeolocation(next: GeolocationFix): void {
  fix = next;
}

export function resetGeolocation(): void {
  fix = "denied";
  permission = null;
}

/** Read at call time, so a test can switch the fix between two readings. */
export function currentGeolocation(): GeolocationFix {
  return fix;
}

/** What `navigator.permissions.query({ name: "geolocation" })` answers. */
export type GeolocationPermission = "granted" | "prompt" | "denied";

let permission: GeolocationPermission | null = null;

/** `null` removes the Permissions API altogether, as in an older WebView. */
export function setGeolocationPermission(next: GeolocationPermission | null): void {
  permission = next;
}

export function currentGeolocationPermission(): GeolocationPermission | null {
  return permission;
}
