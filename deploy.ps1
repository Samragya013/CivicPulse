# Civic Incident Commander - Render Deployment Script for Windows

Write-Host "🚀 Civic Incident Commander - Render Deployment Helper" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# Check if git is initialized
if (-not (Test-Path .git)) {
    Write-Host "📦 Initializing Git repository..." -ForegroundColor Yellow
    git init
    git branch -M main
} else {
    Write-Host "✅ Git repository already initialized" -ForegroundColor Green
}

# Check if remote is set
$remotes = git remote
if ($remotes -notcontains "origin") {
    Write-Host ""
    Write-Host "❌ Git remote 'origin' not set" -ForegroundColor Red
    Write-Host "Please run:" -ForegroundColor Yellow
    Write-Host "  git remote add origin https://github.com/YOUR_USERNAME/civic-incident-commander.git" -ForegroundColor White
    Write-Host ""
    exit 1
}

Write-Host ""
Write-Host "📋 Pre-deployment Checklist:" -ForegroundColor Cyan
Write-Host "  ✅ Git initialized" -ForegroundColor Green
Write-Host "  ✅ Remote repository configured" -ForegroundColor Green
Write-Host ""

# Add all files
Write-Host "📦 Adding files to git..." -ForegroundColor Yellow
git add .

# Commit
$commit_msg = Read-Host "Enter commit message (default: 'Deploy to Render')"
if ([string]::IsNullOrWhiteSpace($commit_msg)) {
    $commit_msg = "Deploy to Render"
}
Write-Host "💾 Creating commit..." -ForegroundColor Yellow
git commit -m $commit_msg

# Push
Write-Host "🚀 Pushing to GitHub..." -ForegroundColor Yellow
git push -u origin main

Write-Host ""
Write-Host "✅ Code pushed to GitHub successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Next Steps:" -ForegroundColor Cyan
Write-Host "1. Go to https://dashboard.render.com/"
Write-Host "2. Click 'New +' → 'Blueprint'"
Write-Host "3. Connect your GitHub repository"
Write-Host "4. Render will auto-configure using render.yaml"
Write-Host "5. Set JWT_SECRET environment variable (see DEPLOYMENT.md)"
Write-Host ""
Write-Host "🔑 Generate JWT_SECRET:" -ForegroundColor Cyan
Write-Host "  node -e `"console.log(require('crypto').randomBytes(64).toString('hex'))`"" -ForegroundColor White
Write-Host ""
Write-Host "📚 Full guide: See DEPLOYMENT.md" -ForegroundColor Cyan
Write-Host ""
