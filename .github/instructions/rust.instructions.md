---
applyTo: "**/*.rs"
---

# Rust review guidelines

- Prefer strong typing and ownership-aware design over unnecessary cloning or shared mutable state.
- Flag large modules, god structs, or traits with unrelated responsibilities.
- Flag Result/Option handling that obscures failure paths.
- Prefer explicit error handling and meaningful error types.
- Flag business rules mixed into HTTP handlers, database code, or serialization layers.
- Flag code that makes unit testing hard because dependencies are not injectable or side effects are not isolated.
- Prefer straightforward composition over premature generic abstractions.
