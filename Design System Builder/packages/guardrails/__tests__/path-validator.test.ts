import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import * as os from 'node:os';
import { validatePath } from '../src/path-validator';
import { DSB_ROOT } from '../src/constants';

describe('path-validator', () => {
  const workspaceContext = path.resolve(DSB_ROOT, 'workspace', 'context');
  const workspaceExports = path.resolve(DSB_ROOT, 'workspace', 'exports');
  const templates = path.resolve(DSB_ROOT, 'templates');

  describe('read operations', () => {
    it('allows reading from workspace/context/', () => {
      const result = validatePath(path.join(workspaceContext, 'tokens.json'), 'read');
      expect(result.ok).toBe(true);
    });

    it('allows reading from templates/', () => {
      const result = validatePath(path.join(templates, 'material-ui.tokens.json'), 'read');
      expect(result.ok).toBe(true);
    });

    it('allows reading from ~/.dsb/', () => {
      const result = validatePath(path.join(os.homedir(), '.dsb', 'global-context.json'), 'read');
      expect(result.ok).toBe(true);
    });

    it('denies reading from home directory', () => {
      const result = validatePath(path.join(os.homedir(), 'Documents', 'secrets.txt'), 'read');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('outside sandbox');
      }
    });

    it('denies reading from /etc/', () => {
      const result = validatePath('/etc/passwd', 'read');
      expect(result.ok).toBe(false);
    });
  });

  describe('write operations', () => {
    it('allows writing to workspace/exports/', () => {
      const result = validatePath(path.join(workspaceExports, 'output.json'), 'write');
      expect(result.ok).toBe(true);
    });

    it('denies writing to workspace/context/', () => {
      // context/ is read-only (user drops files there, DSB reads them)
      const result = validatePath(path.join(workspaceContext, 'malicious.json'), 'write');
      expect(result.ok).toBe(false);
    });

    it('denies writing to templates/', () => {
      const result = validatePath(path.join(templates, 'hack.json'), 'write');
      expect(result.ok).toBe(false);
    });

    it('denies writing outside sandbox', () => {
      const result = validatePath('/tmp/escape.sh', 'write');
      expect(result.ok).toBe(false);
    });
  });

  describe('path traversal attacks', () => {
    it('blocks null bytes', () => {
      const result = validatePath(workspaceContext + '/\0/../../etc/passwd', 'read');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('null bytes');
      }
    });

    it('blocks .. traversal out of sandbox', () => {
      const result = validatePath(path.join(workspaceContext, '..', '..', '..', 'etc', 'passwd'), 'read');
      expect(result.ok).toBe(false);
    });

    it('blocks empty paths', () => {
      const result = validatePath('', 'read');
      expect(result.ok).toBe(false);
    });

    it('blocks whitespace-only paths', () => {
      const result = validatePath('   ', 'read');
      expect(result.ok).toBe(false);
    });
  });
});
