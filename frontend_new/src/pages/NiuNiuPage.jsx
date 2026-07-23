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

  return null; // 不是特殊牌型，交由玩家手動湊牛
}

export default function NiuNiuPage({ user }) {
  const navigate = useNavigate();
  const username = user.email;
  
  const baseWsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:53840/ws';
  const wsUrl = `${baseWsUrl}?username=${encodeURIComponent(username)}`;

  const {
    createRoom, joinRoom, startGame, submitHand, leaveRoom,
    gameState: { roomId, roomData }
  } = useNiuNiuSocket(wsUrl);

  // 玩家理牌狀態
  const [selectedIndices, setSelectedIndices] = useState([]);
  const [manualResult, setManualResult] = useState(null);
  const [isNoNiu, setIsNoNiu] = useState(false);
  const [msg, setMsg] = useState('等待遊戲開始...');
  const [msgColor, setMsgColor] = useState('#fff');
  const [timeLeft, setTimeLeft] = useState(null);
  const [lastStatus, setLastStatus] = useState(null); // ✨ 新增：用來追蹤上一次的狀態
  // 取得目前玩家與其他對手
  const me = useMemo(() => roomData?.players.find(p => p.name === username), [roomData, username]);
  const opponents = useMemo(() => roomData?.players.filter(p => p.name !== username) || [], [roomData, username]);
  const isOwner = roomData?.owner === username;
  const isPlaying = roomData?.status === 'playing';
  const isShowdown = roomData?.status === 'showdown';

  // 處理遊戲狀態改變與倒數計時
  // 處理遊戲狀態改變與倒數計時
  useEffect(() => {
    if (!roomData) return;

    // ✨ 關鍵修復：加入 lastStatus 判斷，確保每局只重置一次，不會因為對手出牌而清空你的畫面
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
      
      if (me && roomData.dealer !== me.name) {
        const dealer = roomData.players.find(p => p.name === roomData.dealer);
        if (me.result && dealer?.result) {
          if (me.result.weight > dealer.result.weight) {
            setMsg('🎉 恭喜！你贏了庄家！');
            setMsgColor('#00e676');
          } else {
            setMsg('💀 遺憾！庄家獲勝！');
            setMsgColor('#ff1744');
          }
        }
      } else {
        setMsg('👀 攤牌結果揭曉！');
        setMsgColor('#fff');
      }
    } 
    else if (roomData.status === 'waiting' && lastStatus !== 'waiting') {
      setLastStatus('waiting');
      setMsg(isOwner ? '等待其他玩家加入，點擊「開始遊戲」' : '等待房主開始遊戲...');
      setMsgColor('#fff');
      setTimeLeft(null);
    }
  }, [roomData?.status, me?.hand, isOwner, me, roomData?.dealer, roomData?.players, roomData?.timeLimit, lastStatus]);

  // 倒數計時器邏輯
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0 || roomData?.status !== 'playing') return;
    const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, roomData?.status]);

  // 點擊卡片邏輯
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

  // 即時驗證選中牌
  useEffect(() => {
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
  }, [selectedIndices, me?.hand]);

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

  // 繪製撲克牌小元件
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

  // 遊戲大廳
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
        {timeLeft !== null && (
          <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: timeLeft <= 10 ? '#ff1744' : '#00e676' }}>
            ⏱️ {timeLeft}s
          </div>
        )}
      </header>

      {/* 🎰 賭桌主視覺 */}
      <div style={{ 
        width: '100%', maxWidth: '900px', flex: 1, 
        background: 'radial-gradient(circle, #226b3a 0%, #11361c 100%)',
        border: '10px solid #4a2e15', borderRadius: '20px', padding: '20px',
        boxShadow: 'inset 0 0 50px rgba(0,0,0,0.5), 0 10px 30px rgba(0,0,0,0.8)',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
      }}>
        
        {/* 對手區域 (顯示於上方) */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '20px' }}>
          {opponents.map((opp) => (
            <div key={opp.name} style={{ textAlign: 'center', background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '12px' }}>
              <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem', color: roomData.dealer === opp.name ? '#ffd700' : '#fff' }}>
                {roomData.dealer === opp.name && '👑 '} {opp.name.split('@')[0]} {opp.isReady && '✅'}
              </h3>
              <div style={{ display: 'flex', justifyContent: 'center', height: '90px' }}>
                {/* 狀態為 playing 時顯示蓋牌，showdown 顯示亮牌，否則顯示空牌框 */}
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
              {isShowdown && opp.result && (
                <div style={{ marginTop: '10px', background: 'rgba(0,0,0,0.7)', color: '#00e676', padding: '4px 12px', borderRadius: '15px', border: '1px solid #00e676', display: 'inline-block', fontSize: '0.9rem' }}>
                  {opp.result.type}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 遊戲訊息與操作區 (中央) */}
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

        {/* 玩家自己的區域 (下方) */}
        {me && (
          <div style={{ textAlign: 'center', background: 'rgba(0,0,0,0.4)', padding: '15px', borderRadius: '15px', border: roomData.dealer === me.name ? '2px solid #ffd700' : 'none' }}>
            <h2 style={{ margin: '0 0 15px 0', fontSize: '1.2rem', color: roomData.dealer === me.name ? '#ffd700' : '#fff' }}>
              {roomData.dealer === me.name && '👑 '} 你的手牌 {me.isReady && '(已確認 ✅)'}
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
            {isShowdown && me.result && (
              <div style={{ marginTop: '15px', background: 'rgba(0,0,0,0.8)', color: '#00e676', padding: '6px 16px', borderRadius: '20px', border: '2px solid #00e676', display: 'inline-block', fontSize: '1.2rem', fontWeight: 'bold' }}>
                {me.result.type}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}