import { SignJWT, exportJWK, generateKeyPair } from "jose";
import { vi } from "vitest";

/**
 * A stand-in Cloudflare Access for worker tests: an RS256 key, a stubbed
 * `fetch` that answers the team's JWKS URL, and a signer for `{ email }`.
 *
 * Each call gets its own team domain, because `auth.ts` caches one JWKS per
 * domain in module scope; reusing a domain across tests would verify against
 * the previous test's key.
 */
let counter = 0;

export type FakeAccess = {
  teamDomain: string;
  aud: string;
  kid: string;
  sign: (email: string) => Promise<string>;
};

export async function fakeAccess(): Promise<FakeAccess> {
  counter += 1;
  const teamDomain = `https://team-${counter}-${crypto.randomUUID().slice(0, 8)}.cloudflareaccess.com`;
  const aud = `aud-${counter}`;
  const kid = `kid-${counter}`;
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = { ...(await exportJWK(publicKey)), kid, alg: "RS256", use: "sig" };

  vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url === `${teamDomain}/cdn-cgi/access/certs`) {
      return Promise.resolve(
        new Response(JSON.stringify({ keys: [jwk] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }
    return Promise.resolve(new Response("not found", { status: 404 }));
  });

  return {
    teamDomain,
    aud,
    kid,
    sign: (email) =>
      new SignJWT({ email })
        .setProtectedHeader({ alg: "RS256", kid })
        .setIssuer(teamDomain)
        .setAudience(aud)
        .setIssuedAt()
        .setExpirationTime("1h")
        .sign(privateKey),
  };
}
