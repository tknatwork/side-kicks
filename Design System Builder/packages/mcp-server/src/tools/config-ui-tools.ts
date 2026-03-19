/**
 * Config UI Tools — MCP tool for opening the visual configuration wizard.
 *
 * Tool:
 *   dsb_open_config_ui — Generates HTML, writes to workspace/temp, opens Chrome,
 *                        polls for config results, returns encrypted config JSON.
 *
 * @module mcp-server/tools/config-ui-tools
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { BridgeClient } from '../bridge-client';
import { z } from 'zod';
import * as path from 'node:path';
import { execFile } from 'node:child_process';
import { generateConfigHtml } from '../config-ui/generate-html';
import type { WizardStep, QuickFillTemplate } from '../config-ui/generate-html';
import { generateSessionKey } from '@dsb/core';
import { safeWriteFile, DSB_ROOT } from '@dsb/guardrails';

// ============================================================================
// SECTION 1: DEFAULT STEPS (placeholder — will be designed later)
// ============================================================================

/**
 * Placeholder step definitions.
 *
 * The specific questions and controls will be designed in a later phase.
 * This demonstrates the data-driven architecture: changing these arrays
 * changes the wizard without touching the HTML generator.
 */
const DEFAULT_STEPS: WizardStep[] = [
  {
    id: 'basics',
    title: 'Design System Basics',
    description: 'Name your design system and choose the framework foundation.',
    fields: [
      { id: 'systemName', label: 'Design System Name', type: 'text', placeholder: 'e.g., Acme Design System', required: true },
      {
        id: 'framework', label: 'Framework', type: 'select',
        options: [
          { value: 'custom', label: 'Custom (start from scratch)' },
          { value: 'shadcn', label: 'shadcn/ui' },
          { value: 'material', label: 'Material Design 3' },
          { value: 'tailwind', label: 'Tailwind CSS defaults' },
        ],
        defaultValue: 'custom',
      },
    ],
  },
  {
    id: 'colors',
    title: 'Color Palette',
    description: 'Define your primary brand colors. These drive the entire color scale.',
    fields: [
      { id: 'primaryColor', label: 'Primary Brand Color', type: 'color', defaultValue: '#6366f1' },
      { id: 'secondaryColor', label: 'Secondary Color', type: 'color', defaultValue: '#8b5cf6' },
      { id: 'neutralBase', label: 'Neutral Base', type: 'color', defaultValue: '#71717a', helpText: 'Used for text, borders, backgrounds.' },
      { id: 'scaleSteps', label: 'Scale Steps', type: 'number', defaultValue: 11, min: 5, max: 21, step: 2, helpText: 'Number of steps in each color scale (odd numbers recommended).' },
    ],
  },
  {
    id: 'typography',
    title: 'Typography',
    description: 'Choose fonts and define the type scale.',
    fields: [
      { id: 'headingFont', label: 'Heading Font', type: 'text', placeholder: 'e.g., Inter, SF Pro Display', defaultValue: 'Inter' },
      { id: 'bodyFont', label: 'Body Font', type: 'text', placeholder: 'e.g., Inter, SF Pro Text', defaultValue: 'Inter' },
      { id: 'baseSize', label: 'Base Font Size (px)', type: 'number', defaultValue: 16, min: 12, max: 24 },
      {
        id: 'typeScale', label: 'Type Scale Ratio', type: 'select',
        options: [
          { value: '1.125', label: 'Major Second (1.125)' },
          { value: '1.200', label: 'Minor Third (1.200)' },
          { value: '1.250', label: 'Major Third (1.250)' },
          { value: '1.333', label: 'Perfect Fourth (1.333)' },
          { value: '1.414', label: 'Augmented Fourth (1.414)' },
        ],
        defaultValue: '1.250',
      },
    ],
  },
  {
    id: 'spacing',
    title: 'Spacing & Layout',
    description: 'Define the spacing scale and breakpoints.',
    fields: [
      { id: 'baseSpacing', label: 'Base Spacing Unit (px)', type: 'number', defaultValue: 4, min: 2, max: 16 },
      {
        id: 'spacingScale', label: 'Spacing Scale Method', type: 'radio',
        options: [
          { value: 'linear', label: 'Linear (4, 8, 12, 16, 20...)' },
          { value: 'exponential', label: 'Exponential (4, 8, 16, 32, 64...)' },
        ],
        defaultValue: 'linear',
      },
      { id: 'includeBreakpoints', label: 'Include Responsive Breakpoints', type: 'toggle', defaultValue: true },
    ],
  },
  {
    id: 'themes',
    title: 'Theme Modes',
    description: 'Configure light/dark mode support.',
    fields: [
      { id: 'darkMode', label: 'Include Dark Mode', type: 'toggle', defaultValue: true },
      { id: 'highContrast', label: 'Include High Contrast Mode', type: 'toggle', defaultValue: false },
      { id: 'customThemes', label: 'Number of Custom Themes', type: 'number', defaultValue: 0, min: 0, max: 5, helpText: 'Additional custom theme modes beyond light/dark.' },
    ],
  },
];

