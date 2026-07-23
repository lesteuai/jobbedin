import { vi } from 'vitest';

/**
 * Chainable drizzle-like stub for `@/app/lib/db`.
 *
 * Usage:
 *   const db = createDbMock();
 *   db.queueResult([{ id: '1', name: 'Resume' }]); // for db.select().from().where()
 *   db.queueResult(undefined); // for db.delete().where()
 *   db.query.userSettings.queueResult({ userId: '1' }); // for db.query.userSettings.findFirst()
 *
 *   vi.doMock('@/app/lib/db', () => ({ db }));
 *   // ...run the route handler...
 *
 *   expect(db.calls.insert[0].values[0]).toEqual({ ... });
 *   expect(db.calls.insert[0].onConflictDoUpdate[0]).toEqual({ target: ..., set: { ... } });
 *
 * To assert a query is scoped to a column and value, pass the recorded where
 * clause through `equalityComparisons`:
 *   expect(equalityComparisons(db.calls.select[0].where[0]))
 *     .toContainEqual({ column: 'user_id', value: 'user-1' });
 */

type EqualityComparison = { column: string; value: unknown };

type SqlLike = { queryChunks: unknown[] };

function isSqlLike(chunk: unknown): chunk is SqlLike {
  return typeof chunk === 'object' && chunk !== null && Array.isArray((chunk as SqlLike).queryChunks);
}

function isColumn(chunk: unknown): chunk is { name: string } {
  if (typeof chunk !== 'object' || chunk === null) return false;
  const candidate = chunk as { name?: unknown; table?: unknown };
  return typeof candidate.name === 'string' && candidate.table !== undefined;
}

function isParam(chunk: unknown): chunk is { value: unknown } {
  return typeof chunk === 'object' && chunk !== null && chunk.constructor?.name === 'Param';
}

/**
 * Flattens a drizzle where clause into the column/value pairs it compares.
 * Drizzle builds `eq(col, val)` as a nested SQL object holding a Column chunk
 * followed by a Param chunk, so walking depth first and pairing each column
 * with the next param recovers what the query is actually filtered on. This is
 * what makes user-scoping assertions possible, since an opaque clause object
 * would otherwise only be checkable for existence.
 */
export function equalityComparisons(clause: unknown): EqualityComparison[] {
  const comparisons: EqualityComparison[] = [];
  let pendingColumn: string | null = null;

  const walk = (chunk: unknown) => {
    if (isSqlLike(chunk)) {
      chunk.queryChunks.forEach(walk);
      return;
    }
    if (isColumn(chunk)) {
      pendingColumn = chunk.name;
      return;
    }
    if (isParam(chunk) && pendingColumn !== null) {
      comparisons.push({ column: pendingColumn, value: chunk.value });
      pendingColumn = null;
    }
  };

  walk(clause);
  return comparisons;
}

type RecordedInsertCall = {
  table: unknown;
  values: unknown[];
  returning: unknown[];
  onConflictDoUpdate: unknown[];
};

type RecordedSelectCall = {
  select: unknown[];
  from: unknown[];
  where: unknown[];
  orderBy: unknown[];
};

type RecordedDeleteCall = {
  table: unknown;
  where: unknown[];
};

export type DbMock = {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  query: Record<string, { findFirst: ReturnType<typeof vi.fn>; queueResult: (result: unknown) => void }>;
  calls: {
    select: RecordedSelectCall[];
    insert: RecordedInsertCall[];
    delete: RecordedDeleteCall[];
  };
  /** Queue the resolved value for the next terminal select/insert/delete call, in call order. */
  queueResult: (result: unknown) => void;
};

export function createDbMock(): DbMock {
  const resultQueue: unknown[] = [];
  const calls: DbMock['calls'] = { select: [], insert: [], delete: [] };

  function nextResult(): unknown {
    return resultQueue.shift();
  }

  function makeSelectChain(selectArgs: unknown[]) {
    const record: RecordedSelectCall = { select: selectArgs, from: [], where: [], orderBy: [] };
    calls.select.push(record);

    // Terminal thenable so `await db.select().from().where()` resolves.
    function toThenable(): PromiseLike<unknown> {
      return { then: (resolve: (v: unknown) => void) => resolve(nextResult()) };
    }

    const chain = {
      from: vi.fn((...fromArgs: unknown[]) => {
        record.from = fromArgs;
        const fromChain = {
          where: vi.fn((...whereArgs: unknown[]) => {
            record.where = whereArgs;
            const whereChain = {
              orderBy: vi.fn((...orderByArgs: unknown[]) => {
                record.orderBy = orderByArgs;
                return toThenable();
              }),
              then: (resolve: (v: unknown) => void) => resolve(nextResult()),
            };
            return whereChain;
          }),
          orderBy: vi.fn((...orderByArgs: unknown[]) => {
            record.orderBy = orderByArgs;
            return toThenable();
          }),
          then: (resolve: (v: unknown) => void) => resolve(nextResult()),
        };
        return fromChain;
      }),
    };
    return chain;
  }

  function makeInsertChain(table: unknown) {
    const record: RecordedInsertCall = { table, values: [], returning: [], onConflictDoUpdate: [] };
    calls.insert.push(record);

    const valuesChain = {
      returning: vi.fn((...returningArgs: unknown[]) => {
        record.returning = returningArgs;
        return { then: (resolve: (v: unknown) => void) => resolve(nextResult()) };
      }),
      onConflictDoUpdate: vi.fn((...onConflictArgs: unknown[]) => {
        record.onConflictDoUpdate = onConflictArgs;
        return { then: (resolve: (v: unknown) => void) => resolve(nextResult()) };
      }),
      then: (resolve: (v: unknown) => void) => resolve(nextResult()),
    };

    return {
      values: vi.fn((...valuesArgs: unknown[]) => {
        record.values = valuesArgs;
        return valuesChain;
      }),
    };
  }

  function makeDeleteChain(table: unknown) {
    const record: RecordedDeleteCall = { table, where: [] };
    calls.delete.push(record);

    return {
      where: vi.fn((...whereArgs: unknown[]) => {
        record.where = whereArgs;
        return { then: (resolve: (v: unknown) => void) => resolve(nextResult()) };
      }),
      then: (resolve: (v: unknown) => void) => resolve(nextResult()),
    };
  }

  const query = new Proxy(
    {} as Record<string, { findFirst: ReturnType<typeof vi.fn>; queueResult: (result: unknown) => void }>,
    {
      get(target, tableName: string) {
        if (!target[tableName]) {
          const tableQueue: unknown[] = [];
          target[tableName] = {
            findFirst: vi.fn(() => Promise.resolve(tableQueue.shift())),
            queueResult: (result: unknown) => tableQueue.push(result),
          };
        }
        return target[tableName];
      },
    }
  );

  return {
    select: vi.fn((...selectArgs: unknown[]) => makeSelectChain(selectArgs)),
    insert: vi.fn((table: unknown) => makeInsertChain(table)),
    delete: vi.fn((table: unknown) => makeDeleteChain(table)),
    query,
    calls,
    queueResult: (result: unknown) => resultQueue.push(result),
  };
}
