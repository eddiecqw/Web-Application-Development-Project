import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import useNiuNiuSocket from '../hooks/useNiuNiuSocket';
import NiuNiuLobby from '../components/Game/NiuNiuLobby';

// 前端輔助計算，用來即時驗證玩家選的牌與特殊牌型
function evaluateHandLocal(hand) {
  if (!hand || hand.length !== 5) return { type: '無牛', weight: 0 };
  
  const isFiveSmall = hand.every(c => c.value < 5) && hand.reduce((sum, c) => sum + c.value, 0) <= 10;
  if (isFiveSmall) return { type: '五小牛', weight: 1000 };

  const rankCounts = {};
  hand.forEach(c => rankCounts[c.rank] = (rankCounts[c.rank] || 0) + 1);
  if (Object.values(rankCounts).includes(4)) return { type: '四炸', weight: 900 };

  const isFiveFlower = hand.every(c => ['J', 'Q', 'K'].includes(c.rank));
  if (isFiveFlower) return { type: '五花牛', weight: 800 };

  return null;
}

// 輔助：找出最大的一張牌
function getHighestCard(hand) {
  if (!hand || hand.length === 0) return null;
  return hand.reduce((max, card) => {
    if (card.numValue > max.numValue) return card;
    if (card.numValue === max.numValue && card.suitValue > max.suitValue) return card;
    return max;
  }, hand[0]);
}

// 輔助：比較兩副牌的大小 (回傳 true 代表 handA 贏)
function compareHands(handA, resultA, handB, resultB) {
  if (!resultA || !resultB) return false;
  if (resultA.weight > resultB.weight) return true;
  if (resultA.weight < resultB.weight) return false;
  
  const highA = getHighestCard(handA);
  const highB = getHighestCard(handB);
  if (!highA || !highB) return false;
  
  if (highA.numValue > highB.numValue) return true;
  if (highA.numValue < highB.numValue) return false;
  
  return highA.suitValue > highB.suitValue;
}