const DEFAULT_TEMPLATES: QuickFillTemplate[] = [
  {
    name: 'Start from shadcn/ui',
    values: {
      systemName: 'shadcn Design System',
      framework: 'shadcn',
      primaryColor: '#0f172a',
      secondaryColor: '#6366f1',
      neutralBase: '#64748b',
      scaleSteps: 11,
      headingFont: 'Inter',
      bodyFont: 'Inter',
      baseSize: 16,
      typeScale: '1.250',
      baseSpacing: 4,
      spacingScale: 'linear',
      includeBreakpoints: true,
      darkMode: true,
      highContrast: false,
      customThemes: 0,
    },
  },
];

// ============================================================================
// SECTION 2: T&C PLACEHOLDER
// ============================================================================

const DEFAULT_TERMS = `<h3>Design System Builder — Terms & Conditions</h3>
<p>By using DSB, you agree to the following terms:</p>
<ol>
<li>DSB creates and modifies files in your Figma workspace as instructed.</li>
<li>DSB sends anonymized usage telemetry if you opt in.</li>
<li>DSB requires Google Chrome and Claude Code to operate.</li>
<li>Your design system configuration is encrypted in transit and at rest.</li>
<li>DSB monitors its own files for unauthorized modifications.</li>
<li>You are responsible for backing up your Figma files before builds.</li>
</ol>
<p>Full terms at: https://dsb.example/terms</p>`;

// ============================================================================
// SECTION 3: REGISTRATION
// ============================================================================

export function registerConfigUiTools(server: McpServer, bridge: BridgeClient): void {

  server.tool(
    'dsb_open_config_ui',
    'Open the visual configuration wizard in Chrome. Generates the HTML, writes it to workspace/temp, opens Chrome, and polls for config results. Returns the encrypted config JSON when the user submits.',
    {
      port: z.number().optional().describe('Orchestration server port (default: 9877).'),
      pollTimeoutMs: z.number().optional().describe('How long to poll for results in ms (default: 600000 = 10 min).'),
      dsbVersion: z.string().optional().describe('DSB version string (default: "0.1.0").'),
    },
    async ({ port: serverPort, pollTimeoutMs, dsbVersion }) => {
      const port = serverPort || 9877;
      const timeout = pollTimeoutMs || 600_000;
      const version = dsbVersion || '0.1.0';

      // 1. Generate session key for config encryption
      const sessionKey = generateSessionKey();

      // 2. Generate HTML
      const html = generateConfigHtml({
        steps: DEFAULT_STEPS,
        templates: DEFAULT_TEMPLATES,
        port,
        sessionKeyHex: sessionKey.hex,
        termsAndConditions: DEFAULT_TERMS,
        dsbVersion: version,
      });

      // 3. Write HTML to workspace/temp
      const htmlPath = path.join(DSB_ROOT, 'workspace', 'temp', 'config-ui.html');
      const writeResult = safeWriteFile(htmlPath, html);
      if (!writeResult.ok) {
        return error('Failed to write config UI HTML: ' + writeResult.error);
      }

      // 4. Open Chrome
      const url = `http://localhost:${port}/config-ui`;
      const openResult = await openInChrome(url);
      if (!openResult) {
        return error('Failed to open Chrome. Is Google Chrome installed?');
      }

      // 5. Poll for config results
      const startTime = Date.now();
      const pollInterval = 3000; // 3 seconds

      while (Date.now() - startTime < timeout) {
        const result = await bridge.getConfigResults();

        if (result && result.available && result.config) {
          // Got config! Clear the server-side session
          await bridge.clearConfigResults();

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                message: 'Configuration received from browser UI.',
                encryptedConfig: result.config,
                sessionKeyHex: sessionKey.hex,
                submittedAt: result.submittedAt,
                action: 'Decrypt the config using the session key, then present the build plan to the user.',
              }, null, 2),
            }],
          };
        }

        // Wait before polling again
        await sleep(pollInterval);
      }

      return error('Config UI timed out after ' + (timeout / 1000) + ' seconds. User did not submit the form.');
    }
  );
}

// ============================================================================
// SECTION 4: HELPERS
// ============================================================================

function error(message: string) {
  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify({ error: message }, null, 2),
    }],
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Open a URL in Google Chrome (platform-specific).
 * Uses execFile (not exec) to prevent shell injection.
 */
function openInChrome(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const platform = process.platform;

    if (platform === 'darwin') {
      execFile('open', ['-a', 'Google Chrome', url], (err) => resolve(!err));
    } else if (platform === 'win32') {
      execFile('cmd', ['/c', 'start', 'chrome', url], (err) => resolve(!err));
    } else {
      execFile('google-chrome', [url], (err) => resolve(!err));
    }
  });
}
