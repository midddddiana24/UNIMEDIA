# 🚀 Git & Vercel Deployment Guide for UniMedia

Complete step-by-step instructions for version control with Git, deploying frontend to Vercel, and backend to GitHub/Heroku.

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

## Part 3: Deploy Frontend to Vercel

### Step 1: Create Vercel Account & Link Project

1. Go to [vercel.com](https://vercel.com/)
2. Sign up/Login with GitHub
3. Click **Add New... > Project**
4. Click **Import Git Repository**
5. Select your GitHub account
6. Find `UNIMEDIA_WEBSITE` repository
7. Click **Import**

### Step 2: Configure Vercel Deployment

When Vercel asks for settings:

**Project Name:** `unimedia-website` (or preferred name)

**Framework Preset:** Select `Other` (since you have custom setup)

**Root Directory:** Leave blank (default)

**Build Command:**

```
npm run build
```

(If you don't have this, use: `npm install`)

**Output Directory:** Leave blank

**Environment Variables:** (Add if needed)

```
API_URL = https://your-backend-url.com
```

### Step 3: Deploy

Click **Deploy** and wait for build to complete.

Your frontend will be live at: `https://unimedia-website.vercel.app`

### Step 4: Custom Domain (Optional)

In Vercel dashboard:

1. Go to your project settings
2. Click **Domains**
3. Add your custom domain (e.g., `unimedia.com`)
4. Follow DNS configuration steps

---

## Part 4: Deploy Backend to GitHub & Host

### Option A: Deploy Backend to Heroku (Recommended)

#### Step 1: Create Heroku Account

- Go to [heroku.com](https://heroku.com/)
- Sign up and verify email

#### Step 2: Create Heroku App

```bash
# Install Heroku CLI (if not already installed)
# Then login:
heroku login

# Create new app
heroku create unimedia-backend
```

#### Step 3: Configure Procfile

Your `Procfile` should contain:

```
web: node server.js
```

#### Step 4: Set Environment Variables

```bash
heroku config:set NODE_ENV=production
heroku config:set PORT=5000
```

#### Step 5: Deploy to Heroku

```bash
git push heroku main
```

Your backend will be live at: `https://unimedia-backend.herokuapp.com`

#### Step 6: View Logs

```bash
heroku logs --tail
```

---

### Option B: Deploy Backend to Railway (Modern Alternative)

#### Step 1: Create Railway Account

- Go to [railway.app](https://railway.app/)
- Sign up with GitHub

#### Step 2: Create New Project

1. Click **Create New Project**
2. Select **Deploy from GitHub repo**
3. Choose `UNIMEDIA_WEBSITE`
4. Confirm deployment

#### Step 3: Configure Service

Railway auto-detects `server.js` and Node.js. Click on the service and:

1. Go to **Variables**
2. Add any environment variables needed
3. Deployment starts automatically

Your backend URL appears in the dashboard (e.g., `https://unimedia-backend-prod.railway.app`)

---

## Part 5: Connect Frontend to Backend

### Step 1: Update API URLs

In your JavaScript files, change hardcoded URLs:

**Before:**

```javascript
fetch("http://localhost:5000/api/...");
```

**After:**

```javascript
const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";
fetch(`${API_URL}/api/...`);
```

### Step 2: Add Environment Variable to Vercel

Environment variables are settings that your app needs to run (like API keys).

#### What is an Environment Variable?

An environment variable is a "secret setting" your app uses. Examples:

- **`GROQ_API_KEY`** - Your Groq AI API key (for speech-to-text, summarization)
- **`FRONTEND_URL`** - Your frontend website URL (for security)
- **`NODE_ENV`** - Set to "production" or "development"

**Why not just put them in code?**

- ❌ If you push API keys to GitHub, hackers can use them!
- ✅ Environment variables keep secrets safe and hidden

#### How to Add Environment Variables to Vercel

1. In Vercel dashboard, go to your project
2. Click **Settings** (top menu)
3. Click **Environment Variables** (left sidebar)
4. Click **Add New** button
5. Fill in:
   - **Name:** `GROQ_API_KEY`
   - **Value:** Paste your actual Groq API key
   - **Environments:** Select "Production", "Preview", "Development"
6. Click **Add** button
7. Repeat for other variables:
   - **`FRONTEND_URL`** = `https://your-frontend-url.vercel.app`
   - **`NODE_ENV`** = `production`

8. **Redeploy:** Click **Deployments** > Latest deploy > **Redeploy button**

#### Where to Get Groq API Key

1. Go to [console.groq.com](https://console.groq.com)
2. Sign up or login
3. Go to **API Keys**
4. Click **Create API Key**
5. Copy the key (looks like: `gsk_xxxxxxxxxxxxxxxx`)
6. Paste in Vercel environment variables

#### How to Create `.env` File Locally

For local development, create a `.env` file (this file is ignored by Git):

```bash
# Create file
echo "GROQ_API_KEY=gsk_your_key_here" > .env
```

Or manually create `.env`:

```
GROQ_API_KEY=gsk_your_actual_key_here
FRONTEND_URL=http://localhost:3000
NODE_ENV=development
```

**Important:** Never push `.env` to GitHub! It's in `.gitignore` - that's why!

#### Access Environment Variables in Code

In `server.js`:

```javascript
const groqKey = process.env.GROQ_API_KEY;
const frontendUrl = process.env.FRONTEND_URL;

console.log("Using API Key:", groqKey.substring(0, 10) + "..."); // Don't print full key!
```

#### Verify Variables Are Set

After deploying, check logs:

```bash
vercel logs --tail
```

If you see errors about missing variables, check:

1. Variable is added in Vercel Settings
2. Spelled exactly the same (case-sensitive!)
3. App was redeployed after adding

4. Redeploy: Click **Deployments** > Latest > **Redeploy**

---

## Part 6: Git Workflow (Ongoing Development)

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

## Part 7: Deployment Checklist

- [ ] Git repository created and pushed to GitHub
- [ ] `.gitignore` file configured
- [ ] Vercel project created and frontend deployed
- [ ] Backend deployed to Heroku/Railway
- [ ] Environment variables set in Vercel
- [ ] Frontend can communicate with backend
- [ ] Custom domain configured (optional)
- [ ] HTTPS enabled (automatic with Vercel)
- [ ] Tested in production

---

## Part 8: Common Commands Reference

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

### Heroku Commands

```bash
heroku logs --tail            # View live logs
heroku restart                # Restart app
heroku open                   # Open app in browser
heroku config                 # View environment variables
```

---

## Part 9: Troubleshooting

### Issue: Vercel Build Fails

- Check build logs in Vercel dashboard
- Ensure `package.json` has all dependencies
- Run `npm install` locally to test

### Issue: Backend Connection Fails

- Check backend is running: `curl https://your-backend-url/health`
- Verify `REACT_APP_API_URL` is set in Vercel
- Check CORS configuration in `server.js`

### Issue: Git Remote Not Set

```bash
git remote -v                 # View current remotes
git remote remove origin      # Remove old remote
git remote add origin https://github.com/yourusername/UNIMEDIA_WEBSITE.git
```

### Issue: Need to Change Deployed URL

1. Update code locally
2. Commit: `git commit -m "Update API URL"`
3. Push: `git push origin main`
4. Vercel auto-redeploys (no extra steps needed)

---

## Part 10: After Deployment

### Monitor Your App

- **Vercel Analytics:** Dashboard shows performance metrics
- **Heroku Logs:** `heroku logs --tail` shows errors
- **GitHub:** Track all changes in commit history

### Keep Code Updated

```bash
# Daily workflow:
git pull origin main          # Get latest
# Make changes
git add .
git commit -m "Update: ..."
git push origin main
# Vercel redeploys automatically!
```

---

## Quick Deploy Summary

| Component       | Platform       | URL                                                |
| --------------- | -------------- | -------------------------------------------------- |
| **Frontend**    | Vercel         | `https://unimedia-website.vercel.app`              |
| **Backend**     | Heroku/Railway | `https://unimedia-backend.herokuapp.com`           |
| **Source Code** | GitHub         | `https://github.com/yourusername/UNIMEDIA_WEBSITE` |

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

**Questions?** Check [Vercel Docs](https://vercel.com/docs) or [Heroku Docs](https://devcenter.heroku.com/)

**Need Help?** Comment in GitHub Issues or check deployment logs.

Good luck! 🚀
