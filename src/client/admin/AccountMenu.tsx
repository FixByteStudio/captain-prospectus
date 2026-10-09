import { LogOutIcon } from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { ApiError, apiFetch } from "../api";
import { copy } from "../copy";
import { initials } from "../format";
import { LOGOUT_PATH } from "./access-logout";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

/**
 * The top bar's avatar menu (GH #64). "Se déconnecter" ends the own-login
 * session with `POST /api/auth/logout`, then asks `/api/me` once (GH #309):
 * still answered means Access is signing this device in, so Access's own
 * logout endpoint finishes the job, as a full navigation — the service worker
 * answers every SPA navigation with the precached shell (`navigateFallback`),
 * and `vite.config.ts` exempts `/cdn-cgi/` (GH #76) for exactly this. Any
 * other answer means the session was all there was: `/login`.
 *
 * A POST that never reached the server stays put: the cookie would survive,
 * and `/login` would send the user straight back to their landing.
 */
export function AccountMenu({ email }: { email: string }) {
  const navigate = useNavigate();

  const logout = async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch (error) {
      // A 401 (either kind) means there was no session left to end, which is
      // the goal; `/api/me` below then sends the user on.
      if (!(error instanceof ApiError && error.status === 401)) {
        toast.error(copy.errors.generic);
        return;
      }
    }
    try {
      await apiFetch("/api/me");
    } catch {
      void navigate("/login");
      return;
    }
    window.location.href = LOGOUT_PATH;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={copy.account.menu(email)}
          // Same classes as the field band's static avatar (App.tsx) — the
          // two must look identical, only one of them opens a menu.
          className="bg-primary text-primary-foreground ring-primary-edge flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-1 ring-inset"
        >
          {initials(email)}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="text-muted-foreground truncate font-normal">
          {email}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void logout()}>
          <LogOutIcon aria-hidden="true" />
          {copy.account.logout}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
