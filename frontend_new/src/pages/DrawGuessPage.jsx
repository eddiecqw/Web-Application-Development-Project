import React, { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useGameSocket from '../hooks/useGameSocket';
import CanvasBoard from '../components/Game/CanvasBoard';
import GameLobby from '../components/Game/GameLobby';
import PlayerList from '../components/Game/PlayerList';
import GuessInput from '../components/Game/GuestInput';

export default function DrawGuessPage({ user }) {
  const canvasRef = useRef();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  
  // ✨ 新增：用來鎖定聊天框，實現內部安全滾動的 Ref
  const chatBoxRef = useRef(null);
  
  const [brushColor, setBrushColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(5);
  const presetColors = ['#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF9900', '#9900FF'];

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
    createRoom,
    joinRoom,
    sendDrawData,
    submitGuess,
    leaveRoom, 
    gameState: { roomId, players, isPainter, playerId, currentWord },
  } = useGameSocket(wsUrl, {
    DRAW_DATA_RECEIVED: (data) => {
      if (data.path && data.path.action === 'UNDO') {
        canvasRef.current?.undo(false); 
      } else if (data.path && data.path.action === 'CLEAR') {
        canvasRef.current?.clear(false);
      } else {
        canvasRef.current?.drawPath(data.path);
      }
    },
    GUESS_RESULT: (data) => {
      if (data.isCorrect) {
        if (!isMuted) {
          correctSound.current.currentTime = 0; 
          correctSound.current.play().catch(e => console.log('音效播放被阻擋:', e));
        }
        
        if (navigator.vibrate) {
          navigator.vibrate([100, 50, 100]);
        }
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
      } else {
        setIsTimerActive(false);
      }
    }
  });

  // ✨ 關鍵修復：安全自動滾動機制
  // 當 messages 更新時，只讓 chatBoxRef 內部滾動到底部，絕對不影響外層網頁
  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (roomId && !isMuted) {
      bgmSound.current.play().catch(e => console.log('BGM 自動播放被瀏覽器阻擋:', e));
    } else {
      bgmSound.current.pause();
    }
    
    return () => {
      bgmSound.current.pause();
    };
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

  const handleCreateRoom = (settings) => createRoom(settings);
  const handleJoinRoom = (roomIdInput) => joinRoom(roomIdInput);
  const handleSubmitGuess = (guess) => submitGuess(guess);

  const handleLeaveGame = () => {
    const isConfirmed = window.confirm("⚠️ 確定要主動離開遊戲嗎？\n\n主動返回聊天室將會清除您當前的房間紀錄與分數！\n(若是意外刷新網頁，分數會自動保留)");
    if (isConfirmed) {
      bgmSound.current.pause();
      leaveRoom(); 
      navigate('/');
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  return (
    <div className="flex flex-col items-center w-full p-4" style={{ color: '#333' }}>
      
      <div style={{ width: '100%', maxWidth: '1152px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <button 
          onClick={handleLeaveGame}
          className="nav-button" 
          style={{ padding: '8px 16px', background: '#dc3545', color: 'white', borderRadius: '4px', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}
        >
          ← 離開遊戲 (Back to Chat)
        </button>

        <button 
          onClick={toggleMute}
          style={{ 
            padding: '8px 12px', background: isMuted ? '#6c757d' : '#28a745', 
            color: 'white', borderRadius: '50px', border: 'none', 
            cursor: 'pointer', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px',
            boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
          }}
          title={isMuted ? "開啟音效" : "靜音"}
        >
          {isMuted ? '🔇' : '🔊'}
        </button>
      </div>

      {!roomId ? (
        <GameLobby onCreateRoom={handleCreateRoom} onJoinRoom={handleJoinRoom} />
      ) : (
        <div className="flex flex-col md:flex-row w-full max-w-6xl">
          <div className="flex-1">
            
            <div className="mb-2 font-bold text-blue-600" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>房間號：{roomId}</span>
              
              {isTimerActive && (
                <span style={{ 
                  color: timeLeft <= 10 ? 'red' : '#333', 
                  fontSize: '1.2rem', 
                  animation: timeLeft <= 10 ? 'pulse 1s infinite' : 'none' 
                }}>
                  ⏱️ {timeLeft} 秒
                </span>
              )}
            </div>

            {isPainter && (
              <div style={{
                display: 'flex', flexWrap: 'wrap', gap: '15px', justifyContent: 'space-between', 
                alignItems: 'center', padding: '10px', backgroundColor: '#f8f9fa', 
                borderRadius: '8px', marginBottom: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
              }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  {presetColors.map(color => (
                    <button
                      key={color}
                      onClick={() => { setBrushColor(color); if (brushSize > 15) setBrushSize(5); }}
                      style={{
                        width: '28px', height: '28px', backgroundColor: color,
                        border: brushColor === color ? '3px solid #666' : '1px solid #ccc',
                        borderRadius: '50%', cursor: 'pointer', padding: 0
                      }}
                    />
                  ))}
                  <input 
                    type="color" 
                    value={brushColor} 
                    onChange={(e) => setBrushColor(e.target.value)}
                    style={{ width: '32px', height: '32px', padding: '0', border: 'none', cursor: 'pointer', background: 'none' }}
                  />
                  <button 
                    onClick={() => { setBrushColor('#FFFFFF'); setBrushSize(20); }}
                    style={{ 
                      padding: '4px 8px', fontSize: '12px', cursor: 'pointer', borderRadius: '4px',
                      backgroundColor: brushColor === '#FFFFFF' ? '#e2e3e5' : '#ffffff',
                      border: '1px solid #ccc', fontWeight: 'bold'
                    }}
                  >
                    🧽 橡皮擦
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <button onClick={() => canvasRef.current?.undo(true)} style={{ padding: '4px 8px', fontSize: '12px', cursor: 'pointer', borderRadius: '4px', border: '1px solid #ccc', background: '#fff' }}>
                    ⏪ 撤銷
                  </button>
                  <button onClick={() => canvasRef.current?.redo()} style={{ padding: '4px 8px', fontSize: '12px', cursor: 'pointer', borderRadius: '4px', border: '1px solid #ccc', background: '#fff' }}>
                    ⏩ 重做
                  </button>
                  <button onClick={() => canvasRef.current?.clear(true)} style={{ padding: '4px 8px', fontSize: '12px', cursor: 'pointer', borderRadius: '4px', border: '1px solid #dc3545', color: '#dc3545', background: '#fff' }}>
                    🗑️ 清空
                  </button>
                  
                  <span style={{ fontSize: '14px', fontWeight: 'bold', marginLeft: '5px' }}>粗細:</span>
                  <input
                    type="range"
                    min="1" max="30"
                    value={brushSize}
                    onChange={(e) => setBrushSize(e.target.value)}
                    style={{ width: '80px', cursor: 'pointer' }}
                  />
                </div>
              </div>
            )}

            <CanvasBoard 
              ref={canvasRef} 
              isPainter={isPainter} 
              sendDraw={sendDrawData} 
              brushColor={brushColor}
              brushSize={brushSize}
            />
            
            <GuessInput
              isPainter={isPainter}
              currentWord={currentWord}
              onSubmitGuess={handleSubmitGuess}
            />
          </div>
          
          <div className="w-full md:w-1/3 p-4">
            <PlayerList players={players} currentUserId={playerId} />
            
            {/* ✨ 替換為聊天室風格的猜詞紀錄區塊 */}
            <div className="mt-4" style={{ display: 'flex', flexDirection: 'column' }}>
              <h4 className="font-bold mb-2">💬 聊天與猜詞動態：</h4>
              
              <div 
                ref={chatBoxRef}
                style={{ 
                  height: '350px',            // 設定固定高度
                  overflowY: 'auto',          // 允許內部滾動
                  backgroundColor: '#f8f9fa', 
                  borderRadius: '8px', 
                  padding: '12px',
                  border: '1px solid #e5e7eb',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}
              >
                {messages.length === 0 && (
                  <div style={{ textAlign: 'center', color: '#999', fontSize: '0.85rem', marginTop: '20px' }}>
                    尚未有紀錄，趕快輸入答案吧！
                  </div>
                )}
                
                {messages.map((msg, idx) => {
                  const isSystem = msg.playerName === 'System';
                  // 判斷是否為自己的訊息
                  const isOwnMessage = msg.playerName === user.email;

                  // 系統提示訊息置中
                  if (isSystem) {
                    return (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'center', width: '100%', margin: '4px 0' }}>
                        <div style={{ background: 'rgba(0,0,0,0.08)', padding: '4px 12px', borderRadius: '12px', fontSize: '0.75rem', color: '#555' }}>
                          🔔 {msg.guess}
                        </div>
                      </div>
                    );
                  }

                  // 玩家對話/猜詞氣泡
                  return (
                    <div key={idx} style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: isOwnMessage ? 'flex-end' : 'flex-start',
                      width: '100%'
                    }}>
                      {/* 玩家名字 */}
                      <div style={{ fontSize: '0.7rem', color: '#888', marginBottom: '2px', padding: '0 4px' }}>
                        {msg.playerName}
                      </div>
                      
                      {/* 訊息氣泡本體 */}
                      <div style={{
                        padding: '8px 12px',
                        borderRadius: isOwnMessage ? '15px 4px 15px 15px' : '4px 15px 15px 15px',
                        // 如果猜中顯示高亮綠色，沒猜中則區分是不是自己發的顏色
                        backgroundColor: msg.isCorrect ? '#dcfce7' : (isOwnMessage ? '#95ec69' : '#ffffff'),
                        color: msg.isCorrect ? '#166534' : '#333',
                        border: msg.isCorrect ? '1px solid #bbf7d0' : '1px solid #e5e7eb',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                        maxWidth: '90%',
                        wordBreak: 'break-word',
                        fontSize: '0.9rem',
                        fontWeight: msg.isCorrect ? 'bold' : 'normal'
                      }}>
                        {/* 如果猜對了，顯示系統給的 text (例如: 🎉 猜中了！...)，如果是平時猜測/聊天，就顯示玩家輸入的文字 */}
                        {msg.isCorrect ? msg.text : msg.guess}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}