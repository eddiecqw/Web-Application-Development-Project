import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import useLoveLetterSocket from '../hooks/useLoveLetterSocket';
import LoveLetterLobby from '../components/Game/LoveLetterLobby';

const CARD_DEFINITIONS = [
  { value: 1, name: '衛兵', count: 5, desc: '猜測一名玩家的手牌，猜中則對方出局。' },
  { value: 2, name: '神父', count: 2, desc: '私下看一名玩家的手牌。' },
  { value: 3, name: '男爵', count: 2, desc: '與一名玩家秘密比大小，數字小者出局。' },
  { value: 4, name: '侍女', count: 2, desc: '直到你的下回合前，免疫所有其他玩家的卡牌效果。' },
  { value: 5, name: '王子', count: 2, desc: '指定一名玩家(含自己)棄牌並重抽一張。' },
  { value: 6, name: '國王', count: 1, desc: '與一名玩家交換手牌。' },
  { value: 7, name: '伯爵夫人', count: 1, desc: '若與王子或國王同時在手，必須強制打出此牌。' },
  { value: 8, name: '公主', count: 1, desc: '因任何原因棄掉此牌，你直接出局。' }
];

export default function LoveLetterPage({ user }) {
  const navigate = useNavigate();
  const username = user.email;
  
  const baseWsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:53840/ws';
  const wsUrl = `${baseWsUrl}?username=${encodeURIComponent(username)}`;

  const [showRules, setShowRules] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeEmojis, setActiveEmojis] = useState({});
  const EMOJI_LIST = ['🧐', '🤫', '😱', '😈', '🤡', '😡', '🛡️', '👑'];

  const [pendingCard, setPendingCard] = useState(null); 
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [showGuessModal, setShowGuessModal] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState(null);

  // 動態日誌與歷史紀錄狀態
  const [showLogModal, setShowLogModal] = useState(false);
  const [currentLog, setCurrentLog] = useState('');
  const [logHistory, setLogHistory] = useState([]);

  const [isBgmPlaying, setIsBgmPlaying] = useState(false);
  const bgmRef = useRef(new Audio('/audio/Sealed_With_A_Wax_Crest.mp3'));

  useEffect(() => {
    const audio = bgmRef.current;
    audio.loop = true;
    audio.volume = 0.3;
    return () => { audio.pause(); audio.currentTime = 0; };
  }, []);

  const toggleBgm = () => {
    if (isBgmPlaying) bgmRef.current.pause();
    else bgmRef.current.play().catch(() => {});
    setIsBgmPlaying(!isBgmPlaying);
  };

  const {
    createRoom, joinRoom, startGame, playCard, leaveRoom, sendEmoji, clearPrivateInfo, restartGame,
    gameState: { roomId, roomData, privateInfo }
  } = useLoveLetterSocket(wsUrl, {
    LL_SHOW_EMOJI: (data) => {
      setActiveEmojis(prev => ({ ...prev, [data.username]: data.emoji }));
      setTimeout(() => {
        setActiveEmojis(prev => { const newState = { ...prev }; delete newState[data.username]; return newState; });
      }, 3000);
    }
  });

  // 監聽日誌變化，自動記錄歷史並在超長時彈窗
  useEffect(() => {
    if (roomData?.actionLog && roomData.actionLog !== currentLog) {
      setCurrentLog(roomData.actionLog);
      
      setLogHistory(prev => {
        if (roomData.actionLog === '遊戲開始！') {
          return [roomData.actionLog];
        }
        return [...prev, roomData.actionLog];
      });

      // 如果文字太長，自動彈出完整的歷史紀錄視窗讓玩家看清楚
      if (roomData.actionLog.length > 15) {
        setShowLogModal(true);
      }
    }
  }, [roomData?.actionLog, currentLog]);

  const handleLeaveGame = () => {
    if (window.confirm("⚠️ 確定要離開宮廷嗎？")) {
      leaveRoom();
      navigate('/');
    }
  };

  const isOwner = roomData?.owner === username;
  const me = useMemo(() => roomData?.players.find(p => p.name === username), [roomData, username]);
  const opponents = useMemo(() => roomData?.players.filter(p => p.name !== username) || [], [roomData, username]);
  const isPlaying = roomData?.status === 'playing' || roomData?.status === 'showdown';
  const isMyTurn = roomData?.status === 'playing' && roomData?.turn === username && me?.isAlive;

  const hasCountess = me?.hand?.some(c => c.value === 7);
  const hasKingOrPrince = me?.hand?.some(c => c.value === 5 || c.value === 6);
  const mustPlayCountess = hasCountess && hasKingOrPrince;

  const getValidTargets = (cardValue) => {
    let targets = opponents.filter(p => p.isAlive && !p.isProtected);
    if (cardValue === 5) targets.push(me); 
    return targets;
  };

  const handleCardClick = (card) => {
    if (!isMyTurn) return;
    if (mustPlayCountess && card.value !== 7) {
      alert('⚠️ 你同時持有伯爵夫人與王子/國王，必須強制打出伯爵夫人！');
      return;
    }

    const needsTarget = [1, 2, 3, 5, 6].includes(card.value);
    
    if (needsTarget) {
      const validTargets = getValidTargets(card.value);
      if (validTargets.length === 0) {
        playCard(card.value, null, null);
      } else {
        setPendingCard(card);
        setShowTargetModal(true);
      }
    } else {
      playCard(card.value, null, null);
    }
  };

  const handleTargetSelect = (targetName) => {
    setShowTargetModal(false);
    if (pendingCard.value === 1) {
      setSelectedTarget(targetName);
      setShowGuessModal(true);
    } else {
      playCard(pendingCard.value, targetName, null);
      setPendingCard(null);
    }
  };

  const handleGuessSelect = (guessValue) => {
    setShowGuessModal(false);
    playCard(pendingCard.value, selectedTarget, guessValue);
    setPendingCard(null);
    setSelectedTarget(null);
  };

  // 確保 keyIndex 參數存在，解決 React 渲染警告
  const renderCard = (card, onClick, disabled = false, isPlaceholder = false, keyIndex = 'default') => {
    
    if (isPlaceholder || !card || card.isHidden) {
      return (
        <img 
          key={keyIndex}
          src="/image/loveletter/card_back.jpg" 
          alt="Card Back"
          style={{
            width: '70px', height: '100px', margin: '0 5px', borderRadius: '8px',
            border: '2px solid #fcd34d', boxShadow: '2px 2px 8px rgba(0,0,0,0.5)',
            objectFit: 'cover'
          }}
        />
      );
    }
    
    return (
      <img 
        key={keyIndex}
        src={`/image/loveletter/card_${card.value}.jpg`} 
        alt={card.name}
        onClick={() => !disabled && onClick && onClick(card)}
        style={{
          width: '70px', height: '100px', margin: '0 5px', borderRadius: '8px',
          border: disabled ? '2px solid #ccc' : '2px solid #b45309',
          boxShadow: '2px 2px 8px rgba(0,0,0,0.5)',
          objectFit: 'cover',
          cursor: disabled ? 'not-allowed' : (onClick ? 'pointer' : 'default'),
          opacity: disabled ? 0.6 : 1, transition: 'transform 0.1s',
          transform: (onClick && !disabled) ? 'translateY(-5px)' : 'none'
        }}
        onMouseOver={e => { if (onClick && !disabled) e.currentTarget.style.transform = 'translateY(-10px)'; }}
        onMouseOut={e => { if (onClick && !disabled) e.currentTarget.style.transform = 'translateY(-5px)'; }}
      />
    );
  };

  const getOpponentStyle = (index, total) => {
    const baseStyle = { 
      position: 'absolute', zIndex: 10, display: 'flex', flexDirection: 'column', 
      alignItems: 'center', background: 'rgba(0,0,0,0.4)', padding: '6px', 
      borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', width: '110px'
    };
    if (total === 1) return { ...baseStyle, top: '10px', left: '50%', transform: 'translateX(-50%)' };
    if (total === 2) {
      if (index === 0) return { ...baseStyle, top: '35%', left: '8px', transform: 'translateY(-50%)' };
      if (index === 1) return { ...baseStyle, top: '35%', right: '8px', transform: 'translateY(-50%)' };
    }
    if (total === 3) {
      if (index === 0) return { ...baseStyle, top: '40%', left: '8px', transform: 'translateY(-50%)' };
      if (index === 1) return { ...baseStyle, top: '10px', left: '50%', transform: 'translateX(-50%)' };
      if (index === 2) return { ...baseStyle, top: '40%', right: '8px', transform: 'translateY(-50%)' };
    }
    return baseStyle;
  };

  if (!roomId) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#121212', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '16px' }}>
        <LoveLetterLobby onCreateRoom={createRoom} onJoinRoom={joinRoom} onBack={() => navigate('/')} username={user.email} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#2d0c0c', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '5px' }}>
      
      <header style={{ width: '100%', maxWidth: '900px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 10px', backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: '8px', marginBottom: '5px' }}>
        <button onClick={handleLeaveGame} style={{ padding: '4px 8px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>← 離開</button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 'bold', color: '#fcd34d', fontSize: '0.95rem' }}>房間: {roomId}</div>
          <div style={{ fontSize: '0.75rem', color: '#d1d5db' }}>(目標: {roomData.settings.winTokens} 個)</div>
        </div>
        <div style={{ display: 'flex', gap: '5px' }}>
          <button onClick={toggleBgm} style={{ padding: '4px 8px', background: isBgmPlaying ? '#dc2626' : '#4b5563', color: 'white', borderRadius: '4px', border: 'none', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>{isBgmPlaying ? '🔊' : '🔇'}</button>
          <button onClick={() => setShowRules(true)} style={{ padding: '4px 8px', background: '#2196F3', color: 'white', borderRadius: '4px', border: 'none', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>❓</button>
        </div>
      </header>

      {/* 🃏 環繞式虛擬主牌桌 */}
      <div style={{ width: '100%', maxWidth: '900px', flex: 1, position: 'relative', background: 'radial-gradient(circle, #7f1d1d 0%, #450a0a 100%)', border: '6px solid #3f3f46', borderRadius: '20px', boxShadow: 'inset 0 0 50px rgba(0,0,0,0.8)', overflow: 'hidden' }}>
        
        {isPlaying && (
          <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 5, textAlign: 'center', background: 'rgba(0,0,0,0.5)', padding: '5px', borderRadius: '8px', border: '1px solid #b45309', transform: 'scale(0.75)', transformOrigin: 'top right' }}>
            <div style={{ color: '#d1d5db', fontSize: '0.7rem', marginBottom: '3px' }}>牌庫</div>
            {renderCard(null, null, false, true, 'deck-placeholder')}
            <div style={{ color: '#fcd34d', fontWeight: 'bold', fontSize: '0.8rem', marginTop: '3px' }}>{roomData.deckCount || 0} 張</div>
          </div>
        )}

        {/* 🎯 完美定位：日誌下移至 top: 56%，徹底避開對手卡牌 */}
        <div style={{ position: 'absolute', top: '56%', left: '50%', transform: 'translate(-50%, -50%)', width: '85%', textAlign: 'center', zIndex: 30 }}>
          {!isPlaying && roomData.status === 'waiting' ? (
            isOwner ? (
              <button onClick={() => startGame()} style={{ padding: '10px 20px', background: 'linear-gradient(to bottom, #fcd34d, #d97706)', color: '#450a0a', border: 'none', borderRadius: '25px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.5)' }}>✉️ 發送情書</button>
            ) : <div style={{ color: '#d1d5db', fontSize: '0.9rem' }}>等待房主開始...</div>
          
          ) : roomData.status === 'game_over' ? (
            <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '12px', background: 'rgba(0,0,0,0.9)', padding: '20px 30px', borderRadius: '15px', border: '2px solid #fcd34d', boxShadow: '0 4px 15px rgba(0,0,0,0.8)' }}>
              <div style={{ color: '#fcd34d', fontWeight: 'bold', fontSize: '1.1rem' }}>🎉 遊戲結束！</div>
              <div style={{ color: '#fff', fontSize: '1rem' }}>【{roomData.winner.split('@')[0]}】贏得了公主的芳心！</div>
              
              {isOwner ? (
                <button onClick={() => restartGame()} style={{ marginTop: '5px', padding: '10px 20px', background: '#4caf50', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}>
                  🔄 再來一局
                </button>
              ) : (
                <div style={{ color: '#9ca3af', fontSize: '0.9rem', marginTop: '5px' }}>等待房主重新開始...</div>
              )}
            </div>
          ) : (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.7)', padding: '6px 12px', borderRadius: '20px', color: '#fcd34d', fontWeight: 'bold', fontSize: '0.85rem', border: '1px solid #7f1d1d', boxShadow: '0 4px 6px rgba(0,0,0,0.5)' }}>
              <span style={{ display: 'inline-block', maxWidth: '140px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {roomData.actionLog}
              </span>
              <button onClick={() => setShowLogModal(true)} style={{ padding: '2px 8px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '10px', fontSize: '0.75rem', cursor: 'pointer', flexShrink: 0 }}>
                紀錄
              </button>
            </div>
          )}
        </div>

        {/* 對手環繞座位 */}
        {opponents.map((opp, index) => (
          <div key={opp.name} style={{ ...getOpponentStyle(index, opponents.length), border: roomData?.turn === opp.name ? '2px solid #fcd34d' : '1px solid rgba(255,255,255,0.1)', opacity: opp.isAlive ? 1 : 0.5 }}>
            {activeEmojis[opp.name] && <div style={{ position: 'absolute', top: '-30px', left: '50%', transform: 'translateX(-50%)', fontSize: '1.5rem', zIndex: 10 }}>{activeEmojis[opp.name]}</div>}
            
            <div style={{ color: opp.isAlive ? '#fff' : '#9ca3af', fontWeight: 'bold', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100px' }}>
              {opp.nickname || opp.name.split('@')[0]}
            </div>
            <div style={{ color: '#fca5a5', fontSize: '0.7rem', marginBottom: '5px' }}>{'❤️'.repeat(opp.tokens)}</div>
            
            <div style={{ display: 'flex', justifyContent: 'center', transform: 'scale(0.8)', margin: '-10px 0' }}>
              {/* ✨ 加上 keyIndex 綁定 */}
              {opp.isAlive ? opp.hand?.map((c, i) => renderCard(c, null, false, false, `opp-${opp.name}-${i}`)) : <div style={{ color: '#ef4444', fontWeight: 'bold', marginTop: '10px' }}>💀</div>}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '2px', marginTop: '5px' }}>
              {opp.discarded?.map((c, i) => (
                 <div key={i} style={{ background: 'rgba(255, 251, 235, 0.9)', color: '#7f1d1d', padding: '1px 3px', borderRadius: '3px', fontSize: '0.65rem', border: '1px solid #b45309', fontWeight: 'bold' }}>{c.value} {c.name}</div>
              ))}
            </div>
            {opp.isProtected && <div style={{ position: 'absolute', top: '-8px', right: '-8px', fontSize: '1.2rem', background: '#fff', borderRadius: '50%', padding: '2px', boxShadow: '0 2px 5px rgba(0,0,0,0.5)' }}>🛡️</div>}
          </div>
        ))}

        {/* 玩家本人的座位 */}
        {me && (
          <div style={{ position: 'absolute', bottom: '10px', left: '50%', transform: 'translateX(-50%) scale(0.82)', transformOrigin: 'bottom center', zIndex: 10, background: 'rgba(0,0,0,0.6)', padding: '10px 15px', borderRadius: '15px', border: isMyTurn ? '3px solid #00e676' : '1px solid transparent', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '270px' }}>
            {activeEmojis[me.name] && <div style={{ position: 'absolute', top: '-40px', left: '50%', transform: 'translateX(-50%)', fontSize: '2rem', zIndex: 10 }}>{activeEmojis[me.name]}</div>}
            
            <div style={{ color: isMyTurn ? '#00e676' : 'white', fontWeight: 'bold', fontSize: '1rem', marginBottom: '5px' }}>
              {me.nickname || me.name.split('@')[0]} ({'❤️'.repeat(me.tokens)})
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'center', minHeight: '100px', transform: 'scale(0.95)' }}>
              {/* ✨ 加上 keyIndex 綁定 */}
              {me.isAlive ? me.hand?.map((c, i) => renderCard(c, handleCardClick, mustPlayCountess && c.value !== 7, false, `me-${i}`)) : <div style={{ color: '#ef4444', fontWeight: 'bold', marginTop: '30px' }}>💀 已出局</div>}
            </div>

            {me.discarded?.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '4px', marginTop: '10px' }}>
                <div style={{ width: '100%', fontSize: '0.75rem', color: '#fca5a5', marginBottom: '2px', textAlign: 'center' }}>棄牌紀錄</div>
                {me.discarded.map((c, i) => (
                   <div key={i} style={{ background: '#fffbeb', color: '#7f1d1d', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', border: '1px solid #b45309', fontWeight: 'bold' }}>{c.value} {c.name}</div>
                ))}
              </div>
            )}
            {me.isProtected && <div style={{ color: '#60a5fa', fontWeight: 'bold', marginTop: '5px', fontSize: '0.8rem' }}>🛡️ 免疫中</div>}
          </div>
        )}
      </div>

      {/* 📜 本局「所有動態」歷史紀錄彈窗 */}
      {showLogModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 150 }}>
          <div style={{ background: '#2d0c0c', padding: '25px', borderRadius: '15px', border: '2px solid #fcd34d', textAlign: 'center', color: 'white', maxWidth: '350px', width: '85%', display: 'flex', flexDirection: 'column', maxHeight: '70vh' }}>
            <h3 style={{ color: '#fcd34d', margin: '0 0 15px 0' }}>📜 本局動態紀錄</h3>
            
            <div style={{ flex: 1, overflowY: 'auto', textAlign: 'left', padding: '0 5px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[...logHistory].reverse().map((log, idx) => {
                const isLatest = idx === 0;
                return (
                  <div key={idx} style={{
                    fontSize: '0.9rem', lineHeight: '1.4',
                    color: isLatest ? '#fcd34d' : '#d1d5db',
                    fontWeight: isLatest ? 'bold' : 'normal',
                    borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px'
                  }}>
                    {log}
                  </div>
                );
              })}
            </div>

            <button onClick={() => setShowLogModal(false)} style={{ marginTop: '20px', padding: '8px 25px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem' }}>
              關閉
            </button>
          </div>
        </div>
      )}

      {/* 🎯 目標選擇 Modal */}
      {showTargetModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 }}>
          <div style={{ background: '#2d0c0c', padding: '25px', borderRadius: '15px', border: '2px solid #fcd34d', textAlign: 'center', color: 'white', maxWidth: '400px', width: '90%' }}>
            <h3 style={{ color: '#fcd34d', marginTop: 0 }}>選擇目標玩家</h3>
            <p style={{ color: '#d1d5db', fontSize: '0.9rem' }}>你打出了 [{pendingCard?.name}]，請選擇發動對象：</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '15px' }}>
              {getValidTargets(pendingCard?.value).map(p => (
                <button key={p.name} onClick={() => handleTargetSelect(p.name)} style={{ padding: '10px', background: '#7f1d1d', color: 'white', border: '1px solid #fca5a5', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                  {p.name === username ? '自己' : (p.nickname || p.name.split('@')[0])}
                </button>
              ))}
              <button onClick={() => setShowTargetModal(false)} style={{ padding: '10px', background: 'transparent', color: '#9ca3af', border: 'none', cursor: 'pointer', marginTop: '10px' }}>取消出牌</button>
            </div>
          </div>
        </div>
      )}

      {/* 🤔 衛兵猜測 Modal */}
      {showGuessModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 105 }}>
          <div style={{ background: '#2d0c0c', padding: '25px', borderRadius: '15px', border: '2px solid #fcd34d', textAlign: 'center', color: 'white', maxWidth: '500px', width: '95%' }}>
            <h3 style={{ color: '#fcd34d', marginTop: 0 }}>猜測手牌</h3>
            <p style={{ color: '#d1d5db', fontSize: '0.9rem' }}>請猜測目標手上的牌 (不能猜衛兵)：</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center', marginTop: '15px' }}>
              {CARD_DEFINITIONS.filter(c => c.value !== 1).map(c => (
                <button key={c.value} onClick={() => handleGuessSelect(c.value)} style={{ padding: '8px 12px', background: '#fffbeb', color: '#7f1d1d', border: '2px solid #b45309', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                  {c.value} {c.name}
                </button>
              ))}
            </div>
            <button onClick={() => { setShowGuessModal(false); setShowTargetModal(true); }} style={{ padding: '10px', background: 'transparent', color: '#9ca3af', border: 'none', cursor: 'pointer', marginTop: '20px' }}>返回重選目標</button>
          </div>
        </div>
      )}

      {/* 👁️ 神父私密視窗 */}
      {privateInfo && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 110 }}>
          <div style={{ background: '#1a0505', padding: '30px', borderRadius: '15px', border: '2px solid #60a5fa', textAlign: 'center', color: 'white', boxShadow: '0 0 30px rgba(96, 165, 250, 0.4)' }}>
            <h2 style={{ color: '#60a5fa', marginTop: 0 }}>👁️ 神父的啟示</h2>
            <p>你看到了對手的手牌是：</p>
            <div style={{ display: 'flex', justifyContent: 'center', margin: '20px 0' }}>
              {/* ✨ 加上 keyIndex 綁定 */}
              {privateInfo.hand.map((c, i) => renderCard(c, null, false, false, `private-${i}`))}
            </div>
            <button onClick={clearPrivateInfo} style={{ padding: '10px 30px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '25px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.1rem' }}>我記住了</button>
          </div>
        </div>
      )}

      {/* 右下角 Emoji */}
      <div style={{ position: 'fixed', bottom: '25px', right: '25px', zIndex: 50 }}>
        {showEmojiPicker && (
          <div style={{ position: 'absolute', bottom: '100%', right: 0, marginBottom: '15px', background: 'white', padding: '10px', borderRadius: '12px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
            {EMOJI_LIST.map(e => <button key={e} onClick={() => { sendEmoji(e); setShowEmojiPicker(false); }} style={{ fontSize: '1.8rem', background: 'transparent', border: 'none', cursor: 'pointer' }}>{e}</button>)}
          </div>
        )}
        <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} style={{ width: '60px', height: '60px', borderRadius: '30px', background: '#dc2626', color: 'white', border: 'none', fontSize: '2rem', display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.5)', cursor: 'pointer' }}>😀</button>
      </div>

      {/* 規則彈窗 */}
      {showRules && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: '#2d0c0c', border: '4px solid #fcd34d', borderRadius: '15px', padding: '25px', maxWidth: '500px', width: '90%', color: 'white', position: 'relative', maxHeight: '80vh', overflowY: 'auto' }}>
            <button onClick={() => setShowRules(false)} style={{ position: 'absolute', top: '10px', right: '15px', background: 'transparent', border: 'none', color: 'white', fontSize: '1.5rem', cursor: 'pointer' }}>✖</button>
            <h2 style={{ color: '#fcd34d', textAlign: 'center', marginTop: 0 }}>📜 情書 (Love Letter) 規則</h2>
            <div style={{ lineHeight: 1.6, fontSize: '0.95rem' }}>
              <p><strong>【核心目標】</strong> 成為活到最後的玩家，或在牌堆抽完時，持有數字最大的卡牌。</p>
              <h3 style={{ color: '#fca5a5', borderBottom: '1px solid #fca5a5' }}>🃏 卡牌效果一覽</h3>
              <ul style={{ paddingLeft: '20px' }}>
                {CARD_DEFINITIONS.map(c => (
                  <li key={c.value} style={{ marginBottom: '8px' }}>
                    <strong>[{c.value}] {c.name} (x{c.count}):</strong> {c.desc}
                  </li>
                ))}
              </ul>
              <h3 style={{ color: '#fca5a5', borderBottom: '1px solid #fca5a5' }}>⚔️ 遊戲流程</h3>
              <p>1. 遊戲開始時會移除 1 張暗牌。每人發 1 張牌。</p>
              <p>2. 輪到你時，系統會自動發 1 張牌給你 (手上變 2 張)。</p>
              <p>3. 點擊手牌打出 1 張，結算效果後換下一位玩家。</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}