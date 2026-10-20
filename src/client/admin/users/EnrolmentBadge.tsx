import type { User } from "../../../shared/schemas";
import { copy } from "../../copy";
import { Badge } from "../../ui/badge";

/** "Inscrit" once the user has a live session on some device; "Pas encore inscrit" until then. */
export function EnrolmentBadge({ user }: { user: User }) {
  return user.sessions > 0 ? (
    <Badge variant="tint-success">{copy.users.enrolled}</Badge>
  ) : (
    <Badge variant="secondary">{copy.users.notEnrolled}</Badge>
  );
}
