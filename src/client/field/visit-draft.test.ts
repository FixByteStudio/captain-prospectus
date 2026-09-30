import { describe, expect, it } from "vitest";
import type { Script } from "../../shared/schemas";
import { brusselsMidnightDaysFromNow, periodDates } from "../../shared/period";
import {
  answeredCount,
  dateInputToEpochMs,
  emptyDraft,
  epochMsToDateInput,
  toVisit,
  withOutcome,
} from "./visit-draft";

const CONTEXT = {
  id: "11111111-1111-4111-8111-111111111111",
  prospectId: "22222222-2222-4222-8222-222222222222",
  visitedAt: 1_700_000_000_000,
  position: { lat: 45.7578, lng: 4.832 },
};

const TODAY = periodDates(brusselsMidnightDaysFromNow(CONTEXT.visitedAt, 0), 1)[0] ?? "";
const TOMORROW = periodDates(brusselsMidnightDaysFromNow(CONTEXT.visitedAt, 1), 1)[0] ?? "";

const draft = (over: Partial<typeof emptyDraft> = {}) => ({ ...emptyDraft, ...over });

describe("dateInputToEpochMs", () => {
  it("reads the date the agent tapped, in their own timezone", () => {
    const ms = dateInputToEpochMs("2026-09-29");
    expect(ms).not.toBeNull();

    // The bug this guards: new Date("2026-09-29") is UTC midnight, which is a
    // different calendar day for anyone west of Greenwich.
    const local = new Date(ms ?? 0);
    expect(local.getFullYear()).toBe(2026);
    expect(local.getMonth()).toBe(8);
    expect(local.getDate()).toBe(29);
    expect(local.getHours()).toBe(0);
  });

  it.each(["", "29/09/2026", "2026-9-29", "not a date"])("refuses %o", (value) => {
    expect(dateInputToEpochMs(value)).toBeNull();
  });

  it("refuses a day that does not exist in that month", () => {
    expect(dateInputToEpochMs("2026-02-30")).toBeNull();
    expect(dateInputToEpochMs("2026-11-31")).toBeNull();
  });

  it("accepts a leap day in a leap year and refuses it otherwise", () => {
    expect(dateInputToEpochMs("2028-02-29")).not.toBeNull();
    expect(dateInputToEpochMs("2026-02-29")).toBeNull();
  });

  it("round-trips through the input format", () => {
    const ms = dateInputToEpochMs("2026-09-29");
    expect(ms).not.toBeNull();
    expect(epochMsToDateInput(ms ?? 0)).toBe("2026-09-29");
  });
});

