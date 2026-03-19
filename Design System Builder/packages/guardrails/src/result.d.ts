/**
 * Result Type Pattern — Discriminated union for explicit error handling.
 *
 * Every function that can fail returns Result<T, E> instead of throwing.
 * Proven pattern from Variables & Styles Extractor (JSF Rule 4.13).
 *
 * @module result
 */
export interface Success<T> {
    readonly ok: true;
    readonly value: T;
}
export interface Failure<E> {
    readonly ok: false;
    readonly error: E;
}
export type Result<T, E = string> = Success<T> | Failure<E>;
export declare const Result: {
    readonly ok: <T>(value: T) => Success<T>;
    readonly err: <E = string>(error: E) => Failure<E>;
    /**
     * Returns true if the result is a success.
     */
    readonly isOk: <T, E>(result: Result<T, E>) => result is Success<T>;
    /**
     * Returns true if the result is a failure.
     */
    readonly isErr: <T, E>(result: Result<T, E>) => result is Failure<E>;
    /**
     * Unwraps a success value or returns the fallback.
     */
    readonly unwrapOr: <T, E>(result: Result<T, E>, fallback: T) => T;
    /**
     * Maps a success value through a transform function.
     * If the result is an error, passes it through unchanged.
     */
    readonly map: <T, U, E>(result: Result<T, E>, fn: (value: T) => U) => Result<U, E>;
    /**
     * Chains a fallible operation onto a success value.
     * If the result is an error, passes it through unchanged.
     */
    readonly flatMap: <T, U, E>(result: Result<T, E>, fn: (value: T) => Result<U, E>) => Result<U, E>;
    /**
     * Collects an array of Results into a Result of array.
     * Returns the first error encountered, or all success values.
     */
    readonly all: <T, E>(results: ReadonlyArray<Result<T, E>>) => Result<T[], E>;
};
//# sourceMappingURL=result.d.ts.map