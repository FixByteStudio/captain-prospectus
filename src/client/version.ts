/**
 * The build stamp shown in the field account card (GH #561). Both defines are
 * injected by `vite.config.ts` and `vitest.config.ts`, so a bundle always
 * carries the release and the deploy commit it was built from.
 */
declare const __APP_VERSION__: string;
declare const __APP_COMMIT__: string;

/** `package.json`'s version, and the deploy commit's 7-character sha — `dev` when the build had none. */
export const BUILD = { version: __APP_VERSION__, commit: __APP_COMMIT__ } as const;
