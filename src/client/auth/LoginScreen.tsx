/**
 * `/login` — docs/design.md › The login page, ADR-0029.
 *
 * The code form is the default: an agent types the one-time code an admin
 * generated, as typed — the server normalises it. "Accès administrateur" swaps
 * in the admin form, which also takes break-glass (`OWNER_EMAIL` plus
 * `BREAK_GLASS`), and nothing on screen names it. The swap is screen state,
 * not a URL. A meta line under the lede counts the visits still in the outbox
 * (read once, never written: INVARIANT 5), and a 426 raises the usual update
 * prompt instead of an Alert.
 *
 * It renders outside the identity gate (App.tsx). It asks `/api/me` once on
 * mount, only to skip the form for a device that already has an identity
 * (GH #309); a 401, an opaque redirect or a network error leaves the form up,
 * with no retry — a phone sent here by a 401 must reach it with no session.
 * It ships in the field shell, so the field rules hold — `copy/field`, native
 * inputs and labels, 48px targets.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import * as z from "zod/mini";
import { Alert, AlertDescription } from "@/ui/alert";
import { buttonVariants } from "@/ui/button-variants";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/ui/form";
import { Input } from "@/ui/input";
import { Spinner } from "@/ui/spinner";
import { ApiError, apiFetch } from "../api";
import { UpdatePrompt } from "../Band";
import { copy } from "../copy/field";
import { formatBrusselsTime } from "../format";
import { fieldDb } from "../field/db";
import { useOnline } from "../hooks/use-online";
import type { PwaState } from "../pwa";
import { CREDENTIAL_MAX, EMAIL_MAX, LOGIN_WINDOW_MS } from "../../shared/constants";
import {
  adminLoginSchema,
  codeLoginSchema,
  meResponseSchema,
  type LoginRequest,
} from "../../shared/schemas";

/** Only "is it filled" and "is it over the cap" are the client's to judge; the server judges the rest. */
const codeFormSchema = z.pick(codeLoginSchema, { code: true });
const adminFormSchema = z.pick(adminLoginSchema, { email: true, code: true });
type CodeForm = z.infer<typeof codeFormSchema>;
type AdminForm = z.infer<typeof adminFormSchema>;

type Mode = "code" | "admin";
type Refusal = "refused" | "unreachable" | "failed";

/** A 429 locks the button until `until`; `exact` says Retry-After gave the time. */
type Lockout = { until: number; exact: boolean };

function refusalCopy(refusal: Refusal, mode: Mode): string {
  if (refusal === "refused")
    return mode === "code" ? copy.login.codeRefused : copy.login.adminRefused;
  return refusal === "unreachable" ? copy.login.unreachable : copy.login.failed;
}

/**
 * A 401 is a refusal, and so is a 400 (a pasted value over the cap: a retry
 * cannot pass, and the same sentence leaks nothing). A rejected fetch never
 * reached the server; the rest is the server's.
 */
function refusalFor(error: unknown): Refusal {
  if (error instanceof ApiError)
    return error.status === 401 || error.status === 400 ? "refused" : "failed";
  return error instanceof TypeError ? "unreachable" : "failed";
}

/**
 * An over-cap value is filled, so "Saisissez" would say it is empty. The
 * resolver reports no issue kind (its `type` is ""), so the value is measured
 * against the schema's own cap; the email is trimmed first, as the schema does.
 */
const isOverCap = (value: string, max: number, trim = false): boolean =>
  (trim ? value.trim() : value).length > max;

function landingFor(role: "admin" | "agent"): string {
  return role === "admin" ? "/admin" : "/round";
}

const labelClass = "font-semibold";

