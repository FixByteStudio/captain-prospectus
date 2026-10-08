import { useState } from "react";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { toast } from "sonner";
import type { LoginCodeResponse, User } from "../../../shared/schemas";
import { ApiError } from "../../api";
import { copy } from "../../copy";
import { useIsMobile } from "../../hooks/use-mobile";
import { Button } from "../../ui/button";
import { Skeleton } from "../../ui/skeleton";
import { ScreenHeader } from "../ScreenHeader";
import { ScreenState } from "../ScreenState";
import { Surface } from "../Surface";
import { useGenerateCode, useUpdateUser, useUsers } from "../queries";
import { AddUserDialog } from "./AddUserDialog";
import { CodeDialog } from "./CodeDialog";
import { DeactivateDialog } from "./DeactivateDialog";
import { displayName } from "./RowMenu";
import { UsersList } from "./UsersList";
import { UsersTable } from "./UsersTable";
import type { UsersActions } from "./UsersTable";

const t = copy.agents;

/** A 409 `last_admin` has its own sentence; anything else leaves the screen as it was. */
function failureToast(error: unknown) {
  toast.error(
    error instanceof ApiError && error.code === "last_admin" ? t.lastAdmin : t.toast.failed,
  );
}

/** `/admin/agents` — docs/design.md › Agents. `email` is the signed-in admin. */
export function AgentsScreen({ email }: { email: string }) {
  const query = useUsers();
  const update = useUpdateUser();
  const isMobile = useIsMobile();
  const [adding, setAdding] = useState(false);
  const [deactivating, setDeactivating] = useState<string | null>(null);
  const [showDeactivated, setShowDeactivated] = useState(false);
  const generate = useGenerateCode();
  const [issued, setIssued] = useState<{ name: string; code: LoginCodeResponse } | null>(null);

  const generateCode = async (user: User) => {
    let code: LoginCodeResponse;
    try {
      code = await generate.mutateAsync(user.email);
    } catch {
      toast.error(t.toast.failed);
      return;
    }
    setIssued({ name: displayName(user), code });
  };

  const toggleRole = async (user: User) => {
    const role = user.role === "admin" ? "agent" : "admin";
    try {
      await update.mutateAsync({ email: user.email, update: { role } });
    } catch (error) {
      failureToast(error);
      return;
    }
    toast.success(t.toast.roleChanged);
    // /admin no longer answers them: land on the round, re-reading who they are.
    if (user.email === email && role === "agent") window.location.assign("/tournee");
  };

  const reactivate = async (user: User) => {
    try {
      await update.mutateAsync({ email: user.email, update: { active: true } });
    } catch (error) {
      failureToast(error);
      return;
    }
    toast.success(t.toast.reactivated);
  };

  return (
    <section className="flex flex-col gap-4">
      <ScreenHeader
        title={t.title}
        subtitle={t.subtitle}
        actions={<Button onClick={() => setAdding(true)}>{t.add}</Button>}
      />

      <ScreenState
        data={query.data}
        isPending={query.isPending}
        isError={query.isError}
        isFetching={query.isFetching}
        onRetry={() => void query.refetch()}
        loadFailed={t.loadFailed}
        loading={t.loading}
        skeleton={
          <Surface className="flex flex-col gap-3 p-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </Surface>
        }
      >
        {({ users }) => {
          const active = users.filter((u) => u.active);
          const deactivated = users.filter((u) => !u.active);
          const activeAdmins = active.filter((u) => u.role === "admin");
          const actions: UsersActions = {
            self: email,
            lastAdmin: activeAdmins.length === 1 ? (activeAdmins[0]?.email ?? null) : null,
            onGenerateCode: (user) => void generateCode(user),
            onToggleRole: (user) => void toggleRole(user),
            onDeactivate: (user) => setDeactivating(user.email),
            onReactivate: (user) => void reactivate(user),
          };
          const Rows = isMobile ? UsersList : UsersTable;
          return (
            <>
              <Surface className="overflow-hidden">
                <Rows users={active} actions={actions} />
              </Surface>

              {deactivated.length > 0 && (
                <div className="flex flex-col gap-2">
                  <Button
                    variant="ghost"
                    className="self-start"
                    aria-expanded={showDeactivated}
                    onClick={() => setShowDeactivated((v) => !v)}
                  >
                    {showDeactivated ? <ChevronDownIcon /> : <ChevronRightIcon />}
                    {t.deactivated(deactivated.length)}
                  </Button>
                  {showDeactivated && (
                    <Surface className="overflow-hidden" aria-label={t.deactivatedLabel}>
                      <Rows users={deactivated} deactivated actions={actions} />
                    </Surface>
                  )}
                </div>
              )}
            </>
          );
        }}
      </ScreenState>

      <AddUserDialog open={adding} onOpenChange={setAdding} />
      {issued && (
        <CodeDialog name={issued.name} issued={issued.code} onClose={() => setIssued(null)} />
      )}
      {deactivating && (
        <DeactivateDialog email={deactivating} self={email} onClose={() => setDeactivating(null)} />
      )}
    </section>
  );
}
