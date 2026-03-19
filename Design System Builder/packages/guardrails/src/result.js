"use strict";
/**
 * Result Type Pattern — Discriminated union for explicit error handling.
 *
 * Every function that can fail returns Result<T, E> instead of throwing.
 * Proven pattern from Variables & Styles Extractor (JSF Rule 4.13).
 *
 * @module result
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Result = void 0;
exports.Result = {
    ok: (value) => ({ ok: true, value }),
    err: (error) => ({ ok: false, error }),
    /**
     * Returns true if the result is a success.
     */
    isOk: (result) => result.ok,
    /**
     * Returns true if the result is a failure.
     */
    isErr: (result) => !result.ok,
    /**
     * Unwraps a success value or returns the fallback.
     */
    unwrapOr: (result, fallback) => result.ok ? result.value : fallback,
    /**
     * Maps a success value through a transform function.
     * If the result is an error, passes it through unchanged.
     */
    map: (result, fn) => result.ok ? exports.Result.ok(fn(result.value)) : result,
    /**
     * Chains a fallible operation onto a success value.
     * If the result is an error, passes it through unchanged.
     */
    flatMap: (result, fn) => result.ok ? fn(result.value) : result,
    /**
     * Collects an array of Results into a Result of array.
     * Returns the first error encountered, or all success values.
     */
    all: (results) => {
        const values = [];
        for (const result of results) {
            if (!result.ok)
                return result;
            values.push(result.value);
        }
        return exports.Result.ok(values);
    },
};