export function LoginScreen({ pwa }: { pwa: PwaState }) {
  const navigate = useNavigate();
  const online = useOnline();
  const [mode, setMode] = useState<Mode>("code");
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const [lockout, setLockout] = useState<Lockout | null>(null);
  // A 426 raises the update prompt; "Plus tard" clears it until the next 426.
  const [outdated, setOutdated] = useState(false);
  // null while the read is pending or after it failed: no line either way.
  const [waiting, setWaiting] = useState<number | null>(null);

  const codeForm = useForm({
    resolver: standardSchemaResolver(codeFormSchema),
    defaultValues: { code: "" },
  });
  const adminForm = useForm({
    resolver: standardSchemaResolver(adminFormSchema),
    defaultValues: { email: "", code: "" },
  });
  // Either form: a swap mid-request must not free the other's button or word
  // the answer in the wrong form's terms, so the swap waits too.
  const submitting = codeForm.formState.isSubmitting || adminForm.formState.isSubmitting;

  // A live identity has no use for the form: straight to its landing. The
  // form is up meanwhile and stays up on any failure, so this never blocks it.
  useEffect(() => {
    let cancelled = false;
    apiFetch<unknown>("/api/me")
      .then((body) => {
        const me = meResponseSchema.safeParse(body);
        if (!cancelled && me.success) {
          void navigate(landingFor(me.data.role), { replace: true });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // Once on mount: `navigate` changes with the location, and a re-ask is a retry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Read once, like the identity check: the line does not refresh live.
  // Every row counts: there is no identity on this page to filter by.
  useEffect(() => {
    let cancelled = false;
    fieldDb.outboxVisits
      .count()
      .then((count) => {
        if (!cancelled) setWaiting(count);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // The lock lifts on its own at `until`, with no reload; unmounting clears it.
  useEffect(() => {
    if (!lockout) return;
    const id = setTimeout(() => setLockout(null), Math.max(0, lockout.until - Date.now()));
    return () => clearTimeout(id);
  }, [lockout]);

  // A swap moves focus to the new form's first field; the first render does not.
  const swapped = useRef(false);
  useEffect(() => {
    if (!swapped.current) return;
    if (mode === "code") codeForm.setFocus("code");
    else adminForm.setFocus("email");
  }, [mode, codeForm, adminForm]);

  const swap = () => {
    swapped.current = true;
    // A refusal belonged to the other form; the lockout is per connection.
    setRefusal(null);
    setMode((m) => (m === "code" ? "admin" : "code"));
  };

  const signIn = async (body: LoginRequest) => {
    setRefusal(null);
    setOutdated(false);
    let role: "admin" | "agent";
    try {
      const response = await apiFetch<unknown>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(body),
      });
      role = meResponseSchema.parse(response).role;
    } catch (error) {
      if (error instanceof ApiError && error.status === 429) {
        const exact = error.retryAfter !== null;
        const wait = error.retryAfter !== null ? error.retryAfter * 1000 : LOGIN_WINDOW_MS;
        setLockout({ until: Date.now() + wait, exact });
        return;
      }
      if (error instanceof ApiError && error.status === 426) {
        setOutdated(true);
        return;
      }
      // What was typed stays: react-hook-form keeps the values.
      setRefusal(refusalFor(error));
      return;
    }
    // Always the landing, never the page a 401 interrupted (design.md).
    await navigate(landingFor(role), { replace: true });
  };

  const signInWithCode = (values: CodeForm) => signIn({ kind: "code", ...values });
  const signInAsAdmin = (values: AdminForm) => signIn({ kind: "admin", ...values });

  // One Alert slot: offline, then the lockout, then a refusal (design.md).
  const alert = !online
    ? copy.login.offline
    : lockout
      ? lockout.exact
        ? copy.login.lockedUntil(formatBrusselsTime(lockout.until))
        : copy.login.lockedForMinutes
      : refusal
        ? refusalCopy(refusal, mode)
        : null;

  // The usual prompt, gated on the 426. With no build waiting yet, a reload is
  // what lets the browser notice one (same choice as `stripEffect`).
  const updatePrompt: PwaState = {
    ...pwa,
    needRefresh: outdated,
    update: pwa.needRefresh ? pwa.update : () => window.location.reload(),
    dismiss: () => setOutdated(false),
  };

  const footer = (
    <>
      {alert && (
        <Alert variant={online ? "destructive" : "default"}>
          <AlertDescription className={online ? "text-base" : "text-base text-foreground"}>
            {alert}
          </AlertDescription>
        </Alert>
      )}

      <button
        type="submit"
        disabled={!online || submitting || lockout !== null}
        className={buttonVariants({ size: "touch", className: "w-full" })}
      >
        {submitting && <Spinner />}
        {copy.login.submit}
      </button>
      <button
        type="button"
        onClick={swap}
        disabled={submitting}
        className={buttonVariants({ variant: "ghost", size: "touch", className: "w-full" })}
      >
        {mode === "code" ? copy.login.toAdmin : copy.login.toCode}
      </button>
    </>
  );

  return (
    // No band here: the brand sits above the card (design.md › The login page).
    // `.safe-top` is on the outer element so it doesn't fight the inner `pt-12`.
    <main className="safe-top flex min-h-dvh flex-col">
      <UpdatePrompt pwa={updatePrompt} />
      <div className="flex flex-1 flex-col items-center px-4 pt-12 pb-page md:justify-center md:pb-20">
        {/* The navy ink vanishes on the dark page, so the dark theme takes the band's light-ink mark.
            width/height are the SVG's own, so its box is reserved before it loads and the card never jumps. */}
        <img
          src="/mark-ink.svg"
          alt=""
          width={1018}
          height={1178}
          className="h-auto w-12 md:w-14 dark:hidden"
        />
        <img
          src="/mark.svg"
          alt=""
          width={1018}
          height={1178}
          className="hidden h-auto w-12 md:w-14 dark:block"
        />
        <p className="text-brand mt-2.5 text-center">{copy.appName}</p>
        <Card className="border-t-primary mt-6 w-full max-w-sm border-t-4 shadow-lg md:py-8">
          <CardHeader className="md:px-8">
            <CardTitle>
              <h1 className="text-title">{copy.login.title}</h1>
            </CardTitle>
            <CardDescription className="text-sm">
              {mode === "code" ? copy.login.codeLede : copy.login.adminLede}
            </CardDescription>
            {waiting !== null && waiting > 0 && (
              <p className="text-meta text-muted-foreground">{copy.login.outboxWaiting(waiting)}</p>
            )}
          </CardHeader>
          <CardContent className="md:px-8">
            {mode === "code" ? (
              <Form {...codeForm}>
                <form
                  className="flex flex-col gap-5"
                  onSubmit={(e) => void codeForm.handleSubmit(signInWithCode)(e)}
                  noValidate
                >
                  <FormField
                    control={codeForm.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem className="gap-0">
                        <FormLabel className={labelClass}>{copy.login.code}</FormLabel>
                        <FormControl>
                          {/* No maxlength and no rewriting: the server's normaliser reads it as typed. */}
                          <Input
                            touch
                            className="mt-1.5"
                            type="text"
                            autoComplete="one-time-code"
                            autoCapitalize="characters"
                            autoCorrect="off"
                            spellCheck={false}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage className="mt-1.5">
                          {isOverCap(field.value, CREDENTIAL_MAX)
                            ? copy.login.codeTooLong
                            : copy.login.codeRequired}
                        </FormMessage>
                      </FormItem>
                    )}
                  />
                  {footer}
                </form>
              </Form>
            ) : (
              <Form {...adminForm}>
                <form
                  className="flex flex-col gap-5"
                  onSubmit={(e) => void adminForm.handleSubmit(signInAsAdmin)(e)}
                  noValidate
                >
                  <FormField
                    control={adminForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem className="gap-0">
                        <FormLabel className={labelClass}>{copy.login.email}</FormLabel>
                        <FormControl>
                          <Input
                            touch
                            className="mt-1.5"
                            type="email"
                            autoComplete="username"
                            autoCapitalize="none"
                            spellCheck={false}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage className="mt-1.5">
                          {isOverCap(field.value, EMAIL_MAX, true)
                            ? copy.login.emailTooLong
                            : copy.login.emailRequired}
                        </FormMessage>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={adminForm.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem className="gap-0">
                        <FormLabel className={labelClass}>{copy.login.code}</FormLabel>
                        <FormControl>
                          <Input
                            touch
                            className="mt-1.5"
                            type="password"
                            autoComplete="one-time-code"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage className="mt-1.5">
                          {isOverCap(field.value, CREDENTIAL_MAX)
                            ? copy.login.codeTooLong
                            : copy.login.codeRequired}
                        </FormMessage>
                      </FormItem>
                    )}
                  />
                  {footer}
                </form>
              </Form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