export default function NiuNiuPage({ user }) {
  const navigate = useNavigate();
  const username = user.email;
  
  const baseWsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:53840/ws';
  const wsUrl = `${baseWsUrl}?username=${encodeURIComponent(username)}`;

  const {
    createRoom, joinRoom, startGame, submitHand, leaveRoom, sendEmoji, // ✨ 引入 sendEmoji
    gameState: { roomId, roomData }
  } = useNiuNiuSocket(wsUrl, {
    // ✨ 監聽收到的表情
    NIUNIU_SHOW_EMOJI: (data) => {
      setActiveEmojis(prev => ({ ...prev, [data.username]: data.emoji }));
      // 3 秒後自動讓氣泡消失
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
    setShowEmojiPicker(false); // 發送後自動關閉面板
  };
  // 玩家理牌狀態與 UI 狀態
  const [selectedIndices, setSelectedIndices] = useState([]);
  const [manualResult, setManualResult] = useState(null);
  const [isNoNiu, setIsNoNiu] = useState(false);
  const [msg, setMsg] = useState('等待遊戲開始...');
  const [msgColor, setMsgColor] = useState('#fff');
  const [timeLeft, setTimeLeft] = useState(null);
  const [lastStatus, setLastStatus] = useState(null);
  
  // ✨ 正確的位置：將 showRules 的 useState 放在元件內部
  const [showRules, setShowRules] = useState(false); 
  // ✨ 新增：表情相關狀態
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeEmojis, setActiveEmojis] = useState({}); // 儲存畫面上正在顯示的表情
  const EMOJI_LIST = ['😀', '😂', '😎', '😍', '😭', '😡', '💩', '👍', '👎', '🎉', '💸', '🤡'];
  // 取得目前玩家與其他對手
  const me = useMemo(() => roomData?.players.find(p => p.name === username), [roomData, username]);
  const opponents = useMemo(() => roomData?.players.filter(p => p.name !== username) || [], [roomData, username]);
  const isOwner = roomData?.owner === username;
  const isPlaying = roomData?.status === 'playing';
  const isShowdown = roomData?.status === 'showdown';

  // 處理遊戲狀態改變與倒數計時
  useEffect(() => {
    if (!roomData) return;

    if (roomData.status === 'playing' && lastStatus !== 'playing') {
      setLastStatus('playing');
      setSelectedIndices([]);
      setIsNoNiu(false);
      setManualResult(null);
      setTimeLeft(roomData.timeLimit);
      
      if (me?.hand) {
        const special = evaluateHandLocal(me.hand);
        if (special) {
          setManualResult(special);
          setMsg(`🌟 運氣爆棚！自動辨識為特殊牌型：【${special.type}】`);
          setMsgColor('#ffd700');
        } else {
          setMsg('👉 請挑選 3 張點數總和為 10 的倍數的牌');
          setMsgColor('#fff');
        }
      }
    } 
    else if (roomData.status === 'showdown' && lastStatus !== 'showdown') {
      setLastStatus('showdown');
      setTimeLeft(null);
      
      const dealer = roomData.players.find(p => p.name === roomData.dealer);

      if (me.name === roomData.dealer) {
        let winCount = 0;
        let loseCount = 0;
        roomData.players.forEach(p => {
          if (p.name !== me.name && p.result) {
            if (compareHands(me.hand, me.result, p.hand, p.result)) winCount++;
            else loseCount++;
          }
        });

        if (winCount === 0 && loseCount === 0) {
          setMsg('👀 攤牌結果揭曉！');
        } else if (winCount >= loseCount) {
          setMsg(`👑 庄家通殺！贏了 ${winCount} 家，輸了 ${loseCount} 家！`);
          setMsgColor('#ffd700');
          new Audio('/success.mp3').play().catch(() => {});
        } else {
          setMsg(`💸 慘遭圍剿！贏了 ${winCount} 家，輸了 ${loseCount} 家！`);
          setMsgColor('#ff1744');
        }
      } 
      else {
        if (dealer && dealer.result && me.result) {
          const isWin = compareHands(me.hand, me.result, dealer.hand, dealer.result);
          if (isWin) {
            setMsg('🎉 恭喜！你贏了庄家！');
            setMsgColor('#00e676');
            new Audio('/success.mp3').play().catch(() => {});
          } else {
            setMsg('💀 遺憾！庄家獲勝！');
            setMsgColor('#ff1744');
          }
        } else {
          setMsg('👀 攤牌結果揭曉！');
          setMsgColor('#fff');
        }
      }
    } 
    else if (roomData.status === 'waiting' && lastStatus !== 'waiting') {
      setLastStatus('waiting');
      setMsg(isOwner ? '等待其他玩家加入，點擊「開始遊戲」' : '等待房主開始遊戲...');
      setMsgColor('#fff');
      setTimeLeft(null);
    }
  }, [roomData?.status, me?.hand, isOwner, me, roomData?.dealer, roomData?.players, roomData?.timeLimit, lastStatus]);

  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0 || roomData?.status !== 'playing') return;
    const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, roomData?.status]);

  const toggleCardSelection = (index) => {
    if (!isPlaying || me?.isReady || manualResult?.weight >= 800 || isNoNiu) return;

    setSelectedIndices(prev => {
      let newSelection = [...prev];
      if (newSelection.includes(index)) {
        newSelection = newSelection.filter(i => i !== index);
      } else if (newSelection.length < 3) {
        newSelection.push(index);
      }
      return newSelection;
    });
  };

  useEffect(() => {
    if (roomData?.status !== 'playing') return;
    if (selectedIndices.length === 3 && me?.hand) {
      const sum = selectedIndices.reduce((acc, idx) => acc + me.hand[idx].value, 0);
      if (sum % 10 === 0) {
        const remainingIndices = [0, 1, 2, 3, 4].filter(idx => !selectedIndices.includes(idx));
        const niuSum = me.hand[remainingIndices[0]].value + me.hand[remainingIndices[1]].value;
        const finalNiu = niuSum % 10 === 0 ? 10 : niuSum % 10;
        
        setManualResult({
          type: finalNiu === 10 ? '鬥牛 (牛牛)' : `牛${finalNiu}`,
          weight: finalNiu * 10
        });
        setMsg(`✅ 湊成 10 的倍數了！牌型：【${finalNiu === 10 ? '鬥牛' : '牛' + finalNiu}】`);
        setMsgColor('#00e676');
        setIsNoNiu(false);
      } else {
        setMsg(`❌ 這三張牌加總 (${sum}) 不是 10 的倍數喔！`);
        setMsgColor('#ff1744');
        setManualResult(null);
      }
    } else if (selectedIndices.length > 0 && selectedIndices.length < 3) {
      setMsg(`👉 已選 ${selectedIndices.length}/3 張牌`);
      setMsgColor('#fff');
      setManualResult(null);
    }
  }, [selectedIndices, me?.hand, roomData?.status]);

  const handleDeclareNoNiu = () => {
    setIsNoNiu(true);
    setManualResult({ type: '無牛', weight: 0 });
    setSelectedIndices([]);
    setMsg('🤷‍♂️ 宣告無牛！點擊「確認手牌」等待結算。');
    setMsgColor('#9e9e9e');
  };

  const handleLeaveGame = () => {
    const isConfirmed = window.confirm("⚠️ 確定要離開賭局嗎？");
    if (isConfirmed) {
      leaveRoom();
      navigate('/');
    }
  };

  const renderCard = (card, idx, isSelectable = false, isSelected = false, isHidden = false) => {
    if (isHidden || !card) {
      return (
        <div key={idx} style={{
          width: '60px', height: '90px', margin: '0 4px', borderRadius: '6px',
          background: 'repeating-linear-gradient(45deg, #0d47a1, #0d47a1 10px, #1976d2 10px, #1976d2 20px)',
          border: '2px solid white', boxShadow: '2px 2px 5px rgba(0,0,0,0.3)'
        }} />
      );
    }

    return (
      <div 
        key={idx} 
        onClick={() => isSelectable && toggleCardSelection(idx)}
        style={{
          width: '60px', height: '90px', margin: '0 4px', borderRadius: '6px',
          backgroundColor: 'white', color: card.color === 'red' ? '#d32f2f' : '#212121',
          display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
          fontWeight: 'bold', fontSize: '1.2rem', cursor: isSelectable ? 'pointer' : 'default',
          boxShadow: isSelected ? '0 0 15px rgba(255,215,0,0.8)' : '2px 2px 5px rgba(0,0,0,0.3)',
          transform: isSelected ? 'translateY(-15px)' : 'translateY(0)',
          border: isSelected ? '3px solid #ffd700' : 'none',
          transition: 'all 0.2s ease', userSelect: 'none'
        }}
      >
        <div>{card.rank}</div>
        <div style={{ fontSize: '1.5rem' }}>{card.suit}</div>
      </div>
    );
  };

  if (!roomId) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6', padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: '100%', maxWidth: '800px', marginBottom: '16px' }}>
          <button onClick={() => navigate('/')} style={{ padding: '8px 16px', background: '#dc3545', color: 'white', borderRadius: '4px', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>
            ← 返回聊天室
          </button>
        </div>
        <NiuNiuLobby onCreateRoom={createRoom} onJoinRoom={joinRoom} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#1a4f2c', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px' }}>
      
      {/* 頂部狀態列 */}
      <header style={{ width: '100%', maxWidth: '900px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: '8px', marginBottom: '15px' }}>
        <button onClick={handleLeaveGame} style={{ padding: '8px 16px', background: '#dc3545', color: 'white', borderRadius: '6px', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>
          ← 離開房間
        </button>
        <div style={{ fontWeight: 'bold', color: '#ffd700', fontSize: '1.2rem' }}>房間號: {roomId}</div>
        
        {/* ✨ 右上角按鈕區（倒數計時與規則彈窗入口） */}
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center', position: 'relative' }}>
          {timeLeft !== null && (
            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: timeLeft <= 10 ? '#ff1744' : '#00e676' }}>
              ⏱️ {timeLeft}s
            </div>
          )}
          
          {/* ✨ 表情按鈕與面板 */}
          <div style={{ position: 'relative' }}>
            <button 
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              style={{ padding: '6px 12px', background: '#ff9800', color: 'white', borderRadius: '20px', border: 'none', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.3)' }}
            >
              😀 表情
            </button>
            
            {showEmojiPicker && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: '10px',
                background: 'white', padding: '10px', borderRadius: '12px',
                display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.3)', zIndex: 100
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
          </div>

          <button 
            onClick={() => setShowRules(true)}
            style={{ padding: '6px 12px', background: '#2196F3', color: 'white', borderRadius: '20px', border: 'none', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.3)' }}
          >
            ❓ 規則
          </button>
        </div>
      </header>

      {/* 🎰 賭桌主視覺 */}
      <div style={{ 
        width: '100%', maxWidth: '900px', flex: 1, 
        background: 'radial-gradient(circle, #226b3a 0%, #11361c 100%)',
        border: '10px solid #4a2e15', borderRadius: '20px', padding: '20px',
        boxShadow: 'inset 0 0 50px rgba(0,0,0,0.5), 0 10px 30px rgba(0,0,0,0.8)',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
      }}>
        
        {/* 對手區域 */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '20px' }}>
          {opponents.map((opp) => (
            <div key={opp.name} style={{ textAlign: 'center', background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '12px', position: 'relative' }}>
              {/* ✨ 對手的表情氣泡 */}
              {activeEmojis[opp.name] && (
                <div style={{
                  position: 'absolute', top: '-45px', left: '50%', transform: 'translateX(-50%)',
                  background: 'white', padding: '4px 12px', borderRadius: '20px',
                  fontSize: '2rem', boxShadow: '0 4px 10px rgba(0,0,0,0.3)', zIndex: 10,
                  animation: 'fadeUp 0.2s ease-out'
                }}>
                  {activeEmojis[opp.name]}
                  {/* 氣泡的小尾巴 */}
                  <div style={{ position: 'absolute', bottom: '-8px', left: '50%', transform: 'translateX(-50%)', borderTop: '8px solid white', borderLeft: '8px solid transparent', borderRight: '8px solid transparent' }} />
                </div>
              )}

              {/* ✨ 加上籌碼顯示 */}
              <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem', color: roomData.dealer === opp.name ? '#ffd700' : '#fff' }}>
                {roomData.dealer === opp.name && '👑 '} {opp.name.split('@')[0]} {opp.isReady && '✅'}
                <div style={{ color: '#ffd700', fontSize: '0.9rem', marginTop: '4px' }}>💰 {opp.chips ?? 1000}</div>
              </h3>
              
              <div style={{ display: 'flex', justifyContent: 'center', height: '90px' }}>
                {[0,1,2,3,4].map(idx => 
                  renderCard(
                    opp.hand ? opp.hand[idx] : null, 
                    idx, 
                    false, 
                    false, 
                    !isShowdown && opp.hand && opp.hand.length > 0 
                  )
                )}
              </div>
              
              {/* ✨ 對手的跳錢特效與牌型 */}
              {isShowdown && opp.result && (
                <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ background: 'rgba(0,0,0,0.7)', color: '#00e676', padding: '4px 12px', borderRadius: '15px', border: '1px solid #00e676', fontSize: '0.9rem' }}>
                    {opp.result.type}
                  </div>
                  {opp.scoreChange !== 0 && (
                    <div style={{
                      color: opp.scoreChange > 0 ? '#00e676' : '#ff1744', 
                      fontWeight: 'bold', fontSize: '1.2rem', marginTop: '5px'
                    }}>
                      {opp.scoreChange > 0 ? `+${opp.scoreChange}` : opp.scoreChange}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 遊戲訊息與操作區 */}
        <div style={{ textAlign: 'center', margin: '20px 0' }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: msgColor, minHeight: '35px', textShadow: '1px 1px 2px black', marginBottom: '15px' }}>
            {msg}
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {roomData.status === 'waiting' && isOwner && (
              <button onClick={() => startGame()} style={{ padding: '12px 24px', background: 'linear-gradient(to bottom, #fbc02d, #f57f17)', color: '#3e2723', border: 'none', borderRadius: '25px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}>
                🎮 開始遊戲
              </button>
            )}
            {isPlaying && !me?.isReady && (
              <>
                <button 
                  onClick={handleDeclareNoNiu} 
                  style={{ padding: '10px 20px', background: 'linear-gradient(to bottom, #9e9e9e, #616161)', color: 'white', border: 'none', borderRadius: '25px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  🤷‍♂️ 宣告無牛
                </button>
                <button 
                  onClick={() => submitHand({ manualResult: manualResult || { type: '無牛', weight: 0 } })}
                  disabled={!manualResult && !isNoNiu}
                  style={{ 
                    padding: '10px 20px', border: 'none', borderRadius: '25px', fontSize: '1rem', fontWeight: 'bold',
                    background: (manualResult || isNoNiu) ? 'linear-gradient(to bottom, #fbc02d, #f57f17)' : '#9e9e9e',
                    color: (manualResult || isNoNiu) ? '#3e2723' : '#616161',
                    cursor: (manualResult || isNoNiu) ? 'pointer' : 'not-allowed'
                  }}
                >
                  ✅ 確認手牌
                </button>
              </>
            )}
          </div>
        </div>

        {/* 玩家自己的區域 */}
        {me && (
          <div style={{ textAlign: 'center', background: 'rgba(0,0,0,0.4)', padding: '15px', borderRadius: '15px', border: roomData.dealer === me.name ? '2px solid #ffd700' : 'none', position: 'relative' }}>

            {/* ✨ 自己的表情氣泡 */}
            {activeEmojis[me.name] && (
              <div style={{
                position: 'absolute', top: '-45px', left: '50%', transform: 'translateX(-50%)',
                background: 'white', padding: '4px 12px', borderRadius: '20px',
                fontSize: '2rem', boxShadow: '0 4px 10px rgba(0,0,0,0.3)', zIndex: 10,
                animation: 'fadeUp 0.2s ease-out'
              }}>
                {activeEmojis[me.name]}
                <div style={{ position: 'absolute', bottom: '-8px', left: '50%', transform: 'translateX(-50%)', borderTop: '8px solid white', borderLeft: '8px solid transparent', borderRight: '8px solid transparent' }} />
              </div>
            )}

            {/* ✨ 加上籌碼顯示 */}
            <h2 style={{ margin: '0 0 15px 0', fontSize: '1.2rem', color: roomData.dealer === me.name ? '#ffd700' : '#fff' }}>
              {roomData.dealer === me.name && '👑 '} 你的手牌 {me.isReady && '(已確認 ✅)'}
              <span style={{ color: '#ffd700', marginLeft: '15px' }}>💰 {me.chips ?? 1000}</span>
            </h2>
            <div style={{ display: 'flex', justifyContent: 'center', height: '110px', alignItems: 'flex-end' }}>
              {[0,1,2,3,4].map(idx => 
                renderCard(
                  me.hand ? me.hand[idx] : null, 
                  idx, 
                  isPlaying && !me.isReady, 
                  selectedIndices.includes(idx), 
                  false
                )
              )}
            </div>
            
            {/* ✨ 自己的跳錢特效與牌型 */}
            {isShowdown && me.result && (
              <div style={{ marginTop: '15px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ background: 'rgba(0,0,0,0.8)', color: '#00e676', padding: '6px 16px', borderRadius: '20px', border: '2px solid #00e676', fontSize: '1.2rem', fontWeight: 'bold' }}>
                  {me.result.type}
                </div>
                {me.scoreChange !== 0 && (
                  <div style={{
                    color: me.scoreChange > 0 ? '#00e676' : '#ff1744', 
                    fontWeight: 'bold', fontSize: '1.5rem', marginTop: '10px'
                  }}>
                    {me.scoreChange > 0 ? `+${me.scoreChange}` : me.scoreChange}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ✨ 規則與倍率彈窗 */}
      {showRules && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#1a4f2c', border: '4px solid #ffd700', borderRadius: '15px',
            padding: '25px', maxWidth: '500px', width: '90%', color: 'white',
            boxShadow: '0 10px 30px rgba(0,0,0,0.8)', position: 'relative'
          }}>
            <button 
              onClick={() => setShowRules(false)}
              style={{ position: 'absolute', top: '10px', right: '15px', background: 'transparent', border: 'none', color: '#fff', fontSize: '1.5rem', cursor: 'pointer' }}
            >
              ✖
            </button>
            <h2 style={{ color: '#ffd700', textAlign: 'center', marginTop: 0 }}>📜 撲克鬥牛 規則與賠率</h2>
            
            <div style={{ lineHeight: '1.6', fontSize: '1rem' }}>
              <p><strong>【基本玩法】</strong> 每人發 5 張牌，閒家與庄家比大小。你需要先挑出 3 張加總為 10 的倍數的牌 (湊牛)，剩下 2 張相加的個位數即為「牛幾」。</p>
              
              <h3 style={{ color: '#00e676', borderBottom: '1px solid #00e676', paddingBottom: '5px' }}>💰 牌型倍率表 (底注 10)</h3>
              <ul style={{ paddingLeft: '20px', margin: '10px 0' }}>
                <li><strong>五小牛、四炸、五花牛：</strong> 5 倍 (贏/輸 50)</li>
                <li><strong>鬥牛 (牛牛)：</strong> 4 倍 (贏/輸 40)</li>
                <li><strong>牛九：</strong> 3 倍 (贏/輸 30)</li>
                <li><strong>牛七、牛八：</strong> 2 倍 (贏/輸 20)</li>
                <li><strong>無牛 ~ 牛六：</strong> 1 倍 (贏/輸 10)</li>
              </ul>

              <h3 style={{ color: '#00e676', borderBottom: '1px solid #00e676', paddingBottom: '5px' }}>⚖️ 大小比較順序</h3>
              <p>1. 先比牌型權重 (五小牛 &gt; 牛牛 &gt; 牛八 &gt; 無牛...)</p>
              <p>2. 若牌型相同，比單張最大牌的點數 (K &gt; Q &gt; J &gt; 10...)</p>
              <p>3. 若點數也相同，比花色 (♠ &gt; ♥ &gt; ♣ &gt; ♦)</p>
              <p style={{ color: '#ff1744', fontWeight: 'bold' }}>注意：結算時以「贏家」的倍率來決定輸贏籌碼量！</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}