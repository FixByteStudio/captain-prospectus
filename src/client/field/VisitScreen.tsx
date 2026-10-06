/**
 * Logging a visit — docs/domains/field-operations.md, docs/design.md.
 *
 * The outcome list takes an unreasonable share of the screen on purpose: it is
 * the one thing the whole app exists to capture, and it has to be hittable by a
 * thumb without the agent looking carefully.
 *
 * "Enregistrer la visite" validates, then asks once (`SaveConfirmation`, GH
 * #125); only the confirmation's "Enregistrer" saves. Saving writes to the
 * Dexie outbox and asks for a sync. It does not wait for one — INVARIANT 5
 * keeps the row until the server lists it in `accepted`, so an agent with no
 * signal is finished the moment they tap save.
 *
 * The form runs on react-hook-form (ADR-0018), but the rules do not live here:
 * the resolver calls `toVisit` from `visit-draft.ts`, the same pure function
 * the tests exercise. react-hook-form owns which control is marked and what is
 * announced; it owns no validation and, above all, no persistence.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Link, useNavigate, useParams } from "react-router";
import { useForm, useWatch, type Resolver } from "react-hook-form";
import { ArrowLeftIcon } from "lucide-react";
import { BACK_LINK_CLASS, BackLink } from "./BackLink";
import { OutcomeCard, outcomeDomId } from "./OutcomeCard";
import { StepIndicator } from "./StepIndicator";
import { useLiveQuery } from "dexie-react-hooks";
import { buttonVariants } from "@/ui/button-variants";
import { FieldCheckbox, FieldRadioGroup, FieldRadioOption } from "@/ui/field-controls";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/ui/form";
import { ScriptQuestions, questionDomId } from "./ScriptQuestions";
import { Input } from "@/ui/input";
import { Textarea } from "@/ui/textarea";
import { apiFetch } from "../api";
import { copy, REFUSAL_REASON_LABELS, TYPE_LABELS } from "../copy/field";
import { cn } from "../lib/utils";
import { OUTCOMES, REFUSAL_REASONS, hasWhenStep, type Outcome } from "../../shared/constants";
import { visitHistoryResponseSchema } from "../../shared/schemas";
import { answerableQuestions } from "../../shared/answers";
import type { Answers, Script } from "../../shared/schemas";
import { cacheVisitHistory, fieldDb, getMeta, queueVisit } from "./db";
import {
  answeredCount,
  asksRefusalReason,
  emptyDraft,
  toVisit,
  withOutcome,
  type VisitDraft,
} from "./visit-draft";
import { brusselsMidnightDaysFromNow, periodDates } from "../../shared/period";
import { useAgentPosition } from "./useAgentPosition";
import { useRegisterDirty } from "./leave-guard";
import { useSyncState } from "./useSync";
import { SaveConfirmation, type SaveSummary } from "./SaveConfirmation";
import { useIsMobile } from "@/hooks/use-mobile";
import { VisitHistory } from "./VisitHistory";
import { VisitSidePane } from "./VisitSidePane";

/** Ties the outcome radiogroup to its own error line (docs/design.md, "One
 * decision per screen": the message says why, the focus says where). */
const OUTCOME_ERROR_ID = "visit-outcome-error";
/** Ties the when radiogroup to its own error line, same reasoning as above. */
const WHEN_ERROR_ID = "visit-when-error";
/** Stable id for the when radiogroup's first option, so a blocked save can
 * focus it (when-step.md). */
const WHEN_TODAY_ID = "visit-when-today";
/** Ties the refusal-reason radiogroup to its own error line
 * (refusal-reasons.md), same reasoning as `WHEN_ERROR_ID`. */
const REFUSAL_REASON_ERROR_ID = "visit-refusal-reason-error";
/** Stable id for the refusal-reason radiogroup's first option, so a blocked
 * save can focus it (refusal-reasons.md). */
const REFUSAL_REASON_FIRST_ID = "visit-refusal-reason-first";

