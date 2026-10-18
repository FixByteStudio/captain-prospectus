import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import "../src/client/styles/app.css";
import { Band, BandBrand } from "../src/client/Band";
import { AccountMenu } from "../src/client/field/AccountMenu";
import { LeaveGuardProvider } from "../src/client/field/leave-guard";
import { FieldTabs } from "../src/client/field/FieldTabs";

const q = new URLSearchParams(location.search);
const admin = q.get("role") === "admin";
const email = admin ? "marie-charlotte.vandenbroucke@captain-prospectus.be" : "francois@captain-prospectus.be";
createRoot(document.getElementById("root")!).render(
  <MemoryRouter initialEntries={["/tournee"]}>
    <LeaveGuardProvider>
      <Band>
        <BandBrand subtitle="Tournée" />
        <FieldTabs />
        <span className="ml-auto md:ml-0"><span className="bg-success inline-block size-2.5 rounded-full" /></span>
        <AccountMenu email={email} role={admin ? "admin" : "agent"} adminOnline={admin} />
      </Band>
      <main className="px-4 pt-6 pb-tab-bar grid gap-3">
        {["Arrêt 4 sur 20", "Friterie Tabora", "Le Pré Salé"].map((t) => (
          <div key={t} className="bg-card border-border rounded-lg border p-4"><p className="text-heading">{t}</p><p className="text-muted-foreground text-sm">Arrêt 5 · 230 m</p></div>
        ))}
      </main>
    </LeaveGuardProvider>
  </MemoryRouter>,
);
