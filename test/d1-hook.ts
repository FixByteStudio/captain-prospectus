/**
 * Wraps a D1 binding so a test can change the database between a route's read
 * and its write. `before` runs once, just ahead of the first statement whose
 * SQL matches, which is where the guarded `INSERT … SELECT` re-checks a row
 * that moved in between (auth.ts, identity.ts). Hand the result to
 * `workerFetch` as `{ DB }`.
 *
 * Only what Drizzle's D1 driver calls is wrapped: prepare, bind, run, all, raw
 * and batch. Everything else is a plain pass-through to the real binding.
 */
export function beforeStatement(
  d1: D1Database,
  match: RegExp,
  before: () => Promise<void>,
): D1Database {
  let fired = false;
  const fire = async (sql: string) => {
    if (fired || !match.test(sql)) return;
    fired = true;
    await before();
  };

  type Wrapped = D1PreparedStatement & { real: D1PreparedStatement; sql: string };
  const wrap = (sql: string, real: D1PreparedStatement): Wrapped =>
    ({
      real,
      sql,
      bind: (...values: unknown[]) => wrap(sql, real.bind(...values)),
      run: async () => (await fire(sql), real.run()),
      all: async () => (await fire(sql), real.all()),
      raw: async (options?: { columnNames: true }) => (
        await fire(sql),
        real.raw(options as { columnNames: true })
      ),
      first: async (column?: string) => (
        await fire(sql),
        column === undefined ? real.first() : real.first(column)
      ),
    }) as Wrapped;

  return {
    prepare: (sql: string) => wrap(sql, d1.prepare(sql)),
    batch: async (statements: Wrapped[]) => {
      for (const statement of statements) await fire(statement.sql);
      return d1.batch(statements.map((statement) => statement.real));
    },
    exec: (sql: string) => d1.exec(sql),
    dump: () => d1.dump(),
    withSession: (constraint?: D1SessionBookmark | D1SessionConstraint) =>
      d1.withSession(constraint),
  } as unknown as D1Database;
}
