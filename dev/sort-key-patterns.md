Here are the expert patterns to handle user-defined reordering while maintaining uniqueness and stability in PostgreSQL:

1. The Floating-Point "Sort Key" Pattern (Most Flexible)
This is the most flexible and commonly recommended pattern for frequently reordered lists. It allows for new items to be inserted anywhere between existing items without rewriting the entire table.

Implementation
Column: Add a sort_key column with the DOUBLE PRECISION (float) data type.

Initial Order: When inserting the very first items, assign them spaced-out integer values (e.g., 100, 200, 300, etc.).

How Reordering Works
Move Item: To move an item, you calculate a new sort_key value that falls exactly halfway between the sort_key values of its new neighbors.

Example: Moving a transaction between items with keys 200.0 and 300.0. The new key is  
2
200.0+300.0
​
 =250.0.

Insert New Item: Inserting a new item at the beginning of the list (before the first item with key 100.0) could get a key of  
2
0+100.0
​
 =50.0.

Advantages
Minimal Writes: Only the one row being moved needs its sort_key updated. No need to update the N rows that follow it, which drastically reduces database load.

Infinite Density: You can always find a number between any two floating-point numbers, meaning you rarely, if ever, run out of space to insert a new item.

The Problem: Re-sequencing (The "Gaps" Shrink)
Over hundreds or thousands of reorders, the sort_key values will become extremely dense (e.g., 250.000000001, 250.000000002). Eventually, you'll hit the limits of DOUBLE PRECISION precision and won't be able to calculate a unique halfway point.

The Solution: Periodic Re-sequencing
You must implement a background process or maintenance trigger that runs when the keys become too dense (e.g., when the difference between two keys is less than 1×10 
−6
 ).

The process:

Read the entire list, ordered by the dense sort_key.

Update every row, resetting the keys to clean, spaced-out integers (100, 200, 300, etc.).

2. The Integer "Position" Pattern (Simpler, Higher Write Load)
This pattern uses a simple integer to define the order, like an array index.

Implementation
Column: Add a position column with the INTEGER data type.

Initial Order: Assign positions sequentially (1, 2, 3, 4, etc.).

How Reordering Works
Move Item: To move a transaction from position 5 to position 2, you must update the position value for every row affected by the move.

The item that was at position 5 gets position 2.

The items that were at positions 2, 3, and 4 must all be incremented to 3, 4, and 5, respectively. This is done inside a single transaction.

Example SQL for Moving Item ID 5 from Position 5 to Position 2:
SQL

BEGIN;

-- 1. Shift the intermediate positions down (2 to 4 become 3 to 5)
UPDATE transactions
SET position = position + 1
WHERE position >= 2 AND position < 5;

-- 2. Move the target item (ID 5) to its new position
UPDATE transactions
SET position = 2
WHERE id = 5;

COMMIT;
Advantages
Simplicity: Uses a simple integer. No floating-point math or precision issues.

No Maintenance: Never needs a background re-sequencing job.

Disadvantages
High Write Load: Moving an item in a list of 10,000 transactions requires updating potentially 9,999 rows, which can be a significant performance bottleneck in large, frequently changing lists.

3. The Combined Stable Sort Pattern
Regardless of which reordering method you choose, you should always include a stable, unique column as a final tie-breaker in your queries. This is generally your primary key (the SERIAL column).

This prevents non-deterministic results if two users somehow manage to assign the same sort_key or position at the same time, or if an internal process temporarily results in a tie.

The Guaranteed Selection Query:
SQL

SELECT *
FROM transactions
ORDER BY
    user_defined_position ASC,  -- Sort by the user's order
    id ASC;                     -- Break ties using the unique insertion ID
This ensures that even if two items have the same user_defined_position of 250.0 or 5, their relative order will always be stable based on which was inserted first