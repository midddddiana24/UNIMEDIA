# 🤖 UniMedia – AI Media Converter for Students

## ✅ Issues Fixed

The original code had **CORS blocking issues** preventing the Groq API from working. This has been fixed by:

1. ✅ **Created a Node.js backend server** - Proxy that safely handles API calls to Groq
2. ✅ **Fixed CORS issues** - Browser can now communicate with Groq via backend
3. ✅ **Added Settings panel** - Easy API key management with verification
4. ✅ **Improved security** - API key is no longer exposed in frontend code

---

## 🚀 Setup Instructions

### Prerequisites

- **Node.js** (v14 or higher) - [Download](https://nodejs.org)
- **Groq API Key** (free) - [Get at console.groq.com](https://console.groq.com)

### Step 1: Install Dependencies

```powershell
cd C:\Users\rober\Desktop\UNIMEDIA_WEBSITE
npm install
```

### Step 2: Start the Server

```powershell
npm start
```

You should see:

```
🤖 UniMedia server running at http://localhost:3000
✅ Features are now working with Groq AI!
```

### Step 3: Open in Browser

1. Open your browser and go to: **http://localhost:3000**
2. Click the **⚙️ Settings** button (top right)
3. Paste your Groq API key from [console.groq.com](https://console.groq.com)
4. Click **✅ Save API Key**

---

## 📋 Getting Your Groq API Key

1. Go to [console.groq.com](https://console.groq.com)
2. Sign in with Google (takes 30 seconds)
3. Click **API Keys** in the left sidebar
4. Click **Create New API Key**
5. Copy the key (starts with `gsk_`)
6. Paste it in UniMedia Settings ⚙️

---

## 🎯 Features Now Working

✅ **Speech to Text** - Transcribe audio files and live microphone input
✅ **PDF Summarizer** - Upload documents and get AI summaries
✅ **Image to Text** - Extract and process text from images
✅ **Video Summarizer** - Paste transcripts and get structured summaries
✅ **Translator** - Translate text to multiple languages
✅ **History** - All past conversions saved locally

---

## 🔧 How It Works

### Backend Architecture

```
Browser (Frontend)
    ↓
    │ POST /api/ai
    ↓
Node.js Server (Backend)
    ↓
    │ Bearer Token + Key
    ↓
Groq API (api.groq.com)
    ↓
Response with AI result
```

The backend acts as a **secure proxy** that:

- Receives requests from your browser
- Safely calls Groq with your API key
- Returns results back to the browser
- Prevents CORS blocking issues
- Keeps your API key secure

### Fallback System

If Groq isn't available:

1. First tries **Chrome AI** (if available)
2. Then tries **Groq** (with your API key via backend)
3. Falls back to **Local Smart Engine** (basic but works!)

---

## 📱 Using Different Devices

### Same Computer (Localhost)

```
http://localhost:3000
```

### Different Computer on Same Network

Replace `localhost` with your computer's IP:

```
http://YOUR_COMPUTER_IP:3000
```

To find your IP:

```powershell
ipconfig
```

Look for "IPv4 Address" (usually 192.168.x.x or 10.x.x.x)

---

## 🆘 Troubleshooting

### "Cannot GET /api/ai"

- Make sure the server is running: `npm start`
- Check if you're on http://localhost:3000

### "API key verification failed"

- Double-check the key format (must start with `gsk_`)
- Make sure the key is from [console.groq.com](https://console.groq.com)
- Try creating a new API key

### "CORS error in console"

- This should be fixed now! If you see it, restart: `npm start`

### "Server won't start"

- Check if port 3000 is already in use
- Try: `npm start -- --port 3001`

### Still not working?

1. Check the terminal for error messages
2. Make sure Node.js is installed: `node --version`
3. Reinstall packages: `rm node_modules -r && npm install`

---

## 🎓 For Teachers/Admins

### Deploy to Cloud

To share this with students, deploy to services like:

- **Heroku** (free tier available)
- **Replit** (instant deployment)
- **Vercel** (serverless deployment)
- **Railway** (modern deployment)

### Key Considerations

- Each student should use their own Groq API key
- Groq's free tier is very generous (unlimited for students!)
- No personal data is stored on the server
- All history is stored locally in browser

---

## 📝 Project Structure

```
UNIMEDIA_WEBSITE/
├── UniMedia_Web.html    ← Frontend (UI & logic)
├── server.js             ← Backend (API proxy)
├── package.json          ← Dependencies
└── README.md             ← This file
```

---

## 🔐 Security Notes

- **Frontend**: API key is stored only in browser localStorage
- **Backend**: API key is sent securely to Groq with HTTPS
- **No storage**: We never log or store your API keys
- **Local processing**: All history is kept only on your device

---

## 📞 Support

If you encounter issues:

1. Check this README
2. Look at browser console (F12 → Console tab)
3. Check terminal output when server runs
4. Make sure Node.js and npm are properly installed

---

## 🎉 You're All Set!

UniMedia is now fully functional with Groq AI!

**Next steps:**

- Start the server: `npm start`
- Open http://localhost:3000
- Add your Groq API key in Settings ⚙️
- Start converting! 🚀

Enjoy using UniMedia! 🤖
