# 🎮 Web Multi-Game Platform | 網頁即時多人遊戲平台

[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E)](https://vitejs.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![WebSocket](https://img.shields.io/badge/WebSocket-010101?style=for-the-badge&logo=socket.io&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
[![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)

[English](#english) | [繁體中文](#繁體中文)

---

<a name="english"></a>

## 🇬🇧 English

### 📖 About The Project

This is a full-stack, real-time multiplayer web application. It features a centralized lobby with a global chatroom, a live user location map, and fully synchronized multiplayer game rooms. The platform currently hosts two main games: **Draw & Guess** and **NiuNiu Poker (鬥牛)**, all powered by a robust native WebSocket architecture.

### ✨ Key Features

* **🔐 Authentication System:** Secure user registration and login using encrypted passwords (`bcrypt`).
* **💬 Global Hub & Live Map:** Real-time global chat with message history, and a dynamic map showing live locations of online users.
* **🎨 Draw & Guess (你畫我猜):**
  * Real-time canvas synchronization.
  * Automated turn-based painter rotation and vocabulary generation.
  * Live guess validation and automatic scoring.
* **🃏 NiuNiu Poker (撲克鬥牛):**
  * **Advanced Room Management:** Create/Join rooms with custom time limits. Built-in prevention of duplicate and ghost rooms.
  * **Smart Evaluation Engine:** Backend-driven card evaluation and weight calculation to prevent client-side manipulation.
  * **Chip & Betting System:** Real-time chip calculation with dynamic multipliers (e.g., 5x for 5-Flower Niu, 4x for NiuNiu).
  * **Interactive UI:** Live Emoji reaction system with floating chat bubbles, detailed rule popups, and smooth victory/loss animations.

### 🛠 Tech Stack

* **Frontend:** React.js, Vite, React Router, `react-use-websocket`
* **Backend:** Node.js, Express.js, `ws` (Native WebSockets)
* **Database:** MongoDB
* **Deployment:** Vercel (Frontend) / Render (Backend)

### 🚀 Getting Started

#### Prerequisites

* Node.js (v16 or higher)
* MongoDB Cluster (URI)

#### Installation

1. Clone the repository:
   ```bash
   git clone [https://github.com/eddiecqw/Web-Application-Development-Project.git](https://github.com/eddiecqw/Web-Application-Development-Project.git)
   ```

* Install dependencies for Backend:
  ```bash
  cd backend 
  npm install
  ```
* Install dependencies for Frontend:
  ```bash
  cd frontend 
  npm install
  ```
* Environment Variables Setup:
  * Create a `.env` file in the backend directory:
    ```
    MONGODB\_URI=your\_mongodb\_connection\_string
    PORT=53840
    ```
  * Create a `.env` file in the frontend directory:
    ```
    VITE\_WS\_URL=ws://localhost:53840/ws
    ```
* Run the application (Development Mode):
  * Backend: `node app.mjs`
  * Frontend: `npm run dev`

<a name="繁體中文"></a>

## 🇹🇼 繁體中文

### 📖專案簡介

這是一個全端開發的即時多人連線網頁應用程式。平台擁有一個結合了全球聊天室與即時用戶位置地圖的遊戲大廳，並提供完全同步的多人遊戲房間。目前平台搭載了兩款核心遊戲： ****你畫我猜 (Draw & Guess)**** and **撲克鬥牛 (NiuNiu Poker)**, all powered by a robust native WebSocket architecture.

### ✨ 核心功能

* **🔐 帳號安全系統:** 具備完整的註冊與登入功能，密碼採用 `bcrypt` 加密儲存。
* **💬 大廳交誼廳 & 即時地圖:** 支援全球廣播的即時聊天室（含歷史訊息載入），以及能顯示在線玩家座標的動態地圖。
* **🎨 你畫我猜 (Draw & Guess):**
  * 超低延遲的畫布軌跡即時同步。
  * 自動輪替畫家身份與隨機題庫生成。
  * 即時對話框猜詞判定與自動計分系統。
* **🃏 撲克鬥牛 (NiuNiu Poker):**
  * **完善的房間生命週期:** 支援自訂倒數時間的房間創建與加入，並內建防止幽靈房間與重複開房的清理機制。
  * **防作弊算牌引擎:** 由後端統一負責洗牌、牌型權重計算與花色比對，確保絕對公平。
  * **籌碼與倍率系統:** 實作經典鬥牛的算分邏輯（包含五花牛 5 倍、牛牛 4 倍等），並提供即時跳錢視覺回饋。
  * **高互動 UI:** 內建帶有自動消失動畫的「表情包氣泡」互動系統，以及完整的遊戲規則浮動視窗。

### 🛠 技術棧

* **前端 (Frontend):** React.js, Vite, React Router, `react-use-websocket`
* **後端 (Backend):** Node.js, Express.js, `ws` (原生 WebSockets)
* **資料庫 (Database):** MongoDB
* **部署環境:** Vercel (前端) / Render (後端)

### 🚀 本地端運行指南

#### 環境要求

* Node.js (v16 或以上版本)
* MongoDB 資料庫連線字串 (URI)

#### 安裝步驟

1. 複製專案到本地端:
   ```bash
   git clone [https://github.com/eddiecqw/Web-Application-Development-Project.git](https://github.com/eddiecqw/Web-Application-Development-Project.git)
   ```

* 安裝後端依賴套件:

```bash
cd backend 
npm install
```

* 安裝前端依賴套件:
  
  ```bash
  cd frontend 
  npm install
  ```
* 環境變數設定:
  
  * 在後端目錄建立 `.env` 檔案:
    ```
    MONGODB\_URI=你的\_mongodb\_連線字串
    PORT=53840
    ```
  * 在前端目錄建立 `.env` 檔案:
    ```
    VITE\_WS\_URL=ws://localhost:53840/ws
    ```
* 啟動伺服器 (開發模式):
  
  * 後端: `node app.mjs`
  * 前端: `npm run dev`
