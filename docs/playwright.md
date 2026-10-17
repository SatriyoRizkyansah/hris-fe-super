# Playwright Testing Guidelines for AI Agent

## Rules & Workflow

1. Every time you implement or modify a UI feature/component:
   - Check if an existing Playwright test file exists in `tests/` or `e2e/`.
   - If not, create a new E2E test file using Playwright.
2. Before declaring a task as "DONE", you MUST run the test suite using:
   `npx playwright test`
3. If the test FAILS:
   - Read the error log/stack trace provided by Playwright.
   - Fix your code or fix the test assertion.
   - Re-run `npx playwright test` until all tests PASS.

## Best Practices for Writing Tests

- **Selectors:** Always prefer user-facing attributes:
  - `page.getByRole()`
  - `page.getByLabel()`
  - `page.getByText()`
  - Avoid using dynamic CSS classes or long XPath selectors.
- **Headless Execution:** Run tests in headless mode by default.
- **Clean Execution:** Do not leave unhandled test artifacts or dummy data hanging.
