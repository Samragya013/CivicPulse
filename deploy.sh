#!/bin/bash

# Civic Incident Commander - Render Deployment Script

echo "🚀 Civic Incident Commander - Render Deployment Helper"
echo "=================================================="
echo ""

# Check if git is initialized
if [ ! -d .git ]; then
    echo "📦 Initializing Git repository..."
    git init
    git branch -M main
else
    echo "✅ Git repository already initialized"
fi

# Check if remote is set
if ! git remote | grep -q origin; then
    echo ""
    echo "❌ Git remote 'origin' not set"
    echo "Please run:"
    echo "  git remote add origin https://github.com/YOUR_USERNAME/civic-incident-commander.git"
    echo ""
    exit 1
fi

echo ""
echo "📋 Pre-deployment Checklist:"
echo "  ✅ Git initialized"
echo "  ✅ Remote repository configured"
echo ""

# Add all files
echo "📦 Adding files to git..."
git add .

# Commit
echo "💾 Creating commit..."
read -p "Enter commit message (default: 'Deploy to Render'): " commit_msg
commit_msg=${commit_msg:-"Deploy to Render"}
git commit -m "$commit_msg"

# Push
echo "🚀 Pushing to GitHub..."
git push -u origin main

echo ""
echo "✅ Code pushed to GitHub successfully!"
echo ""
echo "📝 Next Steps:"
echo "1. Go to https://dashboard.render.com/"
echo "2. Click 'New +' → 'Blueprint'"
echo "3. Connect your GitHub repository"
echo "4. Render will auto-configure using render.yaml"
echo "5. Set JWT_SECRET environment variable (see DEPLOYMENT.md)"
echo ""
echo "🔑 Generate JWT_SECRET:"
echo "  node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\""
echo ""
echo "📚 Full guide: See DEPLOYMENT.md"
echo ""