describe("toVisit", () => {
  it("will not save without an outcome", () => {
    const result = toVisit(draft(), CONTEXT);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.outcome).toBe("required");
  });

  it("requires a when choice when the outcome is follow_up (when-step.md)", () => {
    const result = toVisit(draft({ outcome: "follow_up" }), CONTEXT);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.when).toBe("required");
  });

  it("requires a follow-up date once Choisir une date is picked", () => {
    const result = toVisit(draft({ outcome: "follow_up", when: "date" }), CONTEXT);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.followUpDate).toBe("required");
  });

  it("saves a follow-up once the date is there", () => {
    const result = toVisit(
      draft({ outcome: "follow_up", when: "date", followUpDate: TOMORROW }),
      CONTEXT,
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.visit.followUpAt).toBe(dateInputToEpochMs(TOMORROW));
  });

  it("Aujourd'hui sends today's Brussels midnight as followUpAt (when-step.md)", () => {
    const result = toVisit(draft({ outcome: "follow_up", when: "today" }), CONTEXT);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.visit.followUpAt).toBe(brusselsMidnightDaysFromNow(CONTEXT.visitedAt, 0));
    }
  });

  it("rejects a malformed date the browser let through", () => {
    const result = toVisit(
      draft({ outcome: "follow_up", when: "date", followUpDate: "2026-02-30" }),
      CONTEXT,
    );

    expect(result.ok).toBe(false);
    // "invalid", not "required": the agent typed a date, it just cannot exist,
    // and telling them to supply one they can see would read as a bug.
    if (!result.ok) expect(result.errors.followUpDate).toBe("invalid");
  });

  it("rejects a date that is not after today, distinctly from missing or impossible", () => {
    const result = toVisit(
      draft({ outcome: "follow_up", when: "date", followUpDate: TODAY }),
      CONTEXT,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.followUpDate).toBe("notAfterToday");
  });

  it("separates an impossible follow-up date from a missing one", () => {
    const missing = toVisit(draft({ outcome: "follow_up", when: "date" }), CONTEXT);
    const impossible = toVisit(
      draft({ outcome: "follow_up", when: "date", followUpDate: "2026-02-30" }),
      CONTEXT,
    );

    expect(missing.ok).toBe(false);
    expect(impossible.ok).toBe(false);
    if (!missing.ok) expect(missing.errors.followUpDate).toBe("required");
    if (!impossible.ok) expect(impossible.errors.followUpDate).toBe("invalid");
  });

  it("requires a when choice for Personne sur place too, sharing the same step", () => {
    const result = toVisit(draft({ outcome: "no_contact" }), CONTEXT);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.when).toBe("required");
  });

  it("Personne sur place sends answers: {} even when a script is pinned (Design Notes)", () => {
    const script: Script = {
      id: 9,
      name: "s",
      version: 1,
      isActive: true,
      createdAt: 0,
      questions: [{ key: "note_pos", label: "Caisse ?", type: "text" }],
    };
    const result = toVisit(
      draft({ outcome: "no_contact", when: "today", answers: { note_pos: "leftover" } }),
      { ...CONTEXT, script },
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.visit.answers).toEqual({});
  });

  it.each(["interested", "not_interested", "converted"] as const)(
    "saves %s with no when step and no date",
    (outcome) => {
      const result = toVisit(draft({ outcome }), CONTEXT);

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.visit.followUpAt).toBeNull();
    },
  );

  it("records the check-in position", () => {
    const result = toVisit(draft({ outcome: "interested" }), CONTEXT);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.visit.lat).toBe(45.7578);
      expect(result.visit.lng).toBe(4.832);
    }
  });

  it("saves without a position, because a denied permission is not a blocker", () => {
    const result = toVisit(draft({ outcome: "interested" }), { ...CONTEXT, position: null });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.visit.lat).toBeNull();
      expect(result.visit.lng).toBeNull();
    }
  });

  it("stores blank notes as null rather than an empty string", () => {
    const result = toVisit(draft({ outcome: "interested", notes: "   " }), CONTEXT);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.visit.notes).toBeNull();
  });

  it("trims notes", () => {
    const result = toVisit(draft({ outcome: "interested", notes: "  ferme le lundi  " }), CONTEXT);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.visit.notes).toBe("ferme le lundi");
  });

  it("refuses a note past the shared schema's cap, pointing at the note", () => {
    const result = toVisit(draft({ outcome: "interested", notes: "x".repeat(2001) }), CONTEXT);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.notes).toBe("tooLong");
  });

  it("claims no script when none was cached", () => {
    const result = toVisit(draft({ outcome: "interested" }), CONTEXT);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.visit.scriptId).toBeNull();
      expect(result.visit.answers).toEqual({});
    }
  });

  it("keeps the id it was given, so re-validating does not make a second visit", () => {
    // INVARIANT 4: the client id is the idempotency key.
    const a = toVisit(draft({ outcome: "interested" }), CONTEXT);
    const b = toVisit(draft({ outcome: "converted" }), CONTEXT);

    expect(a.ok && b.ok && a.visit.id === b.visit.id).toBe(true);
  });
});

describe("withOutcome", () => {
  it("keeps the when choice and date on an idempotent tap of the same outcome", () => {
    const next = withOutcome(
      draft({ outcome: "follow_up", when: "date", followUpDate: "2026-09-29" }),
      "follow_up",
    );

    expect(next.when).toBe("date");
    expect(next.followUpDate).toBe("2026-09-29");
  });

  it.each(["interested", "not_interested", "converted"] as const)(
    "resets the when choice to null and drops the date when the outcome becomes %s",
    (outcome) => {
      // The when step is unmounted for these, so a choice left behind is one
      // the agent cancelled and can no longer see — and the Worker would
      // still write the date to prospects.next_visit_at.
      const next = withOutcome(
        draft({ outcome: "follow_up", when: "date", followUpDate: "2026-09-29" }),
        outcome,
      );

      expect(next.outcome).toBe(outcome);
      expect(next.when).toBeNull();
      expect(next.followUpDate).toBe("");

      const result = toVisit(next, CONTEXT);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.visit.followUpAt).toBeNull();
    },
  );

  it("defaults Personne sur place's when choice to Aujourd'hui (when-step.md)", () => {
    const next = withOutcome(
      draft({ outcome: "follow_up", when: "date", followUpDate: "2026-09-29" }),
      "no_contact",
    );

    expect(next.when).toBe("today");
    expect(next.followUpDate).toBe("");
  });

  it("resets À relancer's when choice to null rather than carrying a date's choice over", () => {
    // when-step.md: an agent in a hurry must tick something for À relancer —
    // a "today" carried over from Personne sur place would file "come back
    // Thursday" as today.
    const next = withOutcome(draft({ outcome: "no_contact", when: "today" }), "follow_up");

    expect(next.when).toBeNull();
  });

  it("leaves the rest of the draft alone", () => {
    const next = withOutcome(draft({ flyerGiven: true, notes: "ferme le lundi" }), "interested");

    expect(next.flyerGiven).toBe(true);
    expect(next.notes).toBe("ferme le lundi");
  });
});

