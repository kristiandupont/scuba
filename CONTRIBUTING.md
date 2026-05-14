# Contributing to Scuba

Thank you for your interest in contributing to **Scuba**! 🎉

Scuba is a VIM-like modal editing extension for VS Code and Cursor. We welcome contributions of all kinds — bug reports, feature suggestions, documentation improvements, and code contributions.

## How to Report Bugs

Found a bug? Please help us fix it by opening an issue:

1. **Search existing issues** first to make sure the bug hasn't already been reported.
2. If it's a new issue, [open a new issue](https://github.com/kristiandupont/scuba/issues) with:
   - A clear, descriptive title
   - Steps to reproduce the bug
   - Expected vs. actual behavior
   - Your OS, VS Code version, and Scuba version
   - Any relevant screenshots or logs

## How to Suggest New Features

We'd love to hear your ideas! Before opening a feature request:

1. **Search existing issues** to see if the feature has already been suggested.
2. If not, [open a new issue](https://github.com/kristiandupont/scuba/issues) with:
   - A clear, descriptive title
   - A detailed description of the feature and why it would be useful
   - Any mockups, examples, or references to similar features in other editors

## How to Submit Pull Requests

We welcome pull requests! Here's how to get started:

1. **Fork** the repository and clone it locally.
2. **Create a feature branch** from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes** following the [code style guidelines](#code-style) below.
4. **Test your changes** thoroughly:
   - Run `npm run compile` to build the project.
   - Run `npm run lint` to ensure your code passes linting.
   - Run `npm run test` to execute the test suite.
5. **Commit your changes** with a clear, descriptive commit message.
6. **Push** your branch and [open a pull request](https://github.com/kristiandupont/scuba/pulls) against the `main` branch.

In your PR description, please include:
- A summary of the changes
- Any related issue numbers (e.g., "Fixes #123")
- Screenshots or GIFs for UI-related changes

## Code Style

This project uses **TypeScript** with the following conventions:

- **Semi-colons**: Always required (enforced by ESLint).
- **Curly braces**: Always required for control flow statements (`if`, `for`, `while`, etc.).
- **Strict equality**: Use `===` and `!==` instead of `==` and `!=`.
- **No throw literals**: Always throw `Error` objects, not strings or other primitives.
- **Naming conventions**:
  - `camelCase` for variables, functions, and methods.
  - `PascalCase` for classes, interfaces, and types.
  - `PascalCase` for imported modules.

We use **ESLint** with `@typescript-eslint` for linting. Run `npm run lint` before submitting a PR to ensure your code passes.

## Getting Help

If you have any questions or need help getting started, feel free to:
- Open an issue with a "question" label
- Reach out on the project's discussion channels

We appreciate your contributions and look forward to working with you! 💙
