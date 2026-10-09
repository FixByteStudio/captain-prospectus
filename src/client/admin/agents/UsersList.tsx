import type { User } from "../../../shared/schemas";
import { copy } from "../../copy";
import { cn } from "../../lib/utils";
import { Button } from "../../ui/button";
import { DeviceLines, ExpandButton } from "./DeviceLines";
import { EnrolmentBadge } from "./EnrolmentBadge";
import { RowMenu, displayName } from "./RowMenu";
import type { UsersActions } from "./UsersTable";

/**
 * Below 768px: name and badge, then email and role, the count and the menu on
 * the right; an open row's device lines under it.
 */
export function UsersList({
  users,
  deactivated = false,
  actions,
}: {
  users: User[];
  deactivated?: boolean;
  actions: UsersActions;
}) {
  return (
    <ul className="divide-border divide-y">
      {users.map((user) => {
        const open = !deactivated && actions.expanded.has(user.email);
        return (
          <li key={user.email} className="flex flex-col px-3.5 py-2.5">
            <div className="flex items-center gap-3">
              {!deactivated && (
                <ExpandButton
                  name={displayName(user)}
                  expanded={open}
                  onToggle={() => actions.onToggleExpand(user.email)}
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className={cn("truncate font-medium", deactivated && "text-muted-foreground")}>
                    {displayName(user)}
                  </p>
                  <EnrolmentBadge user={user} />
                </div>
                <p className="text-muted-foreground text-meta truncate">
                  {user.email}
                  {user.email === actions.self ? ` · ${copy.agents.you}` : ""}
                  {` · ${copy.agents.roles[user.role]}`}
                </p>
              </div>
              {deactivated ? (
                <Button variant="secondary" size="sm" onClick={() => actions.onReactivate(user)}>
                  {copy.agents.reactivate}
                </Button>
              ) : (
                <>
                  <span className="tnum text-muted-foreground">{user.sessions}</span>
                  <RowMenu
                    user={user}
                    isLastAdmin={user.email === actions.lastAdmin}
                    onGenerateCode={() => actions.onGenerateCode(user)}
                    onNewPassphrase={
                      user.email === actions.self ? actions.onNewPassphrase : undefined
                    }
                    onToggleRole={() => actions.onToggleRole(user)}
                    onDeactivate={() => actions.onDeactivate(user)}
                  />
                </>
              )}
            </div>
            {open && (
              <div className="pl-9">
                <DeviceLines
                  devices={user.devices}
                  variant="list"
                  revoking={actions.revoking}
                  onRevoke={actions.onRevoke}
                />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
