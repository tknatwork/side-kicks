/**
 * Result Type Pattern — Discriminated union for explicit error handling.
 *
 * Every function that can fail returns Result<T, E> instead of throwing.
 * Proven pattern from Variables & Styles Extractor (JSF Rule 4.13).
 *
 * @module result
 */

// ============================================================================
// SECTION 1: RESULT TYPE DEFINITIONS
// ============================================================================

export interface Success<T> {
  readonly ok: true;
  readonly value: T;
}

export interface Failure<E> {
  readonly ok: false;
  readonly error: E;
}

export type Result<T, E = string> = Success<T> | Failure<E>;

export const Result = {
  ok: <T>(value: T): Success<T> => ({ ok: true, value }),
  err: <E = string>(error: E): Failure<E> => ({ ok: false, error }),

  /**
   * Returns true if the result is a success.
   */
  isOk: <T, E>(result: Result<T, E>): result is Success<T> => result.ok,

  /**
   * Returns true if the result is a failure.
   */
  isErr: <T, E>(result: Result<T, E>): result is Failure<E> => !result.ok,

  /**
   * Unwraps a success value or returns the fallback.
   */
  unwrapOr: <T, E>(result: Result<T, E>, fallback: T): T =>
    result.ok ? result.value : fallback,

  /**
   * Maps a success value through a transform function.
   * If the result is an error, passes it through unchanged.
   */
  map: <T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> =>
    result.ok ? Result.ok(fn(result.value)) : result,

  /**
   * Chains a fallible operation onto a success value.
   * If the result is an error, passes it through unchanged.
   */
  flatMap: <T, U, E>(result: Result<T, E>, fn: (value: T) => Result<U, E>): Result<U, E> =>
    result.ok ? fn(result.value) : result,

  /**
   * Collects an array of Results into a Result of array.
   * Returns the first error encountered, or all success values.
   */
  all: <T, E>(results: ReadonlyArray<Result<T, E>>): Result<T[], E> => {
    const values: T[] = [];
    for (const result of results) {
      if (!result.ok) return result;
      values.push(result.value);
    }
    return Result.ok(values);
  },
} as const;
