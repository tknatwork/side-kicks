/**
 * HTML Config Generator — Generates a self-contained HTML wizard
 * for visual design system configuration.
 *
 * The generator is DATA-DRIVEN: it takes a step definition array
 * as input, so questions can be added/changed without modifying
 * the HTML generator itself.
 *
 * Features:
 *   - Multi-step wizard with progress bar
 *   - Back/next navigation
 *   - License key gate (first screen, locks remaining steps)
 *   - T&C acceptance gate (before license)
 *   - Chrome-only enforcement (browser detection)
 *   - Anti-DevTools deterrents (right-click, F12, debugger traps)
 *   - AES-256-GCM encryption before form submission
 *   - No external dependencies (all CSS/JS inline)
 *   - "Powered by DSB — requires Claude Code" banner
 *
 * Config Encryption:
 *   The browser-side JS uses Web Crypto API (SubtleCrypto) to
 *   encrypt the config JSON with AES-256-GCM before POSTing.
 *   The session key is embedded in the HTML at generation time.
 *
 * Security note on innerHTML usage:
 *   All dynamic values rendered via innerHTML are sanitized through
 *   the escapeHtmlJs() function. The step definitions and T&C content
 *   are generated server-side by DSB — no untrusted user input flows
 *   into innerHTML. The wizard form values are stored in a JS closure
 *   (formData object), not in DOM attributes.
 *
 * @module mcp-server/config-ui/generate-html
 */

// ============================================================================
// SECTION 1: STEP DEFINITION TYPES
// ============================================================================

/** A single field in a wizard step. */
export interface WizardField {
  /** Unique field identifier (becomes JSON key). */
  readonly id: string;
  /** Display label. */
  readonly label: string;
  /** Field type. */
  readonly type: 'text' | 'textarea' | 'number' | 'color' | 'select' | 'toggle' | 'range' | 'radio';
  /** Placeholder text (for text/textarea). */
  readonly placeholder?: string;
  /** Options for select/radio fields. */
  readonly options?: readonly { value: string; label: string }[];
  /** Default value. */
  readonly defaultValue?: string | number | boolean;
  /** Whether the field is required. */
  readonly required?: boolean;
  /** Help text shown below the field. */
  readonly helpText?: string;
  /** Min/max for number/range fields. */
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
}

/** A single step in the wizard. */
export interface WizardStep {
  /** Step identifier. */
  readonly id: string;
  /** Step title shown in the wizard. */
  readonly title: string;
  /** Step description/subtitle. */
  readonly description?: string;
  /** Fields in this step. */
  readonly fields: readonly WizardField[];
}

/** Quick-fill template that pre-populates fields. */
export interface QuickFillTemplate {
  /** Template name (e.g., "shadcn/ui"). */
  readonly name: string;
  /** Field values to pre-populate. */
  readonly values: Readonly<Record<string, string | number | boolean>>;
}

/** Configuration for the HTML generator. */
export interface GenerateHtmlConfig {
  /** Ordered wizard steps. */
  readonly steps: readonly WizardStep[];
  /** Quick-fill templates (optional). */
  readonly templates?: readonly QuickFillTemplate[];
  /** Orchestration server port (for POST URL). */
  readonly port: number;
  /** AES-256-GCM session key as hex string (embedded in HTML). */
  readonly sessionKeyHex: string;
  /** T&C text (HTML allowed — server-generated, trusted content). */
  readonly termsAndConditions: string;
  /** DSB version string for display. */
  readonly dsbVersion: string;
}

// ============================================================================
// SECTION 2: HTML GENERATION
// ============================================================================

/**
 * Generate a self-contained HTML config wizard.
 *
 * Returns a complete HTML string with all CSS and JS inline.
 * No external dependencies — the file is self-contained.
 *
 * @param config - Wizard configuration including steps, port, session key.
 * @returns Complete HTML string.
 */
