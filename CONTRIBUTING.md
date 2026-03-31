# Contributing to Qonnectra

## How We Work

Qonnectra uses a **fork-based contribution model**. All changes go through pull requests from forks — direct pushes to `main` are restricted to maintainers.

## Getting Started

### 1. Fork the Repository

Click the "Fork" button at the top right of [the Qonnectra repo](https://github.com/Geodock-GmbH/Qonnectra) to create your own copy.

### 2. Clone Your Fork

```bash
git clone https://github.com/YOUR-USERNAME/Qonnectra.git
cd Qonnectra
```

### 3. Add Upstream Remote

```bash
git remote add upstream https://github.com/Geodock-GmbH/Qonnectra.git
```

### 4. Keep Your Fork Updated

Before starting new work:

```bash
git fetch upstream
git checkout main
git merge upstream/main
```

## Making Changes

### 1. Create a Feature Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/issue-description
```

### 2. Make Your Changes

- Write clear, focused commits
- Follow existing code style
- Add/update tests if applicable
- Update documentation as needed

### 3. Push to Your Fork

```bash
git push origin feature/your-feature-name
```

### 4. Open a Pull Request

- Go to [Qonnectra PRs](https://github.com/Geodock-GmbH/Qonnectra/pulls)
- Click "New Pull Request"
- Select "compare across forks"
- Choose your fork and branch
- Fill out the PR template

## Issue Guidelines

### Before Creating an Issue

1. Search existing issues to avoid duplicates
2. Check if there's a relevant Discussion thread

### Issue Types

- **Bug Report**: Something isn't working as expected
- **Feature Request**: Suggest a new feature or enhancement
- **Question**: Use [Discussions](https://github.com/Geodock-GmbH/Qonnectra/discussions) instead

## Discussions

For questions, ideas, and general conversation, use [GitHub Discussions](https://github.com/Geodock-GmbH/Qonnectra/discussions):

- **Q&A**: Technical questions about using Qonnectra
- **Ideas**: Feature ideas and brainstorming
- **Show and Tell**: Share your Qonnectra deployments
- **General**: Everything else

## Pull Request Guidelines

- PRs must target the `main` branch
- All PRs require review before merging
- Keep PRs focused — one feature/fix per PR
- Link related issues using `Fixes #123` or `Relates to #123`

## Code of Conduct

Be respectful and constructive. We're building something useful together.

## Questions?

Open a Discussion or reach out to the maintainers.

## Language

Please write issues, PRs, and discussions in **English** or **German**.