export function VisitScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { syncNow, identity, confirmed } = useSyncState();
  const { point } = useAgentPosition();
  // Below 768px one column; from 768px the form left and `VisitSidePane`
  // right (spec-gh-126). Read in JS rather than `md:` classes alone, because
  // the history moves between two slots and the pane must not mount at all
  // on a phone — it is what loads Leaflet.
  const isMobile = useIsMobile();

  /** The outbox write itself failed, so nothing is queued. */
  const [saveFailed, setSaveFailed] = useState(false);

  /**
   * The validated draft the confirmation is showing, or `null` when it is
   * closed. The draft, not a built `Visit`: `save` builds the visit at the
   * tap on "Enregistrer", so `visitedAt` and the position are that moment's.
   * Closing it (Modifier) touches nothing — the form is still mounted
   * underneath with every value in it.
   */
  const [pending, setPending] = useState<VisitDraft | null>(null);
  /**
   * Set for the length of the outbox write; it disables « Enregistrer », so a
   * second tap cannot start a second `add` of the same visit id — that one
   * would fail and report a save that had in fact succeeded.
   */
  const [saving, setSaving] = useState(false);
  /** « Enregistrer la visite », where focus returns when the confirmation closes. */
  const saveButtonRef = useRef<HTMLButtonElement>(null);

  // The visit's id is minted once, not per validation attempt: it is the
  // idempotency key (INVARIANT 4), so re-validating must not mint a second one.
  const [visitId] = useState(() => crypto.randomUUID());

  /**
   * The script as it stood when this form opened, read once and pinned.
   *
   * Not a live query on purpose: scripts.md says a visit records the version it
   * was answered with even if a newer one arrived before it synced, and a sync
   * landing mid-form must not swap the questions under the agent's thumb.
   * `undefined` means not read yet; `null` means none is cached.
   */
  const [script, setScript] = useState<Script | null | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    void getMeta(fieldDb, "script").then((cached) => {
      if (!cancelled) setScript(cached ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /** Only what this build can render; see `answers.ts` for why some are skipped. */
  const questions = useMemo(() => (script ? answerableQuestions(script.questions) : []), [script]);
  const hasQuestions = questions.length > 0;

  const [step, setStep] = useState<"outcome" | "questions">("outcome");

  /**
   * The resolver is `toVisit`, the pure function in `visit-draft.ts` — the one
   * the test suite drives directly. It already returns which control failed and
   * why; this only restates that as react-hook-form's error shape, so the two
   * can never disagree about whether a visit is valid.
   *
   * The context it needs is a placeholder: `save` builds the real visit with a
   * fresh clock reading and the position as it stands at that moment. Nothing
   * validated here is ever the row that gets queued.
   */
  const resolver = useMemo<Resolver<VisitDraft>>(
    () => (values) => {
      const result = toVisit(values, {
        id: visitId,
        prospectId: id ?? crypto.randomUUID(),
        visitedAt: Date.now(),
        position: point,
        script: script ?? null,
      });
      if (result.ok) return { values, errors: {} };

      const errors: Record<string, unknown> = {};
      for (const [field, value] of Object.entries(result.errors)) {
        if (field === "answers" && value && typeof value === "object") {
          // Nested, so each question's control is marked on its own rather
          // than the whole step going red.
          errors.answers = Object.fromEntries(
            Object.entries(value).map(([key, type]) => [key, { type }]),
          );
        } else if (typeof value === "string") {
          errors[field] = { type: value };
        }
      }
      return { values: {}, errors };
    },
    [id, point, script, visitId],
  );

  const form = useForm<VisitDraft>({ resolver, defaultValues: emptyDraft });
  /**
   * `useWatch`, not `form.watch()`: the latter returns a function the React
   * Compiler cannot memoize, so it bails out of compiling this component.
   * Only the values step 2's own controls render from are watched: the
   * outcome (which when, question and reason controls exist at all), the
   * when choice, the answers and the refusal reason.
   */
  const outcome = useWatch({ control: form.control, name: "outcome" });
  const when = useWatch({ control: form.control, name: "when" });
  const answers = useWatch({ control: form.control, name: "answers" });
  const refusalReason = useWatch({ control: form.control, name: "refusalReason" });
  const errors = form.formState.errors;

  // À relancer and Personne sur place share the when step (when-step.md);
  // every other result has none.
  const showsWhenStep = outcome !== null && hasWhenStep(outcome);
  // Pas intéressé's step 2 holds the refusal reason instead of the script
  // (refusal-reasons.md).
  const showsRefusalStep = outcome !== null && asksRefusalReason(outcome);
  // Whether there is a step 2 at all — Pas intéressé is the one exception to
  // "step 2 exists only when there is something to ask" (field-operations.md).
  const hasStep2 = hasQuestions || showsRefusalStep;

  // The date input's `min` (when-step.md): computed once per mount, not on
  // every render, since a form left open across midnight should not have its
  // floor silently move under an agent mid-tap. Read as a Brussels calendar
  // date, never through the device's zone. Across midnight the floor can lag
  // a day behind the save's own rule; `toVisit`'s `notAfterToday` catches that.
  const [tomorrowDateInput] = useState(
    () => periodDates(brusselsMidnightDaysFromNow(Date.now(), 0), 2)[1] ?? "",
  );

  // A tab tap unmounts this form (#74, spec-gh-66): the leave guard asks
  // before it does, unless save() has already navigated it away itself.
  useRegisterDirty(form.formState.isDirty);

  /**
   * design.md: a blocked save (or a blocked "Continuer") moves the screen to
   * the problem rather than sitting there looking like nothing happened. The
   * outcome is missing far more often than a question is, so it is checked
   * first; a missing outcome always wins the focus over a below-the-fold
   * answer, since the agent cannot reach step 2's questions without one.
   *
   * Reads `getFieldState`, not `form.formState.errors`: the latter is the
   * value from the *last render*, and `goToQuestions` calls this in the same
   * tick `form.trigger(...)` resolves, before React has re-rendered with the
   * new errors. `getFieldState` reads react-hook-form's live internal state
   * instead, so both callers see the same, current answer.
   *
   * `flushSync` around `setStep`: this can run from step 2 (an outcome- or
   * date-shaped issue `visitSchema` alone catches, past `goToQuestions`'s own
   * check), and outside `flushSync` React only *schedules* the step-1 render.
   * Without it, `getElementById`/`setFocus` below would run against step 2's
   * still-mounted DOM and find nothing to focus.
   */
  const focusFirstProblem = useCallback(() => {
    if (form.getFieldState("outcome").invalid) {
      flushSync(() => setStep("outcome"));
      const element = document.getElementById(outcomeDomId(OUTCOMES[0]));
      element?.scrollIntoView({ block: "center" });
      element?.focus({ preventScroll: true });
      return;
    }

    // Only Intéressé and Converti ask the script (`asksScript`), and only
    // their step 2 saves, so no step change is needed to reach an invalid
    // question.
    const firstKey = questions.find(
      (question) => form.getFieldState(`answers.${question.key}`).invalid,
    )?.key;
    if (firstKey) {
      const element = document.getElementById(questionDomId(firstKey));
      element?.scrollIntoView({ block: "center", behavior: "smooth" });
      element?.focus({ preventScroll: true });
      return;
    }

    // The when radios and the date sit on step 2 once there is a script, and
    // on the single outcome step otherwise (when-step.md) — wherever they
    // are actually mounted is where focus must land.
    if (form.getFieldState("when").invalid) {
      if (hasQuestions) flushSync(() => setStep("questions"));
      const element = document.getElementById(WHEN_TODAY_ID);
      element?.scrollIntoView({ block: "center" });
      element?.focus({ preventScroll: true });
      return;
    }
    if (form.getFieldState("followUpDate").invalid) {
      if (hasQuestions) flushSync(() => setStep("questions"));
      form.setFocus("followUpDate");
      return;
    }

    // The refusal reason always sits on step 2 (field-operations.md).
    if (form.getFieldState("refusalReason").invalid) {
      flushSync(() => setStep("questions"));
      const element = document.getElementById(REFUSAL_REASON_FIRST_ID);
      element?.scrollIntoView({ block: "center" });
      element?.focus({ preventScroll: true });
      return;
    }
    // Autre with a blank note (refusal-reasons.md). Only that notes error
    // moves focus: a `tooLong` keeps its behaviour on every other outcome.
    if (form.getFieldState("notes").error?.type === "requiredForOther") {
      if (hasStep2) flushSync(() => setStep("questions"));
      form.setFocus("notes");
      return;
    }
  }, [form, hasQuestions, hasStep2, questions]);

  /**
   * Step 1 does not save; it checks its own two controls and moves on. Doing
   * this with `trigger` rather than a submit keeps the questions' requiredness
   * out of it — they belong to the screen after this one.
   */
  const goToQuestions = useCallback(async () => {
    // The when choice and the date belong to step 2 now (when-step.md); step
    // 1 checks only its own control.
    const ok = await form.trigger(["outcome"]);
    if (ok) setStep("questions");
    else focusFirstProblem();
  }, [form, focusFirstProblem]);

  /** Per-question errors, flattened back to the shape `ScriptQuestions` reads. */
  const answerErrors = useMemo(() => {
    const raw = errors.answers as Record<string, { type?: string }> | undefined;
    if (!raw) return undefined;
    const flat: Record<string, "required" | "invalid"> = {};
    for (const [key, error] of Object.entries(raw)) {
      flat[key] = error?.type === "invalid" ? "invalid" : "required";
    }
    return flat;
  }, [errors.answers]);

  /**
   * Notes lives on step 2 when there is one, and on the one-step path
   * otherwise (docs/design.md, "one screen, notes inline") — a no-script
   * visit still needs somewhere to write "ferme le lundi". Extracted so the
   * two call sites render the exact same field rather than a second copy of
   * it drifting from the first.
   */
  const notesField = (
    <FormField
      control={form.control}
      name="notes"
      render={({ field }) => (
        <FormItem className="mt-6 gap-0">
          <FormLabel className="text-base font-medium">{copy.visit.notes}</FormLabel>
          <FormControl>
            <Textarea className="mt-1.5 text-base md:text-base" rows={3} {...field} />
          </FormControl>
          <FormMessage className="mt-1.5">
            {errors.notes?.type === "requiredForOther"
              ? copy.visit.refusalOtherNeedsNote
              : copy.visit.notesTooLong}
          </FormMessage>
        </FormItem>
      )}
    />
  );

  /**
   * The when step, shared by À relancer and Personne sur place (when-step.md,
   * CAP-2). Native radios (ADR-0015); the date input only appears once
   * "Choisir une date" is picked, `min` fixed at tomorrow so the input itself
   * refuses what the error line also blocks.
   */
  const whenField = (
    <div className="border-border mt-6 border-t pt-4">
      <p className="mb-3 font-medium">{copy.visit.when}</p>
      <FieldRadioGroup
        label={copy.visit.when}
        invalid={errors.when !== undefined}
        aria-describedby={errors.when ? WHEN_ERROR_ID : undefined}
        className="gap-3"
      >
        <FieldRadioOption
          id={WHEN_TODAY_ID}
          name="when"
          value="today"
          checked={when === "today"}
          onSelect={() => {
            form.setValue("when", "today");
            form.setValue("followUpDate", "");
            form.clearErrors(["when", "followUpDate"]);
          }}
        >
          {copy.visit.whenToday}
        </FieldRadioOption>
        <FieldRadioOption
          name="when"
          value="date"
          checked={when === "date"}
          onSelect={() => {
            form.setValue("when", "date");
            form.clearErrors("when");
          }}
        >
          {copy.visit.whenDate}
        </FieldRadioOption>
      </FieldRadioGroup>
      {errors.when && (
        <p role="alert" id={WHEN_ERROR_ID} className="text-destructive mt-1.5 text-sm">
          {copy.visit.whenRequired}
        </p>
      )}

      {when === "date" && (
        <FormField
          control={form.control}
          name="followUpDate"
          render={({ field }) => (
            <FormItem className="mt-4 gap-0">
              <FormLabel className="text-base font-medium">{copy.visit.followUpAt}</FormLabel>
              <FormControl>
                <Input type="date" touch min={tomorrowDateInput} className="mt-1.5" {...field} />
              </FormControl>
              <FormMessage className="mt-1.5">
                {errors.followUpDate?.type === "invalid"
                  ? copy.visit.followUpInvalid
                  : errors.followUpDate?.type === "notAfterToday"
                    ? copy.visit.followUpNotAfterToday
                    : copy.visit.followUpRequired}
              </FormMessage>
            </FormItem>
          )}
        />
      )}
    </div>
  );

  /**
   * Pas intéressé's step 2: the reason radios replace the script's
   * questions (refusal-reasons.md). Native radios, same reasons as
   * `whenField` (ADR-0015, ADR-0026); the 7 values and their order come
   * straight from `REFUSAL_REASONS`.
   */
  const refusalReasonField = (
    <div className="border-border mt-6 border-t pt-4">
      <p className="mb-3 font-medium">{copy.visit.refusalReason}</p>
      <FieldRadioGroup
        label={copy.visit.refusalReason}
        invalid={errors.refusalReason !== undefined}
        aria-describedby={errors.refusalReason ? REFUSAL_REASON_ERROR_ID : undefined}
        className="gap-3"
      >
        {REFUSAL_REASONS.map((reason, index) => (
          <FieldRadioOption
            key={reason}
            id={index === 0 ? REFUSAL_REASON_FIRST_ID : undefined}
            name="refusalReason"
            value={reason}
            checked={refusalReason === reason}
            onSelect={() => {
              form.setValue("refusalReason", reason);
              form.clearErrors("refusalReason");
              // "Autre" is the only reason that needs the note; picking any
              // other one clears an error left from a previous "Autre" pick —
              // but never a real `tooLong`, which this pick did not fix.
              if (
                reason !== "other" &&
                form.getFieldState("notes").error?.type === "requiredForOther"
              ) {
                form.clearErrors("notes");
              }
            }}
          >
            {REFUSAL_REASON_LABELS[reason]}
          </FieldRadioOption>
        ))}
      </FieldRadioGroup>
      {errors.refusalReason && (
        <p role="alert" id={REFUSAL_REASON_ERROR_ID} className="text-destructive mt-1.5 text-sm">
          {copy.visit.refusalReasonRequired}
        </p>
      )}
    </div>
  );

  const prospect = useLiveQuery(
    async () => (id ? ((await fieldDb.prospects.get(id)) ?? null) : null),
    [id],
    undefined,
  );
  const pendingProspect = useLiveQuery(
    async () => (id ? ((await fieldDb.outboxProspects.get(id)) ?? null) : null),
    [id],
    undefined,
  );
  const history = useLiveQuery(
    async () =>
      id
        ? await fieldDb.visitHistory.where("prospectId").equals(id).reverse().sortBy("visitedAt")
        : [],
    [id],
    [],
  );

  // Refresh the cached history when there is a network. Offline this is a
  // no-op and the screen shows whatever the last pull left behind.
  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    // `id` is a decoded router param; encode it back into the path segment so
    // a value containing `/`, `?` or `#` cannot change which route this hits.
    // In practice `prospectIdParamSchema` on the Worker rejects anything that
    // is not a UUID with a 400, but the path should not depend on that.
    void apiFetch<unknown>(`/api/agent/prospects/${encodeURIComponent(id)}/visits`)
      .then((body) => {
        if (cancelled) return;
        const parsed = visitHistoryResponseSchema.safeParse(body);
        if (parsed.success) return cacheVisitHistory(fieldDb, id, parsed.data.visits);
      })
      .catch(() => {
        // Offline, or the prospect is not on the server yet. Both are normal
        // here and neither is worth a message: the cache already answers.
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  const save = useCallback(
    async (values: VisitDraft) => {
      if (!id) return;

      const result = toVisit(values, {
        id: visitId,
        prospectId: id,
        visitedAt: Date.now(),
        position: point,
        script: script ?? null,
      });

      // Unreachable: the resolver ran this same function on these same values.
      // Kept because `toVisit` returning a visit is what makes the write below
      // safe, and a silent `as` here would be exactly the wrong economy.
      if (!result.ok) return;

      setSaveFailed(false);
      setSaving(true);

      // INVARIANT 3: the prospect's status is the server's to derive from this
      // visit. Nothing here touches the local copy — the new status arrives on
      // the next pull, in the list.
      try {
        await queueVisit(fieldDb, result.visit, identity, !confirmed);
      } catch {
        // Until this row exists, the outbox is not the only copy of the visit —
        // there is no copy at all (INVARIANT 5). A quota-exhausted or evicted
        // IndexedDB must therefore say so and leave the form standing, rather
        // than navigating away from a visit that was never queued.
        setSaveFailed(true);
        setSaving(false);
        return;
      }

      void syncNow();
      await navigate("/tournee", { replace: true, state: { saved: true } });
    },
    [confirmed, id, identity, navigate, point, script, syncNow, visitId],
  );

  // A sync the server refuses drops the cached round (GH #35), and it can land
  // while this form is open. Once the prospect has been shown, keep its name
  // so the visit being typed can still be saved rather than turning into
  // "not found" — INVARIANT 5. Adjusted during render, React's pattern for
  // state derived from a changing value.
  const liveName = prospect?.name ?? pendingProspect?.name;
  const liveType = prospect?.type ?? pendingProspect?.type;
  const [shown, setShown] = useState({ id, name: liveName, type: liveType });
  if (liveName && (shown.id !== id || shown.name !== liveName || shown.type !== liveType)) {
    setShown({ id, name: liveName, type: liveType });
  }
  const kept = shown.id === id ? shown : null;
  const name = liveName ?? kept?.name;
  const type = liveType ?? kept?.type;

  // Only a validated draft reaches `pending`, so its outcome is set.
  const summary: SaveSummary | null =
    pending?.outcome && name
      ? {
          name,
          outcome: pending.outcome,
          flyerGiven: pending.flyerGiven,
          // À relancer, Personne sur place and Pas intéressé send no answers
          // (`toVisit`), so the sheet counts none — it shows what is sent.
          answerCount: !hasQuestions
            ? null
            : hasWhenStep(pending.outcome) || asksRefusalReason(pending.outcome)
              ? 0
              : answeredCount(
                  pending.answers,
                  questions.map((q) => q.key),
                ),
          // Trimmed as `toVisit` queues it, so the summary shows what is sent.
          notes: pending.notes.trim(),
          // Only Pas intéressé's row shows (SaveConfirmation).
          refusalReason: asksRefusalReason(pending.outcome) ? pending.refusalReason : null,
        }
      : null;

  // useLiveQuery returns undefined until its first read resolves; null means
  // "looked and found nothing". Only the latter is a missing prospect.
  const settled = prospect !== undefined && pendingProspect !== undefined;
  if (settled && !name) {
    return (
      <section>
        <p className="text-muted-foreground">{copy.errors.notFound}</p>
        <Link
          to="/tournee"
          className={cn(buttonVariants({ variant: "outline", size: "touch" }), "mt-4")}
        >
          {copy.visit.back}
        </Link>
      </section>
    );
  }

  return (
    <Form {...form}>
      <form
        className={isMobile ? "pb-action-bar" : "grid grid-cols-5 gap-6"}
        onSubmit={(e) =>
          void form.handleSubmit(
            (values) => {
              setSaveFailed(false);
              setPending(values);
            },
            () => focusFirstProblem(),
          )(e)
        }
        noValidate
      >
        <div className={cn(!isMobile && "col-span-3")}>
          <header>
            {step === "outcome" ? (
              <BackLink />
            ) : (
              /* Back to step 1 with the draft intact — leaving the visit is one
               step further out, never a single stray tap (design.md). Same
               look as BackLink, since both name the place they return to. */
              <button
                type="button"
                className={`${BACK_LINK_CLASS} -ml-1`}
                onClick={() => setStep("outcome")}
              >
                <ArrowLeftIcon aria-hidden className="size-4" />
                {copy.visit.backToOutcome}
              </button>
            )}
            {/* Hidden with no step 2: the one-step path must not read "1 sur 2". */}
            {hasStep2 && (
              <StepIndicator
                step={step === "outcome" ? 1 : 2}
                step2={showsWhenStep ? "when" : showsRefusalStep ? "refusal" : "questions"}
              />
            )}
            <h2 className="mt-1 text-xl font-semibold tracking-[-0.005em]">{name ?? ""}</h2>
            {type && <p className="text-muted-foreground text-sm">{TYPE_LABELS[type]}</p>}
          </header>

          {step === "outcome" && (
            <>
              <div className="border-border mt-6 border-t pt-4">
                <FormField
                  control={form.control}
                  name="flyerGiven"
                  render={({ field }) => (
                    <div className="border-border bg-card rounded-xl border p-4">
                      <FieldCheckbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        hint={copy.visit.flyerHint}
                      >
                        {copy.visit.flyerGiven}
                      </FieldCheckbox>
                    </div>
                  )}
                />
              </div>

              <div className="border-border mt-4 border-t pt-4">
                <p className="mb-3 font-medium">{copy.visit.outcome}</p>
                <FieldRadioGroup
                  label={copy.visit.outcome}
                  invalid={errors.outcome !== undefined}
                  aria-describedby={errors.outcome ? OUTCOME_ERROR_ID : undefined}
                  className="gap-3"
                >
                  {OUTCOMES.map((option) => (
                    <OutcomeCard
                      key={option}
                      outcome={option}
                      checked={outcome === option}
                      onSelect={(value: Outcome) => {
                        // `withOutcome` resets the when choice to the new
                        // result's own default and drops a date the new
                        // outcome does not use — see its comment for why.
                        const next = withOutcome(form.getValues(), value);
                        form.setValue("outcome", next.outcome);
                        form.setValue("when", next.when);
                        form.setValue("followUpDate", next.followUpDate);
                        form.setValue("refusalReason", next.refusalReason);
                        // Controls behind the old outcome may have just been
                        // unmounted; an error pinned to one would block saving
                        // with nothing on screen.
                        form.clearErrors(["outcome", "when", "followUpDate", "refusalReason"]);
                        // Only the refusal step's own `requiredForOther` is
                        // cleared here — a real `tooLong` on Notes is not
                        // fixed by changing the outcome.
                        if (form.getFieldState("notes").error?.type === "requiredForOther") {
                          form.clearErrors("notes");
                        }
                      }}
                    />
                  ))}
                </FieldRadioGroup>
                {errors.outcome && (
                  <p role="alert" id={OUTCOME_ERROR_ID} className="text-destructive mt-1.5 text-sm">
                    {copy.visit.outcomeRequired}
                  </p>
                )}
              </div>

              {/* One screen, notes inline (docs/design.md): with no script
                there is no step 2 to carry the when step or Notes, so both
                live here instead — once the script read has settled, so
                neither flashes here and then moves to step 2 under the
                agent's thumb. The when step sits above Notes (when-step.md).
                Pas intéressé is the one exception (field-operations.md), so
                `hasStep2` already excludes it. */}
              {script !== undefined && !hasStep2 && (
                <>
                  {showsWhenStep && whenField}
                  {notesField}
                </>
              )}
            </>
          )}

          {step === "questions" && (
            <>
              {/* À relancer and Personne sur place replace the script's
                questions with the when radios (when-step.md), and Pas
                intéressé replaces them with the refusal reason
                (field-operations.md). */}
              {!showsWhenStep && !showsRefusalStep && (
                <div className="border-border mt-6 border-t pt-4">
                  <h3 className="font-medium">{copy.visit.questions}</h3>
                  <div className="mt-4">
                    <ScriptQuestions
                      questions={questions}
                      answers={answers ?? {}}
                      errors={answerErrors}
                      onChange={(next: Answers) =>
                        form.setValue("answers", next, { shouldValidate: false })
                      }
                    />
                  </div>
                </div>
              )}

              {showsWhenStep && whenField}
              {showsRefusalStep && refusalReasonField}

              {notesField}
            </>
          )}

          {/* Below 768px the history sits under step 1; from 768px it lives in
            the side pane instead, on both steps (spec-gh-126). */}
          {isMobile && step === "outcome" && (
            <VisitHistory
              history={history}
              lastVisitAt={prospect?.lastVisitAt ?? null}
              className="border-border mt-8 border-t pt-4"
            />
          )}

          {/* Sticky, because the outcome list is taller than a phone and the action
            should not require scrolling back past it. `.above-tab-bar` sits
            it directly above the tab bar below 768px rather than under it
            (app.css); at that size the tab bar itself owns the safe-area
            inset, so this carries only its own breathing room. */}
          <div
            className={cn(
              "above-tab-bar bg-background border-border border-t pt-3",
              // From 768px there is no tab bar to clear, and a bar across the
              // whole viewport would sit under the side pane too: it sticks to
              // the bottom of the form's own column instead.
              isMobile ? "fixed inset-x-0 px-4" : "sticky mt-6",
            )}
          >
            {/* An action keeps its name through the flow, so « Enregistrer la
              visite » appears only on the screen that actually saves. */}
            {step === "outcome" && hasStep2 ? (
              /* `key` is load-bearing: without it React reconciles both branches
               to the same <button> node, and a node that has been type="submit"
               on step 2 keeps submitting when step 1 renders it as
               type="button" again — tapping « Continuer » saved the visit. */
              <button
                key="continue"
                type="button"
                className={cn(buttonVariants({ size: "touch" }), "w-full")}
                onClick={() => void goToQuestions()}
              >
                {copy.visit.continue}
              </button>
            ) : (
              <button
                key="save"
                ref={saveButtonRef}
                type="submit"
                className={cn(buttonVariants({ size: "touch" }), "w-full")}
              >
                {copy.visit.save}
              </button>
            )}
          </div>
        </div>

        {!isMobile && id && (
          <VisitSidePane
            prospectId={id}
            history={history}
            lastVisitAt={prospect?.lastVisitAt ?? null}
            className="sticky top-4 col-span-2 self-start"
          />
        )}
      </form>

      <SaveConfirmation
        open={summary !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        summary={summary}
        saving={saving}
        saveFailed={saveFailed}
        onConfirm={() => {
          if (pending) void save(pending);
        }}
        returnFocusTo={saveButtonRef}
      />
    </Form>
  );
}