export function generateConfigHtml(config: GenerateHtmlConfig): string {
  const { steps, templates, port, sessionKeyHex, termsAndConditions, dsbVersion } = config;

  const stepsJson = JSON.stringify(steps);
  const templatesJson = JSON.stringify(templates || []);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Design System Builder — Configuration</title>
  <style>${generateCss()}</style>
</head>
<body>
  <!-- Chrome-only gate -->
  <div id="chrome-gate" class="gate-overlay">
    <div class="gate-message">
      <h1>Chrome Required</h1>
      <p>Design System Builder requires Google Chrome.</p>
      <p>Please open this page in Chrome to continue.</p>
    </div>
  </div>

  <!-- DevTools warning overlay -->
  <div id="devtools-warning" class="gate-overlay">
    <div class="gate-message">
      <h1>Developer Tools Detected</h1>
      <p>Please close Developer Tools to continue.</p>
      <p>The configuration wizard requires a standard browser environment.</p>
    </div>
  </div>

  <!-- Main app container -->
  <div id="app">
    <header class="dsb-header">
      <div class="dsb-logo">Design System Builder</div>
      <div class="dsb-version">v${escapeHtml(dsbVersion)}</div>
      <div class="dsb-badge">Powered by DSB — requires Claude Code</div>
    </header>
    <div class="progress-bar" id="progress-bar">
      <div class="progress-fill" id="progress-fill"></div>
      <div class="progress-steps" id="progress-steps"></div>
    </div>
    <main class="wizard-content" id="wizard-content"></main>
    <footer class="wizard-nav" id="wizard-nav">
      <button class="btn btn-secondary" id="btn-back" disabled>Back</button>
      <div class="nav-spacer"></div>
      <button class="btn btn-primary" id="btn-next">Next</button>
    </footer>
  </div>

  <script>
  ${generateAntiTamperJs()}
  ${generateWizardJs(stepsJson, templatesJson, port, sessionKeyHex, termsAndConditions)}
  </script>
</body>
</html>`;
}

// ============================================================================
// SECTION 3: JS GENERATION (broken into logical pieces)
// ============================================================================

function generateAntiTamperJs(): string {
  // Chrome detection, right-click disable, keyboard shortcut blocking, DevTools detection
  return `
  (function() {
    var isChrome = /Chrome\\//.test(navigator.userAgent) && !/Edg\\//.test(navigator.userAgent);
    if (!isChrome) {
      document.getElementById('chrome-gate').style.display = 'flex';
      document.getElementById('app').style.display = 'none';
      return;
    }
    document.addEventListener('contextmenu', function(e) { e.preventDefault(); });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'F12') { e.preventDefault(); return; }
      if (e.ctrlKey && e.shiftKey && ['I','J','C'].includes(e.key)) { e.preventDefault(); return; }
      if (e.ctrlKey && e.key === 'u') { e.preventDefault(); return; }
    });
    var devtoolsOpen = false;
    var threshold = 160;
    setInterval(function() {
      var isOpen = (window.outerWidth - window.innerWidth > threshold) || (window.outerHeight - window.innerHeight > threshold);
      if (isOpen !== devtoolsOpen) {
        devtoolsOpen = isOpen;
        document.getElementById('devtools-warning').style.display = isOpen ? 'flex' : 'none';
      }
    }, 1000);
  })();`;
}

function generateWizardJs(
  stepsJson: string,
  templatesJson: string,
  port: number,
  sessionKeyHex: string,
  termsAndConditions: string
): string {
  return `
  (function() {
    'use strict';

    var STEPS = ${stepsJson};
    var TEMPLATES = ${templatesJson};
    var PORT = ${port};
    var SESSION_KEY_HEX = '${sessionKeyHex}';
    var T_AND_C = ${JSON.stringify(termsAndConditions)};

    // State (closure-scoped — not readable from DOM)
    var currentStep = 0;
    var formData = {};
    var tcAccepted = false;
    var licenseValid = false;
    var licenseTier = '';
    var totalSteps = 2 + STEPS.length + 1;

    // ─── Helpers ──────────────────────────────────────────────────────

    function esc(str) {
      return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
    function hexToBytes(hex) {
      var b = new Uint8Array(hex.length / 2);
      for (var i = 0; i < b.length; i++) b[i] = parseInt(hex.substr(i*2,2),16);
      return b;
    }
    function bytesToBase64(bytes) {
      var s = '';
      for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
      return btoa(s);
    }

    // ─── DOM helpers ─────────────────────────────────────────────────

    function $(id) { return document.getElementById(id); }

    /** Safe way to set step content — sanitizes all dynamic values through esc(). */
    function setContent(html) { $('wizard-content').innerHTML = html; }

    // ─── Progress bar ────────────────────────────────────────────────

    function renderProgress() {
      var pct = Math.round((currentStep / (totalSteps - 1)) * 100);
      $('progress-fill').style.width = pct + '%';
      var el = $('progress-steps');
      var labels = ['Terms','License'].concat(STEPS.map(function(s){return s.title;})).concat(['Submit']);
      var html = '';
      for (var i = 0; i < labels.length; i++) {
        var cls = 'progress-dot' + (i < currentStep ? ' done' : '') + (i === currentStep ? ' active' : '');
        html += '<span class="' + cls + '">' + esc(labels[i]) + '</span>';
      }
      el.innerHTML = html;
    }

    // ─── Step rendering ──────────────────────────────────────────────

    function renderStep() {
      var btnBack = $('btn-back');
      var btnNext = $('btn-next');
      btnBack.disabled = currentStep === 0;
      btnNext.style.display = '';

      if (currentStep === 0) { renderTcStep(btnNext); }
      else if (currentStep === 1) { renderLicenseStep(btnNext); }
      else if (currentStep < 2 + STEPS.length) { renderConfigStep(currentStep - 2, btnNext); }
      else { renderSubmitStep(btnNext); }

      renderProgress();
    }

    function renderTcStep(btnNext) {
      setContent(
        '<div class="step-container"><h2>Terms &amp; Conditions</h2>' +
        '<div class="tc-content">' + T_AND_C + '</div>' +
        '<label class="tc-checkbox"><input type="checkbox" id="tc-accept"' + (tcAccepted ? ' checked' : '') + '> I accept the Terms &amp; Conditions</label></div>'
      );
      btnNext.textContent = 'Accept & Continue';
      btnNext.disabled = !tcAccepted;
      $('tc-accept').addEventListener('change', function() {
        tcAccepted = this.checked;
        btnNext.disabled = !tcAccepted;
      });
    }

    function renderLicenseStep(btnNext) {
      setContent(
        '<div class="step-container"><h2>License Key</h2>' +
        '<p>Enter your Gumroad license key to unlock the configuration wizard.</p>' +
        '<div class="field-group">' +
        '<input type="text" id="license-key" class="field-input" placeholder="Paste your license key here...">' +
        '<button class="btn btn-primary" id="btn-validate" style="margin-top:12px;">Validate License</button>' +
        '<div id="license-status" class="license-status"></div></div></div>'
      );
      btnNext.textContent = 'Next';
      btnNext.disabled = !licenseValid;
      $('btn-validate').addEventListener('click', validateLicense);
    }

    function validateLicense() {
      var key = $('license-key').value.trim();
      if (!key) return;
      var st = $('license-status');
      st.textContent = 'Validating...';
      st.className = 'license-status pending';
      fetch('http://localhost:' + PORT + '/validate-license', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({licenseKey: key})
      })
      .then(function(r){return r.json();})
      .then(function(d) {
        if (d.valid) {
          licenseValid = true; licenseTier = d.tier || '';
          st.textContent = 'Valid! Tier: ' + licenseTier;
          st.className = 'license-status valid';
          $('btn-next').disabled = false;
        } else {
          st.textContent = d.message || 'Invalid license key.';
          st.className = 'license-status invalid';
        }
      })
      .catch(function() {
        st.textContent = 'Validation failed. Check your connection.';
        st.className = 'license-status invalid';
      });
    }

    function renderConfigStep(idx, btnNext) {
      var step = STEPS[idx];
      var html = '<div class="step-container"><h2>' + esc(step.title) + '</h2>';
      if (step.description) html += '<p class="step-desc">' + esc(step.description) + '</p>';
      if (idx === 0 && TEMPLATES.length > 0) {
        html += '<div class="templates"><span>Quick fill:</span>';
        for (var t = 0; t < TEMPLATES.length; t++) {
          html += '<button class="btn btn-template" data-template="' + t + '">' + esc(TEMPLATES[t].name) + '</button>';
        }
        html += '</div>';
      }
      for (var f = 0; f < step.fields.length; f++) html += renderField(step.fields[f]);
      html += '</div>';
      setContent(html);
      attachListeners(step.fields);
      btnNext.textContent = (idx === STEPS.length - 1) ? 'Review & Submit' : 'Next';
      btnNext.disabled = false;
    }

    function renderSubmitStep(btnNext) {
      var html = '<div class="step-container"><h2>Review &amp; Submit</h2>' +
        '<p>Your design system configuration is ready.</p>' +
        '<div class="review-summary"><table class="review-table">';
      var keys = Object.keys(formData);
      for (var i = 0; i < keys.length; i++) {
        html += '<tr><td class="review-key">' + esc(keys[i]) + '</td><td class="review-val">' + esc(String(formData[keys[i]])) + '</td></tr>';
      }
      html += '</table></div>' +
        '<button class="btn btn-build" id="btn-build">Build My Design System</button>' +
        '<div id="submit-status" class="submit-status"></div></div>';
      setContent(html);
      btnNext.style.display = 'none';
      $('btn-build').addEventListener('click', submitConfig);
    }

    // ─── Field rendering ─────────────────────────────────────────────

    function renderField(f) {
      var val = formData[f.id] !== undefined ? formData[f.id] : (f.defaultValue || '');
      var html = '<div class="field-group"><label class="field-label" for="field-' + f.id + '">' + esc(f.label);
      if (f.required) html += ' <span class="required">*</span>';
      html += '</label>';

      if (f.type === 'text') {
        html += '<input type="text" id="field-' + f.id + '" class="field-input" placeholder="' + esc(f.placeholder||'') + '" value="' + esc(String(val)) + '" data-field="' + f.id + '">';
      } else if (f.type === 'textarea') {
        html += '<textarea id="field-' + f.id + '" class="field-input field-textarea" placeholder="' + esc(f.placeholder||'') + '" data-field="' + f.id + '">' + esc(String(val)) + '</textarea>';
      } else if (f.type === 'number') {
        html += '<input type="number" id="field-' + f.id + '" class="field-input" value="' + val + '" data-field="' + f.id + '"' + numAttrs(f) + '>';
      } else if (f.type === 'color') {
        html += '<div class="color-field"><input type="color" id="field-' + f.id + '" value="' + (val||'#000000') + '" data-field="' + f.id + '"><span class="color-hex" id="hex-' + f.id + '">' + (val||'#000000') + '</span></div>';
      } else if (f.type === 'select' && f.options) {
        html += '<select id="field-' + f.id + '" class="field-input" data-field="' + f.id + '">';
        for (var o = 0; o < f.options.length; o++) {
          html += '<option value="' + esc(f.options[o].value) + '"' + (val===f.options[o].value?' selected':'') + '>' + esc(f.options[o].label) + '</option>';
        }
        html += '</select>';
      } else if (f.type === 'toggle') {
        html += '<label class="toggle-switch"><input type="checkbox" id="field-' + f.id + '" data-field="' + f.id + '"' + (val?' checked':'') + '><span class="toggle-slider"></span></label>';
      } else if (f.type === 'range') {
        html += '<div class="range-field"><input type="range" id="field-' + f.id + '" value="' + val + '" data-field="' + f.id + '"' + numAttrs(f) + '><span class="range-value" id="range-' + f.id + '">' + val + '</span></div>';
      } else if (f.type === 'radio' && f.options) {
        for (var r = 0; r < f.options.length; r++) {
          html += '<label class="radio-option"><input type="radio" name="field-' + f.id + '" value="' + esc(f.options[r].value) + '"' + (val===f.options[r].value?' checked':'') + ' data-field="' + f.id + '">' + esc(f.options[r].label) + '</label>';
        }
      }
      if (f.helpText) html += '<div class="field-help">' + esc(f.helpText) + '</div>';
      html += '</div>';
      return html;
    }

    function numAttrs(f) {
      var s = '';
      if (f.min !== undefined) s += ' min="' + f.min + '"';
      if (f.max !== undefined) s += ' max="' + f.max + '"';
      if (f.step !== undefined) s += ' step="' + f.step + '"';
      return s;
    }

    function attachListeners(fields) {
      for (var i = 0; i < fields.length; i++) {
        var f = fields[i];
        var el = $('field-' + f.id);
        if (!el) continue;
        if (f.type === 'toggle') {
          el.addEventListener('change', (function(id){return function(){formData[id]=this.checked;};})(f.id));
        } else if (f.type === 'color') {
          el.addEventListener('input', (function(id){return function(){formData[id]=this.value; var h=$('hex-'+id); if(h) h.textContent=this.value;};})(f.id));
        } else if (f.type === 'range') {
          el.addEventListener('input', (function(id){return function(){formData[id]=this.value; var r=$('range-'+id); if(r) r.textContent=this.value;};})(f.id));
        } else if (f.type === 'radio') {
          var radios = document.querySelectorAll('[name="field-' + f.id + '"]');
          for (var r = 0; r < radios.length; r++) {
            radios[r].addEventListener('change', (function(id){return function(){formData[id]=this.value;};})(f.id));
          }
        } else {
          el.addEventListener('input', (function(id){return function(){formData[id]=this.value;};})(f.id));
        }
      }
      // Template buttons
      var btns = document.querySelectorAll('.btn-template');
      for (var b = 0; b < btns.length; b++) {
        btns[b].addEventListener('click', function() {
          var tmpl = TEMPLATES[parseInt(this.getAttribute('data-template'),10)];
          if (!tmpl) return;
          Object.keys(tmpl.values).forEach(function(k){formData[k]=tmpl.values[k];});
          renderStep();
        });
      }
    }

    // ─── Encryption + Submit ─────────────────────────────────────────

    async function submitConfig() {
      var st = $('submit-status');
      st.textContent = 'Encrypting and submitting...';
      st.className = 'submit-status pending';
      try {
        var keyBytes = hexToBytes(SESSION_KEY_HEX);
        var cryptoKey = await crypto.subtle.importKey('raw', keyBytes, {name:'AES-GCM'}, false, ['encrypt']);
        var plaintext = new TextEncoder().encode(JSON.stringify(formData));
        var iv = crypto.getRandomValues(new Uint8Array(12));
        var buf = await crypto.subtle.encrypt({name:'AES-GCM', iv:iv, tagLength:128}, cryptoKey, plaintext);
        var arr = new Uint8Array(buf);
        var ct = arr.slice(0, arr.length - 16);
        var tag = arr.slice(arr.length - 16);
        var resp = await fetch('http://localhost:' + PORT + '/config-results', {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ciphertext:bytesToBase64(ct), iv:bytesToBase64(iv), authTag:bytesToBase64(tag), algorithm:'aes-256-gcm'})
        });
        var data = await resp.json();
        if (data.ok) {
          st.textContent = 'Configuration submitted! Claude will process it now. You can close this tab.';
          st.className = 'submit-status valid';
          $('btn-build').disabled = true;
        } else {
          st.textContent = 'Submission failed: ' + (data.error || 'Unknown error');
          st.className = 'submit-status invalid';
        }
      } catch(err) {
        st.textContent = 'Encryption failed: ' + err.message;
        st.className = 'submit-status invalid';
      }
    }

    // ─── Navigation ──────────────────────────────────────────────────

    function saveCurrentFields() {
      if (currentStep >= 2 && currentStep < 2 + STEPS.length) {
        var fields = STEPS[currentStep - 2].fields;
        for (var i = 0; i < fields.length; i++) {
          var el = $('field-' + fields[i].id);
          if (!el) continue;
          formData[fields[i].id] = fields[i].type === 'toggle' ? el.checked : el.value;
        }
      }
    }

    $('btn-next').addEventListener('click', function() {
      if (currentStep === 0 && !tcAccepted) return;
      if (currentStep === 1 && !licenseValid) return;
      saveCurrentFields();
      currentStep++;
      renderStep();
    });

    $('btn-back').addEventListener('click', function() {
      if (currentStep > 0) { currentStep--; $('btn-next').style.display = ''; renderStep(); }
    });

    // Initialize
    renderStep();
  })();`;
}

// ============================================================================
// SECTION 4: CSS GENERATION
// ============================================================================

function generateCss(): string {
  return `
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0a0a0b;color:#e4e4e7;min-height:100vh}
    .gate-overlay{position:fixed;inset:0;background:#0a0a0b;z-index:9999;display:none;align-items:center;justify-content:center}
    .gate-message{text-align:center;max-width:500px;padding:48px}
    .gate-message h1{font-size:24px;margin-bottom:16px;color:#f59e0b}
    .gate-message p{color:#a1a1aa;line-height:1.6}
    .dsb-header{display:flex;align-items:center;gap:16px;padding:16px 32px;border-bottom:1px solid #27272a}
    .dsb-logo{font-size:18px;font-weight:700;color:#f4f4f5}
    .dsb-version{font-size:12px;color:#71717a;padding:2px 8px;border:1px solid #3f3f46;border-radius:4px}
    .dsb-badge{margin-left:auto;font-size:11px;color:#71717a}
    .progress-bar{position:relative;height:48px;background:#18181b;border-bottom:1px solid #27272a}
    .progress-fill{position:absolute;top:0;left:0;height:3px;background:linear-gradient(90deg,#6366f1,#8b5cf6);transition:width .3s ease}
    .progress-steps{display:flex;align-items:center;justify-content:center;gap:24px;height:100%;overflow-x:auto;padding:0 16px}
    .progress-dot{font-size:12px;color:#52525b;transition:color .3s;white-space:nowrap}
    .progress-dot.active{color:#8b5cf6;font-weight:600}
    .progress-dot.done{color:#22c55e}
    #app{display:flex;flex-direction:column;min-height:100vh}
    .wizard-content{flex:1;padding:32px;max-width:720px;margin:0 auto;width:100%;overflow-y:auto;min-height:calc(100vh - 180px)}
    .step-container h2{font-size:22px;margin-bottom:8px;color:#f4f4f5}
    .step-desc{color:#a1a1aa;margin-bottom:24px;line-height:1.5}
    .field-group{margin-bottom:20px}
    .field-label{display:block;font-size:13px;font-weight:600;color:#d4d4d8;margin-bottom:6px}
    .required{color:#ef4444}
    .field-input{width:100%;padding:10px 14px;background:#18181b;border:1px solid #3f3f46;border-radius:8px;color:#e4e4e7;font-size:14px;outline:none;transition:border-color .2s}
    .field-input:focus{border-color:#6366f1}
    .field-textarea{min-height:80px;resize:vertical}
    .field-help{font-size:12px;color:#71717a;margin-top:4px}
    .color-field{display:flex;align-items:center;gap:12px}
    .color-field input[type="color"]{width:48px;height:48px;border:1px solid #3f3f46;border-radius:8px;cursor:pointer;background:none;padding:2px}
    .color-hex{font-family:monospace;font-size:14px;color:#a1a1aa}
    .toggle-switch{position:relative;display:inline-block;width:44px;height:24px}
    .toggle-switch input{opacity:0;width:0;height:0}
    .toggle-slider{position:absolute;cursor:pointer;inset:0;background:#3f3f46;border-radius:24px;transition:.3s}
    .toggle-slider::before{content:'';position:absolute;height:18px;width:18px;left:3px;bottom:3px;background:#e4e4e7;border-radius:50%;transition:.3s}
    .toggle-switch input:checked+.toggle-slider{background:#6366f1}
    .toggle-switch input:checked+.toggle-slider::before{transform:translateX(20px)}
    .range-field{display:flex;align-items:center;gap:12px}
    .range-field input[type="range"]{flex:1;accent-color:#6366f1}
    .range-value{font-family:monospace;font-size:14px;color:#a1a1aa;min-width:32px;text-align:right}
    .radio-option{display:block;padding:8px 0;cursor:pointer;color:#d4d4d8}
    .radio-option input{margin-right:8px;accent-color:#6366f1}
    .templates{display:flex;align-items:center;gap:8px;margin-bottom:24px;padding:12px 16px;background:#18181b;border:1px solid #3f3f46;border-radius:8px}
    .templates span{font-size:13px;color:#71717a}
    .btn-template{padding:4px 12px;background:#27272a;border:1px solid #3f3f46;border-radius:6px;color:#d4d4d8;cursor:pointer;font-size:12px}
    .btn-template:hover{border-color:#6366f1}
    .tc-content{max-height:300px;overflow-y:auto;padding:16px;background:#18181b;border:1px solid #3f3f46;border-radius:8px;font-size:13px;line-height:1.7;color:#a1a1aa;margin-bottom:16px}
    .tc-checkbox{display:flex;align-items:center;gap:8px;font-size:14px;cursor:pointer}
    .tc-checkbox input{accent-color:#6366f1;width:18px;height:18px}
    .license-status{margin-top:12px;font-size:14px;padding:8px 12px;border-radius:6px}
    .license-status.pending{color:#f59e0b;background:#422006}
    .license-status.valid{color:#22c55e;background:#052e16}
    .license-status.invalid{color:#ef4444;background:#450a0a}
    .review-table{width:100%;border-collapse:collapse;margin:16px 0}
    .review-table td{padding:8px 12px;border-bottom:1px solid #27272a;font-size:13px}
    .review-key{color:#71717a;width:40%}
    .review-val{color:#e4e4e7;font-family:monospace}
    .submit-status{margin-top:16px;font-size:14px;padding:8px 12px;border-radius:6px}
    .submit-status.pending{color:#f59e0b;background:#422006}
    .submit-status.valid{color:#22c55e;background:#052e16}
    .submit-status.invalid{color:#ef4444;background:#450a0a}
    .btn{padding:10px 20px;border-radius:8px;border:none;font-size:14px;font-weight:600;cursor:pointer;transition:all .2s}
    .btn:disabled{opacity:.4;cursor:not-allowed}
    .btn-primary{background:#6366f1;color:#fff}
    .btn-primary:hover:not(:disabled){background:#4f46e5}
    .btn-secondary{background:#27272a;color:#d4d4d8;border:1px solid #3f3f46}
    .btn-secondary:hover:not(:disabled){background:#3f3f46}
    .btn-build{width:100%;padding:14px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-size:16px;border-radius:10px;border:none;cursor:pointer;margin-top:16px}
    .btn-build:hover:not(:disabled){opacity:.9}
    .btn-build:disabled{opacity:.4;cursor:not-allowed}
    .wizard-nav{display:flex;align-items:center;padding:16px 32px;border-top:1px solid #27272a;background:#0a0a0b}
    .nav-spacer{flex:1}
    .review-summary{margin:16px 0}
    select.field-input{appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%2371717a' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10z'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:36px}
  `;
}

// ============================================================================
// SECTION 5: HELPERS
// ============================================================================

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
