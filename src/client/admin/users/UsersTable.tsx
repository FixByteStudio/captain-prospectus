import { Fragment } from "react";
import type { Device, User } from "../../../shared/schemas";
import { copy } from "../../copy";
import { cn } from "../../lib/utils";
import { Button } from "../../ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../ui/table";
import { DeviceLines, ExpandButton } from "./DeviceLines";
import { EnrolmentBadge } from "./EnrolmentBadge";
import { RowMenu, displayName } from "./RowMenu";

export type UsersActions = {
  /** The signed-in admin's email: their row says "Vous". */
  self: string;
  /** Set when exactly one active admin row is listed. */
  lastAdmin: string | null;
  onGenerateCode: (user: User) => void;
  /** Only ever offered on the `self` row: a passphrase is shown to its owner alone. */
  onNewPassphrase: () => void;
  onDeactivate: (user: User) => void;
  onReactivate: (user: User) => void;
  /** Emails whose device lines are open. */
  expanded: Set<string>;
  onToggleExpand: (email: string) => void;
  /** Device ids whose revoke is in flight. */
  revoking: Set<string>;
  onRevoke: (device: Device) => void;
};

/** Email under the name; "Vous" after it on your own row. */
export function UserCell({ user, self, muted }: { user: User; self: string; muted?: boolean }) {
  return (
    <div className="min-w-0">
      <p className={cn("truncate font-medium", muted && "text-muted-foreground")}>
        {displayName(user)}
      </p>
      <p className="text-muted-foreground text-meta truncate">
        {user.email}
        {user.email === self ? ` · ${copy.users.you}` : ""}
      </p>
    </div>
  );
}

/** The ≥768px table: active rows with a menu, or deactivated rows with Réactiver. */
export function UsersTable({
  users,
  deactivated = false,
  actions,
}: {
  users: User[];
  deactivated?: boolean;
  actions: UsersActions;
}) {
  return (
    <Table className="min-w-xl table-fixed">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="pl-3.5">{copy.users.columns.user}</TableHead>
          <TableHead className="w-48">{copy.users.columns.enrolment}</TableHead>
          {/* A deactivated row has no devices but a wider Réactiver: the two
              swap width so Inscription lines up with the active table above. */}
          <TableHead className={cn("text-right", deactivated ? "w-12" : "w-28")}>
            {deactivated ? "" : copy.users.columns.devices}
          </TableHead>
          <TableHead className={deactivated ? "w-32" : "w-16"} />
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => {
          const open = !deactivated && actions.expanded.has(user.email);
          return (
            <Fragment key={user.email}>
              <TableRow>
                <TableCell className="pl-3.5">
                  {deactivated ? (
                    <UserCell user={user} self={actions.self} muted />
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <ExpandButton
                        name={displayName(user)}
                        expanded={open}
                        onToggle={() => actions.onToggleExpand(user.email)}
                      />
                      <UserCell user={user} self={actions.self} />
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <EnrolmentBadge user={user} />
                </TableCell>
                <TableCell className="tnum text-right">
                  {deactivated ? "" : user.sessions}
                </TableCell>
                <TableCell className="pr-3.5">
                  {deactivated ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => actions.onReactivate(user)}
                    >
                      {copy.users.reactivate}
                    </Button>
                  ) : (
                    <RowMenu
                      user={user}
                      isLastAdmin={user.email === actions.lastAdmin}
                      onGenerateCode={() => actions.onGenerateCode(user)}
                      onNewPassphrase={
                        user.email === actions.self ? actions.onNewPassphrase : undefined
                      }
                      onDeactivate={() => actions.onDeactivate(user)}
                    />
                  )}
                </TableCell>
              </TableRow>
              {open && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={4} className="pr-3.5 pl-11">
                    <DeviceLines
                      devices={user.devices}
                      variant="table"
                      revoking={actions.revoking}
                      onRevoke={actions.onRevoke}
                    />
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}
