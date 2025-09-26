The "predicate" (or more accurately, the tie-breaker) that PostgreSQL uses internally to resolve a tie when only one non-unique column is provided in the ORDER BY clause is typically the Tuple Identifier (TID).

Here's a breakdown of why this happens and what it means:

The Tuple Identifier (TID)
What it is: The Tuple Identifier is a system column that exists in every PostgreSQL table (though it's not visible by default). It is an address or location pointer composed of a pair of values: (block_number, item_pointer).

block_number: The physical data block on disk where the row is stored.

item_pointer: The slot number within that data block.

How it works as a Tie-Breaker: When a query has an ORDER BY clause that results in multiple rows being equal (a tie), PostgreSQL needs a deterministic way to order those tied rows. The documentation for B-tree indexes, which are often used to satisfy ORDER BY clauses, confirms this behavior:

"By default, B-tree indexes store their entries in ascending order with nulls last (table TID is treated as a tiebreaker column among otherwise equal entries)."

Therefore, for rows that have the exact same value in your timestamp column, the final ordering is resolved by sorting based on the TID.

Important Caveats
1. The TID is Not Insertion Order
While the TID often reflects the physical order on disk and may initially seem to follow insertion order (because new rows are often appended to the end of the table), you cannot rely on this.

The physical location of a row (and thus its TID) can change due to maintenance operations like:

VACUUM FULL or CLUSTER: These operations rewrite the entire table, completely changing all the TIDs.

UPDATE operations: In PostgreSQL, an UPDATE typically inserts a new row version (a new tuple) and marks the old one for deletion. The new tuple gets a new, higher TID, often placed at the end of the table's data blocks, which disrupts the original sequence.

2. The Order is Only Guaranteed Within the Query
The use of the TID as an internal tie-breaker means the result of a single query run at a specific point in time will be deterministic (it will return the tied rows in the same order every time).

However, the actual order across different executions can be affected by the maintenance operations listed above, even if the underlying data hasn't changed.

The Correct Solution
As a database administrator, you should always treat any sort order not explicitly controlled by an unique column in the ORDER BY clause as unreliable and non-guaranteed.

To ensure a stable, predictable order for rows with identical timestamps, you must explicitly add a unique, monotonically increasing column (like a SERIAL or BIGSERIAL primary key) to your ORDER BY list: