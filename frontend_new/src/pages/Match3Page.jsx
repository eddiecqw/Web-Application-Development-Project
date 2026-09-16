import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useMatch3Socket from '../hooks/useMatch3Socket';
import Match3Lobby from '../components/Game/Match3Lobby';

// 定義四個時段的精美海灘背景
const getBeachBackgroundByTime = () => {
    const hour = new Date().getHours();
    //const hour = 8;
    if (hour >= 5 && hour < 10) return `url('/image/match3/bg_morning.jpg')`;
    else if (hour >= 10 && hour < 16) return `url('/image/match3/bg_midday.jpg')`;
    else if (hour >= 16 && hour < 19) return `url('/image/match3/bg_sunset.jpg')`;
    else return `url('/image/match3/bg_night.jpg')`;
};

export default function Match3Page({ user }) {
    const navigate = useNavigate();
    const location = useLocation();
    const boardRef = useRef(null);
    const [score, setScore] = useState(0);

    // ✨ 1. 初始化 WebSocket Hook
    const baseWsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:53840/ws';
    const wsUrl = `${baseWsUrl}?username=${encodeURIComponent(user.email)}`;
    const { createRoom, joinRoom, leaveRoom, syncState, gameState: { roomId, roomData } } = useMatch3Socket(wsUrl);

    // ✨ 2. 一鍵加入邏輯
    const autoJoinInterval = useRef(null);
    useEffect(() => {
        if (location.state?.autoJoinRoomId && !roomId) {
            autoJoinInterval.current = setInterval(() => {
                joinRoom(location.state.autoJoinRoomId, user.email.split('@')[0]);
            }, 300);
            navigate(location.pathname, { replace: true });
        }
    }, [location.state, navigate, location.pathname, user.email, joinRoom, roomId]);

    useEffect(() => {
        if (roomId && autoJoinInterval.current) {
            clearInterval(autoJoinInterval.current);
            autoJoinInterval.current = null;
        }
    }, [roomId]);

    useEffect(() => {
        return () => { if (autoJoinInterval.current) clearInterval(autoJoinInterval.current); };
    }, []);

    // 氣泡音效
    const popSoundRef = useRef(new Audio('/audio/bubble.mp3')); 
    useEffect(() => { popSoundRef.current.volume = 0.7; }, []);

    // BGM
    const [isBgmPlaying, setIsBgmPlaying] = useState(false);
    const bgmRef = useRef(new Audio('/audio/match3_bgm.mp3'));
    useEffect(() => {
        const audio = bgmRef.current;
        audio.loop = true; audio.volume = 0.6;
        return () => { audio.pause(); audio.currentTime = 0; };
    }, []);

    const toggleBgm = () => {
        if (isBgmPlaying) bgmRef.current.pause();
        else bgmRef.current.play().catch(() => {});
        setIsBgmPlaying(!isBgmPlaying);
    };

    // 動態背景
    const [bgImage, setBgImage] = useState(getBeachBackgroundByTime());
    useEffect(() => {
        const imagesToPreload = ['/image/match3/bg_morning.jpg', '/image/match3/bg_midday.jpg', '/image/match3/bg_sunset.jpg', '/image/match3/bg_night.jpg'];
        imagesToPreload.forEach(src => { const img = new Image(); img.src = src; });
        
        const checkAndUpdateBackground = () => {
            // 使用函數式更新，確保永遠比對最新的背景值
            setBgImage(prev => {
                const currentBg = getBeachBackgroundByTime();
                return prev !== currentBg ? currentBg : prev;
            });
        };
        
        // 改為每 3 秒檢查一次，極度靈敏且完全不耗效能
        const interval = setInterval(checkAndUpdateBackground, 3000);
        window.addEventListener('focus', checkAndUpdateBackground);
        
        return () => {
            clearInterval(interval);
            window.removeEventListener('focus', checkAndUpdateBackground);
        };
    }, []);

    // 🎮 遊戲核心引擎 (改為依賴 roomId 啟動)
    useEffect(() => {
        // ✨ 如果還沒進入房間，就不啟動遊戲引擎
        if (!roomId) return;

        const ROWS = 8;
        const COLS = 8;
        const FRUITS = ['🍉', '🍍', '🥝', '🍇', '🍋', '🍹']; 
        
        let board = [];
        let internalScore = 0;
        let selectedCell = null;
        let isAnimating = false;
        let startX = 0, startY = 0, isSwiping = false;

        const boardEl = boardRef.current;
        if (!boardEl) return;
        boardEl.innerHTML = ''; 

        function getRandomFruit(isInitial = false) {
            if (!isInitial) {
                const rand = Math.random();
                if (rand < 0.02) return '🥥'; 
                if (rand < 0.04) return '🌊'; 
                if (rand < 0.05) return '🌈'; 
                if (rand < 0.12) return '🧊' + FRUITS[Math.floor(Math.random() * FRUITS.length)]; 
            }
            return FRUITS[Math.floor(Math.random() * FRUITS.length)];
        }

        // ✨ 3. 將存檔改為同步給後端 Socket
        function saveGame() {
            syncState(board, internalScore);
        }

        // ✨ 4. 初始化時，從後端資料讀取，而不是 localStorage
        function initBoard() {
            if (roomData && roomData.players) {
                const me = roomData.players.find(p => p.name === user.email);
                if (me && me.board && me.board.length > 0) {
                    board = me.board; 
                    internalScore = me.score;
                    return;
                }
            }
            
            for (let r = 0; r < ROWS; r++) {
                board[r] = [];
                for (let c = 0; c < COLS; c++) {
                    let randomFruit;
                    do { randomFruit = getRandomFruit(true); } while (
                        (r >= 2 && board[r-1][c] === randomFruit && board[r-2][c] === randomFruit) ||
                        (c >= 2 && board[r][c-1] === randomFruit && board[r][c-2] === randomFruit)
                    );
                    board[r][c] = randomFruit;
                }
            }
            saveGame();
        }

        function renderBoard() {
            boardEl.innerHTML = '';
            for (let r = 0; r < ROWS; r++) {
                for (let c = 0; c < COLS; c++) {
                    const cell = document.createElement('div');
                    cell.className = 'cell';
                    
                    let val = board[r][c] || '';
                    if (val.startsWith('🧊')) {
                        cell.innerText = val.replace('🧊', '');
                        cell.classList.add('frozen');
                    } else {
                        cell.innerText = val;
                        if (['🥥', '🌊', '🌈'].includes(val)) cell.classList.add('special-bomb');
                    }

                    if (selectedCell && selectedCell.r === r && selectedCell.c === c) cell.classList.add('selected');

                    cell.onclick = () => { if (!isSwiping) handleCellClick(r, c); };
                    cell.ontouchstart = (e) => { if(isAnimating) return; startX = e.touches[0].clientX; startY = e.touches[0].clientY; isSwiping = false; };
                    cell.ontouchend = (e) => {
                        if (isAnimating) return;
                        const diffX = e.changedTouches[0].clientX - startX;
                        const diffY = e.changedTouches[0].clientY - startY;
                        if (Math.abs(diffX) > 30 || Math.abs(diffY) > 30) {
                            isSwiping = true;
                            selectedCell = { r, c };
                            let targetR = r, targetC = c;
                            if (Math.abs(diffX) > Math.abs(diffY)) targetC = diffX > 0 ? c + 1 : c - 1;
                            else targetR = diffY > 0 ? r + 1 : r - 1;

                            if (targetR >= 0 && targetR < ROWS && targetC >= 0 && targetC < COLS) handleCellClick(targetR, targetC);
                            else { selectedCell = null; renderBoard(); }
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
            if (!selectedCell) { selectedCell = { r, c }; renderBoard(); return; }
            if (selectedCell.r === r && selectedCell.c === c) { selectedCell = null; renderBoard(); return; }

            if (board[selectedCell.r][selectedCell.c].startsWith('🧊') || board[r][c].startsWith('🧊')) {
                selectedCell = null; renderBoard(); return;
            }

            const r1 = selectedCell.r, c1 = selectedCell.c;
            const isAdjacent = (Math.abs(r1 - r) + Math.abs(c1 - c) === 1);

            if (isAdjacent) {
                isAnimating = true; selectedCell = null;
                [board[r1][c1], board[r][c]] = [board[r][c], board[r1][c1]];
                renderBoard(); await sleep(250);

                let matches = findMatches();
                if (matches.length > 0) { await processMatches(); } 
                else {
                    [board[r1][c1], board[r][c]] = [board[r][c], board[r1][c1]];
                    renderBoard(); saveGame();
                }
                isAnimating = false;
            } else {
                selectedCell = { r, c }; renderBoard();
            }
        }

        function findMatches() {
            let matchedSet = new Set();
            const canMatch = (v) => v && FRUITS.includes(v);

            for (let r = 0; r < ROWS; r++) {
                for (let c = 0; c < COLS - 2; c++) {
                    let f1 = board[r][c], f2 = board[r][c+1], f3 = board[r][c+2];
                    if (canMatch(f1) && f1 === f2 && f1 === f3) {
                        matchedSet.add(`${r},${c}`); matchedSet.add(`${r},${c+1}`); matchedSet.add(`${r},${c+2}`);
                    }
                }
            }
            for (let c = 0; c < COLS; c++) {
                for (let r = 0; r < ROWS - 2; r++) {
                    let f1 = board[r][c], f2 = board[r+1][c], f3 = board[r+2][c];
                    if (canMatch(f1) && f1 === f2 && f1 === f3) {
                        matchedSet.add(`${r},${c}`); matchedSet.add(`${r+1},${c}`); matchedSet.add(`${r+2},${c}`);
                    }
                }
            }
            return Array.from(matchedSet).map(str => {
                let [row, col] = str.split(',').map(Number); return { r: row, c: col };
            });
        }

        async function processMatches() {
            let matches = findMatches();
            
            while (matches.length > 0) {
                let toDestroy = new Set();
                let toMelt = new Set();
                let queue = [...matches];
                queue.forEach(m => toDestroy.add(`${m.r},${m.c}`));
                let processed = new Set();

                while(queue.length > 0) {
                    let curr = queue.shift();
                    let key = `${curr.r},${curr.c}`;
                    if (processed.has(key)) continue;
                    processed.add(key);

                    let r = curr.r, c = curr.c;
                    let triggerColor = FRUITS.includes(board[r][c]) ? board[r][c] : null;
                    const neighbors = [ {r: r-1, c}, {r: r+1, c}, {r, c: c-1}, {r, c: c+1} ];

                    neighbors.forEach(n => {
                        if (n.r >= 0 && n.r < ROWS && n.c >= 0 && n.c < COLS) {
                            let nVal = board[n.r][n.c];
                            if (!nVal) return;
                            let nKey = `${n.r},${n.c}`;

                            if (nVal.startsWith('🧊') && !toDestroy.has(nKey)) {
                                toMelt.add(nKey);
                            }
                            else if (nVal === '🥥' && !toDestroy.has(nKey)) {
                                toDestroy.add(nKey); queue.push(n);
                                for(let dr=-1; dr<=1; dr++) {
                                    for(let dc=-1; dc<=1; dc++) {
                                        let rr = n.r+dr, cc = n.c+dc;
                                        if (rr>=0 && rr<ROWS && cc>=0 && cc<COLS && !toDestroy.has(`${rr},${cc}`)) {
                                            toDestroy.add(`${rr},${cc}`); queue.push({r: rr, c: cc});
                                        }
                                    }
                                }
                            }
                            else if (nVal === '🌊' && !toDestroy.has(nKey)) {
                                toDestroy.add(nKey); queue.push(n);
                                for(let i=0; i<ROWS; i++) {
                                    if (!toDestroy.has(`${i},${n.c}`)) { toDestroy.add(`${i},${n.c}`); queue.push({r: i, c: n.c}); }
                                }
                                for(let i=0; i<COLS; i++) {
                                    if (!toDestroy.has(`${n.r},${i}`)) { toDestroy.add(`${n.r},${i}`); queue.push({r: n.r, c: i}); }
                                }
                            }
                            else if (nVal === '🌈' && !toDestroy.has(nKey)) {
                                toDestroy.add(nKey); queue.push(n);
                                let targetColor = triggerColor || FRUITS[Math.floor(Math.random() * FRUITS.length)];
                                for(let rr=0; rr<ROWS; rr++) {
                                    for(let cc=0; cc<COLS; cc++) {
                                        let v = board[rr][cc];
                                        if ((v === targetColor || v === `🧊${targetColor}`) && !toDestroy.has(`${rr},${cc}`)) {
                                            toDestroy.add(`${rr},${cc}`); queue.push({r: rr, c: cc});
                                        }
                                    }
                                }
                            }
                        }
                    });
                }

                internalScore += toDestroy.size * 10 + toMelt.size * 5;
                setScore(internalScore);
                try { popSoundRef.current.currentTime = 0; popSoundRef.current.play().catch(()=>{}); } catch(e){}
                
                const cells = boardEl.children;
                toDestroy.forEach(key => {
                    let [r, c] = key.split(',').map(Number);
                    if(cells[r * COLS + c]) cells[r * COLS + c].classList.add('matched');
                });
                toMelt.forEach(key => {
                    let [r, c] = key.split(',').map(Number);
                    if(cells[r * COLS + c]) cells[r * COLS + c].classList.add('melted');
                });

                await sleep(300);

                toDestroy.forEach(key => { let [r, c] = key.split(',').map(Number); board[r][c] = null; });
                toMelt.forEach(key => { let [r, c] = key.split(',').map(Number); board[r][c] = board[r][c].replace('🧊', ''); });

                renderBoard();

                for (let c = 0; c < COLS; c++) {
                    let emptySlots = 0;
                    for (let r = ROWS - 1; r >= 0; r--) {
                        if (board[r][c] === null) emptySlots++;
                        else if (emptySlots > 0) { board[r + emptySlots][c] = board[r][c]; board[r][c] = null; }
                    }
                    for (let r = 0; r < emptySlots; r++) {
                        board[r][c] = getRandomFruit(false);
                    }
                }
                
                await sleep(350);
                renderBoard();
                
                matches = findMatches();
                if (matches.length > 0) await sleep(200);
            }
            saveGame();
        }

        function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

        initBoard();
        renderBoard();
        
    }, [roomId]); // ✨ 確保只有在進入房間 (roomId 產生時) 才初始化遊戲

    // ✨ 5. 大廳攔截：如果還沒進房間，顯示大廳
    if (!roomId) {
        return (
            <div style={{ 
                minHeight: '100vh', 
                background: `${bgImage} center/cover no-repeat fixed`, 
                transition: 'background 1.5s ease-in-out', // ✨ 補上這行，大廳也會平滑漸變！
                display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '16px' 
            }}>
                <Match3Lobby onCreateRoom={createRoom} onJoinRoom={joinRoom} onBack={() => navigate('/')} username={user.email} />
            </div>
        );
    }

    return (
        <div style={{
            background: `${bgImage} center/cover no-repeat fixed`,
            transition: 'background 1.5s ease-in-out', 
            fontFamily: "'Nunito', 'Noto Color Emoji', sans-serif",
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            minHeight: '100vh', margin: 0, padding: '20px 10px', color: '#334155', position: 'relative'
        }}>
            <style>{`
                * { box-sizing: border-box; }
                .back-btn, .bgm-btn {
                    position: absolute; top: 15px; 
                    background: rgba(255,255,255,0.25); backdrop-filter: blur(10px);
                    border: 2px solid rgba(255,255,255,0.6); border-radius: 12px;
                    padding: 8px 15px; color: #fff; font-weight: bold; cursor: pointer;
                    font-size: 0.95rem; text-shadow: 0 2px 4px rgba(0,0,0,0.4);
                    box-shadow: 0 4px 10px rgba(0,0,0,0.1); transition: background 0.2s;
                    z-index: 100;
                }
                .back-btn { left: 15px; }
                .bgm-btn { right: 15px; padding: 8px 12px; font-size: 1rem; }
                .back-btn:hover, .bgm-btn:hover { background: rgba(255,255,255,0.4); }

                .title-wrapper { margin-top: 40px; display: flex; flex-direction: column; align-items: center; }
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

                .frozen {
                    background: linear-gradient(135deg, rgba(165, 243, 252, 0.9) 0%, rgba(125, 211, 252, 0.8) 100%);
                    border: 2px solid #38bdf8 !important; box-shadow: inset 0 0 10px rgba(255,255,255,0.8);
                }
                .frozen::after {
                    content: '❄️'; position: absolute; top: -5px; right: -5px; font-size: 1.2rem; filter: drop-shadow(0 2px 2px rgba(0,0,0,0.3));
                }
                .melted { animation: meltIce 0.3s forwards; }
                @keyframes meltIce { 100% { border-color: transparent; filter: brightness(1.5); } }

                .special-bomb {
                    animation: pulseBomb 1.5s infinite; border: 2px solid #f43f5e !important;
                    box-shadow: 0 0 15px rgba(244, 63, 94, 0.5); position: relative;
                }
                @keyframes pulseBomb { 0% { transform: scale(1); } 50% { transform: scale(1.05); } 100% { transform: scale(1); } }
            `}</style>

            {/* ✨ 離開房間時觸發 leaveRoom 斷開 Socket，再跳轉回大廳 */}
            <button onClick={() => { leaveRoom(); navigate('/'); }} className="back-btn">
                ← 離開房間
            </button>
            
            <button onClick={toggleBgm} className="bgm-btn">
                {isBgmPlaying ? '🔊 音樂' : '🔇 靜音'}
            </button>
            {/* ✨ 新增：房間即時戰況排行榜 */}
            {roomData && roomData.players.length > 1 && (
                <div style={{
                    position: 'absolute', top: '70px', right: '15px',
                    background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(10px)',
                    padding: '12px 15px', borderRadius: '16px', border: '2px solid rgba(255,255,255,0.6)',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.15)', fontSize: '0.85rem', zIndex: 50, minWidth: '150px'
                }}>
                    <strong style={{ color: '#0f766e', display: 'block', marginBottom: '8px', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px' }}>👥 房間戰況</strong>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {roomData.players.sort((a,b) => b.score - a.score).map((p, i) => (
                            <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', color: p.name === user.email ? '#ea580c' : '#334155', fontWeight: p.name === user.email ? 'bold' : 'normal' }}>
                                <span>{i+1}. {p.nickname} {!p.isOnline && <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}>(離線)</span>}</span>
                                <span>{p.score}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            <div className="title-wrapper">
                
                {/* 顯示房間 ID 的玻璃擬態膠囊 */}
                <div style={{
                    background: 'rgba(255,255,255,0.85)', padding: '5px 16px', borderRadius: '20px',
                    color: '#0f766e', fontWeight: '900', fontSize: '0.9rem', marginBottom: '10px',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.1)', border: '1px solid rgba(255,255,255,0.6)',
                    backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', gap: '6px'
                }}>
                    🏠 房間 ID : <span style={{ color: '#ea580c', letterSpacing: '1px' }}>{roomId}</span>
                </div>

                <div className="title-glass">
                    <div>🍉 夏日消消樂</div>
                    {/* 將原本的重置按鈕改成純展示的連線模式標籤，移除 onClick 與 pointer cursor */}
                    <div className="endless-badge" style={{ cursor: 'default' }}>
                        🎮 連線對戰模式
                    </div>
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