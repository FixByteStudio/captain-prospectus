/**
 * `/login` — docs/design.md › The login page, ADR-0029.
 *
 * Only the admin form exists so far, which is also break-glass: `OWNER_EMAIL`
 * plus `BREAK_GLASS`, and nothing on screen names it. The code form, its
 * "Accès administrateur" switch, the lockout and the outbox line come with
 * the later entries of epic-own-login.
 *
 * It renders outside the identity gate (App.tsx) and never asks `/api/me`:
 * a phone sent here by a 401 must reach it with no session. It ships in the
 * field shell, so the field rules hold — `copy/field`, native inputs and
 * labels, 48px targets.
 */
import { useState } from "react";
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
import { useOnline } from "../hooks/use-online";
import { meResponseSchema, passphraseLoginSchema, type LoginRequest } from "../../shared/schemas";

/** Only "is it filled" is the client's to judge; the server judges the rest. */
const adminFormSchema = z.pick(passphraseLoginSchema, { email: true, passphrase: true });
type AdminForm = z.infer<typeof adminFormSchema>;

type Refusal = "refused" | "unreachable" | "failed";

const REFUSAL_COPY: Record<Refusal, string> = {
  refused: copy.login.adminRefused,
  unreachable: copy.login.unreachable,
  failed: copy.login.failed,
};

/** A 401 is a refusal; a rejected fetch never reached the server; the rest is the server's. */
function refusalFor(error: unknown): Refusal {
  if (error instanceof ApiError) return error.status === 401 ? "refused" : "failed";
  return error instanceof TypeError ? "unreachable" : "failed";
}

export function LoginScreen() {
  const navigate = useNavigate();
  const online = useOnline();
  const [refusal, setRefusal] = useState<Refusal | null>(null);

  const form = useForm({
    resolver: standardSchemaResolver(adminFormSchema),
    defaultValues: { email: "", passphrase: "" },
  });
  const submitting = form.formState.isSubmitting;

  const signIn = async (values: AdminForm) => {
    setRefusal(null);
    const body: LoginRequest = { kind: "passphrase", ...values };
    let role: "admin" | "agent";
    try {
      const response = await apiFetch<unknown>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(body),
      });
      role = meResponseSchema.parse(response).role;
    } catch (error) {
      // What was typed stays: react-hook-form keeps the values.
      setRefusal(refusalFor(error));
      return;
    }
    // Always the landing, never the page a 401 interrupted (design.md).
    await navigate(role === "admin" ? "/admin" : "/tournee", { replace: true });
  };

  // One Alert slot, and offline wins it (design.md).
  const alert = !online ? copy.login.offline : refusal ? REFUSAL_COPY[refusal] : null;

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
            <CardDescription className="text-base">{copy.login.adminLede}</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                className="flex flex-col gap-5"
                onSubmit={(e) => void form.handleSubmit(signIn)(e)}
                noValidate
              >
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem className="gap-0">
                      <FormLabel className="text-base font-medium">{copy.login.email}</FormLabel>
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
                  control={form.control}
                  name="passphrase"
                  render={({ field }) => (
                    <FormItem className="gap-0">
                      <FormLabel className="text-base font-medium">
                        {copy.login.passphrase}
                      </FormLabel>
                      <FormControl>
                        <Input
                          touch
                          className="mt-1.5"
                          type="password"
                          autoComplete="current-password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="mt-1.5">{copy.login.passphraseRequired}</FormMessage>
                    </FormItem>
                  )}
                />

                {alert && (
                  <Alert variant={online ? "destructive" : "default"}>
                    <AlertDescription
                      className={online ? "text-base" : "text-base text-foreground"}
                    >
                      {alert}
                    </AlertDescription>
                  </Alert>
                )}

                <button
                  type="submit"
                  disabled={!online || submitting}
                  className={buttonVariants({ size: "touch", className: "w-full" })}
                >
                  {submitting && <Spinner />}
                  {copy.login.submit}
                </button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
