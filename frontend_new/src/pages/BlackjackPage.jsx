import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import useBlackjackSocket from '../hooks/useBlackjackSocket';
import BlackjackLobby from '../components/Game/BlackjackLobby';

export default function BlackjackPage({ user }) {
  const navigate = useNavigate();
  const username = user.email;
  
  const baseWsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:53840/ws';
  const wsUrl = `${baseWsUrl}?username=${encodeURIComponent(username)}`;

  const [showRules, setShowRules] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeEmojis, setActiveEmojis] = useState({});
  const [glow, setGlow] = useState(false); 
  const EMOJI_LIST = ['😎', '😭', '🤡', '💸', '😀', '😡', '💩', '🎉'];
  // ✨BGM 音樂狀態與實體設定
  const [isBgmPlaying, setIsBgmPlaying] = useState(false);
  const bgmRef = useRef(new Audio('/audio/The_Felt_Table.mp3'));

  // ✨設定音樂循環播放與離開頁面自動清理
  useEffect(() => {
    const audio = bgmRef.current;
    audio.loop = true;
    audio.volume = 0.4; // 建議音量 40%
    return () => {
      audio.pause();
      audio.currentTime = 0;
    };
  }, []);

  // ✨音樂開關函數
  const toggleBgm = () => {
    const audio = bgmRef.current;
    if (isBgmPlaying) {
      audio.pause();
    } else {
      audio.play().catch(e => console.error("音樂播放失敗:", e));
    }
    setIsBgmPlaying(!isBgmPlaying);
  };

  // ✨ 1. 新增：計時器相關狀態
  const [timeLeft, setTimeLeft] = useState(null);
  const [lastTurn, setLastTurn] = useState(null);
  const [isAutoStanding, setIsAutoStanding] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setGlow(g => !g), 800);
    return () => clearInterval(interval);
  }, []);

  const {
    createRoom, joinRoom, leaveRoom, sendEmoji, startGame, hit, stand,
    gameState: { roomId, roomData }
  } = useBlackjackSocket(wsUrl, {
    BJ_SHOW_EMOJI: (data) => {
      setActiveEmojis(prev => ({ ...prev, [data.username]: data.emoji }));
      setTimeout(() => {
        setActiveEmojis(prev => {
          const newState = { ...prev };
          delete newState[data.username];
          return newState;
        });
      }, 3000);
    }
  });

  // ✨ 2. 新增：監聽回合改變，重置計時器
  useEffect(() => {
    if (roomData?.status === 'playing' && roomData.turn !== lastTurn) {
      setLastTurn(roomData.turn);
      setIsAutoStanding(false); // 換人時取消自動停牌狀態
      
      // 只要不是輪到系統/莊家自動補牌，就開始倒數
      if (roomData.turn !== 'dealer') {
        setTimeLeft(roomData.settings?.timeLimit || 30);
      } else {
        setTimeLeft(null);
      }
    } else if (roomData?.status !== 'playing') {
      setTimeLeft(null);
      setLastTurn(null);
      setIsAutoStanding(false);
    }
  }, [roomData?.status, roomData?.turn, roomData?.settings?.timeLimit, lastTurn]);

  // ✨ 3. 新增：執行倒數計時
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0 || roomData?.status !== 'playing') return;
    const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, roomData?.status]);

  // ✨ 4. 新增：超時自動強制停牌 (加入 1.5 秒視覺緩衝)
  const isMyTurn = roomData?.status === 'playing' && roomData?.turn === username;
  // ✨ 修復陷阱 1：偵測時間到，單純改變 UI 狀態
  useEffect(() => {
    if (timeLeft === 0 && isMyTurn && !isAutoStanding) {
      setIsAutoStanding(true);
    }
  }, [timeLeft, isMyTurn, isAutoStanding]);

  // ✨ 修復陷阱 2：獨立的計時器，專門監聽 isAutoStanding
  useEffect(() => {
    if (isAutoStanding) {
      const timer = setTimeout(() => {
        stand(); // 1.5 秒後執行停牌
      }, 1500);
      
      // 因為這個 useEffect 只有在 isAutoStanding 改變時才會重跑，所以它絕對不會被提前殺死！
      return () => clearTimeout(timer);
    }
  }, [isAutoStanding, stand]);


  const handleSendEmoji = (emoji) => {
    sendEmoji(emoji);
    setShowEmojiPicker(false);
  };

  const handleLeaveGame = () => {
    if (window.confirm("⚠️ 確定要離開房間嗎？")) {
      leaveRoom();
      navigate('/');
    }
  };

  const isOwner = roomData?.owner === username;
  const me = useMemo(() => roomData?.players.find(p => p.name === username), [roomData, username]);
  const opponents = useMemo(() => roomData?.players.filter(p => p.name !== username) || [], [roomData, username]);
  const dealer = roomData?.dealer;
  const isPlaying = roomData?.status === 'playing' || roomData?.status === 'showdown';
  
  const isRotateDealer = roomData?.settings?.rotateDealer;
  const notEnoughPlayers = isRotateDealer && roomData?.players?.length < 2;
  const amIDealer = roomData?.dealerName === username;

  const renderCard = (card, idx, isPlaceholder = false) => {
    if (isPlaceholder) {
      return (
        <div key={`ph-${idx}`} style={{
          width: '60px', height: '90px', margin: '0 -15px', borderRadius: '6px', zIndex: idx,
          border: '2px dashed rgba(255,255,255,0.3)', backgroundColor: 'rgba(0,0,0,0.2)', position: 'relative'
        }} />
      );
    }
    if (!card || card.isHidden) {
      return (
        <div key={idx} style={{
          width: '60px', height: '90px', margin: '0 -15px', borderRadius: '6px', zIndex: idx,
          background: 'repeating-linear-gradient(45deg, #0d47a1, #0d47a1 10px, #1976d2 10px, #1976d2 20px)',
          border: '2px solid white', boxShadow: '2px 2px 5px rgba(0,0,0,0.3)', position: 'relative'
        }} />
      );
    }
    return (
      <div key={idx} style={{
        width: '60px', height: '90px', margin: '0 -15px', borderRadius: '6px', zIndex: idx,
        backgroundColor: 'white', color: card.color === 'red' ? '#d32f2f' : '#212121',
        display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
        fontWeight: 'bold', fontSize: '1.2rem', border: '1px solid #ccc',
        boxShadow: '2px 2px 5px rgba(0,0,0,0.3)', position: 'relative'
      }}>
        <div>{card.rank}</div>
        <div style={{ fontSize: '1.5rem' }}>{card.suit}</div>
      </div>
    );
  };

  const renderEmojiBubble = (playerName) => {
    if (!activeEmojis[playerName]) return null;
    return (
      <div style={{
        position: 'absolute', top: '-45px', left: '50%', transform: 'translateX(-50%)',
        background: 'white', padding: '4px 12px', borderRadius: '20px',
        fontSize: '2rem', boxShadow: '0 4px 10px rgba(0,0,0,0.3)', zIndex: 50,
        animation: 'fadeUp 0.2s ease-out'
      }}>
        {activeEmojis[playerName]}
        <div style={{ position: 'absolute', bottom: '-8px', left: '50%', transform: 'translateX(-50%)', borderTop: '8px solid white', borderLeft: '8px solid transparent', borderRight: '8px solid transparent' }} />
      </div>
    );
  };

  if (!roomId) {
    return (
      // ✨ 統一採用深色背景
      <div style={{ minHeight: '100vh', backgroundColor: '#121212', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '16px' }}>
        <BlackjackLobby onCreateRoom={createRoom} onJoinRoom={joinRoom} onBack={() => navigate('/')} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#1a4f2c', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px', position: 'relative' }}>
      
      {/* 頂部狀態列 (同步套用鬥牛的防擠壓排版) */}
      <header style={{ 
        width: '100%', maxWidth: '900px', display: 'flex', justifyContent: 'space-between', 
        alignItems: 'center', padding: '10px 5px', backgroundColor: 'rgba(0,0,0,0.3)', 
        borderRadius: '8px', marginBottom: '10px', gap: '5px' 
      }}>
        
        {/* 左側：離開按鈕 */}
        <button onClick={handleLeaveGame} style={{ 
          padding: '6px 10px', background: '#dc3545', color: 'white', 
          borderRadius: '6px', border: 'none', fontWeight: 'bold', 
          cursor: 'pointer', whiteSpace: 'nowrap', fontSize: '0.9rem', flexShrink: 0 
        }}>
          ← 離開
        </button>
        
        {/* 中間：房間與房主資訊 (防擠壓) */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: 0, margin: '0 5px' }}>
          <div style={{ fontWeight: 'bold', color: '#ffd700', fontSize: '1rem', whiteSpace: 'nowrap' }}>
            房間: {roomId}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#ffea00', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
            (房主: {isOwner ? '你' : roomData?.owner?.split('@')[0]})
          </div>
        </div>
        
        {/* 右側：規則按鈕 */}
        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, gap: '6px' }}>
          
          {/* ✨ BGM 控制按鈕 (跟鬥牛的樣式完全統一) */}
          <button 
            onClick={toggleBgm} 
            style={{ 
              padding: '6px 8px', background: isBgmPlaying ? '#4caf50' : '#666',
              color: 'white', borderRadius: '20px', border: 'none', 
              fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap', fontSize: '0.85rem',
              boxShadow: isBgmPlaying ? '0 0 10px rgba(76, 175, 80, 0.5)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            {isBgmPlaying ? '🔊' : '🔇'} BGM
          </button>

          <button onClick={() => setShowRules(true)} style={{ padding: '6px 10px', background: '#2196F3', color: 'white', borderRadius: '20px', border: 'none', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap', fontSize: '0.9rem' }}>
            ❓ 規則
          </button>
        </div>
      </header>
      {roomData?.status === 'playing' && (
        <div style={{
          width: '100%', maxWidth: '900px', 
          background: 'linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.5) 50%, rgba(0,0,0,0) 100%)',
          padding: '8px 0', marginBottom: '15px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px'
        }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#fff', textShadow: '1px 1px 2px #000' }}>
            👉 現在輪到: <span style={{ color: '#00e676', fontSize: '0.8rem' }}>
              {roomData.turn === 'dealer' ? '莊家結算中...' : roomData.turn.split('@')[0]}
            </span>
          </div>

          {timeLeft !== null && roomData.turn !== 'dealer' && (
            <div style={{ 
              fontSize: '0.8rem', fontWeight: 'bold', 
              color: timeLeft <= 5 ? '#ff1744' : '#ffd700',
              textShadow: '1px 1px 2px #000'
            }}>
              ⏱️ {timeLeft}s
            </div>
          )}
        </div>
      )}

      <div style={{ width: '100%', maxWidth: '900px', flex: 1, background: 'radial-gradient(circle, #226b3a 0%, #11361c 100%)', border: '10px solid #4a2e15', borderRadius: '20px', padding: '20px', boxShadow: 'inset 0 0 50px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        
        {/* 中央區域 */}
        <div style={{ textAlign: 'center', color: 'white', minHeight: roomData?.status === 'waiting' ? '150px' : '20px' }}>
          {isPlaying && roomData.dealerName === 'System' && (
            <>
              <h3 style={{ margin: '0 0 10px 0', color: '#ffd700' }}>👑 系統莊家</h3>
              <div style={{ display: 'flex', justifyContent: 'center', paddingLeft: '15px' }}>
                {dealer?.hand.map((card, idx) => renderCard(card, idx))}
              </div>
              <div style={{ background: 'rgba(0,0,0,0.7)', color: '#9e9e9e', padding: '4px 12px', borderRadius: '15px', border: '1px solid #9e9e9e', fontSize: '1rem', marginTop: '10px', display: 'inline-block' }}>
                點數：{dealer?.score} {roomData.status === 'playing' ? '+ ?' : ''}
              </div>
            </>
          )}
          
          {!isPlaying && roomData?.status === 'waiting' && isOwner && (
            <div style={{ marginTop: '40px' }}>
              <button 
                onClick={() => startGame()} 
                disabled={notEnoughPlayers}
                style={{ 
                  padding: '12px 40px', background: notEnoughPlayers ? '#9e9e9e' : 'linear-gradient(to bottom, #fbc02d, #f57f17)', 
                  color: notEnoughPlayers ? '#666' : '#3e2723', border: 'none', borderRadius: '25px', fontSize: '1.2rem', 
                  fontWeight: 'bold', cursor: notEnoughPlayers ? 'not-allowed' : 'pointer',
                  boxShadow: (!notEnoughPlayers && glow) ? '0 0 20px rgba(255, 215, 0, 0.8)' : '0 4px 6px rgba(0,0,0,0.3)',
                  transition: 'box-shadow 0.4s ease-in-out'
                }}
              >
                🎮 開始發牌
              </button>
              <div style={{ color: notEnoughPlayers ? '#ff1744' : '#ffd700', marginTop: '10px', fontSize: '0.9rem', fontWeight: 'bold' }}>
                {notEnoughPlayers ? '⚠️ 輪流做莊模式至少需要 2 人' : '點擊開始為所有玩家發牌'}
              </div>
            </div>
          )}
          {!isPlaying && roomData?.status === 'waiting' && !isOwner && (
            <div style={{ marginTop: '50px', fontSize: '1.2rem', color: '#ccc' }}>等待房主開始遊戲...</div>
          )}
        </div>

        {/* 對手區域 */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '40px', flexWrap: 'wrap', minHeight: '120px' }}>
          {opponents.map((opp) => {
            const isThisOppDealer = roomData.dealerName === opp.name;
            const oppHand = isThisOppDealer ? dealer?.hand : opp.hand;
            const oppScore = isThisOppDealer ? dealer?.score : opp.score;

            return (
              <div key={opp.name} style={{ textAlign: 'center', color: 'white', position: 'relative', background: roomData?.turn === opp.name ? 'rgba(255,215,0,0.1)' : 'transparent', padding: '10px', borderRadius: '10px', border: isThisOppDealer ? '2px solid #ffd700' : '2px solid transparent' }}>
                {renderEmojiBubble(opp.name)}
                <h4 style={{ margin: '0 0 5px 0', color: isThisOppDealer ? '#ffd700' : 'white' }}>
                  {isThisOppDealer && '👑 '} {opp.name.split('@')[0]} 💰 {opp.chips}
                </h4>
                <div style={{ display: 'flex', justifyContent: 'center', paddingLeft: '15px' }}>
                  {roomData.status === 'waiting' 
                    ? [0, 1].map(idx => renderCard(null, idx, true))
                    : oppHand?.map((card, idx) => renderCard(card, idx))
                  }
                </div>
                {roomData.status === 'showdown' && opp.result ? (
                  <div style={{ color: opp.scoreChange > 0 ? '#00e676' : (opp.scoreChange < 0 ? '#ff1744' : '#ccc'), fontWeight: 'bold', marginTop: '5px' }}>
                    {opp.result}
                  </div>
                ) : (
                  isPlaying && (
                    <div style={{ color: '#ccc', fontSize: '0.9rem', marginTop: '5px' }}>
                      點數：{oppScore > 0 ? oppScore : 0} {roomData.status === 'playing' ? ' + ?' : ''}
                    </div>
                  )
                )}
              </div>
            );
          })}
        </div>

        {/* 玩家自己的區域 */}
        {me && (
          <div style={{ textAlign: 'center', color: 'white', background: 'rgba(0,0,0,0.4)', padding: '15px', borderRadius: '15px', border: isMyTurn ? '3px solid #00e676' : (amIDealer ? '2px solid #ffd700' : '2px solid transparent'), position: 'relative' }}>
            {renderEmojiBubble(me.name)}
            
            <h2 style={{ margin: '0 0 10px 0', color: amIDealer ? '#ffd700' : 'white' }}>
              {amIDealer && '👑 '} 你的手牌 💰 {me.chips}
            </h2>
            
            <div style={{ display: 'flex', justifyContent: 'center', paddingLeft: '15px', minHeight: '100px' }}>
              {roomData.status === 'waiting' 
                ? [0, 1].map(idx => renderCard(null, idx, true))
                : (amIDealer ? dealer?.hand : me.hand)?.map((card, idx) => renderCard(card, idx))
              }
            </div>
            
            {roomData.status === 'showdown' && me.result ? (
              <div style={{ background: 'rgba(0,0,0,0.8)', color: me.scoreChange > 0 ? '#00e676' : (me.scoreChange < 0 ? '#ff1744' : '#fff'), padding: '6px 16px', borderRadius: '20px', border: `2px solid ${me.scoreChange > 0 ? '#00e676' : (me.scoreChange < 0 ? '#ff1744' : '#fff')}`, fontSize: '1.2rem', fontWeight: 'bold', marginTop: '10px', display: 'inline-block' }}>
                {me.result} 
              </div>
            ) : (
              isPlaying && (
                <div style={{ background: 'rgba(0,0,0,0.7)', color: (amIDealer ? dealer?.score : me.score) > 21 ? '#ff1744' : '#00e676', padding: '4px 12px', borderRadius: '15px', border: `1px solid ${(amIDealer ? dealer?.score : me.score) > 21 ? '#ff1744' : '#00e676'}`, fontSize: '1rem', marginTop: '10px', display: 'inline-block' }}>
                  點數：{(amIDealer ? dealer?.score : me.score) > 0 ? (amIDealer ? dealer?.score : me.score) : 0} 
                  {roomData.status === 'playing' ? ' + ?' : ''}
                  {(!amIDealer || roomData.turn === 'dealer') && (amIDealer ? dealer?.score : me.score) > 21 && '(爆牌)'}
                </div>
              )
            )}

            {amIDealer && isPlaying && (
              <div style={{ marginTop: '15px', color: '#ffd700', fontSize: '1.1rem', fontWeight: 'bold', textShadow: '1px 1px 2px black' }}>
                {roomData.turn === 'dealer' 
                  ? '🤖 系統正依據規則，為您自動補牌結算中...' 
                  : '⏳ 莊家請稍候，等待閒家行動完畢...'}
              </div>
            )}

            {/* ✨ 超時狀態提示 */}
            {isAutoStanding && (
              <div style={{ color: '#ff1744', marginTop: '15px', fontSize: '1.1rem', fontWeight: 'bold' }}>
                ⏰ 思考時間到！系統即將強制停牌...
              </div>
            )}

            {/* ✨ 只有在未超時的狀態下，才顯示操作按鈕 */}
            {isMyTurn && !amIDealer && !isAutoStanding && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '15px', flexWrap: 'wrap' }}>
                <button onClick={() => hit()} style={{ background: '#4caf50', color: 'white', padding: '10px 20px', borderRadius: '25px', border: 'none', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}>👉 要牌 (Hit)</button>
                <button onClick={() => stand()} style={{ background: '#f44336', color: 'white', padding: '10px 20px', borderRadius: '25px', border: 'none', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}>✋ 停牌 (Stand)</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ✨ 右下角懸浮表情按鈕 (Floating Action Button) - 同步鬥牛樣式 */}
      <div style={{ position: 'fixed', bottom: '25px', right: '25px', zIndex: 100 }}>
        {showEmojiPicker && (
          <div style={{
            position: 'absolute', bottom: '100%', right: 0, marginBottom: '15px',
            background: 'white', padding: '10px', borderRadius: '12px',
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
          }}>
            {EMOJI_LIST.map(e => (
              <button 
                key={e} onClick={() => handleSendEmoji(e)}
                style={{ fontSize: '1.8rem', background: 'transparent', border: 'none', cursor: 'pointer', padding: '5px', borderRadius: '8px', transition: 'background 0.2s' }}
                onMouseOver={(e) => e.target.style.background = '#f0f0f0'}
                onMouseOut={(e) => e.target.style.background = 'transparent'}
              >
                {e}
              </button>
            ))}
          </div>
        )}
        <button 
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          style={{ 
            width: '60px', height: '60px', borderRadius: '30px', 
            background: '#ff9800', color: 'white', border: 'none', 
            fontSize: '2rem', display: 'flex', justifyContent: 'center', alignItems: 'center',
            boxShadow: '0 4px 10px rgba(0,0,0,0.5)', cursor: 'pointer',
            transition: 'transform 0.2s'
          }}
          onMouseOver={(e) => e.target.style.transform = 'scale(1.1)'}
          onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
        >
          😀
        </button>
      </div>

      {/* 規則彈窗 */}
      {showRules && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: '#1a4f2c', border: '4px solid #ffd700', borderRadius: '15px', padding: '25px', maxWidth: '500px', width: '90%', color: 'white', position: 'relative', maxHeight: '80vh', overflowY: 'auto' }}>
            <button onClick={() => setShowRules(false)} style={{ position: 'absolute', top: '10px', right: '15px', background: 'transparent', border: 'none', color: 'white', fontSize: '1.5rem', cursor: 'pointer' }}>✖</button>
            <h2 style={{ color: '#ffd700', textAlign: 'center', marginTop: 0 }}>📜 21點 (Blackjack) 規則</h2>
            <div style={{ lineHeight: 1.6 }}>
              <p><strong>【核心目標】</strong> 讓手中牌的點數總和比莊家更接近 21點，且絕對不能超過 21點（爆牌）。</p>
              <h3 style={{ color: '#00e676', borderBottom: '1px solid #00e676' }}>🔢 點數計算</h3>
              <ul><li><strong>2-10:</strong> 依照牌面數字計算。</li><li><strong>J、Q、K:</strong> 一律計為 10點。</li><li><strong>A (Ace):</strong> 可靈活記為 1點 或 11點。系統會自動幫您選擇最有利的點數。</li></ul>
              <h3 style={{ color: '#00e676', borderBottom: '1px solid #00e676' }}>🤖 莊家規則與賠率</h3>
              <p>莊家未滿 <strong>17點</strong> 必須要牌；達到 <strong>17點(含)以上</strong> 必須停牌。無論是系統當莊還是玩家輪流當莊，皆受此嚴格限制。</p>
              <ul><li><strong>Blackjack:</strong> 起手 A + 10點牌，贏得 1.5 倍獎金！</li><li><strong>平手 (Push):</strong> 點數與莊家相同，退回本金。</li></ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}