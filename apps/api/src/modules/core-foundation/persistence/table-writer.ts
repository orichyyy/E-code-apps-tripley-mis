import type { QueryExecutor } from "./query-executor";
import { normalizeParam, placeholders } from "./row-values";

export abstract class TableWriter {
  constructor(protected readonly executor: QueryExecutor) {}

  protected async deleteFrom(table: string): Promise<void> {
    await this.executor.run(`DELETE FROM ${table}`);
  }

  protected async insertMany(table: string, columns: string[], rows: unknown[][]): Promise<void> {
    for (const row of rows) {
      await this.executor.run(
        `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders(row.length, this.executor.dialect)})`,
        row.map((value) => normalizeParam(value, this.executor.dialect)),
      );
    }
  }

  protected async replaceTables(operation: () => Promise<void>): Promise<void> {
    await this.executor.transaction(operation);
  }
}
