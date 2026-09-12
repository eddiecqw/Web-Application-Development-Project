import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Match3Page({ user }) {
    const navigate = useNavigate();
    const boardRef = useRef(null);
    const [score, setScore] = useState(0);

    // ✨ 新增：初始化氣泡音效
    const popSoundRef = useRef(new Audio('/audio/bubble.mp3')); 
    useEffect(() => {
        popSoundRef.current.volume = 0.6; // 設定一個舒適的音量
    }, []);

    // ✨ 新增：BGM 狀態與控制邏輯
    const [isBgmPlaying, setIsBgmPlaying] = useState(false);
    const bgmRef = useRef(new Audio('/audio/match3_bgm.mp3'));

    useEffect(() => {
        const audio = bgmRef.current;
        audio.loop = true;
        audio.volume = 0.4; // 音量設為 0.3，避免蓋過清脆的氣泡消除音效
        return () => {
            audio.pause();
            audio.currentTime = 0;
        };
    }, []);

    const toggleBgm = () => {
        const audio = bgmRef.current;
        if (isBgmPlaying) {
            audio.pause();
        } else {
            audio.play().catch(e => console.log('BGM 播放被瀏覽器阻擋:', e));
        }
        setIsBgmPlaying(!isBgmPlaying);
    };

    // 📡 WebSocket：通知伺服器我正在玩消消樂
    useEffect(() => {
        const username = user.email;
        const baseWsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:53840/ws';
        const wsUrl = `${baseWsUrl}?username=${encodeURIComponent(username)}`;
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            ws.send(JSON.stringify({ type: 'MATCH3_JOIN' }));
        };

        return () => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'MATCH3_LEAVE' }));
            }
            ws.close();
        };
    }, [user.email]);

    // 🎮 遊戲核心引擎 (完美繼承原型邏輯)
    useEffect(() => {
        const ROWS = 8;
        const COLS = 8;
        const FRUITS = ['🍉', '🍍', '🥥', '🫐', '🍋', '🍹'];
        let board = [];
        let internalScore = 0;
        let selectedCell = null;
        let isAnimating = false;

        const boardEl = boardRef.current;
        if (!boardEl) return;
        boardEl.innerHTML = ''; // 確保 React Strict Mode 不會重複渲染

        function initBoard() {
            for (let r = 0; r < ROWS; r++) {
                board[r] = [];
                for (let c = 0; c < COLS; c++) {
                    let randomFruit;
                    do {
                        randomFruit = FRUITS[Math.floor(Math.random() * FRUITS.length)];
                    } while (
                        (r >= 2 && board[r-1][c] === randomFruit && board[r-2][c] === randomFruit) ||
                        (c >= 2 && board[r][c-1] === randomFruit && board[r][c-2] === randomFruit)
                    );
                    board[r][c] = randomFruit;
                }
            }
        }

        // ✨ 新增：用於記錄滑動的變數
        let startX = 0;
        let startY = 0;
        let isSwiping = false;

        function renderBoard() {
            boardEl.innerHTML = '';
            for (let r = 0; r < ROWS; r++) {
                for (let c = 0; c < COLS; c++) {
                    const cell = document.createElement('div');
                    cell.className = 'cell';
                    if (selectedCell && selectedCell.r === r && selectedCell.c === c) {
                        cell.classList.add('selected');
                    }
                    cell.innerText = board[r][c] || '';
                    
                    // 1. 傳統點擊事件 (防呆：如果是滑動結束產生的殘留點擊，則忽略)
                    cell.onclick = () => {
                        if (isSwiping) return; 
                        handleCellClick(r, c);
                    };

                    // 2. 手機滑動開始
                    cell.ontouchstart = (e) => {
                        if (isAnimating) return;
                        startX = e.touches[0].clientX;
                        startY = e.touches[0].clientY;
                        isSwiping = false;
                    };

                    // 3. 手機滑動結束 (計算方向並觸發交換)
                    cell.ontouchend = (e) => {
                        if (isAnimating) return;
                        const endX = e.changedTouches[0].clientX;
                        const endY = e.changedTouches[0].clientY;
                        
                        const diffX = endX - startX;
                        const diffY = endY - startY;

                        // 若滑動距離超過 30px，判定為有效滑動 (Swipe)
                        if (Math.abs(diffX) > 30 || Math.abs(diffY) > 30) {
                            isSwiping = true; // 鎖定狀態，防止觸發接下來的 onClick
                            
                            // 強制選中滑動起點的水果
                            selectedCell = { r, c }; 
                            
                            let targetR = r;
                            let targetC = c;

                            // 判斷是橫向還是縱向滑動
                            if (Math.abs(diffX) > Math.abs(diffY)) {
                                targetC = diffX > 0 ? c + 1 : c - 1; // 右或左
                            } else {
                                targetR = diffY > 0 ? r + 1 : r - 1; // 下或上
                            }

                            // 如果滑動目標在棋盤範圍內，直接觸發交換邏輯
                            if (targetR >= 0 && targetR < ROWS && targetC >= 0 && targetC < COLS) {
                                handleCellClick(targetR, targetC);
                            } else {
                                selectedCell = null;
                                renderBoard();
                            }
                            
                            // 300 毫秒後解除點擊鎖定
                            setTimeout(() => isSwiping = false, 300);
                        }
                    };

                    boardEl.appendChild(cell);
                }
            }
            setScore(internalScore); 
        }

        async function handleCellClick(r, c) {
            if (isAnimating) return;

            if (!selectedCell) {
                selectedCell = { r, c };
                renderBoard();
                return;
            }

            if (selectedCell.r === r && selectedCell.c === c) {
                selectedCell = null;
                renderBoard();
                return;
            }

            const r1 = selectedCell.r, c1 = selectedCell.c;
            const isAdjacent = (Math.abs(r1 - r) + Math.abs(c1 - c) === 1);

            if (isAdjacent) {
                isAnimating = true;
                selectedCell = null;

                // 交換
                [board[r1][c1], board[r][c]] = [board[r][c], board[r1][c1]];
                renderBoard();
                await sleep(250);

                let matches = findMatches();
                if (matches.length > 0) {
                    await processMatches();
                } else {
                    // 退回原位
                    [board[r1][c1], board[r][c]] = [board[r][c], board[r1][c1]];
                    renderBoard();
                }
                isAnimating = false;
            } else {
                selectedCell = { r, c };
                renderBoard();
            }
        }

        function findMatches() {
            let matchedSet = new Set();
            for (let r = 0; r < ROWS; r++) {
                for (let c = 0; c < COLS - 2; c++) {
                    let f1 = board[r][c], f2 = board[r][c+1], f3 = board[r][c+2];
                    if (f1 && f1 === f2 && f1 === f3) {
                        matchedSet.add(`${r},${c}`); matchedSet.add(`${r},${c+1}`); matchedSet.add(`${r},${c+2}`);
                    }
                }
            }
            for (let c = 0; c < COLS; c++) {
                for (let r = 0; r < ROWS - 2; r++) {
                    let f1 = board[r][c], f2 = board[r+1][c], f3 = board[r+2][c];
                    if (f1 && f1 === f2 && f1 === f3) {
                        matchedSet.add(`${r},${c}`); matchedSet.add(`${r+1},${c}`); matchedSet.add(`${r+2},${c}`);
                    }
                }
            }
            return Array.from(matchedSet).map(str => {
                let [row, col] = str.split(',').map(Number);
                return { r: row, c: col };
            });
        }

        async function processMatches() {
            let matches = findMatches();
            while (matches.length > 0) {
                internalScore += matches.length * 10;
                setScore(internalScore);
                
                popSoundRef.current.currentTime = 0;
                popSoundRef.current.play().catch(e => console.log('PopSound is blocked:', e));

                const cells = boardEl.children;
                matches.forEach(m => {
                    const index = m.r * COLS + m.c;
                    if(cells[index]) cells[index].classList.add('matched');
                });
                await sleep(300);

                matches.forEach(m => board[m.r][m.c] = null);
                renderBoard();

                for (let c = 0; c < COLS; c++) {
                    let emptySlots = 0;
                    for (let r = ROWS - 1; r >= 0; r--) {
                        if (board[r][c] === null) {
                            emptySlots++;
                        } else if (emptySlots > 0) {
                            board[r + emptySlots][c] = board[r][c];
                            board[r][c] = null;
                        }
                    }
                    for (let r = 0; r < emptySlots; r++) {
                        board[r][c] = FRUITS[Math.floor(Math.random() * FRUITS.length)];
                    }
                }
                
                await sleep(350);
                renderBoard();
                
                matches = findMatches();
                if (matches.length > 0) await sleep(200);
            }
        }

        function sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        initBoard();
        renderBoard();
    }, []);

    return (
        <div style={{
            background: `url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?ixlib=rb-1.2.1&auto=format&fit=crop&w=1920&q=80') center/cover no-repeat fixed`,
            fontFamily: "'Nunito', 'Noto Color Emoji', sans-serif",
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            minHeight: '100vh', margin: 0, padding: '20px 10px', color: '#334155', position: 'relative'
        }}>
            {/* 動態注入的 CSS 樣式 */}
            <style>{`
                * { box-sizing: border-box; }
                
                /* ✨ 新增：返回按鈕的響應式樣式 */
                .back-btn {
                    position: absolute; top: 15px; left: 15px;
                    background: rgba(255,255,255,0.25); backdrop-filter: blur(10px);
                    border: 2px solid rgba(255,255,255,0.6); border-radius: 12px;
                    padding: 8px 15px; color: #fff; font-weight: bold; cursor: pointer;
                    font-size: 0.95rem; text-shadow: 0 2px 4px rgba(0,0,0,0.4);
                    box-shadow: 0 4px 10px rgba(0,0,0,0.1); transition: background 0.2s;
                    z-index: 100;
                }
                .back-btn:hover { background: rgba(255,255,255,0.4); }

                /* ✨ 新增：BGM 控制按鈕樣式 */
                .bgm-btn {
                    position: absolute; top: 15px; right: 15px;
                    background: rgba(255,255,255,0.25); backdrop-filter: blur(10px);
                    border: 2px solid rgba(255,255,255,0.6); border-radius: 12px;
                    padding: 8px 12px; color: #fff; font-weight: bold; cursor: pointer;
                    font-size: 1rem; text-shadow: 0 2px 4px rgba(0,0,0,0.4);
                    box-shadow: 0 4px 10px rgba(0,0,0,0.1); transition: background 0.2s;
                    z-index: 100;
                }
                .bgm-btn:hover { background: rgba(255,255,255,0.4); }

                /* ✨ 新增：標題外層容器，負責把標題往下推，避開按鈕 */
                .title-wrapper {
                    margin-top: 40px; 
                    display: flex; flex-direction: column; align-items: center;
                }

                .title-glass {
                    margin: 10px 0 10px 0; font-size: 2.2rem; color: #fff;
                    text-shadow: 0 4px 10px rgba(0,0,0,0.3);
                    background: rgba(255, 255, 255, 0.2);
                    padding: 10px 30px; border-radius: 30px;
                    backdrop-filter: blur(10px); border: 2px solid rgba(255,255,255,0.5);
                    animation: float 3s ease-in-out infinite; display: flex; flex-direction: column; align-items: center;
                }
                .endless-badge {
                    font-size: 0.9rem; background: #ea580c; color: white;
                    padding: 2px 10px; border-radius: 12px; margin-top: 5px;
                    text-shadow: none; box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                }
                @keyframes float { 0% { transform: translateY(0px); } 50% { transform: translateY(-8px); } 100% { transform: translateY(0px); } }
                
                .score-board {
                    font-size: 1.2rem; background: rgba(255, 255, 255, 0.85);
                    padding: 8px 30px; border-radius: 20px; margin-bottom: 25px;
                    box-shadow: 0 8px 32px rgba(31, 38, 135, 0.15);
                    backdrop-filter: blur(8px); border: 1px solid rgba(255, 255, 255, 0.8);
                    display: flex; align-items: center; gap: 10px; font-weight: 900;
                }
                #scoreValue { color: #ea580c; font-size: 1.8rem; text-shadow: 1px 1px 0px #fff; }
                
                #game-board {
                    display: grid; grid-template-columns: repeat(8, 48px); grid-template-rows: repeat(8, 48px);
                    gap: 6px; padding: 12px; background: rgba(255, 255, 255, 0.35);
                    backdrop-filter: blur(15px); border-radius: 20px; border: 2px solid rgba(255, 255, 255, 0.6);
                    box-shadow: 0 15px 35px rgba(0,0,0,0.2), inset 0 0 20px rgba(255,255,255,0.5);
                    /* ✨ 核心防呆：防止在遊戲盤上滑動時觸發手機網頁滾動 */
                    touch-action: none; 
                }
                .cell {
                    width: 48px; height: 48px;
                    background: linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.6) 100%);
                    border-radius: 12px; display: flex; justify-content: center; align-items: center;
                    font-size: 32px; cursor: pointer; user-select: none;
                    transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                    box-shadow: 0 4px 6px rgba(0,0,0,0.1), inset 0 -2px 5px rgba(0,0,0,0.05); border: 1px solid rgba(255,255,255,0.8);
                }
                .cell:active { transform: scale(0.9); }
                .cell.selected { background: #fff; transform: scale(1.15); box-shadow: 0 0 20px #fcd34d, inset 0 0 10px #f59e0b; border: 2px solid #f59e0b; z-index: 10; }
                .cell.matched { animation: popOut 0.3s forwards; }
                @keyframes popOut { 0% { transform: scale(1); opacity: 1; filter: brightness(1); } 50% { transform: scale(1.4); opacity: 0.8; filter: brightness(1.5); } 100% { transform: scale(0); opacity: 0; } }
                
                /* ✨ 手機端完美壓縮：按鈕、標題、間距全部等比例縮小 */
                @media (max-width: 480px) {
                    .back-btn { top: 10px; left: 10px; padding: 6px 12px; font-size: 0.8rem; border-radius: 8px; }
                    .bgm-btn { top: 10px; right: 10px; padding: 6px 10px; font-size: 0.8rem; border-radius: 8px; }
                    .title-wrapper { margin-top: 55px; } 
                    .title-glass { margin: 5px 0; font-size: 1.6rem; padding: 8px 20px; }
                    .endless-badge { font-size: 0.8rem; padding: 2px 8px; }
                    .score-board { font-size: 1rem; padding: 6px 20px; margin-bottom: 15px; }
                    #scoreValue { font-size: 1.5rem; }
                    
                    #game-board { grid-template-columns: repeat(8, 10.5vw); grid-template-rows: repeat(8, 10.5vw); gap: 1.5vw; padding: 3vw; border-radius: 16px; }
                    .cell { width: 100%; height: 100%; font-size: 7.5vw; border-radius: 8px; }
                }
            `}</style>

            {/* ✨ 新增：不帶浮動動畫的玻璃擬態返回按鈕 */}
            <button onClick={() => navigate('/')} className="back-btn">
                ← 返回大廳
            </button>
            
            {/* ✨ 新增：BGM 控制按鈕 */}
            <button onClick={toggleBgm} className="bgm-btn">
                {isBgmPlaying ? '🔊 音樂' : '🔇 靜音'}
            </button>
            
            {/* ✨ 用 title-wrapper 包裹，將標題往下推 */}
            <div className="title-wrapper">
                <div className="title-glass">
                    <div>🍉 夏日消消樂</div>
                    <div className="endless-badge">∞ 無盡模式</div>
                </div>
            </div>

            <div className="score-board">
                <span>SCORE</span>
                <span id="scoreValue">{score}</span>
            </div>

            <div id="game-board" ref={boardRef}></div>
        </div>
    );
}