import React, { useEffect, useLayoutEffect, useState, useRef } from 'react';
import useWebSocket from 'react-use-websocket';
import { Link, useNavigate } from "react-router-dom";

export function Home({ username ,onLogout}) {
  const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:53840/ws';
  const navigate = useNavigate();
  const { sendJsonMessage, lastJsonMessage } = useWebSocket(WS_URL, {
    share: true,
    queryParams: { username },
  });

  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [onlineCount, setOnlineCount] = useState(1);
  const [mapCount, setMapCount] = useState(0);
  
  const [activeTab, setActiveTab] = useState('world'); 
  // ✨ 核心修復 1：用 Ref 追蹤當前的 Tab，避免切換 Tab 時重複觸發訊息接收
  const activeTabRef = useRef(activeTab);
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  const [hasMore, setHasMore] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);

  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadSystemCount, setUnreadSystemCount] = useState(0);
  const [toastMsg, setToastMsg] = useState(null);

  const chatBoxRef = useRef(null);
  const messagesEndRef = useRef(null);
  const isAtBottomRef = useRef(true); 
  const fileInputRef = useRef(null); 

  const isLoadingMoreRef = useRef(false);
  const scrollDistanceToBottomRef = useRef(0);
  const forceScrollRef = useRef(false); 

  const { getWebSocket } = useWebSocket(WS_URL, { share: true, queryParams: { username } });

  const handleLogout = () => {
    const ws = getWebSocket();
    if (ws) ws.close(1000, 'User logout'); 
    localStorage.removeItem('user');
    if (typeof onLogout === 'function') onLogout();
    navigate('/login', { replace: true });
  };

  const scrollToBottom = () => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTo({ top: chatBoxRef.current.scrollHeight, behavior: 'smooth' });
      setUnreadCount(0);
      isAtBottomRef.current = true;
    }
  };

  const handleScroll = () => {
    if (!chatBoxRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatBoxRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
    isAtBottomRef.current = isAtBottom;
    if (isAtBottom && unreadCount > 0) setUnreadCount(0);
  };

  const loadMoreMessages = () => {
    if (isLoadingHistory || !hasMore) return;
    setIsLoadingHistory(true);
    isLoadingMoreRef.current = true;
    if (chatBoxRef.current) scrollDistanceToBottomRef.current = chatBoxRef.current.scrollHeight - chatBoxRef.current.scrollTop;
    
    const dbMessageCount = messages.filter(m => m.type !== 'system' && !/^guest_/i.test(m.sender) && !m.isGuest && m.channel !== 'room').length;
    sendJsonMessage({ type: 'LOAD_MORE_MESSAGES', data: { skip: dbMessageCount, limit: 50 } });
  };

  useEffect(() => {
    if (toastMsg) {
      const timer = setTimeout(() => setToastMsg(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toastMsg]);

  useEffect(() => {
    if (!lastJsonMessage) return;

    if (lastJsonMessage.type === 'INITIAL_HISTORY') {
      const historyMsgs = lastJsonMessage.data;
      if (historyMsgs && historyMsgs.length > 0) {
        setMessages(historyMsgs);
        forceScrollRef.current = true; 
      }
    } 
    else if (lastJsonMessage.type === 'MORE_HISTORY') {
      setIsLoadingHistory(false);
      const historyMsgs = lastJsonMessage.data;
      if (historyMsgs.length > 0) {
        setMessages((prev) => [...historyMsgs, ...prev]);
        if (historyMsgs.length < 50) setHasMore(false);
      } else {
        setHasMore(false); isLoadingMoreRef.current = false;
      }
    } 
    else if (Array.isArray(lastJsonMessage)) {
      const statusMsg = lastJsonMessage.find(msg => msg?.type === 'SYSTEM_STATUS');
      if (statusMsg) {
        setOnlineCount(statusMsg.data.online);
        setMapCount(statusMsg.data.map);
      }

      const validMessages = lastJsonMessage.filter(msg => msg?.type === 'text' || msg?.type === 'file' || msg?.type === 'system');
    
      if (validMessages.length > 0) {
        const sysMsgs = validMessages.filter(m => m.type === 'system');
        if (sysMsgs.length > 0) {
          setToastMsg(sysMsgs[sysMsgs.length - 1].content);
          // ✨ 使用 activeTabRef 來判斷，就不會產生依賴連鎖反應
          if (activeTabRef.current !== 'system') setUnreadSystemCount(c => c + sysMsgs.length);
        }

        setMessages((prev) => {
          const hasMyMessage = validMessages.some(m => m.sender === username);
          if (isAtBottomRef.current || hasMyMessage) {
            forceScrollRef.current = true;
          } else {
            // ✨ 同樣使用 activeTabRef
            const visibleMsgs = validMessages.filter(m => (activeTabRef.current === 'world' && m.type !== 'system') || (activeTabRef.current === 'system' && m.type === 'system'));
            if (visibleMsgs.length > 0) setUnreadCount(c => c + visibleMsgs.length);
          }
          return [...prev, ...validMessages];
        });
      }
    }
  // ✨ 核心修復 2：從依賴陣列中徹底移除 activeTab，解決切換 Tab 會重複跑馬燈與重複訊息的 Bug！
  }, [lastJsonMessage, username]); 

  useEffect(() => {
    if (forceScrollRef.current) {
      requestAnimationFrame(() => scrollToBottom());
      forceScrollRef.current = false;
    }
  }, [messages, activeTab]);

  useLayoutEffect(() => {
    if (isLoadingMoreRef.current && chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight - scrollDistanceToBottomRef.current;
      isLoadingMoreRef.current = false; 
    }
  }, [messages]);

  const sendMessage = () => {
    if (!message.trim()) return;
    sendJsonMessage({
      type: 'CHAT_MESSAGE',
      data: {
        content: message, type: 'text',
        replyTo: replyingTo ? { sender: replyingTo.sender, content: replyingTo.type === 'text' ? replyingTo.content : '[圖片/檔案]' } : null
      },
    });
    setMessage('');
    setReplyingTo(null);
    forceScrollRef.current = true; 
  };

  const sendFile = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('File is too large! Please upload a file smaller than 5MB.');
      event.target.value = ''; return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      sendJsonMessage({
        type: 'CHAT_MESSAGE',
        data: {
          type: 'file', content: reader.result, filename: file.name, mimeType: file.type,
          replyTo: replyingTo ? { sender: replyingTo.sender, content: replyingTo.type === 'text' ? replyingTo.content : '[圖片/檔案]' } : null
        },
      });
      setReplyingTo(null); forceScrollRef.current = true; 
    };
    reader.readAsDataURL(file);
  };

  const renderContent = (msg) => {
    const { type, content, mimeType, filename } = msg;
    if (type === 'text') return <span>{content}</span>;
    if (type === 'file') {
      if (mimeType?.startsWith('image/')) return <img src={content} alt={filename} className="media" style={{ maxWidth: '100%', maxHeight: '250px', width: 'auto', borderRadius: '8px' }} />;
      else if (mimeType?.startsWith('video/')) return <video controls className="media" style={{ maxWidth: '100%', maxHeight: '250px', borderRadius: '8px' }}><source src={content} type={mimeType} /></video>;
      else if (mimeType?.startsWith('audio/')) return <audio controls className="media" style={{ maxWidth: '100%' }}><source src={content} type={mimeType} /></audio>;
      else return <a href={content} download={filename} className="file-link" style={{ wordBreak: 'break-all' }}>📄 Download {filename}</a>;
    }
    return null;
  };

  const renderBadge = (msg) => {
    if (msg.type === 'system' || msg.sender === 'System') return <span style={{ background: '#dc2626', color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', marginRight: '5px' }}>📢 系統</span>;
    const isGuest = /^guest_/i.test(msg.sender) || msg.isGuest;
    if (isGuest) return <span style={{ background: '#4b5563', color: '#d1d5db', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', marginRight: '5px' }}>👤 遊客</span>;
    return <span style={{ background: 'linear-gradient(45deg, #f59e0b, #d97706)', color: '#fffbeb', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold', marginRight: '5px', boxShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>⭐ 會員</span>;
  };

  const filteredMessages = messages.filter(msg => {
    if (activeTab === 'world') return msg.type !== 'system';
    if (activeTab === 'system') return msg.type === 'system';
    return true;
  });

  return (
    <div className="chat-container">
      <div className="background-blur" />
      
      <style>
        {`
          @keyframes toast-fade {
            0% { opacity: 0; transform: translate(-50%, -20px); }
            10% { opacity: 1; transform: translate(-50%, 0); }
            90% { opacity: 1; transform: translate(-50%, 0); }
            100% { opacity: 0; transform: translate(-50%, -20px); }
          }
        `}
      </style>

      <div className="content-wrapper" style={{ position: 'relative' }}>
        
        {/* ✨ 核心修復 3：全域系統浮動提示 (解決文字超出螢幕的問題) */}
        {toastMsg && activeTab === 'world' && (
          <div style={{ 
            position: 'absolute', top: '15px', left: '50%', transform: 'translate(-50%, 0)', 
            zIndex: 100, background: 'rgba(0,0,0,0.85)', color: '#fcd34d', 
            padding: '10px 20px', borderRadius: '25px', fontSize: '0.9rem', 
            fontWeight: 'bold', boxShadow: '0 4px 15px rgba(0,0,0,0.4)', 
            border: '1px solid #b45309', 
            maxWidth: '90vw', wordBreak: 'break-word', textAlign: 'center', whiteSpace: 'normal', lineHeight: '1.4', /* ✨ 允許換行且限制寬度 */
            animation: 'toast-fade 3.5s forwards', pointerEvents: 'none' 
          }}>
            🔔 {toastMsg}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <h1 className='rainbow-text' style={{ margin: 0 }}>Chat Room</h1>
          <div style={{ display: 'flex', gap: '15px', background: 'rgba(255,255,255,0.75)', padding: '8px 16px', borderRadius: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', fontWeight: 'bold', fontSize: '0.9rem' }}>
            <span style={{ color: '#4caf50', display: 'flex', alignItems: 'center', gap: '5px' }}>🟢 在線人數: {onlineCount}</span>
            <span style={{ color: '#2196f3', display: 'flex', alignItems: 'center', gap: '5px' }}>🌎 地圖探索中: {mapCount}</span>
          </div>
        </div>
        
        <div className='name' style={{ marginTop: '5px' }}>Some extra functions:</div>
        
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center', margin: '15px 0' }}>
          <button 
            onClick={() => navigate('/blackjack')} 
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', height: '30px', padding: '0 16px', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.3)', textShadow: '1px 1px 2px rgba(0,0,0,0.8)', boxSizing: 'border-box', background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: '#93c5fd', border: '1px solid #334155' }}
          >
            <span style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center' }}>🎰</span> 21點
          </button>

          <button 
            onClick={() => navigate('/niuniu')} 
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', height: '30px', padding: '0 16px', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.3)', textShadow: '1px 1px 2px rgba(0,0,0,0.8)', boxSizing: 'border-box', background: 'linear-gradient(135deg, #1b4d2e 0%, #0d2617 100%)', color: '#a7f3d0', border: '1px solid #2e6930' }}
          >
            <span style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center' }}>🃏</span> 撲克鬥牛
          </button>

          <button 
            onClick={() => navigate('/loveletter')} 
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', height: '30px', padding: '0 16px', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.3)', textShadow: '1px 1px 2px rgba(0,0,0,0.8)', boxSizing: 'border-box', background: 'linear-gradient(135deg, #7f1d1d 0%, #4a0404 100%)', color: '#fcd34d', border: '1px solid #b45309' }}
          >
            <span style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center' }}>💌</span> 情書
          </button>

          <button 
            onClick={() => navigate('/map')} 
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', height: '30px', padding: '0 16px', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.3)', textShadow: '1px 1px 2px rgba(0,0,0,0.8)', boxSizing: 'border-box', background: 'linear-gradient(135deg, #0f766e 0%, #042f2e 100%)', color: '#99f6e4', border: '1px solid #115e59' }}
          >
            <span style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center' }}>🌏</span> 地圖探索
          </button>

          <button 
            onClick={() => navigate('/draw-guess')} 
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', height: '30px', padding: '0 16px', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.3)', textShadow: '1px 1px 2px rgba(0,0,0,0.8)', boxSizing: 'border-box', background: 'linear-gradient(135deg, #6b21a8 0%, #3b0764 100%)', color: '#e9d5ff', border: '1px solid #581c87' }}
          >
            <span style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center' }}>🎨</span> 你畫我猜
          </button>
        </div>
  
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', width: '100%', flex: 1, overflow: 'hidden', minHeight: '200px' }}>
          
          <div style={{ display: 'flex', gap: '5px', padding: '0 15px', marginTop: '5px' }}>
            <button 
              onClick={() => { setActiveTab('world'); forceScrollRef.current = true; }}
              style={{ 
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', /* ✨ 使用 Flex 置中並統一間距 */
                flex: 1, padding: '10px', borderRadius: '12px 12px 0 0', border: 'none', 
                background: activeTab === 'world' ? '#fff' : 'rgba(255,255,255,0.4)', 
                fontWeight: 'bold', cursor: 'pointer', 
                borderBottom: activeTab === 'world' ? '4px solid #4caf50' : '4px solid transparent', 
                color: activeTab === 'world' ? '#333' : '#666', transition: 'all 0.2s',
                fontSize: '0.80rem' /* ✨ 設定文字大小 */
              }}
            >
              {/* ✨ 將圖示獨立包起來，設定合適的大小 (例如 1.05rem 或 1.1rem) */}
              <span style={{ fontSize: '0.80rem', display: 'flex', alignItems: 'center' }}>🌍</span> 
              <span>綜合大廳</span>
            </button>

            <button 
              onClick={() => { setActiveTab('system'); setUnreadSystemCount(0); forceScrollRef.current = true; }}
              style={{ 
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', /* ✨ 使用 Flex 置中並統一間距 */
                flex: 1, padding: '10px', borderRadius: '12px 12px 0 0', border: 'none', 
                background: activeTab === 'system' ? '#fff' : 'rgba(255,255,255,0.4)', 
                fontWeight: 'bold', cursor: 'pointer', 
                borderBottom: activeTab === 'system' ? '4px solid #f44336' : '4px solid transparent', 
                color: activeTab === 'system' ? '#333' : '#666', transition: 'all 0.2s',
                fontSize: '0.80rem' /* ✨ 設定文字大小 */
              }}
            >
              {/* ✨ 將圖示獨立包起來控制大小 */}
              <span style={{ fontSize: '0.80rem', display: 'flex', alignItems: 'center' }}>📢</span> 
              <span>系統廣播</span>
              {unreadSystemCount > 0 && activeTab !== 'system' && (
                <span style={{ background: '#ef4444', color: 'white', padding: '1px 6px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 'bold', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
                  {unreadSystemCount}
                </span>
              )}
            </button>
          </div>

          <div className="chat-box" ref={chatBoxRef} onScroll={handleScroll} style={{ display: 'flex', flexDirection: 'column', gap: '15px', padding: '15px', overflowY: 'auto', flex: 1, background: '#fff', borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px' }}>
            {activeTab === 'system' && filteredMessages.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af', gap: '10px' }}>
                <span style={{ fontSize: '3rem' }}>📭</span>
                <p>目前沒有新的系統廣播</p>
                <p style={{ fontSize: '0.75rem' }}>(系統廣播為閱後即焚，重整後將會清空)</p>
              </div>
            )}

            {hasMore && filteredMessages.length >= 20 && activeTab === 'world' && (
              <button 
                onClick={loadMoreMessages} disabled={isLoadingHistory}
                style={{ background: 'transparent', border: 'none', color: '#aaa', fontSize: '0.85rem', cursor: isLoadingHistory ? 'default' : 'pointer', padding: '5px 0 15px 0', textAlign: 'center', width: '100%', outline: 'none', transition: 'color 0.2s' }}
              >
                {isLoadingHistory ? '載入中...' : '⟳ 點擊載入較舊的訊息 (每次 50 條)'}
              </button>
            )}

            {filteredMessages.map((msg, index) => {
              const isOwnMessage = msg.sender === username;
              const isGuest = /^guest_/i.test(msg.sender) || msg.isGuest;
              
              if (msg.type === 'system') {
                return (
                  <div key={index} style={{ display: 'flex', justifyContent: 'center', width: '100%', margin: '5px 0' }}>
                    <div style={{ background: 'rgba(0,0,0,0.08)', padding: '6px 14px', borderRadius: '20px', fontSize: '0.85rem', color: '#666', fontWeight: 'bold' }}>
                      🔔 {msg.content}
                    </div>
                  </div>
                );
              }

              return (
                <div key={index} style={{ display: 'flex', flexDirection: 'column', alignItems: isOwnMessage ? 'flex-end' : 'flex-start', width: '100%', opacity: isGuest ? 0.85 : 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.75rem', color: '#888', marginBottom: '4px', padding: '0 5px' }}>
                    {!isOwnMessage && renderBadge(msg)}
                    <span>{msg.sender.split('@')[0]}</span>
                    {isOwnMessage && <span style={{ marginLeft: '5px' }}>{renderBadge(msg)}</span>}
                  </div>
                  
                  <div style={{
                    background: isOwnMessage ? '#95ec69' : '#f4f4f5', padding: '10px 15px',
                    borderRadius: isOwnMessage ? '15px 4px 15px 15px' : '4px 15px 15px 15px', 
                    boxShadow: '0 2px 5px rgba(0,0,0,0.05)', maxWidth: '85%', display: 'flex', flexDirection: 'column', gap: '5px'
                  }}>
                    {msg.replyTo && (
                      <div style={{ background: isOwnMessage ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.04)', borderLeft: `3px solid ${isOwnMessage ? '#5f9e40' : '#ccc'}`, padding: '6px 8px', borderRadius: '4px', fontSize: '0.8rem', color: isOwnMessage ? '#4a7a32' : '#666', marginBottom: '4px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word' }}>
                        <strong style={{ opacity: 0.8 }}>{msg.replyTo.sender.split('@')[0]}</strong><br/>
                        {msg.replyTo.content}
                      </div>
                    )}

                    <div style={{ fontSize: '1rem', color: '#222', wordBreak: 'break-word' }}>{renderContent(msg)}</div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '2px', gap: '15px' }}>
                      <button onClick={() => setReplyingTo(msg)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '0.75rem', fontWeight: 'bold', color: isOwnMessage ? 'rgba(0,0,0,0.3)' : '#aaa' }}>↩ 回覆</button>
                      <span style={{ fontSize: '0.7rem', color: isOwnMessage ? '#5f9e40' : '#999', whiteSpace: 'nowrap' }}>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {unreadCount > 0 && (
            <button onClick={scrollToBottom} style={{ position: 'absolute', bottom: '20px', right: '20px', background: '#4caf50', color: 'white', border: 'none', borderRadius: '20px', padding: '8px 16px', boxShadow: '0 4px 8px rgba(0,0,0,0.2)', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', zIndex: 10, transition: 'transform 0.2s' }}>
              <span>↓</span><span>{unreadCount/2} 條新訊息</span>
            </button>
          )}
        </div>
  
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '8px', marginTop: '10px' }}>
          {replyingTo && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.9)', padding: '8px 12px', borderRadius: '8px', borderLeft: '4px solid #4caf50', boxShadow: '0 2px 5px rgba(0,0,0,0.1)', fontSize: '0.85rem', color: '#555' }}>
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                正在回覆 <strong>{replyingTo.sender.split('@')[0]}</strong>: {replyingTo.type === 'text' ? replyingTo.content : '[圖片/檔案]'}
              </div>
              <button onClick={() => setReplyingTo(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', fontWeight: 'bold', padding: '0 5px' }}>✕</button>
            </div>
          )}

          <div className="chat-input">
            <input type="text" value={message} placeholder="Type a message..." onChange={(e) => setMessage(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && sendMessage()} />
            <button onClick={sendMessage}>Send</button>
            <input type="file" ref={fileInputRef} onChange={sendFile} style={{ display: 'none' }} />
            <button onClick={() => fileInputRef.current.click()}>📎</button>
          </div>
        </div>
  
        <div className="buttonContainer" style={{ marginTop: '20px' }}>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <a href="https://www.google.com/" target="_blank" rel="noopener noreferrer"><button className="nav-button"><span role="img" aria-label="google">🌐</span> Google</button></a>
            <button className='nav-button' onClick={handleLogout}>Log Out</button>
          </div>
          <div style={{ fontSize: '12px', marginTop: '10px', color: '#666' }}>(Your chat history is securely saved. Scroll up to load more.)</div>
        </div>
      </div>
    </div>
  );
}