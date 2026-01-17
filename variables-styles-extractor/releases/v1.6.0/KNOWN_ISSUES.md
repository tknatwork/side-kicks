# Known Issues - v1.6.0

**Version**: 1.6.0  
**Status**: Published to Figma Community

---

## Current Issues

No known issues at this time.

---

## Reporting Issues

If you encounter a problem, please report it:

### Via GitHub
1. Go to [GitHub Issues](https://github.com/tknatwork/side-kicks/issues)
2. Click "New Issue"
3. Select "Bug Report" template
4. Fill in all details

### Information to Include
- Figma version
- Plugin version (shown in window title)
- Operating system
- Steps to reproduce
- Expected vs. actual behavior
- Export JSON if relevant (remove sensitive data)

---

## Resolved Issues (Previous Versions)

### Grid Import Validation (Fixed in v1.2.0)
Grid styles failed to import with "layoutGrids validation error". Fixed by using conditional property structure per alignment type.

### Stack Underflow Error (Fixed in v1.5.5)
Plugin crashed with "stack underflow" on large files. Fixed by changing TypeScript target from ES2020 to ES2017.

---

**Last Updated:** 2025-12-24
