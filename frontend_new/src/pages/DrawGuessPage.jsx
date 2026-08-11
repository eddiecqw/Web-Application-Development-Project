import React, { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useGameSocket from '../hooks/useGameSocket';
import CanvasBoard from '../components/Game/CanvasBoard';
import GameLobby from '../components/Game/GameLobby';

export default function DrawGuessPage({ user }) {
  const canvasRef = useRef();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  
  const chatBoxRef = useRef(null);
  
  const [guess, setGuess] = useState('');
  
  const [brushColor, setBrushColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(5);
  // 保持豐富顏色，但等下 UI 會縮小它們的尺寸
  const presetColors = ['#000000', '#EF4444', '#22C55E', '#3B82F6', '#EAB308', '#F97316', '#A855F7', '#EC4899'];

  const [timeLeft, setTimeLeft] = useState(null);
  const [isTimerActive, setIsTimerActive] = useState(false);

  const [isMuted, setIsMuted] = useState(false);
  const correctSound = useRef(new Audio('/success.mp3')); 
  const bgmSound = useRef(new Audio('/The_Carousel_Clock.mp3'));         

  useEffect(() => {
    bgmSound.current.loop = true;
    bgmSound.current.volume = 0.3; 
  }, []);
  
  const baseWsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:53840/ws';
  const wsUrl = `${baseWsUrl}?username=${encodeURIComponent(user.email)}`;
  
  const {
    createRoom, joinRoom, sendDrawData, submitGuess, leaveRoom, 
    gameState: { roomId, players, isPainter, playerId, currentWord },
  } = useGameSocket(wsUrl, {
    DRAW_DATA_RECEIVED: (data) => {
      if (data.path && data.path.action === 'UNDO') canvasRef.current?.undo(false); 
      else if (data.path && data.path.action === 'CLEAR') canvasRef.current?.clear(false);
      else canvasRef.current?.drawPath(data.path);
    },
    GUESS_RESULT: (data) => {
      if (data.isCorrect) {
        if (!isMuted) {
          correctSound.current.currentTime = 0; 
          correctSound.current.play().catch(e => console.log('音效被阻擋:', e));
        }
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      }
      setMessages(prev => [...prev, {
        ...data,
        text: data.isCorrect ? `🎉 猜中了！正確答案：${data.guess}` : `❌ 猜錯了，繼續努力！`
      }]);
    },
    GAME_NEW_ROUND: (data) => {
      canvasRef.current?.clear(false);
      if (data.hasTimeLimit) {
        setTimeLeft(data.timeLimit);
        setIsTimerActive(true);
      } else setIsTimerActive(false);
    }
  });

  useEffect(() => {
    if (chatBoxRef.current) chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (roomId && !isMuted) bgmSound.current.play().catch(e => console.log('BGM阻擋:', e));
    else bgmSound.current.pause();
    return () => bgmSound.current.pause();
  }, [roomId, isMuted]);

  useEffect(() => {
    if (!isTimerActive || timeLeft === null || timeLeft <= 0) return;
    const timerId = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearInterval(timerId);
  }, [isTimerActive, timeLeft]);

  useEffect(() => {
    if (isTimerActive && timeLeft === 0) {
      setIsTimerActive(false);
      setMessages(prev => [...prev, { playerName: 'System', guess: '時間到！準備進入下一輪', isCorrect: false }]);
    }
  }, [timeLeft, isTimerActive]);

  const handleLeaveGame = () => {
    if (window.confirm("⚠️ 確定要主動離開遊戲嗎？\n\n主動返回聊天室將會清除您當前的房間紀錄！")) {
      bgmSound.current.pause();
      leaveRoom(); 
      navigate('/');
    }
  };

  const handleGuessSubmit = (e) => {
    e.preventDefault();
    if (guess.trim()) {
      submitGuess(guess.trim());
      setGuess(''); 
    }
  };

  // ================= 大廳畫面 =================
  if (!roomId) {
    return (
      <div style={{ minHeight: '100vh', width: '100vw', background: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px', boxSizing: 'border-box' }}>
        <div style={{ width: '100%', maxWidth: '450px', display: 'flex', justifyContent: 'flex-start', marginBottom: '15px' }}>
          <button 
            onClick={() => { bgmSound.current.pause(); navigate('/'); }}
            style={{ padding: '8px 16px', background: '#dc3545', color: 'white', borderRadius: '12px', border: 'none', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.9rem', boxShadow: '0 4px 6px rgba(0,0,0,0.2)' }}
          >
            ← 離開大廳
          </button>
        </div>
        <GameLobby onCreateRoom={createRoom} onJoinRoom={joinRoom} />
      </div>
    );
  }

  // ================= 遊戲本體畫面 =================
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '5px', boxSizing: 'border-box', color: '#333' }}>
      
      <style>{`
        @keyframes timer-pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.8; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      {/* ✨ 1. 極致壓縮的頂部狀態列 */}
      <header style={{ 
        width: '100%', maxWidth: '1100px', display: 'flex', justifyContent: 'space-between', 
        alignItems: 'center', padding: '6px 10px', /* 大幅縮小 Padding */
        backgroundColor: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(10px)', 
        borderRadius: '12px', marginBottom: '10px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', boxSizing: 'border-box'
      }}>
        <button onClick={handleLeaveGame} style={{ padding: '6px 12px', background: '#dc2626', color: 'white', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem', boxShadow: '0 2px 6px rgba(220,38,38,0.3)' }}>
          ← 離開
        </button>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ fontWeight: 'bold', color: '#c2410c', fontSize: '1rem', textShadow: '1px 1px 2px rgba(255,255,255,0.5)' }}>房間: {roomId}</div>
          {isTimerActive && (
            <div style={{ fontSize: '0.8rem', color: timeLeft <= 10 ? '#ef4444' : '#b45309', fontWeight: 'bold', background: 'rgba(255,255,255,0.8)', padding: '2px 8px', borderRadius: '8px', animation: timeLeft <= 10 ? 'timer-pulse 1s infinite' : 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              ⏱️ {timeLeft}s
            </div>
          )}
        </div>
        
        <button onClick={() => setIsMuted(!isMuted)} style={{ padding: '6px 12px', background: isMuted ? '#94a3b8' : '#10b981', color: 'white', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem', boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }}>
          {isMuted ? '🔇' : '🔊'}
        </button>
      </header>

      {/* 核心佈局 */}
      <div style={{ width: '100%', maxWidth: '1100px', display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center' }}>
        
        {/* 左側：畫布與工具區 */}
        <div style={{ flex: '1 1 600px', display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 }}>
          
          {/* ✨ 展平化工具列：強制單行橫向滑動 (Swipeable Toolbar) */}
          {isPainter && (
            <>
              {/* 隱藏橫向滾動條，讓 UI 更乾淨 */}
              <style>{`
                .hide-scrollbar::-webkit-scrollbar { display: none; }
                .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
              `}</style>
              
              <div className="hide-scrollbar" style={{ 
                display: 'flex', flexWrap: 'nowrap', gap: '8px', alignItems: 'center', 
                padding: '8px 10px', backgroundColor: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(5px)', 
                borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%' 
              }}>
                
                {/* 顏色選擇區：加入 flexShrink: 0 確保不會被擠壓變形 */}
                {presetColors.map(color => (
                  <button 
                    key={color} 
                    onClick={() => { setBrushColor(color); if (brushSize > 15) setBrushSize(5); }} 
                    style={{ flexShrink: 0, width: '24px', height: '24px', backgroundColor: color, border: brushColor === color ? '2px solid #475569' : '1px solid #e2e8f0', borderRadius: '50%', cursor: 'pointer', padding: 0, boxShadow: brushColor === color ? '0 2px 6px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.1)', transition: 'transform 0.1s' }} 
                    onMouseDown={e => e.currentTarget.style.transform='scale(0.9)'}
                    onMouseUp={e => e.currentTarget.style.transform='scale(1)'}
                  />
                ))}
                
                <div style={{ flexShrink: 0, width: '1px', height: '18px', background: '#cbd5e1', margin: '0 2px' }} />
                
                <input 
                  type="color" 
                  value={brushColor} 
                  onChange={(e) => setBrushColor(e.target.value)}
                  style={{ flexShrink: 0, width: '28px', height: '28px', padding: '0', border: 'none', cursor: 'pointer', background: 'none', borderRadius: '50%' }}
                />
                
                <button 
                  onClick={() => { setBrushColor('#FFFFFF'); setBrushSize(20); }} 
                  style={{ flexShrink: 0, padding: '4px 8px', fontSize: '0.8rem', cursor: 'pointer', borderRadius: '8px', backgroundColor: brushColor === '#FFFFFF' ? '#e2e8f0' : '#f8fafc', border: '1px solid #cbd5e1', fontWeight: 'bold', color: '#475569', display: 'flex', alignItems: 'center' }}
                >
                  🧽
                </button>

                <div style={{ flexShrink: 0, width: '1px', height: '18px', background: '#cbd5e1', margin: '0 2px' }} />

                <button onClick={() => canvasRef.current?.undo(true)} style={{ flexShrink: 0, padding: '4px 8px', fontSize: '0.8rem', cursor: 'pointer', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontWeight: 'bold' }}>⏪</button>
                <button onClick={() => canvasRef.current?.clear(true)} style={{ flexShrink: 0, padding: '4px 8px', fontSize: '0.8rem', cursor: 'pointer', borderRadius: '8px', border: '1px solid #fca5a5', color: '#ef4444', background: '#fff', fontWeight: 'bold' }}>🗑️</button>
                
                <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', background: '#f1f5f9', padding: '4px 8px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 'bold', marginRight: '6px', color: '#64748b' }}>粗細</span>
                  <input type="range" min="1" max="30" value={brushSize} onChange={(e) => setBrushSize(e.target.value)} style={{ width: '50px', accentColor: '#f59e0b', cursor: 'pointer' }} />
                </div>
              </div>
            </>
          )}

          {/* 畫布本體 */}
          <div style={{ background: '#fff', borderRadius: '16px', padding: '6px', boxShadow: '0 8px 30px rgba(234, 88, 12, 0.2)', border: '3px solid #fde68a', overflow: 'hidden' }}>
            <CanvasBoard ref={canvasRef} isPainter={isPainter} sendDraw={sendDrawData} brushColor={brushColor} brushSize={brushSize} />
          </div>
          
          {/* ✨ 3. 水平並排的猜題區塊 */}
          <div style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(5px)', borderRadius: '12px', padding: '10px 15px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
            {isPainter ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '0.95rem', color: '#b45309', fontWeight: 'bold' }}>🎯 繪畫題目：</span>
                <span style={{ fontSize: '1.4rem', color: '#ea580c', fontWeight: '900', letterSpacing: '1px' }}>{currentWord}</span>
              </div>
            ) : (
              <form onSubmit={handleGuessSubmit} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="text"
                  value={guess}
                  onChange={(e) => setGuess(e.target.value)}
                  placeholder="輸入你的猜測..."
                  style={{ flex: 1, padding: '8px 12px', fontSize: '0.95rem', border: '2px solid #fcd34d', borderRadius: '8px', outline: 'none', background: '#fff' }}
                />
                <button type="submit" style={{ padding: '8px 20px', background: 'linear-gradient(to right, #f59e0b, #ea580c)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.95rem', cursor: 'pointer', boxShadow: '0 2px 6px rgba(234, 88, 12, 0.3)' }}>
                  送出
                </button>
              </form>
            )}
          </div>

        </div>
        
        {/* 右側：玩家與聊天區 (微調圓角與內距以配合整體比例) */}
        <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0 }}>
          
          <div style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(5px)', borderRadius: '12px', padding: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
            <h4 style={{ margin: '0 0 8px 0', color: '#b45309', borderBottom: '2px solid #fef3c7', paddingBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '1rem' }}>
              👥 玩家列表 ({players?.length || 0})
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '120px', overflowY: 'auto', paddingRight: '5px' }}>
              {players?.map(p => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', borderRadius: '8px', background: p.id === playerId ? '#fed7aa' : '#f8fafc', border: p.id === playerId ? '1px solid #f97316' : '1px solid #e2e8f0' }}>
                  <span style={{ fontWeight: 'bold', color: '#334155', fontSize: '0.85rem' }}>
                    {p.name.split('@')[0]} {p.isPainter && '🖌️'}
                  </span>
                  <span style={{ fontWeight: 'bold', color: '#ea580c', fontSize: '0.9rem' }}>🎯 {p.score}</span>
                </div>
              ))}
            </div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(5px)', borderRadius: '12px', padding: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', minHeight: '250px' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#b45309', borderBottom: '2px solid #fef3c7', paddingBottom: '8px', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>💬 猜詞動態</h4>
            
            <div ref={chatBoxRef} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '5px' }}>
              {messages.length === 0 && (
                <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem', marginTop: '20px' }}>尚未有紀錄，趕快輸入答案吧！✍️</div>
              )}
              
              {messages.map((msg, idx) => {
                const isSystem = msg.playerName === 'System';
                const isOwnMessage = msg.playerName === user.email;

                if (isSystem) {
                  return (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'center', width: '100%', margin: '4px 0' }}>
                      <div style={{ background: '#fef3c7', padding: '4px 12px', borderRadius: '12px', fontSize: '0.8rem', color: '#b45309', fontWeight: 'bold', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>🔔 {msg.guess}</div>
                    </div>
                  );
                }

                return (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: isOwnMessage ? 'flex-end' : 'flex-start', width: '100%' }}>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '2px', padding: '0 4px', fontWeight: 'bold' }}>{msg.playerName.split('@')[0]}</div>
                    <div style={{
                      padding: '8px 12px', borderRadius: isOwnMessage ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
                      backgroundColor: msg.isCorrect ? '#dcfce7' : (isOwnMessage ? '#fde68a' : '#f8fafc'),
                      color: msg.isCorrect ? '#166534' : '#334155',
                      border: msg.isCorrect ? '1px solid #bbf7d0' : (isOwnMessage ? '1px solid #fcd34d' : '1px solid #e2e8f0'),
                      boxShadow: '0 2px 4px rgba(0,0,0,0.02)', maxWidth: '90%', wordBreak: 'break-word', fontSize: '0.9rem',
                      fontWeight: msg.isCorrect ? 'bold' : 'normal', lineHeight: '1.3'
                    }}>
                      {msg.isCorrect ? msg.text : msg.guess}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}