import React, { useState, useMemo, useEffect } from 'react';
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
  const isMyTurn = roomData?.status === 'playing' && roomData?.turn === username;
  
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
      <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6', padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: '100%', maxWidth: '800px', marginBottom: '16px' }}>
          <button onClick={() => navigate('/')} style={{ padding: '8px 16px', background: '#dc3545', color: 'white', borderRadius: '4px', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>← 返回聊天室</button>
        </div>
        <BlackjackLobby onCreateRoom={createRoom} onJoinRoom={joinRoom} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#1a4f2c', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px' }}>
      
      <header style={{ width: '100%', maxWidth: '900px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', backgroundColor: 'rgba(0,0,0,0.8)', borderRadius: '8px', marginBottom: '10px' }}>
        <button onClick={handleLeaveGame} style={{ padding: '8px 16px', background: '#dc3545', color: 'white', borderRadius: '6px', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>← 離開</button>
        <div style={{ fontWeight: 'bold', color: '#ffd700', fontSize: '1.2rem' }}>
          房間: {roomId} {isOwner && '(房主)'}
        </div>
        
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', position: 'relative' }}>
          {roomData?.status === 'playing' && roomData.turn !== 'dealer' && (
            <span style={{ color: '#00e676', fontWeight: 'bold' }}>輪到: {roomData.turn.split('@')[0]}</span>
          )}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} style={{ padding: '6px 12px', background: '#ff9800', color: 'white', borderRadius: '20px', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>😀 表情</button>
            {showEmojiPicker && (
              <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '10px', background: 'white', padding: '10px', borderRadius: '12px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.3)', zIndex: 100 }}>
                {EMOJI_LIST.map(e => <button key={e} onClick={() => handleSendEmoji(e)} style={{ fontSize: '1.5rem', background: 'transparent', border: 'none', cursor: 'pointer', padding: '5px' }}>{e}</button>)}
              </div>
            )}
          </div>
          <button onClick={() => setShowRules(true)} style={{ padding: '6px 12px', background: '#2196F3', color: 'white', borderRadius: '20px', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>❓ 規則</button>
        </div>
      </header>

      <div style={{ width: '100%', maxWidth: '900px', flex: 1, background: 'radial-gradient(circle, #226b3a 0%, #11361c 100%)', border: '10px solid #4a2e15', borderRadius: '20px', padding: '20px', boxShadow: 'inset 0 0 50px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        
        {/* 1. 中央區域 (系統莊家 或 等待開始按鈕) */}
        <div style={{ textAlign: 'center', color: 'white', minHeight: roomData?.status === 'waiting' ? '150px' : '20px' }}>
          {/* ✨ 只有當莊家是「System」時，才在最上方顯示手牌 */}
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

        {/* 2. 對手區域 */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '40px', flexWrap: 'wrap', minHeight: '120px' }}>
          {opponents.map((opp) => {
            // ✨ 動態判定這個對手是不是莊家，如果是，就把 dealer 的牌給他
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

        {/* 3. 玩家自己的區域 */}
        {me && (
          <div style={{ textAlign: 'center', color: 'white', background: 'rgba(0,0,0,0.4)', padding: '15px', borderRadius: '15px', border: isMyTurn ? '3px solid #00e676' : (amIDealer ? '2px solid #ffd700' : '2px solid transparent'), position: 'relative' }}>
            {renderEmojiBubble(me.name)}
            
            <h2 style={{ margin: '0 0 10px 0', color: amIDealer ? '#ffd700' : 'white' }}>
              {amIDealer && '👑 '} 你的手牌 💰 {me.chips}
            </h2>
            
            <div style={{ display: 'flex', justifyContent: 'center', paddingLeft: '15px', minHeight: '100px' }}>
              {/* ✨ 如果自己是莊家，直接顯示 dealer 的牌 */}
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

            {/* ✨ 彌補莊家不能操作的 UX 提示 */}
            {amIDealer && isPlaying && (
              <div style={{ marginTop: '15px', color: '#ffd700', fontSize: '1.1rem', fontWeight: 'bold', textShadow: '1px 1px 2px black' }}>
                {roomData.turn === 'dealer' 
                  ? '🤖 系統正依據規則，為您自動補牌結算中...' 
                  : '⏳ 莊家請稍候，等待閒家行動完畢...'}
              </div>
            )}

            {isMyTurn && !amIDealer && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '15px', flexWrap: 'wrap' }}>
                <button onClick={() => hit()} style={{ background: '#4caf50', color: 'white', padding: '10px 20px', borderRadius: '25px', border: 'none', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}>👉 要牌 (Hit)</button>
                <button onClick={() => stand()} style={{ background: '#f44336', color: 'white', padding: '10px 20px', borderRadius: '25px', border: 'none', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}>✋ 停牌 (Stand)</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 規則彈窗 (略) */}
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