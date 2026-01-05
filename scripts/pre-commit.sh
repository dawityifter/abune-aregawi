#!/bin/bash

# Pre-commit hook to run backend and frontend tests
# To install: ln -s ../../scripts/pre-commit.sh .git/hooks/pre-commit

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
