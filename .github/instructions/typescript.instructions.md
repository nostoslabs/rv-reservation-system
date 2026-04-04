---
applyTo: "**/*.{ts,tsx}"
---

# TypeScript review guidelines

- Prefer explicit types at module boundaries.
- Flag use of any, implicit contracts, or unsafe casts unless clearly justified.
- Flag overly large services, utility dumping grounds, and mixed concerns.
- Prefer small composable modules with clear responsibilities.
- Flag duplication that should be extracted, but avoid abstractions that hide simple logic.
- Ensure async flows, error handling, and null/undefined handling are explicit and testable.

