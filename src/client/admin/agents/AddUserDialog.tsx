import { useState } from "react";
import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { toast } from "sonner";
import * as z from "zod/mini";
import { userCreateSchema } from "../../../shared/schemas";
import { ApiError } from "../../api";
import { copy } from "../../copy";
import { Button } from "../../ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../../ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "../../ui/form";
import { Input } from "../../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { Spinner } from "../../ui/spinner";
import { useCreateUser } from "../queries";

/** The shared rules, picked — never a second copy (ADR-0018). The parse trims and lowercases the email. */
const addSchema = z.pick(userCreateSchema, { email: true, name: true, role: true });

const t = copy.agents;

export function AddUserDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const create = useCreateUser();
  const [taken, setTaken] = useState(false);
  const form = useForm({
    resolver: standardSchemaResolver(addSchema),
    defaultValues: { email: "", name: "", role: "agent" as const },
  });
  const saving = create.isPending;

  const close = (next: boolean) => {
    // While the POST is in flight the dialog stays, as the script save's does.
    if (saving) return;
    if (!next) {
      form.reset();
      setTaken(false);
    }
    onOpenChange(next);
  };

  const submit = async (values: z.infer<typeof addSchema>) => {
    setTaken(false);
    try {
      await create.mutateAsync(values);
    } catch (error) {
      if (error instanceof ApiError && error.code === "email_taken") {
        setTaken(true);
        form.setError("email", { type: "server" });
        return;
      }
      toast.error(t.toast.failed);
      return;
    }
    toast.success(t.toast.added);
    close(false);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent showCloseButton={!saving}>
        <DialogHeader>
          <DialogTitle>{t.addDialog.title}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            className="flex flex-col gap-4"
            noValidate
            onSubmit={(e) => void form.handleSubmit(submit)(e)}
          >
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t.addDialog.email}</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      autoComplete="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      {...field}
                      onChange={(e) => {
                        setTaken(false);
                        field.onChange(e);
                      }}
                    />
                  </FormControl>
                  <FormMessage>
                    {taken ? t.addDialog.emailTaken : t.addDialog.emailInvalid}
                  </FormMessage>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t.addDialog.name}</FormLabel>
                  <FormControl>
                    <Input autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage>{t.addDialog.nameRequired}</FormMessage>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t.addDialog.role}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(["agent", "admin"] as const).map((role) => (
                        <SelectItem key={role} value={role}>
                          {t.roles[role]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => close(false)}
              >
                {t.addDialog.cancel}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Spinner />}
                {t.addDialog.submit}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