/**
 * docs/domains/scripts.md and docs/domains/field-operations.md. The script the
 * caller passes is the one pinned when the form opened, not whichever is active
 * now — a visit records the version it was answered with.
 */
describe("toVisit — the script's answers", () => {
  const script: Script = {
    id: 7,
    name: "Questionnaire",
    version: 3,
    isActive: true,
    createdAt: 1_700_000_000_000,
    questions: [
      { key: "has_delivery", label: "Livraison ?", type: "yes_no", required: true },
      { key: "note_pos", label: "Caisse ?", type: "text" },
    ],
  };

  const withScript = { ...CONTEXT, script };

  it("stamps the version that was answered, and the answers with it", () => {
    const result = toVisit(
      draft({ outcome: "interested", answers: { has_delivery: true, note_pos: "Papier" } }),
      withScript,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.visit.scriptId).toBe(7);
      expect(result.visit.answers).toEqual({ has_delivery: true, note_pos: "Papier" });
    }
  });

  it("refuses to save while a required question is unanswered", () => {
    const result = toVisit(draft({ outcome: "interested", answers: {} }), withScript);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.answers).toEqual({ has_delivery: "required" });
  });

  it("marks an answer that is present but wrong as invalid, not missing", () => {
    const result = toVisit(
      draft({ outcome: "interested", answers: { has_delivery: "oui" as unknown as boolean } }),
      withScript,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.answers).toEqual({ has_delivery: "invalid" });
  });

  /** field-operations.md: nobody was there to ask. */
  it("waives required questions when the outcome is no_contact", () => {
    const result = toVisit(
      draft({ outcome: "no_contact", when: "today", answers: {} }),
      withScript,
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.visit.scriptId).toBe(7);
  });

  it("never validates answers for no_contact, even a stale invalid one left over from another result", () => {
    // The questions are hidden behind the when radios for Personne sur place
    // (when-step.md); a wrong answer typed under another outcome must not
    // block a save the agent cannot see why is stuck.
    const result = toVisit(
      draft({
        outcome: "no_contact",
        when: "today",
        answers: { has_delivery: 3 as unknown as boolean },
      }),
      withScript,
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.visit.answers).toEqual({});
  });

  it("does not send answers it has no script to interpret them against", () => {
    const result = toVisit(draft({ outcome: "interested", answers: { stale: true } }), {
      ...CONTEXT,
      script: null,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.visit.scriptId).toBeNull();
      expect(result.visit.answers).toEqual({});
    }
  });

  /**
   * A script is data, not contract shape (src/shared/answers.ts). A question
   * this build cannot render must not be able to block the save.
   */
  it("saves against a script whose questions this build cannot ask", () => {
    const alien: Script = {
      ...script,
      questions: [
        {
          key: "signature",
          label: "Signature",
          type: "signature" as Script["questions"][number]["type"],
          required: true,
        },
      ],
    };

    const result = toVisit(draft({ outcome: "interested", answers: {} }), {
      ...CONTEXT,
      script: alien,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.visit.scriptId).toBe(7);
  });
});

describe("answeredCount", () => {
  const keys = ["delivery", "seats", "comment", "channels"];

  it("counts every kind of real answer, false and 0 included", () => {
    expect(
      answeredCount({ delivery: false, seats: 0, comment: "ok", channels: ["Papier"] }, keys),
    ).toBe(4);
  });

  it("does not count a blank text or an empty multi-choice", () => {
    expect(answeredCount({ delivery: true, comment: "   ", channels: [] }, keys)).toBe(1);
  });

  it("counts only the keys it is given", () => {
    expect(answeredCount({ delivery: true, stale: "left over" }, keys)).toBe(1);
    expect(answeredCount({}, keys)).toBe(0);
  });
});
