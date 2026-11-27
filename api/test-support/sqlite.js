import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
export function database() {
  const db = new DatabaseSync(":memory:");
  db.exec(
    readFileSync(new URL("../migrations/0001.sql", import.meta.url), "utf8"),
  );
  db.exec(readFileSync(new URL("../migrations/0002_submissions.sql", import.meta.url), "utf8"));
  return {
    db,
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              return db.prepare(sql).get(...args) || null;
            },
            async run() {
              return db.prepare(sql).run(...args);
            },
            async all() {
              return { results: db.prepare(sql).all(...args) };
            },
          };
        },
      };
    },
    async batch(statements) {
      db.exec("BEGIN");
      try {
        const result = await Promise.all(statements.map((s) => s.run()));
        db.exec("COMMIT");
        return result;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
  };
}
