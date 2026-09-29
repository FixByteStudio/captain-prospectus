/**
 * A place the agent found that the base does not have —
 * docs/domains/field-operations.md#field-prospects.
 *
 * Name and type are required; the position defaults to the current reading,
 * which is what lets Flow 4 put the place on the round as the nearest stop.
 * The row goes into the outbox and appears on the round immediately, before
 * any sync, so an agent can add a food truck and visit it on the spot.
 *
 * It sends only what `fieldProspectSchema` declares. `source`, `status` and
 * ownership are the server's (INVARIANT 2): it forces source = field, status =
 * assigned, and assigns it to the verified identity that sent it.
 *
 * The form runs on react-hook-form (ADR-0018). Its resolver is `z.pick` of the
 * shared schema, so the caps the server enforces are the caps the control
 * enforces — one definition, not a copy.
 */
import { useCallback, useState } from "react";
import { useNavigate } from "react-router";
import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import * as z from "zod/mini";
import { LocateFixedIcon, MapPinIcon, MapPinPlusIcon } from "lucide-react";
import { BackLink } from "./BackLink";
import { buttonVariants } from "@/ui/button-variants";
import { cn } from "../lib/utils";
import { FieldRadioGroup, FieldRadioOption } from "@/ui/field-controls";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/ui/form";
import { Input } from "@/ui/input";
import { copy, TYPE_LABELS } from "../copy/field";
import { formatCoordinate } from "../format";
import { PROSPECT_TYPES, type ProspectType } from "../../shared/constants";
import { fieldProspectSchema } from "../../shared/schemas";
import { fieldDb } from "./db";
import { useAgentPosition } from "./useAgentPosition";
import { useRegisterDirty } from "./leave-guard";
import { useSyncState } from "./useSync";

/**
 * The typed fields only. `id`, `createdAt` and the position are not typed by
 * anyone, so they are composed at submit rather than held as form state.
 */
const addProspectFormSchema = z.pick(fieldProspectSchema, {
  name: true,
  type: true,
  address: true,
  phone: true,
});

type AddProspectForm = z.infer<typeof addProspectFormSchema>;

