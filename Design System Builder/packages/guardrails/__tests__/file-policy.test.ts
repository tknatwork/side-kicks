import { describe, it, expect } from 'vitest';
import { checkFilePolicy } from '../src/file-policy';

describe('file-policy', () => {
  describe('allowed extensions', () => {
    const allowedFiles = [
      'tokens.json',
      'brand-guide.pdf',
      'styles.css',
      'component.tsx',
      'config.yaml',
      'icon.svg',
      'logo.png',
      'theme.tokens.json',
      'tailwind.config.js',
    ];

    for (const file of allowedFiles) {
      it(`allows ${file}`, () => {
        const result = checkFilePolicy(`/fake/path/${file}`);
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value.verdict).toBe('allowed');
        }
      });
    }
  });

  describe('blocked extensions', () => {
    const blockedFiles = [
      'malware.exe',
      'payload.app',
      'installer.dmg',
      'setup.msi',
      'hack.sh',
      'attack.bat',
      'script.ps1',
      'archive.zip',
      'backup.tar',
      'data.db',
      'dump.sql',
      'report.docx',
    ];

    for (const file of blockedFiles) {
      it(`blocks ${file}`, () => {
        const result = checkFilePolicy(`/fake/path/${file}`);
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value.verdict).toBe('blocked');
        }
      });
    }
  });

  describe('secret detection', () => {
    const secretFiles = [
      '.env',
      '.env.local',
      '.env.production',
      'credentials.json',
      'my-secret.txt',
      'id_rsa',
      'server.pem',
      'tls.key',
    ];

    for (const file of secretFiles) {
      it(`blocks secret file: ${file}`, () => {
        const result = checkFilePolicy(`/fake/path/${file}`);
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value.verdict).toBe('blocked');
        }
      });
    }
  });

  describe('unknown extensions', () => {
    it('warns for unknown extensions', () => {
      const result = checkFilePolicy('/fake/path/file.xyz');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.verdict).toBe('warning');
      }
    });
  });
});
