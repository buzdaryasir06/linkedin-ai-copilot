# Contributing to LinkedIn AI Copilot

Thank you for your interest in contributing! This guide will help you get started.

## Getting Started

1. **Fork** this repository
2. **Clone** your fork locally
3. **Set up** the development environment (see below)
4. **Create a branch** for your feature or fix: `git checkout -b feature/your-feature-name`

## Development Setup

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
pip install ruff pytest pytest-asyncio httpx  # Dev dependencies

cp .env.example .env
# Edit .env with your Groq API key (free at console.groq.com)

uvicorn app.main:app --reload --port 8000
```

### Extension

1. Open Chrome → `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked** → select the `extension/` folder

## Code Quality

### Python (Backend)

- **Linter**: [Ruff](https://docs.astral.sh/ruff/) — run `ruff check app/`
- **Formatter**: `ruff format app/`
- **Tests**: `pytest tests/ -v`
- **Type hints**: Use type hints for all function signatures

### JavaScript (Extension)

- Use modern ES2022+ syntax
- Keep functions small and focused
- Use `const`/`let`, never `var`

## Making Changes

1. Write your code following the patterns in existing files
2. Add tests for any new backend functionality
3. Run the linter and fix any issues
4. Test your changes manually in Chrome
5. Commit with a clear message: `feat: add batch export feature`

## Commit Convention

Use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` — New feature
- `fix:` — Bug fix
- `docs:` — Documentation only
- `refactor:` — Code change that neither fixes a bug nor adds a feature
- `test:` — Adding or updating tests
- `chore:` — Maintenance tasks

## Pull Requests

1. Update documentation if your changes affect the API or user-facing behavior
2. Ensure CI passes (linting + tests)
3. Provide a clear PR description explaining what and why
4. Link any related issues

## Reporting Issues

- Use the GitHub issue tracker
- Include steps to reproduce, expected vs. actual behavior
- Include browser/OS version for extension issues

## Questions?

Open a discussion or issue — we're happy to help!
