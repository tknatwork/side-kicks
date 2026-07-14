// Populates the runner's DETECTORS map. Imported for its side-effect by
// lint/index.ts before runLint is ever called. New tiers add their detector
// bundle here as they land (Waves 3b–7).
import { DETECTORS } from "../runner.js";
import { tokenDetectors } from "./tokens.js";
import { scopeDetectors } from "./scopes.js";
import { bindingDetectors } from "./bindings.js";
import { themingDetectors } from "./theming.js";
import { namingDetectors } from "./naming.js";
import { codegenDetectors } from "./codegen.js";
import { componentDetectors } from "./components.js";

Object.assign(
  DETECTORS,
  tokenDetectors,
  scopeDetectors,
  bindingDetectors,
  themingDetectors,
  namingDetectors,
  codegenDetectors,
  componentDetectors
);
