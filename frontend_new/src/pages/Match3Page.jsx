import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useMatch3Socket from '../hooks/useMatch3Socket';
import Match3Lobby from '../components/Game/Match3Lobby';

const getBeachBackgroundByTime = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 10) return `url('/image/match3/bg_morning.jpg')`;
    else if (hour >= 10 && hour < 16) return `url('/image/match3/bg_midday.jpg')`;
    else if (hour >= 16 && hour < 19) return `url('/image/match3/bg_sunset.jpg')`;
    else return `url('/image/match3/bg_night.jpg')`;
};

export default function Match3Page({ user }) {
    const navigate = useNavigate();
    const location = useLocation();
    
    const [score, setScore] = useState(0);
    const [grid, setGrid] = useState([]);
    const [animStates, setAnimStates] = useState({});
    const [uiSelectedCell, setUiSelectedCell] = useState(null);
    const engineRef = useRef({ isAnimating: false, isSwiping: false, startX: 0, startY: 0 });

    const baseWsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:53840/ws';
    const wsUrl = `${baseWsUrl}?username=${encodeURIComponent(user.email)}`;
    const { createRoom, joinRoom, leaveRoom, syncState, gameState: { roomId, roomData } } = useMatch3Socket(wsUrl);

    // ✨ 音訊狀態獨立分離
    const [isBgmPlaying, setIsBgmPlaying] = useState(false);
    const [isSfxEnabled, setIsSfxEnabled] = useState(true);
    const isSfxEnabledRef = useRef(true); // 給閉包內的遊戲引擎讀取用

    // ✨ 專業級 Web Audio API 引擎 (負責 SFX)
    const audioCtxRef = useRef(null);
    const sfxBufferRef = useRef(null);
    const bgmRef = useRef(new Audio('/audio/match3_bgm.mp3'));

    useEffect(() => {
        // 初始化 AudioContext
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioCtxRef.current = new AudioContext();

        // 預先載入氣泡音效並解碼存入記憶體 (Buffer)
        fetch('/audio/bubble.mp3')
            .then(res => res.arrayBuffer())
            .then(arrayBuffer => audioCtxRef.current.decodeAudioData(arrayBuffer))
            .then(audioBuffer => { sfxBufferRef.current = audioBuffer; })
            .catch(e => console.error("音效載入失敗:", e));

        const audio = bgmRef.current;
        audio.loop = true; audio.volume = 0.6;

        return () => { 
            audio.pause(); audio.currentTime = 0; 
            if (audioCtxRef.current?.state !== 'closed') audioCtxRef.current?.close();
        };
    }, []);

    const toggleBgm = () => {
        if (isBgmPlaying) bgmRef.current.pause();
        else bgmRef.current.play().catch(() => {});
        setIsBgmPlaying(!isBgmPlaying);
    };

    const toggleSfx = () => {
        const nextState = !isSfxEnabled;
        setIsSfxEnabled(nextState);
        isSfxEnabledRef.current = nextState;
        // 若 iOS 暫停了音訊，玩家點開關時順便喚醒它
        if (nextState && audioCtxRef.current?.state === 'suspended') {
            audioCtxRef.current.resume();
        }
    };

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

    const [bgImage, setBgImage] = useState(getBeachBackgroundByTime());
    useEffect(() => {
        const imagesToPreload = ['/image/match3/bg_morning.jpg', '/image/match3/bg_midday.jpg', '/image/match3/bg_sunset.jpg', '/image/match3/bg_night.jpg'];
        imagesToPreload.forEach(src => { const img = new Image(); img.src = src; });
        
        const checkAndUpdateBackground = () => {
            setBgImage(prev => {
                const currentBg = getBeachBackgroundByTime();
                return prev !== currentBg ? currentBg : prev;
            });
        };
        const interval = setInterval(checkAndUpdateBackground, 3000);
        window.addEventListener('focus', checkAndUpdateBackground);
        return () => {
            clearInterval(interval);
            window.removeEventListener('focus', checkAndUpdateBackground);
        };
    }, []);

    useEffect(() => {
        if (!roomId) return;

        const ROWS = 8;
        const COLS = 8;
        const FRUITS = ['🍉', '🍍', '🥝', '🍇', '🍋', '🍹']; 
        
        let board = [];
        let internalScore = 0;
        let selectedCell = null;
        let isAnimating = false;

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

        function saveGame() {
            syncState(board, internalScore);
        }

        function renderBoard() {
            setGrid(board.map(row => [...row])); 
            setUiSelectedCell(selectedCell);
            setScore(internalScore);
        }

        // ✨ 音訊解鎖機制：觸控螢幕瞬間喚醒 Web Audio
        const unlockAudio = () => {
            if (audioCtxRef.current?.state === 'suspended') {
                audioCtxRef.current.resume();
            }
        };

        engineRef.current.handleCellClick = handleCellClick;
        engineRef.current.handleSwipe = (r, c, tr, tc) => {
            unlockAudio();
            if (isAnimating) return;
            selectedCell = { r, c };
            renderBoard();
            handleCellClick(tr, tc);
        };

        function initBoard() {
            if (roomData && roomData.players) {
                const me = roomData.players.find(p => p.name === user.email);
                if (me && me.board && me.board.length > 0) {
                    board = me.board.map(row => [...row]); 
                    internalScore = me.score;
                    renderBoard();
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
            renderBoard();
        }

        async function handleCellClick(r, c) {
            unlockAudio();
            if (isAnimating) return;
            if (!selectedCell) { selectedCell = { r, c }; renderBoard(); return; }
            if (selectedCell.r === r && selectedCell.c === c) { selectedCell = null; renderBoard(); return; }

            if (board[selectedCell.r][selectedCell.c]?.startsWith('🧊') || board[r][c]?.startsWith('🧊')) {
                selectedCell = null; renderBoard(); return;
            }

            const r1 = selectedCell.r, c1 = selectedCell.c;
            const isAdjacent = (Math.abs(r1 - r) + Math.abs(c1 - c) === 1);

            if (isAdjacent) {
                isAnimating = true; engineRef.current.isAnimating = true;
                selectedCell = null;
                
                try {
                    [board[r1][c1], board[r][c]] = [board[r][c], board[r1][c1]];
                    renderBoard(); 
                    await sleep(250);

                    let matches = findMatches();
                    if (matches.length > 0) { 
                        await processMatches(); 
                    } else {
                        [board[r1][c1], board[r][c]] = [board[r][c], board[r1][c1]];
                        renderBoard(); saveGame();
                    }
                } catch (error) {
                    console.error("消消樂引擎恢復:", error);
                } finally {
                    isAnimating = false; engineRef.current.isAnimating = false;
                }
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
            let safetyCounter = 0; 
            
            while (matches.length > 0 && safetyCounter < 20) {
                safetyCounter++;
                let toDestroy = new Set();
                let toMelt = new Set();
                let queue = [];
                matches.forEach(m => {
                    let v = board[m.r][m.c];
                    let tColor = FRUITS.includes(v) ? v : null;
                    queue.push({ r: m.r, c: m.c, triggerColor: tColor });
                    toDestroy.add(`${m.r},${m.c}`);
                });
                
                let processed = new Set();
                const triggerDestroy = (r, c, inheritedColor) => {
                    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return;
                    let key = `${r},${c}`;
                    let v = board[r][c];
                    if (!v) return;
                    if (v.startsWith('🧊')) {
                        toMelt.add(key); 
                    } else {
                        if (!toDestroy.has(key)) {
                            toDestroy.add(key);
                            queue.push({r, c, triggerColor: inheritedColor}); 
                        }
                    }
                };

                let qSafety = 0;
                while(queue.length > 0 && qSafety < 200) {
                    qSafety++;
                    let curr = queue.shift();
                    let key = `${curr.r},${curr.c}`;
                    if (processed.has(key)) continue;
                    processed.add(key);

                    let r = curr.r, c = curr.c;
                    let v = board[r][c];
                    if (!v) continue;

                    let tColor = curr.triggerColor || (FRUITS.includes(v) ? v : null);
                    const neighbors = [ {r: r-1, c}, {r: r+1, c}, {r, c: c-1}, {r, c: c+1} ];
                    neighbors.forEach(n => {
                        if (n.r >= 0 && n.r < ROWS && n.c >= 0 && n.c < COLS) {
                            let nVal = board[n.r][n.c];
                            if (nVal && nVal.startsWith('🧊')) {
                                toMelt.add(`${n.r},${n.c}`);
                            } else if (nVal && ['🥥', '🌊', '🌈'].includes(nVal)) {
                                triggerDestroy(n.r, n.c, tColor);
                            }
                        }
                    });

                    if (v === '🥥') {
                        for(let dr=-1; dr<=1; dr++) {
                            for(let dc=-1; dc<=1; dc++) triggerDestroy(r+dr, c+dc, tColor);
                        }
                    } else if (v === '🌊') {
                        for(let i=0; i<ROWS; i++) triggerDestroy(i, c, tColor);
                        for(let i=0; i<COLS; i++) triggerDestroy(r, i, tColor);
                    } else if (v === '🌈') {
                        let targetColor = tColor || FRUITS[Math.floor(Math.random() * FRUITS.length)];
                        for(let rr=0; rr<ROWS; rr++) {
                            for(let cc=0; cc<COLS; cc++) {
                                let cellV = board[rr][cc];
                                if (cellV === targetColor) triggerDestroy(rr, cc, targetColor);
                                else if (cellV === `🧊${targetColor}`) toMelt.add(`${rr},${cc}`);
                            }
                        }
                    }
                }

                toMelt.forEach(key => toDestroy.delete(key));

                internalScore += toDestroy.size * 10 + toMelt.size * 5;
                setScore(internalScore);

                // ✨ 利用 Web Audio API 播放消除音效 (允許百重疊加、不中斷背景音樂)
                if (isSfxEnabledRef.current && audioCtxRef.current && sfxBufferRef.current) {
                    if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
                    const source = audioCtxRef.current.createBufferSource();
                    source.buffer = sfxBufferRef.current;
                    const gainNode = audioCtxRef.current.createGain();
                    gainNode.gain.value = 0.7; // 控制音量
                    source.connect(gainNode);
                    gainNode.connect(audioCtxRef.current.destination);
                    source.start(0);
                }
                
                let newAnimStates = {};
                toDestroy.forEach(k => newAnimStates[k] = 'matched');
                toMelt.forEach(k => newAnimStates[k] = 'melted');
                setAnimStates(newAnimStates);

                await sleep(150);

                toDestroy.forEach(key => { let [r, c] = key.split(',').map(Number); board[r][c] = null; });
                toMelt.forEach(key => { 
                    let [r, c] = key.split(',').map(Number); 
                    if (board[r][c]) board[r][c] = board[r][c].replace('🧊', ''); 
                });

                setAnimStates({});
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
                
                await sleep(200);
                renderBoard();
                
                matches = findMatches();
                if (matches.length > 0) await sleep(80);
            }
            saveGame();
        }

        function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
        initBoard();
        
    }, [roomId]); 

    if (!roomId) {
        return (
            <div style={{ minHeight: '100vh', background: `${bgImage} center/cover no-repeat`, transition: 'background 1.5s ease-in-out', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '16px' }}>
                <Match3Lobby onCreateRoom={createRoom} onJoinRoom={joinRoom} onBack={() => navigate('/')} username={user.email} />
            </div>
        );
    }

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', touchAction: 'none',
            background: `${bgImage} center/cover no-repeat`, 
            transition: 'background 1.5s ease-in-out', fontFamily: "'Nunito', 'Noto Color Emoji', sans-serif",
            display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#334155'
        }}>
            <style>{`
                * { box-sizing: border-box; }
                .action-btn {
                    background: rgba(255,255,255,0.25); backdrop-filter: blur(10px); WebkitBackdropFilter: blur(10px);
                    border: 2px solid rgba(255,255,255,0.6); border-radius: 12px;
                    padding: 8px 15px; color: #fff; font-weight: bold; cursor: pointer;
                    font-size: 0.95rem; text-shadow: 0 2px 4px rgba(0,0,0,0.4);
                    box-shadow: 0 4px 10px rgba(0,0,0,0.1); transition: background 0.2s; z-index: 100;
                }
                .action-btn:hover { background: rgba(255,255,255,0.4); }
                .back-btn { position: absolute; top: 15px; left: 15px; }
                .controls-container { position: absolute; top: 15px; right: 15px; display: flex; gap: 8px; z-index: 100; }
                
                .title-wrapper { margin-top: 55px; display: flex; flex-direction: column; align-items: center; }
                .title-glass {
                    margin: 10px 0 10px 0; font-size: 2.2rem; color: #fff; text-shadow: 0 4px 10px rgba(0,0,0,0.3);
                    background: rgba(255, 255, 255, 0.2); padding: 10px 30px; border-radius: 30px;
                    backdrop-filter: blur(10px); WebkitBackdropFilter: blur(10px); border: 2px solid rgba(255,255,255,0.5);
                    animation: float 3s ease-in-out infinite; display: flex; flex-direction: column; align-items: center;
                }
                .endless-badge { font-size: 0.9rem; background: #ea580c; color: white; padding: 2px 10px; border-radius: 12px; margin-top: 5px; text-shadow: none; }
                @keyframes float { 0% { transform: translateY(0px); } 50% { transform: translateY(-8px); } 100% { transform: translateY(0px); } }
                
                .score-board {
                    font-size: 1.2rem; background: rgba(255, 255, 255, 0.85); padding: 8px 30px; border-radius: 20px; margin-bottom: 25px;
                    box-shadow: 0 8px 32px rgba(31, 38, 135, 0.15); backdrop-filter: blur(8px); WebkitBackdropFilter: blur(8px); 
                    border: 1px solid rgba(255, 255, 255, 0.8); display: flex; align-items: center; gap: 10px; font-weight: 900;
                }
                #scoreValue { color: #ea580c; font-size: 1.8rem; text-shadow: 1px 1px 0px #fff; }
                
                #game-board {
                    display: grid; grid-template-columns: repeat(8, 48px); grid-template-rows: repeat(8, 48px); gap: 6px; padding: 12px;
                    background: rgba(255, 255, 255, 0.35); 
                    backdrop-filter: blur(8px); WebkitBackdropFilter: blur(8px); transform: translateZ(0); 
                    border-radius: 20px; border: 2px solid rgba(255, 255, 255, 0.6); box-shadow: 0 15px 35px rgba(0,0,0,0.2), inset 0 0 20px rgba(255,255,255,0.5); 
                }
                .cell {
                    width: 48px; height: 48px; background: linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.6) 100%);
                    border-radius: 12px; display: flex; justify-content: center; align-items: center; font-size: 32px; cursor: pointer; user-select: none;
                    transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275); 
                    will-change: transform; 
                    box-shadow: 0 4px 6px rgba(0,0,0,0.1), inset 0 -2px 5px rgba(0,0,0,0.05); border: 1px solid rgba(255,255,255,0.8);
                }
                .cell:active { transform: scale(0.9); }
                .cell.selected { background: #fff; transform: scale(1.15); box-shadow: 0 0 20px #fcd34d, inset 0 0 10px #f59e0b; border: 2px solid #f59e0b; z-index: 10; }
                .cell.matched { animation: popOut 0.2s forwards; }
                @keyframes popOut { 0% { transform: scale(1); opacity: 1; filter: brightness(1); } 50% { transform: scale(1.4); opacity: 0.8; filter: brightness(1.5); } 100% { transform: scale(0); opacity: 0; } }
                
                @media (max-width: 480px) {
                    .action-btn { padding: 6px 10px; font-size: 0.8rem; border-radius: 8px; }
                    .back-btn { top: 10px; left: 10px; }
                    .controls-container { top: 10px; right: 10px; }
                    .title-wrapper { margin-top: 55px; } 
                    .title-glass { margin: 5px 0; font-size: 1.6rem; padding: 8px 20px; }
                    .endless-badge { font-size: 0.8rem; padding: 2px 8px; }
                    .score-board { font-size: 1rem; padding: 6px 20px; margin-bottom: 15px; }
                    #scoreValue { font-size: 1.5rem; }
                    #game-board { grid-template-columns: repeat(8, 10.5vw); grid-template-rows: repeat(8, 10.5vw); gap: 1.5vw; padding: 3vw; border-radius: 16px; }
                    .cell { width: 100%; height: 100%; font-size: 7.5vw; border-radius: 8px; }
                }
                .frozen { background: linear-gradient(135deg, rgba(165, 243, 252, 0.9) 0%, rgba(125, 211, 252, 0.8) 100%); border: 2px solid #38bdf8 !important; box-shadow: inset 0 0 10px rgba(255,255,255,0.8); }
                .frozen::after { content: '❄️'; position: absolute; top: -5px; right: -5px; font-size: 1.2rem; filter: drop-shadow(0 2px 2px rgba(0,0,0,0.3)); }
                .melted { animation: meltIce 0.2s forwards; }
                @keyframes meltIce { 100% { border-color: transparent; filter: brightness(1.5); } }
                .special-bomb { animation: pulseBomb 1.5s infinite; border: 2px solid #f43f5e !important; box-shadow: 0 0 15px rgba(244, 63, 94, 0.5); }
                @keyframes pulseBomb { 0% { transform: scale(1); } 50% { transform: scale(1.05); } 100% { transform: scale(1); } }
            `}</style>

            <button onClick={() => { leaveRoom(); navigate('/'); }} className="action-btn back-btn">← 離開房間</button>
            
            {/* ✨ 獨立的控制台：分開 BGM 與 SFX */}
            <div className="controls-container">
                <button onClick={toggleSfx} className="action-btn">
                    {isSfxEnabled ? '✨ 音效: 開' : '🔇 音效: 關'}
                </button>
                <button onClick={toggleBgm} className="action-btn">
                    {isBgmPlaying ? '🔊 音樂: 開' : '🔈 音樂: 關'}
                </button>
            </div>
            
            {roomData && roomData.players.length > 1 && (
                <div style={{ position: 'absolute', top: '70px', right: '15px', background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', padding: '12px 15px', borderRadius: '16px', border: '2px solid rgba(255,255,255,0.6)', boxShadow: '0 4px 15px rgba(0,0,0,0.15)', fontSize: '0.85rem', zIndex: 50, minWidth: '150px' }}>
                    <strong style={{ color: '#0f766e', display: 'block', marginBottom: '8px', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px' }}>👥 房間戰況</strong>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {[...roomData.players].sort((a,b) => b.score - a.score).map((p, i) => (
                            <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', color: p.name === user.email ? '#ea580c' : '#334155', fontWeight: p.name === user.email ? 'bold' : 'normal' }}>
                                <span>{i+1}. {p.nickname} {!p.isOnline && <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}>(離線)</span>}</span>
                                <span>{p.score}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="title-wrapper">
                <div style={{ background: 'rgba(255,255,255,0.85)', padding: '5px 16px', borderRadius: '20px', color: '#0f766e', fontWeight: '900', fontSize: '0.9rem', marginBottom: '10px', boxShadow: '0 4px 10px rgba(0,0,0,0.1)', border: '1px solid rgba(255,255,255,0.6)', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    🏠 房間 ID : <span style={{ color: '#ea580c', letterSpacing: '1px' }}>{roomId}</span>
                </div>
                <div className="title-glass">
                    <div>🍉 夏日消消樂</div>
                    <div className="endless-badge" style={{ cursor: 'default' }}>🎮 連線對戰模式</div>
                </div>
            </div>

            <div className="score-board">
                <span>SCORE</span>
                <span id="scoreValue">{score}</span>
            </div>

            <div id="game-board">
                {grid.map((row, r) => row.map((val, c) => {
                    const key = `${r},${c}`;
                    const isSelected = uiSelectedCell && uiSelectedCell.r === r && uiSelectedCell.c === c;
                    const animState = animStates[key];

                    let displayVal = val || '';
                    let classes = 'cell';

                    if (displayVal.startsWith('🧊')) {
                        displayVal = displayVal.replace('🧊', '');
                        classes += ' frozen';
                    } else if (['🥥', '🌊', '🌈'].includes(displayVal)) {
                        classes += ' special-bomb';
                    }

                    if (isSelected) classes += ' selected';
                    if (animState === 'matched') classes += ' matched';
                    if (animState === 'melted') classes += ' melted';

                    return (
                        <div
                            key={key}
                            className={classes}
                            onClick={() => {
                                if (!engineRef.current.isSwiping && engineRef.current.handleCellClick) {
                                    engineRef.current.handleCellClick(r, c);
                                }
                            }}
                            onTouchStart={(e) => {
                                if (engineRef.current.isAnimating) return;
                                engineRef.current.startX = e.touches[0].clientX;
                                engineRef.current.startY = e.touches[0].clientY;
                                engineRef.current.isSwiping = false;
                            }}
                            onTouchEnd={(e) => {
                                if (engineRef.current.isAnimating) return;
                                const diffX = e.changedTouches[0].clientX - engineRef.current.startX;
                                const diffY = e.changedTouches[0].clientY - engineRef.current.startY;
                                
                                if (Math.abs(diffX) > 30 || Math.abs(diffY) > 30) {
                                    engineRef.current.isSwiping = true;
                                    let targetR = r, targetC = c;
                                    if (Math.abs(diffX) > Math.abs(diffY)) targetC = diffX > 0 ? c + 1 : c - 1;
                                    else targetR = diffY > 0 ? r + 1 : r - 1;

                                    if (targetR >= 0 && targetR < 8 && targetC >= 0 && targetC < 8) {
                                        engineRef.current.handleSwipe && engineRef.current.handleSwipe(r, c, targetR, targetC);
                                    }
                                    setTimeout(() => { engineRef.current.isSwiping = false; }, 300);
                                }
                            }}
                        >
                            {displayVal}
                        </div>
                    );
                }))}
            </div>
        </div>
    );
}