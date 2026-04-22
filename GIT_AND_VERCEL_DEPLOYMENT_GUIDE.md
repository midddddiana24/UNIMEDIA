# 🚀 Git & Vercel Deployment Guide for UniMedia

Complete step-by-step instructions for version control with Git and deploying your static site to Vercel.

---

## 📋 Prerequisites

- Git installed ([Download](https://git-scm.com/))
- GitHub account ([Sign up](https://github.com/))
- Vercel account ([Sign up](https://vercel.com/))
- Node.js installed
- A terminal/command prompt

---

## Part 1: Git Setup & Local Repository

### Step 1: Initialize Git (First Time Only)

Open terminal in your project folder and run:

```bash
git init
```

This creates a `.git` folder to track changes.

### Step 2: Configure Git User

```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

Replace with your actual GitHub username and email.

### Step 3: Create `.gitignore` File

The `.gitignore` file tells Git which files and folders **NOT** to upload to GitHub.

#### Why Use `.gitignore`?

Some files are **large, sensitive, or auto-generated** and shouldn't be on GitHub:

- **`node_modules/`** - Takes 500MB+, can be recreated with `npm install`
- **`.env`** - Contains passwords, API keys (NEVER push this!)
- **`dist/`, `build/`** - Auto-generated files from builds
- **`*.log`** - Debug/error logs
- **`.DS_Store`** - Mac system files (not needed)

#### How to Create `.gitignore`

Create a file named `.gitignore` in your project root folder:

1. Open a text editor (VS Code, Notepad, etc.)
2. Paste this content:

```
# Dependencies
node_modules/
package-lock.json

# Environment variables (SENSITIVE - never push these!)
.env
.env.local
.env.*.local

# Build outputs
dist/
build/
*.min.js
*.min.css

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# OS Files
.DS_Store
Thumbs.db

# IDE/Editor
.vscode/
.idea/
*.swp
*.swo

# Testing (no longer needed)
cypress/videos/
cypress/screenshots/
```

3. Save as `.gitignore` (no extension, just the name)
4. Save in your project root folder (same level as `package.json`)

#### How `.gitignore` Works

**Example:**

```
node_modules/     ← Git ignores entire node_modules folder
*.log             ← Git ignores ALL .log files
.env              ← Git ignores .env file (passwords safe!)
```

**When you run:**

```bash
git add .
```

Git will:

- ✅ Add: `server.js`, `package.json`, `README.md`, etc.
- ❌ Skip: `node_modules/`, `.env`, `*.log` files

**Result:** Only important code is uploaded, not dependencies or secrets!

#### Verify `.gitignore` Works

Check if files are being ignored:

```bash
git status
```

**You should NOT see:**

- `node_modules/`
- `.env`
- Any `.log` files

If you still see them, make sure `.gitignore` is in the right folder!

#### Already Pushed Wrong Files?

If you accidentally pushed `.env` or `node_modules/`, remove them:

```bash
# Remove from Git (but keep locally)
git rm --cached .env
git rm -r --cached node_modules/

# Commit the removal
git commit -m "Remove .env and node_modules from git"
git push origin main
```

### Step 4: Add Files to Git

```bash
git add .
```

This stages all files for commit.

### Step 5: Create Your First Commit

```bash
git commit -m "Initial commit: UniMedia project setup"
```

---

## Part 2: Create GitHub Repository

### Step 1: Create Repository on GitHub

1. Go to [github.com/new](https://github.com/new)
2. Repository name: `UNIMEDIA_WEBSITE` (or your preferred name)
3. Description: `A modern web app for speech-to-text, text-to-speech, and document summarization`
4. Choose: **Public** (recommended for Vercel)
5. Click **Create repository**

**Important:** Do NOT initialize with README/license (you already have files)

### Step 2: Add Remote Repository

Copy the HTTPS URL from GitHub (looks like: `https://github.com/yourusername/UNIMEDIA_WEBSITE.git`)

Run in terminal:

```bash
git remote add origin https://github.com/yourusername/UNIMEDIA_WEBSITE.git
```

Replace `yourusername` with your GitHub username.

### Step 3: Push to GitHub

```bash
git branch -M main
git push -u origin main
```

This uploads your code to GitHub's `main` branch.

---

## Part 3: Deploy Frontend to Vercel (Static Site)

Your site is a static HTML file that doesn't need a backend server.

### Step 1: Create Vercel Account & Link Project

1. Go to [vercel.com](https://vercel.com/)
2. Sign up/Login with GitHub
3. Click **Add New... > Project**
4. Click **Import Git Repository**
5. Select your GitHub account
6. Find `UNIMEDIA` repository
7. Click **Import**

### Step 2: Configure Vercel Deployment

When Vercel asks for settings:

**Project Name:** `unimedia` (or preferred name)

**Framework Preset:** Select `Other`

**Root Directory:** Leave blank (default)

**Build Command:** Leave blank (not needed for static files)

**Output Directory:** Leave blank

**Environment Variables:** None needed

### Step 3: Deploy

Click **Deploy** and wait for build to complete.

Your site will be live at: `https://unimedia.vercel.app` ✅

---

## 🎯 QUICK SETUP (Static Site Deployment)

Since this is a static example site, here's your simplified workflow:

### 1. Push Code to GitHub

```bash
git add .
git commit -m "Your message"
git push origin main
```

### 2. Deploy Frontend to Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repo: `midddddiana24/UNIMEDIA`
3. Click **Deploy** - done! 🎉

### 3. Future Updates

Every time you push to GitHub, Vercel auto-deploys!

---

## Part 4: What's Next?

Your site is now live! You can:

- 📱 Share your Vercel URL with others
- 🎨 Make changes locally and push to GitHub
- 🚀 Vercel automatically deploys on every push
- 🔧 Add custom domain in Vercel Settings → Domains

---

## Part 5: Git Workflow (Ongoing Development)

### Making Changes

```bash
# 1. Create a new branch for features
git checkout -b feature/new-feature

# 2. Make your changes
# 3. Stage changes
git add .

# 4. Commit
git commit -m "Add new feature: [description]"

# 5. Push to GitHub
git push origin feature/new-feature

# 6. Go to GitHub and create Pull Request
# 7. After review, merge to main
```

### After Merging to Main

```bash
# Switch to main branch
git checkout main

# Get latest code
git pull origin main

# Vercel auto-deploys when main branch changes!
```

---

## Part 6: Deployment Checklist

- [ ] Git repository created and pushed to GitHub
- [ ] `.gitignore` file configured
- [ ] Vercel project created and deployed
- [ ] Site is live at `https://unimedia.vercel.app`
- [ ] Changes auto-deploy when you push to GitHub

---

## Part 7: Common Commands Reference

### Git Commands

```bash
git status                    # Check current status
git log                       # View commit history
git diff                      # See what changed
git revert HEAD               # Undo last commit
git pull origin main          # Get latest from GitHub
git push origin main          # Upload to GitHub
```

### Vercel Commands

```bash
npm i -g vercel               # Install Vercel CLI
vercel login                  # Login to Vercel
vercel deploy                 # Deploy from terminal
vercel --prod                 # Deploy to production
```

---

## Part 8: Troubleshooting

### Issue: Vercel Build Fails

- Check build logs in Vercel dashboard
- Make sure `UniMedia_Web.html` exists in project root
- Ensure `.gitignore` doesn't block HTML files

### Issue: Site Shows 404 Error

- Check that your main HTML file is named `UniMedia_Web.html` or rename in Vercel settings
- Go to Vercel Settings → General → Root Directory

### Issue: Git Remote Not Set

```bash
git remote -v                 # View current remotes
git remote remove origin      # Remove old remote
git remote add origin https://github.com/yourusername/UNIMEDIA.git
```

### Issue: Changes Not Deploying

1. Make sure you pushed to `main` branch: `git push origin main`
2. Check Vercel **Deployments** tab to see if new deployment started
3. Wait for deployment to complete (usually 30-60 seconds)

---

## Part 9: After Deployment

Your site is now live! Here's what you can do next:

### Share Your Site

- 📱 Share the Vercel URL: `https://unimedia.vercel.app`
- 📤 Share the GitHub repo: `https://github.com/midddddiana24/UNIMEDIA`

### Keep Updating

```bash
# Simple daily workflow:
# 1. Make changes to your files
# 2. Stage and commit
git add .
git commit -m "Update: [description]"

# 3. Push to GitHub
git push origin main

# Vercel automatically redeploys!
```

### Add Custom Domain (Optional)

1. In Vercel dashboard, go to your project
2. Click **Settings** → **Domains**
3. Add your custom domain (e.g., `unimedia.com`)
4. Follow DNS configuration steps

---

## Quick Deploy Summary

| Component       | Platform | URL                                         |
| --------------- | -------- | ------------------------------------------- |
| **Live Site**   | Vercel   | `https://unimedia.vercel.app`               |
| **Source Code** | GitHub   | `https://github.com/midddddiana24/UNIMEDIA` |

---

## Bonus: `.gitignore` Quick Reference

### What Gets Uploaded ✅

```
UniMedia_Web.html
server.js
package.json
README.md
.gitignore
src/
public/
```

### What Gets BLOCKED ❌

```
node_modules/          (500MB+ dependencies)
.env                   (passwords, API keys)
.env.local             (local secrets)
dist/                  (build output)
build/                 (build output)
*.log                  (error logs)
.DS_Store              (Mac files)
cypress/videos/        (test videos)
cypress/screenshots/   (test screenshots)
```

### Real Example Scenario

**Your folder has:**

- ✅ `server.js` (code)
- ✅ `package.json` (dependencies list)
- ❌ `node_modules/` (actual dependencies - 500MB!)
- ❌ `.env` (passwords - NEVER PUSH!)
- ❌ `debug.log` (error log)

**When you push to GitHub:**

- GitHub gets: `server.js`, `package.json` (tiny!)
- GitHub ignores: `node_modules/`, `.env`, `debug.log` (safe!)

**When someone clones from GitHub:**

- They get: `server.js`, `package.json`
- They run: `npm install`
- This recreates `node_modules/` from `package.json`

**Result:** Everyone has the same code, but not the bloated dependencies! ✅

---

**Questions?** Check [Vercel Docs](https://vercel.com/docs) or [Git Docs](https://git-scm.com/doc)

**Your site is now live and auto-deploys on every push!** 🚀
