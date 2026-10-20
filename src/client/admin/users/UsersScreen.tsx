import { useId, useState } from "react";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { toast } from "sonner";
import type { Role } from "../../../shared/constants";
import type { Device, LoginCodeResponse, User } from "../../../shared/schemas";
import { ApiError } from "../../api";
import { copy } from "../../copy";
import { useIsMobile } from "../../hooks/use-mobile";
import { Button } from "../../ui/button";
import { Skeleton } from "../../ui/skeleton";
import { ScreenHeader } from "../ScreenHeader";
import { ScreenState } from "../ScreenState";
import { Surface } from "../Surface";
import { useGenerateCode, useRevokeSession, useUpdateUser, useUsers } from "../queries";
import { AddUserDialog } from "./AddUserDialog";
import { CodeDialog } from "./CodeDialog";
import { DeactivateDialog } from "./DeactivateDialog";
import { PassphraseDialog } from "./PassphraseDialog";
import { failureToast } from "./failure-toast";
import { displayName } from "./RowMenu";
import { UsersList } from "./UsersList";
import { UsersTable } from "./UsersTable";
import type { UsersActions } from "./UsersTable";

const t = copy.users;

/** Agents first: they are the rows an admin works with most (owner, 2026-10-20). */
const SECTION_ORDER: readonly Role[] = ["agent", "admin"];

type RowsComponent = typeof UsersList | typeof UsersTable;

/** One role's heading with its count, its rows, and its own Désactivés toggle. */
function UsersSection({
  role,
  active,
  deactivated,
  Rows,
  actions,
}: {
  role: Role;
  active: User[];
  deactivated: User[];
  Rows: RowsComponent;
  actions: UsersActions;
}) {
  const [showDeactivated, setShowDeactivated] = useState(false);
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h3 id={headingId} className="text-heading flex items-baseline gap-2">
        {t.sections[role]}
        <span className="text-muted-foreground text-meta tnum">{active.length}</span>
      </h3>
      <Surface className="overflow-hidden">
        {active.length === 0 && role === "agent" ? (
          <p className="text-muted-foreground p-4">{t.noAgent}</p>
        ) : (
          <Rows users={active} actions={actions} />
        )}
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
            <Surface className="overflow-hidden" aria-label={t.deactivatedLabel(role)}>
              <Rows users={deactivated} deactivated actions={actions} />
            </Surface>
          )}
        </div>
      )}
    </section>
  );
}

/** `/admin/users` — docs/design.md › Utilisateurs. `email` is the signed-in admin. */
export function UsersScreen({ email }: { email: string }) {
  const query = useUsers();
  const update = useUpdateUser();
  const isMobile = useIsMobile();
  const [adding, setAdding] = useState(false);
  const [deactivating, setDeactivating] = useState<string | null>(null);
  const generate = useGenerateCode();
  const [issued, setIssued] = useState<{ name: string; code: LoginCodeResponse } | null>(null);
  const [replacingPassphrase, setReplacingPassphrase] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const revokeSession = useRevokeSession();
  const [revoking, setRevoking] = useState<Set<string>>(() => new Set());

  const toggleExpand = (userEmail: string) =>
    setExpanded((open) => {
      const next = new Set(open);
      if (next.has(userEmail)) next.delete(userEmail);
      else next.add(userEmail);
      return next;
    });

  // No confirmation (design.md): a new code re-enrols the device.
  // A 404 means the session is already gone (a double click, another admin,
  // expiry): the outcome the admin asked for, so it reads as done.
  const revoke = async (device: Device) => {
    setRevoking((ids) => new Set(ids).add(device.id));
    try {
      await revokeSession.mutateAsync(device.id);
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 404)) {
        toast.error(t.toast.failed);
        return;
      }
    } finally {
      setRevoking((ids) => {
        const next = new Set(ids);
        next.delete(device.id);
        return next;
      });
    }
    toast.success(t.toast.revoked);
  };

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
            onNewPassphrase: () => setReplacingPassphrase(true),
            onDeactivate: (user) => setDeactivating(user.email),
            onReactivate: (user) => void reactivate(user),
            expanded,
            onToggleExpand: toggleExpand,
            revoking,
            onRevoke: (device) => void revoke(device),
          };
          const Rows = isMobile ? UsersList : UsersTable;
          return (
            <>
              {SECTION_ORDER.map((role) => (
                <UsersSection
                  key={role}
                  role={role}
                  active={active.filter((u) => u.role === role)}
                  deactivated={deactivated.filter((u) => u.role === role)}
                  Rows={Rows}
                  actions={actions}
                />
              ))}
            </>
          );
        }}
      </ScreenState>

      <AddUserDialog open={adding} onOpenChange={setAdding} />
      {issued && (
        <CodeDialog name={issued.name} issued={issued.code} onClose={() => setIssued(null)} />
      )}
      {replacingPassphrase && <PassphraseDialog onClose={() => setReplacingPassphrase(false)} />}
      {deactivating && (
        <DeactivateDialog email={deactivating} self={email} onClose={() => setDeactivating(null)} />
      )}
    </section>
  );
}
