/**
 * One question card in the script editor — docs/design.md#the-script-editor.
 *
 * The drag handle is the only affordance for reordering, and `useSortable`
 * supplies both the pointer and (via the `KeyboardSensor` wired in
 * `ScriptsScreen`) the keyboard behaviour for it.
 */
import { useEffect, useRef } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { GripVerticalIcon, InfoIcon, LockIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { useWatch, type UseFormReturn } from "react-hook-form";
import { copy, QUESTION_TYPE_LABELS } from "../../copy";
import { QUESTION_TYPES, type QuestionType } from "../../../shared/constants";
import { cn } from "../../lib/utils";
import { Surface } from "../Surface";
import { suggestKey, type ScriptDraft } from "./script-draft";
import { Button } from "@/ui/button";
import { Checkbox } from "@/ui/checkbox";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/ui/form";
import { Input } from "@/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select";

function transformStyle(transform: { x: number; y: number } | null): string | undefined {
  // `@dnd-kit/utilities`'s `CSS.Transform.toString` is not a dependency of this
  // repo (only core, sortable and modifiers are); a translate3d is all a
  // vertical sortable list needs, so it is written out instead of pulling in
  // another package for one call.
  return transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined;
}

export function QuestionRow({
  form,
  index,
  id,
  otherKeys,
  onRemove,
}: {
  form: UseFormReturn<ScriptDraft>;
  index: number;
  id: string;
  otherKeys: string[];
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const type = useWatch({ control: form.control, name: `questions.${index}.type` });
  const label = useWatch({ control: form.control, name: `questions.${index}.label` });
  const keyLocked = useWatch({ control: form.control, name: `questions.${index}.keyLocked` });
  const keyTouched = useWatch({ control: form.control, name: `questions.${index}.keyTouched` });
  const originallyLocked = useWatch({
    control: form.control,
    name: `questions.${index}.originallyLocked`,
  });
  const options = useWatch({ control: form.control, name: `questions.${index}.options` }) ?? [];
  const optionsShown = type === "single" || type === "multi";
  const rowTitle = label.trim() || copy.scripts.question.untitled;

  function handleTypeChange(next: QuestionType) {
    form.setValue(`questions.${index}.type`, next, { shouldDirty: true });
    if ((next === "single" || next === "multi") && options.length === 0) {
      form.setValue(`questions.${index}.options`, [""], { shouldDirty: true });
    }
  }

  // The « Modifier la clé » button unmounts as the key input replaces it, so
  // focus is handed to that input once it exists rather than falling to <body>.
  const focusKeyOnUnlock = useRef(false);
  useEffect(() => {
    if (!keyLocked && focusKeyOnUnlock.current) {
      focusKeyOnUnlock.current = false;
      form.setFocus(`questions.${index}.key`);
    }
  }, [keyLocked, form, index]);

  function handleUnlockKey() {
    focusKeyOnUnlock.current = true;
    form.setValue(`questions.${index}.keyLocked`, false, { shouldDirty: true });
  }

  function setOption(optionIndex: number, value: string) {
    const next = [...options];
    next[optionIndex] = value;
    form.setValue(`questions.${index}.options`, next, { shouldDirty: true });
  }

  function removeOption(optionIndex: number) {
    form.setValue(
      `questions.${index}.options`,
      options.filter((_, i) => i !== optionIndex),
      { shouldDirty: true },
    );
  }

  function addOption() {
    form.setValue(`questions.${index}.options`, [...options, ""], { shouldDirty: true });
  }

  const keyNote = keyLocked
    ? copy.scripts.question.keyLocked
    : originallyLocked
      ? copy.scripts.question.keyUnlockedWarning
      : copy.scripts.question.keyHint;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: transformStyle(transform), transition: transition ?? undefined }}
      className={isDragging ? "relative z-10 rounded-md shadow-md" : undefined}
      aria-label={copy.scripts.question.cardAria(index + 1, rowTitle)}
    >
      <Surface className="overflow-hidden">
        <div className="flex items-start gap-2 p-3.5 sm:gap-3">
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground mt-0.5 flex size-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 active:cursor-grabbing"
            aria-label={copy.scripts.question.dragHandle(rowTitle)}
            {...attributes}
            {...listeners}
          >
            <GripVerticalIcon className="size-4" aria-hidden />
          </button>

          <span className="tnum text-label mt-2 min-w-4 shrink-0 text-right">{index + 1}</span>

          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-start gap-3">
              <FormField
                control={form.control}
                name={`questions.${index}.label`}
                render={({ field, fieldState }) => (
                  <FormItem className="min-w-0 flex-1 basis-48 gap-1">
                    <FormLabel className="sr-only">{copy.scripts.question.label}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={copy.scripts.question.labelPlaceholder}
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          if (!keyLocked && !keyTouched) {
                            form.setValue(
                              `questions.${index}.key`,
                              suggestKey(e.target.value, otherKeys),
                              { shouldDirty: true },
                            );
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage>
                      {fieldState.error ? copy.scripts.errors.emptyLabel : undefined}
                    </FormMessage>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name={`questions.${index}.type`}
                render={({ field }) => (
                  <FormItem className="w-full gap-1 sm:w-44">
                    <FormLabel className="sr-only">{copy.scripts.question.type}</FormLabel>
                    <Select value={field.value} onValueChange={handleTypeChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {QUESTION_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {QUESTION_TYPE_LABELS[t]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            </div>

            {optionsShown && (
              <FormField
                control={form.control}
                name={`questions.${index}.options`}
                render={({ fieldState }) => (
                  <FormItem className="gap-1.5">
                    <FormLabel className="text-muted-foreground text-overline uppercase">
                      {copy.scripts.question.options}
                    </FormLabel>
                    <div className="grid gap-1.5 sm:grid-cols-2">
                      {options.map((option, optionIndex) => (
                        // Options are add/remove only, never reordered, so the
                        // index is a stable enough key for this short list.
                        <div key={optionIndex} className="flex min-w-0 items-center gap-1.5">
                          <Input
                            value={option}
                            placeholder={copy.scripts.question.optionPlaceholder(optionIndex + 1)}
                            onChange={(e) => setOption(optionIndex, e.target.value)}
                            className="h-8 min-w-0"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={copy.scripts.question.removeOption(optionIndex + 1)}
                            onClick={() => removeOption(optionIndex)}
                          >
                            <XIcon className="size-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="w-fit"
                      onClick={addOption}
                    >
                      <PlusIcon /> {copy.scripts.question.addOption}
                    </Button>
                    <FormMessage>
                      {fieldState.error ? copy.scripts.errors.missingOptions : undefined}
                    </FormMessage>
                  </FormItem>
                )}
              />
            )}
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0"
            aria-label={copy.scripts.question.remove(rowTitle)}
            onClick={onRemove}
          >
            <Trash2Icon />
          </Button>
        </div>

        <div className="bg-secondary border-border border-t px-3.5 py-2.5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <FormField
              control={form.control}
              name={`questions.${index}.required`}
              render={({ field }) => (
                <FormItem className="flex flex-row items-center gap-2">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="text-sm font-normal">
                    {copy.scripts.question.required}
                  </FormLabel>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name={`questions.${index}.key`}
              render={({ field, fieldState }) => (
                // `contents`: the key, its message and its note join the footer's
                // own wrapping row, while the note stays this field's
                // FormDescription so the key input is described by it.
                <FormItem className="contents">
                  {keyLocked ? (
                    // Locked: the key is a fact, not a field — docs/design.md#the-script-editor.
                    <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
                      <LockIcon className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
                      <span className="text-muted-foreground">{copy.scripts.question.key}</span>
                      <span className="min-w-0 font-medium break-all">{field.value}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={copy.scripts.question.unlockKeyAria(field.value)}
                        onClick={handleUnlockKey}
                      >
                        {copy.scripts.question.unlockKey}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex min-w-0 items-center gap-2">
                      <FormLabel className="text-muted-foreground shrink-0 text-sm font-normal">
                        {copy.scripts.question.key}
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          className="tnum h-8 w-full min-w-0 sm:w-60"
                          onChange={(e) => {
                            field.onChange(e);
                            form.setValue(`questions.${index}.keyTouched`, true, {
                              shouldDirty: true,
                            });
                          }}
                        />
                      </FormControl>
                    </div>
                  )}
                  <FormMessage className="basis-full">
                    {fieldState.error?.type === "duplicate"
                      ? copy.scripts.errors.duplicateKey
                      : fieldState.error
                        ? copy.scripts.errors.invalidKey
                        : undefined}
                  </FormMessage>
                  <FormDescription
                    className={cn(
                      "text-meta flex basis-full items-start gap-1.5",
                      !keyLocked && originallyLocked && "text-foreground",
                    )}
                  >
                    <InfoIcon className="mt-px size-3.5 shrink-0" aria-hidden />
                    {keyNote}
                  </FormDescription>
                </FormItem>
              )}
            />
          </div>
        </div>
      </Surface>
    </li>
  );
}
