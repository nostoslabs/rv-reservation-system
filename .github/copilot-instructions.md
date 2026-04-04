When reviewing pull requests in this repository, prioritize maintainability, modularity, correctness, and testability.

## Review goals
- Flag violations of single responsibility, high coupling, unclear boundaries, or mixed domain/infrastructure/UI concerns.
- Flag brittle code, hidden side effects, duplicated logic, tight coupling, poor naming, overly large functions/modules, and unclear ownership of behavior.
- Prefer simple, explicit designs over clever or overly abstract ones.
- Prefer changes that reduce complexity and improve modularity without unnecessary indirection.
- Identify code that is difficult to test because of hidden dependencies, global state, side effects, or missing seams.

## Architecture guidance
- Encourage clear separation of domain logic, application orchestration, infrastructure, and UI concerns.
- Prefer dependency inversion at architectural boundaries.
- Flag business logic embedded in transport, persistence, or UI layers.
- Flag abstractions that add indirection without reducing complexity.

## Testing guidance
- Verify that new or changed behavior is covered by appropriate tests.
- Do not suggest changing tests merely to satisfy implementation changes unless behavior intentionally changed and the PR explains why.
- Flag missing regression tests for bug fixes.
- Flag code that is difficult to test and explain what design change would improve testability.

## Review focus
Prioritize the highest-impact issues:
1. correctness and safety
2. architecture and maintainability
3. testability and regression risk
4. readability and duplication
5. performance only when there is a clear issue

## Review output
For each issue:
- state the problem clearly
- explain why it matters
- point to the affected code
- suggest a concrete improvement

Only comment on substantive issues. Avoid trivial style comments unless they affect readability or correctness.

