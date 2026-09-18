# 🧩 Vision Jigsaw Puzzles

> **An AI-powered, interactive computer vision jigsaw puzzle played with touchless real-time hand gestures right in your browser.**

[![Vercel Deployment](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vision-jigsaw-puzzles.vercel.app)
[![MediaPipe](https://img.shields.io/badge/MediaPipe-Hands_AI-0288D1?style=for-the-badge&logo=google)](https://developers.google.com/mediapipe)
[![JavaScript](https://img.shields.io/badge/ES6+-JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![HTML5 Canvas](https://img.shields.io/badge/HTML5-Canvas_2D-E34F26?style=for-the-badge&logo=html5)](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

---

## 🚀 Live Demo & Links

- **⚡ Fast Live Demo (Vercel Edge)**: [https://vision-jigsaw-puzzles.vercel.app](https://vision-jigsaw-puzzles.vercel.app) *(or your deployed Vercel domain)*
- **📦 GitHub Repository**: [https://github.com/nikithajammugani2004-png/Vision_jigsaw_puzzles](https://github.com/nikithajammugani2004-png/Vision_jigsaw_puzzles)

> ### ⚡ Why Vercel instead of Render?
> - **Zero Cold Starts (0ms)**: Render's free tier spins down after 15 minutes of inactivity, causing **50–90 second delays** on initial click.
> - **Instant Edge CDN Delivery**: Because Vision Jigsaw is a pure client-side application (WebAssembly + WebGL + Canvas), Vercel serves the entire game from edge servers closest to you in milliseconds on **one single click**.
> - **Automatic HTTPS**: Provides the mandatory secure context required by browsers for camera (`navigator.mediaDevices.getUserMedia`) permissions.

---

## 🌟 Key Features

- 🖐️ **Touchless Vision Control**: Control puzzle pieces with your bare hands! Pinch to pick up, drag across the board, and release to drop.
- ⚡ **Ultra-Smooth 30+ FPS Tracking**: Powered by MediaPipe Hands (Lite model complexity 0) combined with `requestVideoFrameCallback` throttling and low-pass smoothing filters to eliminate hand jitter.
- 🧩 **Procedural Jigsaw Mechanics**: Generates authentic interlocking jigsaw shapes with cubic Bézier tabs and sockets, realistic drop shadows, and bleed margin texture mapping.
- 🧲 **Magnetic Snap Physics**: Pieces automatically snap into their exact coordinate positions when brought near the correct grid cell.
- 🏆 **3 Progressive Difficulty Levels**:
  - **Level 1**: `4x4` Grid (16 Pieces) — 120-second timer
  - **Level 2**: `5x5` Grid (25 Pieces) — 180-second timer
  - **Level 3**: `6x6` Grid (36 Pieces) — 240-second timer
- ⏱️ **Real-Time Heads-Up Display (HUD)**:
  - Live FPS counter
  - Countdown timer with warning states
  - Remaining piece counter
  - Goal preview reference thumbnail
  - Skeletal tracking toggle (isolate skeleton vs. game view)
- 🥇 **Persistent Leaderboard**: Tracks and saves your fastest completion times for each difficulty level in `localStorage`.
- 🔊 **Haptic Audio Feedback**: High-quality audio cues on piece snaps and level completion.
- 🖱️ **Hybrid Fallback**: Can also be played using traditional mouse drag-and-drop if a webcam is not available.

---

## 🎮 How to Play

Position yourself approximately **1.5 to 3 feet (0.5m – 1m)** in front of your webcam in good lighting.

| Gesture | Finger Action | Behavior | Feedback Indicator |
| :--- | :--- | :--- | :--- |
| **Hover / Aim** | Keep index finger and thumb apart | Moves the target cursor across the screen | Cyan outline circle (`#38bdf8`) |
| **Grab Piece** | **Pinch** thumb tip & index tip together | Grabs the puzzle piece under the cursor | Green filled circle (`#22c55e`) |
| **Drag Piece** | Keep fingers pinched & move hand | Moves the grabbed piece across the board | Piece floats with drop shadow |
| **Release / Drop** | **Open** index finger & thumb apart | Releases piece; snaps if over correct slot | Snap sound + piece lock |

---

## 📐 System Architecture

Vision Jigsaw processes every video frame entirely client-side using browser-native APIs:

```
+------------------+
|   User Webcam    |  (WebRTC getUserMedia)
+--------+---------+
         |
         v
+------------------+
| MediaPipe Hands  |  (WebAssembly / WebGL - Model Complexity 0)
+--------+---------+
         |
         v
+------------------+
| Landmark Filter  |  (Alpha=0.55 Low-Pass Filter on Landmarks #4 & #8)
+--------+---------+
         |
         v
+------------------+
| Hysteresis Logic |  (Pinch Start: <= 0.085 | Release: > 0.13)
+--------+---------+
         |
         v
+------------------+
|  Puzzle Engine   |  (Interlocking Tabs, Bounding Box Hit Tests, Snapping)
+--------+---------+
         |
         v
+------------------+
| HTML5 Canvas 2D  |  (60 Hz Double-Buffered Render Loop)
+------------------+
```

---

## 📁 Repository Structure

```
Vision_jigsaw_puzzles/
├── assets/
│   ├── icons/
│   │   ├── refresh.svg          # UI reset & reload icons
│   │   └── sound.svg            # Audio status icon
│   └── sounds/
│       ├── snap.mp3             # Piece magnetic snap audio effect
│       └── win.mp3              # Level completion victory sound
├── css/
│   └── style.css                # Dark neon glassmorphism UI styling
├── js/
│   ├── app.js                   # Application coordinator, game loop, HUD & state
│   ├── handTracker.js           # MediaPipe camera loop, smoothing & pinch detection
│   ├── imagePool.js             # High-res puzzle image fetcher & procedural fallback
│   ├── puzzleEngine.js          # Bézier puzzle pieces, clipping & snap physics
│   └── utils.js                 # Low-pass filter, Euclidean distance, time formatters
├── index.html                   # Core HTML5 entry point & preconnect headers
├── vercel.json                  # Edge caching, security & camera permission headers
└── README.md                    # Project documentation
```

---

## 🚀 Instant Deployment to Vercel (1 Click)

Deploying to Vercel takes **under 60 seconds**:

### Option 1: Via Vercel Web Dashboard (Recommended)

1. Go to [vercel.com](https://vercel.com) and log in with your GitHub account.
2. Click **"Add New..."** ➔ **"Project"**.
3. Under *Import Git Repository*, locate and select **`Vision_jigsaw_puzzles`**.
4. Configure the project:
   - **Framework Preset**: `Other`
   - **Root Directory**: `./`
   - **Build Command**: *(leave blank)*
   - **Output Directory**: *(leave blank)*
5. Click **"Deploy"**.
6. That's it! Your game is live worldwide on a `.vercel.app` domain with **instant 1-click loading**.

### Option 2: Via Vercel CLI

```bash
# 1. Install Vercel CLI globally
npm install -g vercel

# 2. Navigate to the project root
cd d:/NIKITHA/PY_games/vision-jigsaw

# 3. Deploy to production
vercel --prod
```

---

## 💻 Local Development Setup

No build step or node package manager is required! You can serve the game locally using any local web server:

### Using Python:
```bash
# Python 3
python -m http.server 8000
```
Open [http://localhost:8000](http://localhost:8000) in Google Chrome or Microsoft Edge.

### Using Node.js (npx):
```bash
npx serve .
```

### Using VS Code:
Install the **Live Server** extension, right-click `index.html`, and select **"Open with Live Server"**.

---

## 🛡️ Browser Compatibility & Permissions

| Browser | Supported | Notes |
| :--- | :---: | :--- |
| **Google Chrome** | ✅ Yes | Recommended for optimal WebAssembly & WebGL performance |
| **Microsoft Edge** | ✅ Yes | Full support |
| **Mozilla Firefox** | ✅ Yes | Full support |
| **Apple Safari** | ✅ Yes | Requires camera permission approval |

> **Note**: A camera permission prompt will appear when launching the game. Make sure to click **"Allow"** to enable real-time hand gesture tracking.

---

## 📜 License

This project is licensed under the [MIT License](LICENSE) — feel free to modify, distribute, and build upon it!

---

*Built with ❤️ by [Nikitha Jammugani](https://github.com/nikithajammugani2004-png)*
