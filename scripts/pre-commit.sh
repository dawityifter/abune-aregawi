#!/bin/bash

# Pre-commit hook to run backend and frontend tests
# To install: ln -s ../../scripts/pre-commit.sh .git/hooks/pre-commit

# Resolved from the repo root rather than $BASH_SOURCE: this script is invoked
# through .git/hooks/pre-commit, a symlink, so dirname would point into
# .git/hooks and not at scripts/.
REPO_ROOT="$(git rev-parse --show-toplevel)"

# Sensitive-data check runs first: it is fast, and a commit carrying member PII
# should be stopped whether or not the test suites pass.
if ! "$REPO_ROOT/scripts/check-staged-sensitive.sh"; then
  exit 1
fi

echo "🚀 Running pre-commit tests..."

# Run backend tests
echo "📦 Testing Backend..."
if ! npm run test:backend; then
  echo "❌ Backend tests failed. Commit aborted."
  exit 1
fi

# Run frontend tests
echo "🎨 Testing Frontend..."
if ! npm run test:frontend; then
  echo "❌ Frontend tests failed. Commit aborted."
  exit 1
fi

echo "✅ All tests passed. Committing..."
exit 0
