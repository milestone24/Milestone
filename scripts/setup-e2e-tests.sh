#!/bin/bash

# Setup script for E2E tests with Playwright

echo "🎭 Setting up Playwright for E2E testing..."

# Install Playwright
echo "📦 Installing Playwright..."
npm install -D @playwright/test

# Install browsers
echo "🌐 Installing browser binaries..."
npx playwright install chromium

echo "✅ Setup complete!"
echo ""
echo "📚 Next steps:"
echo "1. Make sure your app is running: npm run dev"
echo "2. Run tests: npx playwright test"
echo "3. Run tests with UI: npx playwright test --ui"
echo "4. See docs/E2E-Testing.md for more info"


