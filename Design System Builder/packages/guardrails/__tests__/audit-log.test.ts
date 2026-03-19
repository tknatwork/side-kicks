import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { auditLog, readAuditLog, getAuditLogPath } from '../src/audit-log';

describe('audit-log', () => {
  describe('getAuditLogPath', () => {
    it('returns a path ending in audit.log', () => {
      const logPath = getAuditLogPath();
      expect(logPath.endsWith('audit.log')).toBe(true);
    });

    it('path includes workspace/reports', () => {
      const logPath = getAuditLogPath();
      expect(logPath).toContain(path.join('workspace', 'reports'));
    });
  });

  describe('write and read round-trip', () => {
    const logPath = getAuditLogPath();
    let backupContent: string | null = null;

    beforeEach(() => {
      try { backupContent = fs.readFileSync(logPath, 'utf-8'); } catch { backupContent = null; }
      const dir = path.dirname(logPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      try { fs.unlinkSync(logPath); } catch { /* ok */ }
    });

    afterEach(() => {
      try { fs.unlinkSync(logPath); } catch { /* ok */ }
      if (backupContent !== null) fs.writeFileSync(logPath, backupContent, 'utf-8');
    });

    it('logs READ action and reads it back', () => {
      auditLog('READ', '/workspace/context/file.json', 'OK');
      const entries = readAuditLog();
      const entry = entries.find(e => e.action === 'READ');
      expect(entry).toBeDefined();
      expect(entry!.status).toBe('OK');
    });

    it('logs WRITE action', () => {
      auditLog('WRITE', '/workspace/exports/out.json', 'OK');
      const entries = readAuditLog();
      expect(entries.some(e => e.action === 'WRITE')).toBe(true);
    });

    it('logs DENIED action with reason', () => {
      auditLog('DENIED', '/etc/passwd', 'DENIED', 'Path outside sandbox');
      const entries = readAuditLog();
      const denied = entries.find(e => e.action === 'DENIED');
      expect(denied).toBeDefined();
      expect(denied!.reason).toContain('outside sandbox');
    });

    it('logs DELETE action', () => {
      auditLog('DELETE', '/workspace/temp/old.json', 'OK');
      const entries = readAuditLog();
      expect(entries.some(e => e.action === 'DELETE')).toBe(true);
    });

    it('logs ERROR status', () => {
      auditLog('READ', '/workspace/context/x.json', 'ERROR', 'File not found');
      const entries = readAuditLog();
      const err = entries.find(e => e.status === 'ERROR');
      expect(err).toBeDefined();
      expect(err!.reason).toContain('File not found');
    });

    it('accumulates multiple entries', () => {
      auditLog('READ', '/a', 'OK');
      auditLog('WRITE', '/b', 'OK');
      auditLog('DENIED', '/c', 'DENIED', 'blocked');
      const entries = readAuditLog();
      expect(entries.length).toBeGreaterThanOrEqual(3);
    });

    it('entries include ISO timestamps', () => {
      auditLog('READ', '/test', 'OK');
      const entries = readAuditLog();
      expect(entries[0]!.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('readAuditLog when file missing', () => {
    it('returns empty array', () => {
      // Temporarily rename path if it exists, test, restore
      const logPath = getAuditLogPath();
      const tmpPath = logPath + '.bak-test';
      let hadFile = false;
      try {
        if (fs.existsSync(logPath)) {
          fs.renameSync(logPath, tmpPath);
          hadFile = true;
        }
        const entries = readAuditLog();
        expect(entries).toEqual([]);
      } finally {
        if (hadFile) fs.renameSync(tmpPath, logPath);
      }
    });
  });
});
