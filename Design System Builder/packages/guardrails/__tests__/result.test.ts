import { describe, it, expect } from 'vitest';
import { Result } from '../src/result';

describe('Result type', () => {
  describe('ok', () => {
    it('creates a success result', () => {
      const result = Result.ok(42);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(42);
      }
    });
  });

  describe('err', () => {
    it('creates a failure result', () => {
      const result = Result.err('something went wrong');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('something went wrong');
      }
    });
  });

  describe('isOk / isErr', () => {
    it('correctly identifies success', () => {
      const result = Result.ok('hello');
      expect(Result.isOk(result)).toBe(true);
      expect(Result.isErr(result)).toBe(false);
    });

    it('correctly identifies failure', () => {
      const result = Result.err('fail');
      expect(Result.isOk(result)).toBe(false);
      expect(Result.isErr(result)).toBe(true);
    });
  });

  describe('unwrapOr', () => {
    it('returns value on success', () => {
      expect(Result.unwrapOr(Result.ok(10), 0)).toBe(10);
    });

    it('returns fallback on failure', () => {
      expect(Result.unwrapOr(Result.err('fail'), 0)).toBe(0);
    });
  });

  describe('map', () => {
    it('transforms success value', () => {
      const result = Result.map(Result.ok(5), (n) => n * 2);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe(10);
    });

    it('passes through error', () => {
      const result = Result.map(Result.err('fail'), (n: number) => n * 2);
      expect(result.ok).toBe(false);
    });
  });

  describe('flatMap', () => {
    it('chains successful operations', () => {
      const divide = (n: number): ReturnType<typeof Result.ok<number>> | ReturnType<typeof Result.err> =>
        n === 0 ? Result.err('division by zero') : Result.ok(100 / n);

      const result = Result.flatMap(Result.ok(5), divide);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe(20);
    });

    it('short-circuits on error', () => {
      const divide = (n: number): ReturnType<typeof Result.ok<number>> | ReturnType<typeof Result.err> =>
        Result.ok(100 / n);

      const result = Result.flatMap(Result.err('already failed'), divide);
      expect(result.ok).toBe(false);
    });
  });

  describe('all', () => {
    it('collects all successes', () => {
      const results = [Result.ok(1), Result.ok(2), Result.ok(3)];
      const combined = Result.all(results);
      expect(combined.ok).toBe(true);
      if (combined.ok) expect(combined.value).toEqual([1, 2, 3]);
    });

    it('returns first error', () => {
      const results = [Result.ok(1), Result.err('fail'), Result.ok(3)];
      const combined = Result.all(results);
      expect(combined.ok).toBe(false);
      if (!combined.ok) expect(combined.error).toBe('fail');
    });
  });
});
