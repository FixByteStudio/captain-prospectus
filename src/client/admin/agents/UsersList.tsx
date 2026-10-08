import type { User } from "../../../shared/schemas";
import { copy } from "../../copy";
import { cn } from "../../lib/utils";
import { Button } from "../../ui/button";
import { EnrolmentBadge } from "./EnrolmentBadge";
import { RowMenu, displayName } from "./RowMenu";
import type { UsersActions } from "./UsersTable";

/** Below 768px: name and badge, then email and role, the count and the menu on the right. */
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
      {users.map((user) => (
        <li key={user.email} className="flex items-center gap-3 px-3.5 py-2.5">
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
                onToggleRole={() => actions.onToggleRole(user)}
                onDeactivate={() => actions.onDeactivate(user)}
              />
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