export function AddProspectScreen() {
  const navigate = useNavigate();
  const { syncNow, stamp } = useSyncState();
  const { point, locating, refresh } = useAgentPosition();

  /** The outbox write itself failed, so nothing is queued. */
  const [saveFailed, setSaveFailed] = useState(false);

  // Minted once: the client id is the idempotency key (INVARIANT 4).
  const [prospectId] = useState(() => crypto.randomUUID());

  const form = useForm({
    resolver: standardSchemaResolver(addProspectFormSchema),
    defaultValues: { name: "", type: "restaurant", address: "", phone: "" },
  });

  const save = useCallback(
    async (values: AddProspectForm) => {
      const parsed = fieldProspectSchema.safeParse({
        id: prospectId,
        name: values.name,
        type: values.type,
        lat: point?.lat ?? null,
        lng: point?.lng ?? null,
        address: values.address?.trim() || null,
        phone: values.phone?.trim() || null,
        createdAt: Date.now(),
      });

      if (!parsed.success) {
        // The resolver already cleared every typed field, so anything left is a
        // field the agent has no control for — the id, the position, the clock.
        // The name is where a message can still be acted on.
        form.setError("name", { type: "schema" });
        return;
      }

      setSaveFailed(false);

      try {
        await fieldDb.outboxProspects.add({ ...parsed.data, ...stamp });
      } catch {
        // Same rule as the visit form: the outbox row is the only copy of this
        // prospect, so a failed write is reported rather than navigated past.
        setSaveFailed(true);
        return;
      }

      void syncNow();
      await navigate("/tournee", { replace: true, state: { added: true } });
    },
    [form, stamp, navigate, point, prospectId, syncNow],
  );

  const saving = form.formState.isSubmitting;

  // A tab tap unmounts this form (#74, spec-gh-66): the leave guard asks
  // before it does, unless save() has already navigated it away itself.
  useRegisterDirty(form.formState.isDirty);

  return (
    <Form {...form}>
      <form className="pb-action-bar" onSubmit={(e) => void form.handleSubmit(save)(e)} noValidate>
        <header>
          <BackLink />
          <h2 className="mt-1 text-xl font-semibold tracking-[-0.005em]">
            {copy.fieldProspect.title}
          </h2>
        </header>

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem className="mt-6 gap-0">
              <FormLabel className="text-base font-medium">{copy.fieldProspect.name}</FormLabel>
              <FormControl>
                <Input
                  touch
                  className="mt-1.5"
                  placeholder={copy.fieldProspect.namePlaceholder}
                  {...field}
                />
              </FormControl>
              <FormMessage className="mt-1.5">{copy.fieldProspect.nameRequired}</FormMessage>
            </FormItem>
          )}
        />

        <div className="mt-5">
          {/* The group's own aria-label names it; this is the same word for
              sighted agents, hidden so it is not read twice. */}
          <p aria-hidden="true" className="mb-3 font-medium">
            {copy.fieldProspect.type}
          </p>
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FieldRadioGroup label={copy.fieldProspect.type} className="grid-cols-2">
                {PROSPECT_TYPES.map((t) => (
                  <FieldRadioOption
                    key={t}
                    name="type"
                    value={t}
                    checked={field.value === t}
                    onSelect={(value) => field.onChange(value as ProspectType)}
                  >
                    {TYPE_LABELS[t]}
                  </FieldRadioOption>
                ))}
              </FieldRadioGroup>
            )}
          />
        </div>

        {/* A card, not a map: it reads the same offline, where the agent
            often is, and asks nothing of the tile server — docs/design.md,
            "Adding a place". */}
        <div className="mt-6">
          <p className="font-medium">{copy.fieldProspect.position}</p>
          {/* Wraps: at 390px the button drops under the coordinates, right-aligned. */}
          <div className="bg-card border-border mt-1.5 flex flex-wrap items-center gap-3 rounded-lg border p-3">
            <span className="bg-secondary text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-md">
              <MapPinIcon aria-hidden="true" className="size-5" />
            </span>
            <p aria-live="polite" className="min-w-0 flex-1 basis-40 text-base">
              {/* The reading shown is the one « Ajouter » would save right now,
                  so it stays on screen while « Actualiser » looks for a new one. */}
              {point && (
                <span className="tnum block">
                  {copy.fieldProspect.positionSet(
                    formatCoordinate(point.lat),
                    formatCoordinate(point.lng),
                  )}
                </span>
              )}
              {locating ? (
                <span className="text-muted-foreground block">{copy.today.locating}</span>
              ) : (
                !point && (
                  <span className="text-muted-foreground block">
                    {copy.fieldProspect.positionNone}
                  </span>
                )
              )}
            </p>
            <button
              type="button"
              className={cn(
                buttonVariants({ variant: "secondary", size: "touch" }),
                "ml-auto shrink-0",
              )}
              onClick={refresh}
              disabled={locating}
            >
              <LocateFixedIcon aria-hidden="true" />
              {point ? copy.fieldProspect.positionRefresh : copy.fieldProspect.useMyPosition}
            </button>
          </div>
        </div>

        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem className="mt-5 gap-0">
              <FormLabel className="text-base font-medium">
                {copy.fieldProspect.address}{" "}
                <span className="text-muted-foreground font-normal">
                  ({copy.fieldProspect.optional})
                </span>
              </FormLabel>
              <FormControl>
                <Input touch className="mt-1.5" {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage className="mt-1.5">{copy.fieldProspect.addressTooLong}</FormMessage>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem className="mt-4 gap-0">
              <FormLabel className="text-base font-medium">
                {copy.fieldProspect.phone}{" "}
                <span className="text-muted-foreground font-normal">
                  ({copy.fieldProspect.optional})
                </span>
              </FormLabel>
              <FormControl>
                <Input type="tel" touch className="mt-1.5" {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage className="mt-1.5">{copy.fieldProspect.phoneTooLong}</FormMessage>
            </FormItem>
          )}
        />

        {/* `.above-tab-bar` sits this directly above the tab bar below 768px
            rather than under it (app.css); at that size the tab bar itself
            owns the safe-area inset, so this carries only its own breathing
            room. */}
        <div className="above-tab-bar bg-background border-border fixed inset-x-0 border-t px-4 pt-3">
          {saveFailed && (
            <p role="alert" className="text-destructive mb-2 text-sm">
              {copy.fieldProspect.saveFailed}
            </p>
          )}
          <button
            type="submit"
            className={cn(buttonVariants({ size: "touch" }), "w-full")}
            disabled={saving}
          >
            <MapPinPlusIcon aria-hidden="true" />
            {saving ? copy.fieldProspect.saving : copy.fieldProspect.save}
          </button>
        </div>
      </form>
    </Form>
  );
}
