---
applyTo: "**/*.svelte"
---

# Svelte review guidelines

- Keep UI components focused on presentation and simple interaction logic.
- Flag domain or persistence logic embedded directly in components.
- Prefer moving reusable business logic into stores, services, or domain modules.
- Flag state management that is overly coupled, hard to reason about, or hard to test.
- Flag accessibility issues for interactive elements, forms, labels, keyboard support, and ARIA usage where relevant.
- Prefer components that are easy to test with clear inputs, outputs, and side effects.
