import type { User } from "../../../shared/schemas";
import { copy } from "../../copy";
import { Badge } from "../../ui/badge";

/** "Inscrit" once a live session exists — the word the cutover waits on for every row. */
export function EnrolmentBadge({ user }: { user: User }) {
  return user.sessions > 0 ? (
    <Badge variant="tint-success">{copy.agents.enrolled}</Badge>
  ) : (
    <Badge variant="secondary">{copy.agents.notEnrolled}</Badge>
  );
}
