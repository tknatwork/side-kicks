import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import { guardOperation, guardRead, guardWrite } from '../src/operation-guard';
import { DSB_ROOT } from '../src/constants';

describe('operation-guard', () => {
  describe('guardRead', () => {
    it('allows reading from workspace/context/', () => {
      const target = path.resolve(DSB_ROOT, 'workspace', 'context', 'README.md');
      const result = guardRead(target);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.safePath).toBe(target);
      }
    });

    it('allows reading from workspace/exports/', () => {
      const target = path.resolve(DSB_ROOT, 'workspace', 'exports', 'tokens.json');
      const result = guardRead(target);
      expect(result.ok).toBe(true);
    });

    it('allows reading from templates/', () => {
      const target = path.resolve(DSB_ROOT, 'templates', 'shadcn-ui.tokens.json');
      const result = guardRead(target);
      expect(result.ok).toBe(true);
    });

    it('allows reading from workspace/temp/', () => {
      const target = path.resolve(DSB_ROOT, 'workspace', 'temp', 'snapshot.json');
      const result = guardRead(target);
      expect(result.ok).toBe(true);
    });

    it('allows reading from .dsb/', () => {
      const target = path.resolve(DSB_ROOT, '.dsb', 'config.json');
      const result = guardRead(target);
      expect(result.ok).toBe(true);
    });

    it('denies reading from paths outside sandbox', () => {
      const result = guardRead('/etc/passwd');
      expect(result.ok).toBe(false);
    });

    it('denies reading with directory traversal', () => {
      const target = path.resolve(DSB_ROOT, 'workspace', 'context', '..', '..', '..', 'etc', 'passwd');
      const result = guardRead(target);
      expect(result.ok).toBe(false);
    });

    it('denies reading from home directory', () => {
      const result = guardRead(path.resolve(process.env['HOME'] || '~', '.bashrc'));
      expect(result.ok).toBe(false);
    });
  });

  describe('guardWrite', () => {
    it('allows writing to workspace/exports/', () => {
      const target = path.resolve(DSB_ROOT, 'workspace', 'exports', 'output.json');
      const result = guardWrite(target);
      expect(result.ok).toBe(true);
    });

    it('allows writing to workspace/temp/', () => {
      const target = path.resolve(DSB_ROOT, 'workspace', 'temp', 'data.json');
      const result = guardWrite(target);
      expect(result.ok).toBe(true);
    });

    it('allows writing to workspace/reports/', () => {
      const target = path.resolve(DSB_ROOT, 'workspace', 'reports', 'report.json');
      const result = guardWrite(target);
      expect(result.ok).toBe(true);
    });

    it('allows writing to .dsb/', () => {
      const target = path.resolve(DSB_ROOT, '.dsb', 'state.json');
      const result = guardWrite(target);
      expect(result.ok).toBe(true);
    });

    it('denies writing outside sandbox', () => {
      const result = guardWrite('/tmp/evil.sh');
      expect(result.ok).toBe(false);
    });

    it('denies writing to workspace/context/ (read-only)', () => {
      const target = path.resolve(DSB_ROOT, 'workspace', 'context', 'hack.json');
      const result = guardWrite(target);
      expect(result.ok).toBe(false);
    });
  });

  describe('guardOperation', () => {
    it('respects skipFilePolicy option', () => {
      const target = path.resolve(DSB_ROOT, 'workspace', 'exports', 'data.json');
      const result = guardOperation(target, 'write', { skipFilePolicy: true });
      expect(result.ok).toBe(true);
    });

    it('respects label option for audit logging', () => {
      const target = path.resolve(DSB_ROOT, 'workspace', 'exports', 'data.json');
      const result = guardOperation(target, 'write', { skipFilePolicy: true, label: 'test-label' });
      expect(result.ok).toBe(true);
    });

    it('deny still works with skipFilePolicy', () => {
      const result = guardOperation('/etc/shadow', 'read', { skipFilePolicy: true });
      expect(result.ok).toBe(false);
    });
  });
});
