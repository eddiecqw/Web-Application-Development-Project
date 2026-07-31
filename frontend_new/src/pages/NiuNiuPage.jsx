import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import useNiuNiuSocket from '../hooks/useNiuNiuSocket';
import NiuNiuLobby from '../components/Game/NiuNiuLobby';

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

function getHighestCard(hand) {
  if (!hand || hand.length === 0) return null;
  return hand.reduce((max, card) => {
    if (card.numValue > max.numValue) return card;
    if (card.numValue === max.numValue && card.suitValue > max.suitValue) return card;
    return max;
  }, hand[0]);
}

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
  const wsUrl = `${import.meta.env.VITE_WS_URL || 'ws://localhost:53840/ws'}?username=${encodeURIComponent(username)}`;

  const [isBgmPlaying, setIsBgmPlaying] = useState(false);
  const bgmRef = useRef(new Audio('/audio/The_High_Stakes_Shuffle.mp3'));

  useEffect(() => {
    const audio = bgmRef.current;
    audio.loop = true; audio.volume = 0.4;
    return () => { audio.pause(); audio.currentTime = 0; };
  }, []);

  const toggleBgm = () => {
    const audio = bgmRef.current;
    if (isBgmPlaying) audio.pause();
    else audio.play().catch(e => console.error(e));
    setIsBgmPlaying(!isBgmPlaying);
  };

  const {
    createRoom, joinRoom, startGame, submitHand, leaveRoom, sendEmoji,
    gameState: { roomId, roomData }
  } = useNiuNiuSocket(wsUrl, {
    NIUNIU_SHOW_EMOJI: (data) => {
      setActiveEmojis(prev => ({ ...prev, [data.username]: data.emoji }));
      setTimeout(() => setActiveEmojis(prev => { const n = { ...prev }; delete n[data.username]; return n; }), 3000);
    }
  });

  const handleSendEmoji = (emoji) => { sendEmoji(emoji); setShowEmojiPicker(false); };

  const [selectedIndices, setSelectedIndices] = useState([]);
  const [manualResult, setManualResult] = useState(null);
  const [isNoNiu, setIsNoNiu] = useState(false);
  const [msg, setMsg] = useState('等待遊戲開始...');
  const [msgColor, setMsgColor] = useState('#fff');
  const [timeLeft, setTimeLeft] = useState(null);
  const [lastStatus, setLastStatus] = useState(null);
  const [showRules, setShowRules] = useState(false); 
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeEmojis, setActiveEmojis] = useState({});
  const EMOJI_LIST = ['😀', '😂', '😎', '😍', '😭', '😡', '💩', '👍', '👎', '🎉', '💸', '🤡'];
  
  const me = useMemo(() => roomData?.players.find(p => p.name === username), [roomData, username]);
  const opponents = useMemo(() => roomData?.players.filter(p => p.name !== username) || [], [roomData, username]);
  const isOwner = roomData?.owner === username;
  const isPlaying = roomData?.status === 'playing';
  const isShowdown = roomData?.status === 'showdown';
  const isRotateDealer = roomData?.settings?.rotateDealer;
  const notEnoughPlayers = isRotateDealer && roomData?.players?.length < 2;

  useEffect(() => {
    if (!roomData) return;
    if (roomData.status === 'playing' && lastStatus !== 'playing') {
      setLastStatus('playing'); setSelectedIndices([]); setIsNoNiu(false); setManualResult(null);
      setTimeLeft(roomData.settings?.timeLimit || 30);
      if (me?.hand) {
        const special = evaluateHandLocal(me.hand);
        if (special) {
          setManualResult(special); setMsg(`🌟 運氣爆棚！自動辨識為特殊牌型：【${special.type}】`); setMsgColor('#ffd700');
        } else {
          setMsg('👉 挑出 3 張點數總和為 10 的倍數'); setMsgColor('#fff');
        }
      }
    } else if (roomData.status === 'showdown' && lastStatus !== 'showdown') {
      setLastStatus('showdown'); setTimeLeft(null);
      const dealer = roomData.players.find(p => p.name === roomData.dealer);
      if (me.name === roomData.dealer) {
        let winCount = 0; let loseCount = 0;
        roomData.players.forEach(p => { if (p.name !== me.name && p.result) { compareHands(me.hand, me.result, p.hand, p.result) ? winCount++ : loseCount++; }});
        if (winCount === 0 && loseCount === 0) setMsg('👀 攤牌結果揭曉！');
        else if (winCount >= loseCount) { setMsg(`👑 庄家通殺！贏 ${winCount} 輸 ${loseCount}`); setMsgColor('#ffd700'); }
        else { setMsg(`💸 慘遭圍剿！贏 ${winCount} 輸 ${loseCount}`); setMsgColor('#ff1744'); }
      } else {
        if (dealer?.result && me.result) {
          if (compareHands(me.hand, me.result, dealer.hand, dealer.result)) { setMsg('🎉 你贏了庄家！'); setMsgColor('#00e676'); }
          else { setMsg('💀 庄家獲勝！'); setMsgColor('#ff1744'); }
        }
      }
    } else if (roomData.status === 'waiting' && lastStatus !== 'waiting') {
      setLastStatus('waiting'); setMsg(isOwner ? '等待玩家加入，點擊「開始遊戲」' : '等待房主開始...'); setMsgColor('#fff'); setTimeLeft(null);
    }
  }, [roomData?.status, me?.hand, isOwner, me, roomData?.dealer, roomData?.players, roomData?.timeLimit, lastStatus]);

  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0 || roomData?.status !== 'playing') return;
    const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, roomData?.status]);

  useEffect(() => {
    if (timeLeft === 0 && roomData?.status === 'playing' && !me?.isReady && !isNoNiu) {
      setMsg('⏰ 超時！強制以「無牛」交卷...'); setMsgColor('#ff1744'); setIsNoNiu(true); 
    }
  }, [timeLeft, roomData?.status, me?.isReady, isNoNiu]);

  useEffect(() => {
    if (isNoNiu && timeLeft === 0 && roomData?.status === 'playing' && !me?.isReady) {
      const timer = setTimeout(() => submitHand({ manualResult: { type: '無牛', weight: 0 } }), 1500);
      return () => clearTimeout(timer);
    }
  }, [isNoNiu, timeLeft, roomData?.status, me?.isReady, submitHand]);

  const toggleCardSelection = (index) => {
    if (!isPlaying || me?.isReady || manualResult?.weight >= 800 || isNoNiu) return;
    setSelectedIndices(prev => {
      let newSel = [...prev];
      if (newSel.includes(index)) newSel = newSel.filter(i => i !== index);
      else if (newSel.length < 3) newSel.push(index);
      return newSel;
    });
  };

  useEffect(() => {
    if (roomData?.status !== 'playing') return;
    if (selectedIndices.length === 3 && me?.hand) {
      const sum = selectedIndices.reduce((acc, idx) => acc + me.hand[idx].value, 0);
      if (sum % 10 === 0) {
        const rem = [0, 1, 2, 3, 4].filter(idx => !selectedIndices.includes(idx));
        const niuSum = me.hand[rem[0]].value + me.hand[rem[1]].value;
        const finalNiu = niuSum % 10 === 0 ? 10 : niuSum % 10;
        setManualResult({ type: finalNiu === 10 ? '鬥牛 (牛牛)' : `牛${finalNiu}`, weight: finalNiu * 10 });
        setMsg(`✅ 湊滿了！牌型：【${finalNiu === 10 ? '鬥牛' : '牛' + finalNiu}】`); setMsgColor('#00e676'); setIsNoNiu(false);
      } else {
        setMsg(`❌ 加總不是 10 的倍數喔！`); setMsgColor('#ff1744'); setManualResult(null);
      }
    } else if (selectedIndices.length > 0 && selectedIndices.length < 3) {
      setMsg(`👉 已選 ${selectedIndices.length}/3 張牌`); setMsgColor('#fff'); setManualResult(null);
    }
  }, [selectedIndices, me?.hand, roomData?.status]);

  const handleDeclareNoNiu = () => {
    setIsNoNiu(true); setManualResult({ type: '無牛', weight: 0 }); setSelectedIndices([]);
    setMsg('🤷‍♂️ 宣告無牛！等待結算。'); setMsgColor('#9e9e9e');
  };

  const handleLeaveGame = () => {
    if (window.confirm("⚠️ 確定要離開嗎？")) { leaveRoom(); navigate('/'); }
  };

  // ✨ 調整卡牌尺寸適應手機
  const renderCard = (card, idx, isSelectable = false, isSelected = false, isHidden = false) => {
    const cardStyle = {
      width: '45px', height: '65px', margin: '0 -5px', borderRadius: '4px', zIndex: idx, position: 'relative',
      boxShadow: isSelected ? '0 0 10px rgba(255,215,0,0.8)' : '1px 1px 4px rgba(0,0,0,0.4)',
      transform: isSelected ? 'translateY(-10px)' : 'translateY(0)',
      border: isSelected ? '2px solid #ffd700' : 'none', transition: 'all 0.2s ease', userSelect: 'none'
    };
    if (isHidden || !card) return <div key={idx} style={{ ...cardStyle, background: 'repeating-linear-gradient(45deg, #0d47a1, #0d47a1 8px, #1976d2 8px, #1976d2 16px)', border: '1px solid white' }} />;
    return (
      <div key={idx} onClick={() => isSelectable && toggleCardSelection(idx)} style={{ ...cardStyle, backgroundColor: 'white', color: card.color === 'red' ? '#d32f2f' : '#212121', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', fontSize: '1rem', cursor: isSelectable ? 'pointer' : 'default', border: isSelected ? '2px solid #ffd700' : '1px solid #ccc' }}>
        <div style={{ lineHeight: '1' }}>{card.rank}</div>
        <div style={{ fontSize: '1.2rem', lineHeight: '1' }}>{card.suit}</div>
      </div>
    );
  };

  if (!roomId) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#121212', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '16px' }}>
        <NiuNiuLobby onCreateRoom={createRoom} onJoinRoom={joinRoom} onBack={() => navigate('/')} username={user.email} />
      </div>
    );
  }

  return (
    // ✨ 滿版深色背景，內部限制 maxWidth 450px 居中
    <div style={{ minHeight: '100vh', backgroundColor: '#121212', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '5px' }}>
      
      {/* 頂部狀態列 */}
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

      {/* 🎰 主牌桌 (MaxWidth: 450px) */}
      <div style={{ width: '100%', maxWidth: '450px', flex: 1, background: 'radial-gradient(circle, #226b3a 0%, #11361c 100%)', border: '6px solid #4a2e15', borderRadius: '15px', padding: '10px', boxSizing: 'border-box', boxShadow: 'inset 0 0 30px rgba(0,0,0,0.8)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        
        {/* 對手區域 (網格排列，適應窄螢幕) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {opponents.map((opp) => (
            <div key={opp.name} style={{ textAlign: 'center', background: 'rgba(0,0,0,0.3)', padding: '8px', borderRadius: '10px', position: 'relative' }}>
              {activeEmojis[opp.name] && <div style={{ position: 'absolute', top: '-25px', left: '50%', transform: 'translateX(-50%)', fontSize: '1.5rem', zIndex: 10 }}>{activeEmojis[opp.name]}</div>}
              
              {/* ✨ 顯示對手暱稱 */}
              <div style={{ margin: '0 0 5px 0', fontSize: '0.85rem', color: roomData.dealer === opp.name ? '#ffd700' : '#fff', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {roomData.dealer === opp.name && '👑 '} {opp.nickname || opp.name.split('@')[0]} {opp.isReady && '✅'}
                <div style={{ color: '#fcd34d', fontSize: '0.75rem' }}>💰 {opp.chips ?? 1000}</div>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'center', height: '65px' }}>
                {[0,1,2,3,4].map(idx => renderCard(opp.hand ? opp.hand[idx] : null, idx, false, false, !isShowdown && opp.hand && opp.hand.length > 0))}
              </div>
              
              {isShowdown && opp.result && (
                <div style={{ marginTop: '5px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ background: 'rgba(0,0,0,0.7)', color: '#00e676', padding: '2px 8px', borderRadius: '10px', border: '1px solid #00e676', fontSize: '0.75rem' }}>{opp.result.type}</div>
                  {opp.scoreChange !== 0 && <div style={{ color: opp.scoreChange > 0 ? '#00e676' : '#ff1744', fontWeight: 'bold', fontSize: '0.9rem' }}>{opp.scoreChange > 0 ? `+${opp.scoreChange}` : opp.scoreChange}</div>}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 遊戲訊息與操作區 */}
        <div style={{ textAlign: 'center', margin: '15px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: msgColor, textShadow: '1px 1px 2px black' }}>{msg}</div>
            {timeLeft !== null && <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: timeLeft <= 10 ? '#ff1744' : '#00e676' }}>⏱️ {timeLeft}s</div>}
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {roomData.status === 'waiting' && isOwner && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <button onClick={() => startGame()} disabled={notEnoughPlayers} style={{ padding: '8px 20px', background: notEnoughPlayers ? '#9e9e9e' : 'linear-gradient(to bottom, #fbc02d, #f57f17)', color: '#3e2723', border: 'none', borderRadius: '20px', fontSize: '0.95rem', fontWeight: 'bold', cursor: notEnoughPlayers ? 'not-allowed' : 'pointer' }}>🎮 開始遊戲</button>
                {notEnoughPlayers && <div style={{ color: '#ff1744', marginTop: '5px', fontSize: '0.8rem', fontWeight: 'bold' }}>⚠️ 需至少 2 人</div>}
              </div>
            )}
            {isPlaying && !me?.isReady && (
              <>
                <button onClick={handleDeclareNoNiu} style={{ padding: '8px 16px', background: 'linear-gradient(to bottom, #9e9e9e, #616161)', color: 'white', border: 'none', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 'bold' }}>🤷‍♂️ 無牛</button>
                <button onClick={() => submitHand({ manualResult: manualResult || { type: '無牛', weight: 0 } })} disabled={!manualResult && !isNoNiu} style={{ padding: '8px 16px', border: 'none', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 'bold', background: (manualResult || isNoNiu) ? 'linear-gradient(to bottom, #fbc02d, #f57f17)' : '#9e9e9e', color: (manualResult || isNoNiu) ? '#3e2723' : '#616161' }}>✅ 確認</button>
              </>
            )}
          </div>
        </div>

        {/* 玩家自己的區域 */}
        {me && (
          <div style={{ textAlign: 'center', background: 'rgba(0,0,0,0.5)', padding: '12px', borderRadius: '12px', border: roomData.dealer === me.name ? '2px solid #ffd700' : 'none', position: 'relative' }}>
            {activeEmojis[me.name] && <div style={{ position: 'absolute', top: '-30px', left: '50%', transform: 'translateX(-50%)', fontSize: '1.8rem', zIndex: 10 }}>{activeEmojis[me.name]}</div>}

            {/* ✨ 顯示自己暱稱 */}
            <div style={{ margin: '0 0 8px 0', fontSize: '1rem', fontWeight: 'bold', color: roomData.dealer === me.name ? '#ffd700' : 'white' }}>
              {roomData.dealer === me.name && '👑 '} {me.nickname || me.name.split('@')[0]} {me.isReady && '✅'}
              <span style={{ color: '#ffd700', marginLeft: '10px' }}>💰 {me.chips ?? 1000}</span>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'center', height: '80px', alignItems: 'flex-end' }}>
              {[0,1,2,3,4].map(idx => renderCard(me.hand ? me.hand[idx] : null, idx, isPlaying && !me.isReady, selectedIndices.includes(idx), false))}
            </div>
            
            {isShowdown && me.result && (
              <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ background: 'rgba(0,0,0,0.8)', color: '#00e676', padding: '4px 12px', borderRadius: '15px', border: '1px solid #00e676', fontSize: '0.9rem', fontWeight: 'bold' }}>{me.result.type}</div>
                {me.scoreChange !== 0 && <div style={{ color: me.scoreChange > 0 ? '#00e676' : '#ff1744', fontWeight: 'bold', fontSize: '1.2rem', marginTop: '5px' }}>{me.scoreChange > 0 ? `+${me.scoreChange}` : me.scoreChange}</div>}
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ position: 'fixed', bottom: '15px', right: '15px', zIndex: 50 }}>
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
            <h2 style={{ color: '#ffd700', textAlign: 'center', margin: '0 0 15px 0', fontSize: '1.3rem' }}>📜 鬥牛規則</h2>
            <div style={{ lineHeight: '1.5', fontSize: '0.9rem' }}>
              <p>選出 3 張加總為 10 倍數的牌(湊牛)，剩下 2 張決定「牛幾」。</p>
              <h3 style={{ color: '#00e676', borderBottom: '1px solid #00e676', fontSize: '1rem' }}>牌型倍率</h3>
              <ul style={{ paddingLeft: '20px', margin: '5px 0' }}>
                <li>五小牛/四炸/五花牛：5 倍</li>
                <li>鬥牛 (牛牛)：4 倍</li>
                <li>牛九：3 倍</li>
                <li>牛七、牛八：2 倍</li>
                <li>無牛 ~ 牛六：1 倍</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}