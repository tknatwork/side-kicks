// Lint entry point: importing this registers all detectors (side-effect) and
// re-exports the runner. Import from here, not runner.js, so DETECTORS is
// populated before runLint runs.
import "./detectors/register.js";

export { runLint, ruleInventory, DETECTORS } from "./runner.js";
export type { LintSnapshot, LintReport, Finding } from "./runner.js";
