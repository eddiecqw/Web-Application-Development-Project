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
  
  const [isBgmPlaying, setIsBgmPlaying] = useState(false);
  const bgmRef = useRef(new Audio('/audio/The_Felt_Table.mp3'));

  const [timeLeft, setTimeLeft] = useState(null);
  const [lastTurn, setLastTurn] = useState(null);
  const [isAutoStanding, setIsAutoStanding] = useState(false);

  useEffect(() => {
    const audio = bgmRef.current;
    audio.loop = true; audio.volume = 0.4;
    return () => { audio.pause(); audio.currentTime = 0; };
  }, []);

  const toggleBgm = () => {
    const audio = bgmRef.current;
    if (isBgmPlaying) audio.pause();
    else audio.play().catch(e => console.error("音樂播放失敗:", e));
    setIsBgmPlaying(!isBgmPlaying);
  };

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
      setTimeout(() => setActiveEmojis(prev => { const n = { ...prev }; delete n[data.username]; return n; }), 3000);
    }
  });

  useEffect(() => {
    if (roomData?.status === 'playing' && roomData.turn !== lastTurn) {
      setLastTurn(roomData.turn);
      setIsAutoStanding(false); 
      if (roomData.turn !== 'dealer') setTimeLeft(roomData.settings?.timeLimit || 30);
      else setTimeLeft(null);
    } else if (roomData?.status !== 'playing') {
      setTimeLeft(null); setLastTurn(null); setIsAutoStanding(false);
    }
  }, [roomData?.status, roomData?.turn, roomData?.settings?.timeLimit, lastTurn]);

  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0 || roomData?.status !== 'playing') return;
    const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, roomData?.status]);

  const isMyTurn = roomData?.status === 'playing' && roomData?.turn === username;
  
  useEffect(() => {
    if (timeLeft === 0 && isMyTurn && !isAutoStanding) setIsAutoStanding(true);
  }, [timeLeft, isMyTurn, isAutoStanding]);

  useEffect(() => {
    if (isAutoStanding) {
      const timer = setTimeout(() => stand(), 1500);
      return () => clearTimeout(timer);
    }
  }, [isAutoStanding, stand]);

  const handleSendEmoji = (emoji) => {
    sendEmoji(emoji); setShowEmojiPicker(false);
  };

  const handleLeaveGame = () => {
    if (window.confirm("⚠️ 確定要離開房間嗎？")) { leaveRoom(); navigate('/'); }
  };

  const isOwner = roomData?.owner === username;
  const me = useMemo(() => roomData?.players.find(p => p.name === username), [roomData, username]);
  const opponents = useMemo(() => roomData?.players.filter(p => p.name !== username) || [], [roomData, username]);
  const dealer = roomData?.dealer;
  const isPlaying = roomData?.status === 'playing' || roomData?.status === 'showdown';
  const isRotateDealer = roomData?.settings?.rotateDealer;
  const notEnoughPlayers = isRotateDealer && roomData?.players?.length < 2;
  const amIDealer = roomData?.dealerName === username;

  // ✨ 取得正在回合玩家的暱稱
  const getTurnDisplayName = () => {
    if (roomData?.turn === 'dealer') return '莊家結算中...';
    const turnPlayer = roomData?.players?.find(p => p.name === roomData.turn);
    return turnPlayer?.nickname || roomData?.turn?.split('@')[0];
  };

  // ✨ 調整卡牌尺寸適應手機
  const renderCard = (card, idx, isPlaceholder = false) => {
    const cardStyle = {
      width: '45px', height: '65px', margin: '0 -15px', borderRadius: '4px', zIndex: idx,
      boxShadow: '1px 1px 4px rgba(0,0,0,0.4)', position: 'relative'
    };
    if (isPlaceholder) return <div key={`ph-${idx}`} style={{ ...cardStyle, border: '2px dashed rgba(255,255,255,0.3)', backgroundColor: 'rgba(0,0,0,0.2)' }} />;
    if (!card || card.isHidden) return <div key={idx} style={{ ...cardStyle, background: 'repeating-linear-gradient(45deg, #0d47a1, #0d47a1 8px, #1976d2 8px, #1976d2 16px)', border: '1px solid white' }} />;
    
    return (
      <div key={idx} style={{ ...cardStyle, backgroundColor: 'white', color: card.color === 'red' ? '#d32f2f' : '#212121', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', fontSize: '1rem', border: '1px solid #ccc' }}>
        <div style={{ lineHeight: '1' }}>{card.rank}</div>
        <div style={{ fontSize: '1.2rem', lineHeight: '1' }}>{card.suit}</div>
      </div>
    );
  };

  if (!roomId) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#121212', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '16px' }}>
        <BlackjackLobby onCreateRoom={createRoom} onJoinRoom={joinRoom} onBack={() => navigate('/')} username={user.email} />
      </div>
    );
  }

  return (
    // ✨ 外層滿版深色，內部統一 maxWidth 450px 居中
    <div style={{ minHeight: '100vh', backgroundColor: '#121212', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '5px', color: 'white' }}>
      
      {/* 頂部 Header */}
      <header style={{ width: '100%', maxWidth: '450px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '8px', marginBottom: '8px', boxSizing: 'border-box' }}>
        <button onClick={handleLeaveGame} style={{ padding: '6px 10px', background: '#dc3545', color: 'white', borderRadius: '6px', border: 'none', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>← 離開</button>
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{ fontWeight: 'bold', color: '#ffd700', fontSize: '0.9rem' }}>房間: {roomId}</div>
        </div>
        <div style={{ display: 'flex', gap: '5px' }}>
          <button onClick={toggleBgm} style={{ padding: '6px 8px', background: isBgmPlaying ? '#4caf50' : '#666', color: 'white', borderRadius: '6px', border: 'none', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>{isBgmPlaying ? '🔊' : '🔇'}</button>
          <button onClick={() => setShowRules(true)} style={{ padding: '6px 8px', background: '#2196F3', color: 'white', borderRadius: '6px', border: 'none', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>❓</button>
        </div>
      </header>

      {/* 回合提示 */}
      {roomData?.status === 'playing' && (
        <div style={{ width: '100%', maxWidth: '450px', background: 'linear-gradient(90deg, transparent, rgba(0,230,118,0.2), transparent)', padding: '5px 0', marginBottom: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>👉 輪到: <span style={{ color: '#00e676' }}>{getTurnDisplayName()}</span></div>
          {timeLeft !== null && roomData.turn !== 'dealer' && (
            <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: timeLeft <= 5 ? '#ff1744' : '#ffd700' }}>⏱️ {timeLeft}s</div>
          )}
        </div>
      )}

      {/* 🎰 虛擬主牌桌 (MaxWidth: 450px) */}
      <div style={{ width: '100%', maxWidth: '450px', flex: 1, background: 'radial-gradient(circle, #226b3a 0%, #11361c 100%)', border: '6px solid #4a2e15', borderRadius: '15px', padding: '15px', boxSizing: 'border-box', boxShadow: 'inset 0 0 30px rgba(0,0,0,0.8)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        
        {/* 莊家區塊 */}
        <div style={{ textAlign: 'center', minHeight: '80px', marginBottom: '10px' }}>
          {isPlaying && roomData.dealerName === 'System' && (
            <>
              <h3 style={{ margin: '0 0 5px 0', color: '#ffd700', fontSize: '1rem' }}>👑 系統莊家</h3>
              <div style={{ display: 'flex', justifyContent: 'center', paddingLeft: '10px' }}>
                {dealer?.hand.map((card, idx) => renderCard(card, idx))}
              </div>
              <div style={{ background: 'rgba(0,0,0,0.6)', color: '#ccc', padding: '2px 10px', borderRadius: '10px', fontSize: '0.8rem', marginTop: '5px', display: 'inline-block' }}>
                點數：{dealer?.score} {roomData.status === 'playing' ? '+ ?' : ''}
              </div>
            </>
          )}
          {!isPlaying && roomData?.status === 'waiting' && (
            isOwner ? (
              <div style={{ marginTop: '20px' }}>
                <button onClick={() => startGame()} disabled={notEnoughPlayers} style={{ padding: '10px 30px', background: notEnoughPlayers ? '#9e9e9e' : 'linear-gradient(to bottom, #fbc02d, #f57f17)', color: '#3e2723', border: 'none', borderRadius: '20px', fontSize: '1rem', fontWeight: 'bold', cursor: notEnoughPlayers ? 'not-allowed' : 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}>🎮 開始發牌</button>
                {notEnoughPlayers && <div style={{ color: '#ff1744', marginTop: '8px', fontSize: '0.8rem' }}>⚠️ 輪流做莊需至少2人</div>}
              </div>
            ) : <div style={{ marginTop: '30px', color: '#ccc', fontSize: '0.9rem' }}>等待房主開始...</div>
          )}
        </div>

        {/* 對手區域 (網格排列，適應窄螢幕) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '15px' }}>
          {opponents.map((opp) => {
            const isThisOppDealer = roomData.dealerName === opp.name;
            const oppHand = isThisOppDealer ? dealer?.hand : opp.hand;
            const oppScore = isThisOppDealer ? dealer?.score : opp.score;

            return (
              <div key={opp.name} style={{ textAlign: 'center', background: roomData?.turn === opp.name ? 'rgba(255,215,0,0.15)' : 'rgba(0,0,0,0.3)', padding: '8px', borderRadius: '10px', border: isThisOppDealer ? '1px solid #ffd700' : '1px solid transparent', position: 'relative' }}>
                {activeEmojis[opp.name] && <div style={{ position: 'absolute', top: '-25px', left: '50%', transform: 'translateX(-50%)', fontSize: '1.5rem', zIndex: 10 }}>{activeEmojis[opp.name]}</div>}
                
                {/* ✨ 顯示對手暱稱 */}
                <div style={{ margin: '0 0 5px 0', fontSize: '0.85rem', color: isThisOppDealer ? '#ffd700' : 'white', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {isThisOppDealer && '👑 '} {opp.nickname || opp.name.split('@')[0]}
                  <div style={{ color: '#fcd34d', fontSize: '0.75rem' }}>💰 {opp.chips}</div>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'center', paddingLeft: '10px' }}>
                  {roomData.status === 'waiting' ? [0, 1].map(idx => renderCard(null, idx, true)) : oppHand?.map((card, idx) => renderCard(card, idx))}
                </div>
                
                {roomData.status === 'showdown' && opp.result ? (
                  <div style={{ color: opp.scoreChange > 0 ? '#00e676' : (opp.scoreChange < 0 ? '#ff1744' : '#ccc'), fontWeight: 'bold', marginTop: '5px', fontSize: '0.8rem' }}>{opp.result}</div>
                ) : (
                  isPlaying && <div style={{ color: '#ccc', fontSize: '0.75rem', marginTop: '5px' }}>點數：{oppScore || 0}{roomData.status === 'playing' ? ' + ?' : ''}</div>
                )}
              </div>
            );
          })}
        </div>

        {/* 玩家自己的區域 */}
        {me && (
          <div style={{ textAlign: 'center', background: 'rgba(0,0,0,0.5)', padding: '12px', borderRadius: '12px', border: isMyTurn ? '2px solid #00e676' : (amIDealer ? '2px solid #ffd700' : 'none'), position: 'relative' }}>
            {activeEmojis[me.name] && <div style={{ position: 'absolute', top: '-30px', left: '50%', transform: 'translateX(-50%)', fontSize: '1.8rem', zIndex: 10 }}>{activeEmojis[me.name]}</div>}
            
            {/* ✨ 顯示自己暱稱 */}
            <div style={{ margin: '0 0 8px 0', fontSize: '1rem', fontWeight: 'bold', color: amIDealer ? '#ffd700' : 'white' }}>
              {amIDealer && '👑 '} {me.nickname || me.name.split('@')[0]} <span style={{ color: '#fcd34d' }}>💰 {me.chips}</span>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'center', paddingLeft: '10px', minHeight: '70px' }}>
              {roomData.status === 'waiting' ? [0, 1].map(idx => renderCard(null, idx, true)) : (amIDealer ? dealer?.hand : me.hand)?.map((card, idx) => renderCard(card, idx))}
            </div>
            
            {roomData.status === 'showdown' && me.result ? (
              <div style={{ background: 'rgba(0,0,0,0.8)', color: me.scoreChange > 0 ? '#00e676' : (me.scoreChange < 0 ? '#ff1744' : '#fff'), padding: '4px 12px', borderRadius: '15px', border: `1px solid ${me.scoreChange > 0 ? '#00e676' : (me.scoreChange < 0 ? '#ff1744' : '#fff')}`, fontSize: '1rem', fontWeight: 'bold', marginTop: '8px', display: 'inline-block' }}>
                {me.result} 
              </div>
            ) : (
              isPlaying && (
                <div style={{ background: 'rgba(0,0,0,0.7)', color: (amIDealer ? dealer?.score : me.score) > 21 ? '#ff1744' : '#00e676', padding: '3px 10px', borderRadius: '10px', border: `1px solid ${(amIDealer ? dealer?.score : me.score) > 21 ? '#ff1744' : '#00e676'}`, fontSize: '0.85rem', marginTop: '8px', display: 'inline-block' }}>
                  點數：{(amIDealer ? dealer?.score : me.score) || 0} {roomData.status === 'playing' ? ' + ?' : ''} {(!amIDealer || roomData.turn === 'dealer') && (amIDealer ? dealer?.score : me.score) > 21 && '(爆牌)'}
                </div>
              )
            )}

            {isAutoStanding && <div style={{ color: '#ff1744', marginTop: '10px', fontSize: '0.9rem', fontWeight: 'bold' }}>⏰ 超時！強制停牌...</div>}

            {isMyTurn && !amIDealer && !isAutoStanding && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginTop: '12px' }}>
                <button onClick={() => hit()} style={{ background: '#4caf50', color: 'white', padding: '8px 20px', borderRadius: '20px', border: 'none', fontWeight: 'bold', fontSize: '0.95rem', cursor: 'pointer' }}>👉 要牌</button>
                <button onClick={() => stand()} style={{ background: '#f44336', color: 'white', padding: '8px 20px', borderRadius: '20px', border: 'none', fontWeight: 'bold', fontSize: '0.95rem', cursor: 'pointer' }}>✋ 停牌</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 表情包與規則 */}
      <div style={{ position: 'fixed', bottom: '20px', right: '15px', zIndex: 50 }}>
        {showEmojiPicker && (
          <div style={{ position: 'absolute', bottom: '100%', right: 0, marginBottom: '10px', background: 'white', padding: '8px', borderRadius: '10px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '5px', boxShadow: '0 4px 15px rgba(0,0,0,0.3)' }}>
            {EMOJI_LIST.map(e => <button key={e} onClick={() => handleSendEmoji(e)} style={{ fontSize: '1.5rem', background: 'transparent', border: 'none', cursor: 'pointer' }}>{e}</button>)}
          </div>
        )}
        <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} style={{ width: '50px', height: '50px', borderRadius: '25px', background: '#ff9800', color: 'white', border: 'none', fontSize: '1.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.5)' }}>😀</button>
      </div>

      {showRules && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#1a4f2c', border: '3px solid #ffd700', borderRadius: '15px', padding: '20px', maxWidth: '400px', width: '90%', color: 'white', position: 'relative', maxHeight: '80vh', overflowY: 'auto' }}>
            <button onClick={() => setShowRules(false)} style={{ position: 'absolute', top: '5px', right: '10px', background: 'transparent', border: 'none', color: '#fff', fontSize: '1.5rem' }}>✖</button>
            <h2 style={{ color: '#ffd700', textAlign: 'center', margin: '0 0 15px 0', fontSize: '1.3rem' }}>📜 21點 規則</h2>
            <div style={{ lineHeight: 1.5, fontSize: '0.9rem' }}>
              <p>讓手中牌點數比莊家更接近 21點，絕不能超過 21點。</p>
              <h3 style={{ color: '#00e676', borderBottom: '1px solid #00e676', fontSize: '1rem' }}>點數計算</h3>
              <p>J, Q, K = 10點。A = 1點或11點(自動判斷)。</p>
              <h3 style={{ color: '#00e676', borderBottom: '1px solid #00e676', fontSize: '1rem' }}>莊家規則</h3>
              <p>未滿 17點 必須要牌；17點以上 必須停牌。</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}