# Contributing to VelocityLLM

Thank you for your interest in contributing! 🎉

## Development Setup

1. **Fork the repository**
2. **Clone your fork**
```bash
   https://github.com/VighneshDev1411/velocityllm.git
   cd velocityllm
```

3. **Install dependencies**
```bash
   make deps
   make install-tools
```

4. **Create a branch**
```bash
   git checkout -b feature/your-feature-name
```

## Code Style

- Follow standard Go conventions
- Run `make fmt` before committing
- Run `make lint` to check for issues
- Write tests for new features

## Commit Messages

Use clear, descriptive commit messages:
```
feat: add semantic caching support
fix: resolve race condition in worker pool
docs: update API documentation
test: add integration tests for router
```

## Pull Request Process

1. Update documentation if needed
2. Add tests for new features
3. Ensure all tests pass: `make test`
4. Update CHANGELOG.md
5. Submit PR with clear description

## Questions?

Open an issue or reach out to the maintainers.

## Code of Conduct

Be respectful and professional in all interactions.