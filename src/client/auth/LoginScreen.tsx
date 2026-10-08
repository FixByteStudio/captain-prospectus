/**
 * `/login` — docs/design.md › The login page, ADR-0029.
 *
 * The code form is the default: an agent types the one-time code an admin
 * generated, as typed — the server normalises it. "Accès administrateur" swaps
 * in the admin form, which is also break-glass (`OWNER_EMAIL` plus
 * `BREAK_GLASS`), and nothing on screen names it. The swap is screen state,
 * not a URL. The outbox line comes with a later entry of epic-own-login.
 *
 * It renders outside the identity gate (App.tsx) and never asks `/api/me`:
 * a phone sent here by a 401 must reach it with no session. It ships in the
 * field shell, so the field rules hold — `copy/field`, native inputs and
 * labels, 48px targets.
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
import { Band, BandBrand } from "../Band";
import { copy } from "../copy/field";
import { formatBrusselsTime } from "../format";
import { useOnline } from "../hooks/use-online";
import {
  codeLoginSchema,
  meResponseSchema,
  passphraseLoginSchema,
  type LoginRequest,
} from "../../shared/schemas";

/** Only "is it filled" is the client's to judge; the server judges the rest. */
const codeFormSchema = z.pick(codeLoginSchema, { code: true });
const adminFormSchema = z.pick(passphraseLoginSchema, { email: true, passphrase: true });
type CodeForm = z.infer<typeof codeFormSchema>;
type AdminForm = z.infer<typeof adminFormSchema>;

type Mode = "code" | "admin";
type Refusal = "refused" | "unreachable" | "failed";

/** A 429 locks the button until `until`; `exact` says Retry-After gave the time. */
type Lockout = { until: number; exact: boolean };

/** What design.md waits when the 429 carries no usable Retry-After. */
const LOCKOUT_FALLBACK_MS = 15 * 60 * 1000;

function refusalCopy(refusal: Refusal, mode: Mode): string {
  if (refusal === "refused")
    return mode === "code" ? copy.login.codeRefused : copy.login.adminRefused;
  return refusal === "unreachable" ? copy.login.unreachable : copy.login.failed;
}

/** A 401 is a refusal; a rejected fetch never reached the server; the rest is the server's. */
function refusalFor(error: unknown): Refusal {
  if (error instanceof ApiError) return error.status === 401 ? "refused" : "failed";
  return error instanceof TypeError ? "unreachable" : "failed";
}

const labelClass = "text-base font-medium";

export function LoginScreen() {
  const navigate = useNavigate();
  const online = useOnline();
  const [mode, setMode] = useState<Mode>("code");
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const [lockout, setLockout] = useState<Lockout | null>(null);

  const codeForm = useForm({
    resolver: standardSchemaResolver(codeFormSchema),
    defaultValues: { code: "" },
  });
  const adminForm = useForm({
    resolver: standardSchemaResolver(adminFormSchema),
    defaultValues: { email: "", passphrase: "" },
  });
  // Either form: a swap mid-request must not free the other's button or word
  // the answer in the wrong form's terms, so the swap waits too.
  const submitting = codeForm.formState.isSubmitting || adminForm.formState.isSubmitting;

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
        const wait = error.retryAfter !== null ? error.retryAfter * 1000 : LOCKOUT_FALLBACK_MS;
        setLockout({ until: Date.now() + wait, exact });
        return;
      }
      // What was typed stays: react-hook-form keeps the values.
      setRefusal(refusalFor(error));
      return;
    }
    // Always the landing, never the page a 401 interrupted (design.md).
    await navigate(role === "admin" ? "/admin" : "/tournee", { replace: true });
  };

  const signInWithCode = (values: CodeForm) => signIn({ kind: "code", ...values });
  const signInAsAdmin = (values: AdminForm) => signIn({ kind: "passphrase", ...values });

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
    <>
      <Band>
        <BandBrand />
      </Band>
      <main className="px-4 pt-6 pb-page">
        <Card className="mx-auto w-full max-w-sm">
          <CardHeader>
            <CardTitle>
              <h1 className="text-title">{copy.login.title}</h1>
            </CardTitle>
            <CardDescription className="text-base">
              {mode === "code" ? copy.login.codeLede : copy.login.adminLede}
            </CardDescription>
          </CardHeader>
          <CardContent>
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
                        <FormMessage className="mt-1.5">{copy.login.codeRequired}</FormMessage>
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
                        <FormMessage className="mt-1.5">{copy.login.emailRequired}</FormMessage>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={adminForm.control}
                    name="passphrase"
                    render={({ field }) => (
                      <FormItem className="gap-0">
                        <FormLabel className={labelClass}>{copy.login.passphrase}</FormLabel>
                        <FormControl>
                          <Input
                            touch
                            className="mt-1.5"
                            type="password"
                            autoComplete="current-password"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage className="mt-1.5">
                          {copy.login.passphraseRequired}
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
      </main>
    </>
  );
}
