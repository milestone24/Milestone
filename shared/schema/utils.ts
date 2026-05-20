import z from "zod";
/**
 * IfEquals is a utility type that compares two types for equality.
 *
 * It works by creating two identical function types that differ only in their return type,
 * which depends on whether a generic type G extends T or U respectively.
 *
 * If T and U are the same type, then both functions will have the same signature and return type Y.
 * If T and U are different, the functions will have different signatures and return type N.
 *
 * @template T - First type to compare
 * @template U - Second type to compare
 * @template Y - Return type if T equals U (defaults to unknown)
 * @template N - Return type if T does not equal U (defaults to never)
 *
 * The parameter G is not explicitly defined anywhere - it's a generic type parameter
 * that's introduced and scoped within each of the function type expressions:
 * (<G>() => G extends T ? 1 : 2) and (<G>() => G extends U ? 1 : 2)
 *
 * "G extends T" is a conditional type check in TypeScript that asks:
 * "Is G assignable to T?" or "Does G satisfy all the constraints of T?"
 *
 * For example:
 * - If T is 'string' and G is 'string', then 'G extends T' is true
 * - If T is 'string' and G is 'number', then 'G extends T' is false
 * - If T is 'string | number' and G is 'string', then 'G extends T' is true
 *
 * In this utility type, we're not actually using G for its value - we're using
 * the structure of the conditional expressions to determine if T and U are the same type.
 * If they are the same, both expressions will have identical behavior for any G.
 */
// export type IfEquals<T, U, Y = unknown, N = never> =
//     (<G>() => G extends T ? 1 : 2) extends
//     (<G>() => G extends U ? 1 : 2) ? Y : N;

export type IfTypeEquals<T, U, N = never> = (<G>() => G extends T
  ? 1
  : 2) extends <G>() => G extends U ? 1 : 2
  ? T
  : N;

export type IfConstructorEquals<T, U extends T, N = never> = [T] extends [U]
  ? [U] extends [T]
    ? T
    : N
  : N;

export type Orphan<T> = T extends { userAccountId: string }
  ? Omit<T, "userAccountId">
  : T;

export type WithInitialBalance<T> = T & { initialBalance: number };
export type WithCurrentBalance<T> = T & { currentBalance: number };

/**
 * Utility type that extracts common fields from given types
 *
 * @example
 * type A = { id: string, name: string, age: number };
 * type B = { id: string, name: string, address: string };
 * type Common = ExtractCommonFields<A, B>; // { id: string, name: string }
 */
export type ExtractCommonFields<T, U> = Pick<
  T,
  {
    [K in keyof T]: K extends keyof U
      ? T[K] extends U[K]
        ? U[K] extends T[K]
          ? K
          : never
        : never
      : never;
  }[keyof T]
>;

// Utility type for mapping DB schema types to application schema types.
// Takes a DB type T and a union of keys K that are nullable in the DB,
// making those keys optional (null→undefined) while leaving all other keys unchanged.
export type NullableKeysToOptional<T, K extends keyof T> =
  Omit<T, K> & { [P in K]?: Exclude<T[P], null> };

export const dateTransformedSchema = z.coerce
  .date()
  .transform((val) => (typeof val === "string" ? new Date(val) : val));
