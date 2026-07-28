import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import useLoveLetterSocket from '../hooks/useLoveLetterSocket';
import LoveLetterLobby from '../components/Game/LoveLetterLobby';

// 定義卡牌資訊 (供 UI 渲染與衛兵猜測使用)
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

  // UI 狀態
  const [showRules, setShowRules] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeEmojis, setActiveEmojis] = useState({});
  const EMOJI_LIST = ['🧐', '🤫', '😱', '😈', '🤡', '😡', '🛡️', '👑'];

  // 卡牌操作狀態
  const [pendingCard, setPendingCard] = useState(null); 
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [showGuessModal, setShowGuessModal] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState(null);

  // BGM 控制
  const [isBgmPlaying, setIsBgmPlaying] = useState(false);
  // ✨ 建議你可以找一首中世紀宮廷風的音樂放進 audio 資料夾
  const bgmRef = useRef(new Audio('/audio/Court_Music.mp3')); 

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
    createRoom, joinRoom, startGame, playCard, leaveRoom, sendEmoji, clearPrivateInfo,
    gameState: { roomId, roomData, privateInfo }
  } = useLoveLetterSocket(wsUrl, {
    LL_SHOW_EMOJI: (data) => {
      setActiveEmojis(prev => ({ ...prev, [data.username]: data.emoji }));
      setTimeout(() => {
        setActiveEmojis(prev => { const newState = { ...prev }; delete newState[data.username]; return newState; });
      }, 3000);
    }
  });

  const handleLeaveGame = () => {
    if (window.confirm("⚠️ 確定要離開宮廷嗎？")) {
      leaveRoom();
      navigate('/');
    }
  };

  // 衍生狀態計算
  const isOwner = roomData?.owner === username;
  const me = useMemo(() => roomData?.players.find(p => p.name === username), [roomData, username]);
  const opponents = useMemo(() => roomData?.players.filter(p => p.name !== username) || [], [roomData, username]);
  const isPlaying = roomData?.status === 'playing' || roomData?.status === 'showdown';
  const isMyTurn = roomData?.status === 'playing' && roomData?.turn === username && me?.isAlive;

  // 🚨 伯爵夫人強制出牌檢查
  const hasCountess = me?.hand?.some(c => c.value === 7);
  const hasKingOrPrince = me?.hand?.some(c => c.value === 5 || c.value === 6);
  const mustPlayCountess = hasCountess && hasKingOrPrince;

  // 取得合法目標 (排除出局者、受侍女保護者)
  const getValidTargets = (cardValue) => {
    let targets = opponents.filter(p => p.isAlive && !p.isProtected);
    if (cardValue === 5) targets.push(me); // 王子可以指定自己
    return targets;
  };

  // 點擊手牌發動邏輯
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
        // 如果所有人都無敵，只能空放 (空放不發動效果)
        playCard(card.value, null, null);
      } else {
        setPendingCard(card);
        setShowTargetModal(true);
      }
    } else {
      // 不需要目標的牌 (4, 7, 8) 直接打出
      playCard(card.value, null, null);
    }
  };

  // 選擇目標後
  const handleTargetSelect = (targetName) => {
    setShowTargetModal(false);
    if (pendingCard.value === 1) {
      setSelectedTarget(targetName);
      setShowGuessModal(true); // 衛兵需要多猜一個數字
    } else {
      playCard(pendingCard.value, targetName, null);
      setPendingCard(null);
    }
  };

  // 衛兵猜測後
  const handleGuessSelect = (guessValue) => {
    setShowGuessModal(false);
    playCard(pendingCard.value, selectedTarget, guessValue);
    setPendingCard(null);
    setSelectedTarget(null);
  };

  const renderCard = (card, onClick, disabled = false, isPlaceholder = false) => {
    if (isPlaceholder || !card || card.isHidden) {
      return (
        <div style={{
          width: '70px', height: '100px', margin: '0 5px', borderRadius: '8px',
          background: 'repeating-linear-gradient(45deg, #7f1d1d, #7f1d1d 10px, #991b1b 10px, #991b1b 20px)',
          border: '2px solid #fcd34d', boxShadow: '2px 2px 8px rgba(0,0,0,0.5)', position: 'relative'
        }}>
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: '#fcd34d', fontSize: '1.5rem' }}>💌</div>
        </div>
      );
    }
    return (
      <div 
        onClick={() => !disabled && onClick && onClick(card)}
        style={{
          width: '70px', height: '100px', margin: '0 5px', borderRadius: '8px',
          backgroundColor: '#fffbeb', color: '#7f1d1d',
          display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
          fontWeight: 'bold', border: disabled ? '2px solid #ccc' : '2px solid #b45309',
          boxShadow: '2px 2px 8px rgba(0,0,0,0.5)', position: 'relative',
          cursor: disabled ? 'not-allowed' : (onClick ? 'pointer' : 'default'),
          opacity: disabled ? 0.6 : 1, transition: 'transform 0.1s',
          transform: (onClick && !disabled) ? 'translateY(-5px)' : 'none'
        }}
        onMouseOver={e => { if (onClick && !disabled) e.currentTarget.style.transform = 'translateY(-10px)'; }}
        onMouseOut={e => { if (onClick && !disabled) e.currentTarget.style.transform = 'translateY(-5px)'; }}
      >
        <div style={{ position: 'absolute', top: '2px', left: '6px', fontSize: '1.2rem' }}>{card.value}</div>
        <div style={{ fontSize: '1.1rem', marginTop: '10px' }}>{card.name}</div>
      </div>
    );
  };

  if (!roomId) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#121212', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '16px' }}>
        <LoveLetterLobby onCreateRoom={createRoom} onJoinRoom={joinRoom} onBack={() => navigate('/')} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#2d0c0c', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px' }}>
      
      {/* 頂部 Header */}
      <header style={{ width: '100%', maxWidth: '900px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: '8px', marginBottom: '10px' }}>
        <button onClick={handleLeaveGame} style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>← 離開</button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 'bold', color: '#fcd34d', fontSize: '1.1rem', letterSpacing: '1px' }}>房間: {roomId}</div>
          <div style={{ fontSize: '0.8rem', color: '#d1d5db' }}>(目標: {roomData.settings.winTokens} 個指示物)</div>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={toggleBgm} style={{ padding: '6px 10px', background: isBgmPlaying ? '#dc2626' : '#4b5563', color: 'white', borderRadius: '20px', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>
            {isBgmPlaying ? '🔊' : '🔇'} BGM
          </button>
          <button onClick={() => setShowRules(true)} style={{ padding: '6px 10px', background: '#2196F3', color: 'white', borderRadius: '20px', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>❓ 規則</button>
        </div>
      </header>

      {/* 📜 動態日誌橫幅 */}
      <div style={{ width: '100%', maxWidth: '900px', background: 'linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(127,29,29,0.8) 50%, rgba(0,0,0,0) 100%)', padding: '10px 0', marginBottom: '15px', textAlign: 'center' }}>
        <div style={{ fontSize: '1.1rem', color: '#fcd34d', fontWeight: 'bold', textShadow: '1px 1px 2px #000' }}>
          {roomData.status === 'game_over' ? `🎉 遊戲結束！【${roomData.winner.split('@')[0]}】贏得了最終勝利！` : (roomData.actionLog || '等待遊戲開始...')}
        </div>
      </div>

      {/* 🃏 主遊戲桌面 */}
      <div style={{ width: '100%', maxWidth: '900px', flex: 1, background: 'radial-gradient(circle, #7f1d1d 0%, #450a0a 100%)', border: '8px solid #3f3f46', borderRadius: '20px', padding: '20px', boxShadow: 'inset 0 0 50px rgba(0,0,0,0.8)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        
        {/* 對手區域 */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap' }}>
          {opponents.map((opp) => (
            <div key={opp.name} style={{ textAlign: 'center', background: roomData?.turn === opp.name ? 'rgba(252,211,77,0.15)' : 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '12px', border: roomData?.turn === opp.name ? '2px solid #fcd34d' : '2px solid transparent', opacity: opp.isAlive ? 1 : 0.4, position: 'relative' }}>
              {activeEmojis[opp.name] && <div style={{ position: 'absolute', top: '-40px', left: '50%', transform: 'translateX(-50%)', fontSize: '2rem', zIndex: 10 }}>{activeEmojis[opp.name]}</div>}
              
              <h4 style={{ margin: '0 0 5px 0', color: opp.isAlive ? '#fff' : '#9ca3af' }}>
                {opp.name.split('@')[0]}
              </h4>
              <div style={{ color: '#fca5a5', fontSize: '0.85rem', marginBottom: '8px' }}>
                好感度: {'❤️'.repeat(opp.tokens)}
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'center', minHeight: '105px' }}>
                {opp.isAlive ? (
                  opp.hand?.map((c, i) => renderCard(c, null, false, false))
                ) : (
                  <div style={{ color: '#ef4444', fontWeight: 'bold', marginTop: '30px' }}>💀 已出局</div>
                )}
              </div>
              {opp.isProtected && <div style={{ position: 'absolute', top: '-10px', right: '-10px', fontSize: '1.5rem', background: '#fff', borderRadius: '50%', padding: '2px', boxShadow: '0 2px 5px rgba(0,0,0,0.5)' }}>🛡️</div>}
            </div>
          ))}
        </div>

        {/* 中央資訊區 (牌庫與棄牌堆) */}
        <div style={{ textAlign: 'center', margin: '20px 0', padding: '15px', background: 'rgba(0,0,0,0.5)', borderRadius: '12px' }}>
          {!isPlaying && roomData.status === 'waiting' ? (
            isOwner ? (
              <button onClick={() => startGame()} style={{ padding: '12px 30px', background: 'linear-gradient(to bottom, #fcd34d, #d97706)', color: '#450a0a', border: 'none', borderRadius: '25px', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.5)' }}>
                ✉️ 開始派送情書
              </button>
            ) : (
              <div style={{ color: '#d1d5db', fontSize: '1.2rem' }}>等待房主開始遊戲...</div>
            )
          ) : (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '40px' }}>
              <div>
                <div style={{ color: '#d1d5db', marginBottom: '5px' }}>剩餘牌庫</div>
                {renderCard(null, null, false, true)}
                <div style={{ color: '#fcd34d', fontWeight: 'bold', marginTop: '5px' }}>{roomData.deck?.length || 0} 張</div>
              </div>
              <div>
                <div style={{ color: '#d1d5db', marginBottom: '5px' }}>棄牌堆 (公開資訊)</div>
                <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap', maxWidth: '250px', justifyContent: 'center' }}>
                  {roomData.discardPile?.length === 0 ? <div style={{ color: '#666' }}>尚無棄牌</div> : 
                   roomData.discardPile?.map((c, i) => (
                    <div key={i} style={{ background: '#fffbeb', color: '#7f1d1d', padding: '2px 6px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold', border: '1px solid #b45309' }}>
                      {c.value} {c.name}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 玩家自己的區域 */}
        {me && (
          <div style={{ textAlign: 'center', background: 'rgba(0,0,0,0.6)', padding: '15px', borderRadius: '15px', border: isMyTurn ? '3px solid #00e676' : '2px solid transparent', opacity: me.isAlive ? 1 : 0.5, position: 'relative' }}>
            {activeEmojis[me.name] && <div style={{ position: 'absolute', top: '-40px', left: '50%', transform: 'translateX(-50%)', fontSize: '2rem', zIndex: 10 }}>{activeEmojis[me.name]}</div>}
            
            <h3 style={{ margin: '0 0 5px 0', color: isMyTurn ? '#00e676' : 'white' }}>
              你的手牌 (好感度: {'❤️'.repeat(me.tokens)})
            </h3>
            
            <div style={{ display: 'flex', justifyContent: 'center', minHeight: '110px', marginTop: '10px' }}>
              {me.isAlive ? (
                me.hand?.map((c, i) => {
                  const isDisabled = mustPlayCountess && c.value !== 7;
                  return renderCard(c, handleCardClick, isDisabled, false);
                })
              ) : (
                <div style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '1.2rem', marginTop: '30px' }}>💀 你已出局，等待下局開始</div>
              )}
            </div>
            {me.isProtected && <div style={{ color: '#60a5fa', fontWeight: 'bold', marginTop: '10px' }}>🛡️ 侍女保護中，免疫所有效果</div>}
            {isMyTurn && <div style={{ color: '#fcd34d', fontWeight: 'bold', marginTop: '15px', animation: 'pulse 1.5s infinite' }}>👉 輪到你了！請點擊一張手牌打出。</div>}
          </div>
        )}
      </div>

      {/* 🎯 目標選擇 Modal */}
      {showTargetModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 }}>
          <div style={{ background: '#2d0c0c', padding: '25px', borderRadius: '15px', border: '2px solid #fcd34d', textAlign: 'center', color: 'white', maxWidth: '400px', width: '90%' }}>
            <h3 style={{ color: '#fcd34d', marginTop: 0 }}>選擇目標玩家</h3>
            <p style={{ color: '#d1d5db', fontSize: '0.9rem' }}>你打出了 [{pendingCard?.name}]，請選擇發動對象：</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '15px' }}>
              {getValidTargets(pendingCard?.value).map(p => (
                <button key={p.name} onClick={() => handleTargetSelect(p.name)} style={{ padding: '10px', background: '#7f1d1d', color: 'white', border: '1px solid #fca5a5', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                  {p.name === username ? '自己' : p.name.split('@')[0]}
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
            <p style={{ color: '#d1d5db', fontSize: '0.9rem' }}>請猜測【{selectedTarget?.split('@')[0]}】手上的牌 (不能猜衛兵)：</p>
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
            <p>你看到了【{privateInfo.targetName.split('@')[0]}】的手牌是：</p>
            <div style={{ display: 'flex', justifyContent: 'center', margin: '20px 0' }}>
              {privateInfo.hand.map((c, i) => renderCard(c, null, false, false))}
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