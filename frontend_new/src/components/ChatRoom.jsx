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
  
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);

  // 滾動控制與未讀訊息狀態
  const [unreadCount, setUnreadCount] = useState(0);
  const chatBoxRef = useRef(null);
  const messagesEndRef = useRef(null);
  const isAtBottomRef = useRef(true); 
  const fileInputRef = useRef(null); 

  // 用於完美處理歷史訊息與新訊息滾動的 Refs
  const isLoadingMoreRef = useRef(false);
  const scrollDistanceToBottomRef = useRef(0);
  const forceScrollRef = useRef(false); // 🌟 新增：標記是否需要強制滾動到底部

  const { getWebSocket } = useWebSocket(WS_URL, {
    share: true,
    queryParams: { username },
  });

  const handleLogout = () => {
    const ws = getWebSocket();
    if (ws) ws.close(1000, 'User logout'); 
    localStorage.removeItem('user');
    if (typeof onLogout === 'function') onLogout();
    navigate('/login', { replace: true });
  };

  // 🌟 修復 1：改用直接控制父容器的 scrollTo，這在手機端更為穩定
  const scrollToBottom = () => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTo({
        top: chatBoxRef.current.scrollHeight,
        behavior: 'smooth'
      });
      setUnreadCount(0);
      isAtBottomRef.current = true;
    }
  };

  const handleScroll = () => {
    if (!chatBoxRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatBoxRef.current;
    
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
    isAtBottomRef.current = isAtBottom;

    if (isAtBottom && unreadCount > 0) {
      setUnreadCount(0);
    }
  };

  const loadMoreMessages = () => {
    if (isLoadingHistory || !hasMore) return;
    setIsLoadingHistory(true);
    isLoadingMoreRef.current = true;

    if (chatBoxRef.current) {
      scrollDistanceToBottomRef.current = chatBoxRef.current.scrollHeight - chatBoxRef.current.scrollTop;
    }

    sendJsonMessage({
      type: 'LOAD_MORE_MESSAGES',
      data: { skip: messages.length, limit: 50 } 
    });
  };

  useEffect(() => {
    if (!lastJsonMessage) return;

    if (Array.isArray(lastJsonMessage)) {
      const statusMsg = lastJsonMessage.find(msg => msg?.type === 'SYSTEM_STATUS');
      if (statusMsg) {
        setOnlineCount(statusMsg.data.online);
        setMapCount(statusMsg.data.map);
      }

      const validMessages = lastJsonMessage.filter(
        (msg) => msg?.type === 'text' || msg?.type === 'file' || msg?.type === 'system' 
      );
    
      if (validMessages.length > 0) {
        setMessages((prev) => {
          const isInitialLoad = prev.length === 0;
          const hasMyMessage = validMessages.some(m => m.sender === username);

          // 🌟 修復 2：不要用 setTimeout，而是立起「需要滾動」的旗幟 (Ref)
          if (isInitialLoad || isAtBottomRef.current || hasMyMessage) {
            forceScrollRef.current = true;
          } else {
            setUnreadCount(c => c + validMessages.length);
          }
          return [...prev, ...validMessages];
        });
      }
    } else if (lastJsonMessage.type === 'MORE_HISTORY') {
      setIsLoadingHistory(false);
      const historyMsgs = lastJsonMessage.data;
      
      if (historyMsgs.length > 0) {
        setMessages((prev) => [...historyMsgs, ...prev]);
        if (historyMsgs.length < 50) setHasMore(false);
      } else {
        setHasMore(false);
        isLoadingMoreRef.current = false;
      }
    }
  }, [lastJsonMessage, username]);

  // 🌟 修復 3：單獨監聽 messages 的變化。確保 React 把畫面畫完後，瞬間將畫面捲動到底部
  useEffect(() => {
    if (forceScrollRef.current) {
      requestAnimationFrame(() => {
        scrollToBottom();
      });
      forceScrollRef.current = false;
    }
  }, [messages]);

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
        content: message,
        type: 'text',
        replyTo: replyingTo ? {
          sender: replyingTo.sender,
          content: replyingTo.type === 'text' ? replyingTo.content : '[圖片/檔案]'
        } : null
      },
    });
    setMessage('');
    setReplyingTo(null);
    forceScrollRef.current = true; // 送出時標記強制滾動
  };

  const sendFile = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const MAX_FILE_SIZE = 5 * 1024 * 1024; 
    if (file.size > MAX_FILE_SIZE) {
      alert('File is too large! Please upload a file smaller than 5MB.');
      event.target.value = ''; 
      return;
    }
  
    const reader = new FileReader();
    reader.onload = () => {
      sendJsonMessage({
        type: 'CHAT_MESSAGE',
        data: {
          type: 'file',
          content: reader.result,
          filename: file.name,
          mimeType: file.type,
          replyTo: replyingTo ? {
            sender: replyingTo.sender,
            content: replyingTo.type === 'text' ? replyingTo.content : '[圖片/檔案]'
          } : null
        },
      });
      setReplyingTo(null);
      forceScrollRef.current = true; // 送出時標記強制滾動
    };
    reader.readAsDataURL(file);
  };

  const renderContent = (msg) => {
    const { type, content, mimeType, filename } = msg;

    if (type === 'text') return <span>{content}</span>;

    if (type === 'file') {
      if (mimeType?.startsWith('image/')) {
        return <img src={content} alt={filename} className="media" style={{ maxWidth: '100%', maxHeight: '250px', width: 'auto', borderRadius: '8px' }} />;
      } else if (mimeType?.startsWith('video/')) {
        return <video controls className="media" style={{ maxWidth: '100%', maxHeight: '250px', borderRadius: '8px' }}><source src={content} type={mimeType} /></video>;
      } else if (mimeType?.startsWith('audio/')) {
        return <audio controls className="media" style={{ maxWidth: '100%' }}><source src={content} type={mimeType} /></audio>;
      } else {
        return <a href={content} download={filename} className="file-link" style={{ wordBreak: 'break-all' }}>📄 Download {filename}</a>;
      }
    }
    return null;
  };

  return (
    <div className="chat-container">
      <div className="background-blur" />
      <div className="content-wrapper">
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <h1 className='rainbow-text' style={{ margin: 0 }}>Chat Room</h1>
          <div style={{ 
            display: 'flex', gap: '15px', background: 'rgba(255,255,255,0.75)', 
            padding: '8px 16px', borderRadius: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', 
            fontWeight: 'bold', fontSize: '0.9rem'
          }}>
            <span style={{ color: '#4caf50', display: 'flex', alignItems: 'center', gap: '5px' }}>
              🟢 在線人數: {onlineCount}
            </span>
            <span style={{ color: '#2196f3', display: 'flex', alignItems: 'center', gap: '5px' }}>
              🌎 地圖探索中: {mapCount}
            </span>
          </div>
        </div>
        
        <div className='name' style={{ marginTop: '5px' }}>Some extra functions:</div>
        
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center', margin: '15px 0' }}>
          
          <Link to="/map"><button className="nav-button">View Map</button></Link>
          <Link to="/draw-guess"><button className="nav-button">🎨 Start Drawing Game</button></Link>
        </div>
  
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', width: '100%', flex: 1, overflow: 'hidden' }}>
          
          <div 
            className="chat-box" 
            ref={chatBoxRef}
            onScroll={handleScroll} 
            style={{ display: 'flex', flexDirection: 'column', gap: '15px', padding: '15px', overflowY: 'auto', flex: 1 }}
          >
            {hasMore && messages.length >= 20 && (
              <button 
                onClick={loadMoreMessages}
                disabled={isLoadingHistory}
                style={{
                  background: 'transparent', border: 'none', color: '#aaa', fontSize: '0.85rem',
                  cursor: isLoadingHistory ? 'default' : 'pointer', padding: '5px 0 15px 0',
                  textAlign: 'center', width: '100%', outline: 'none', transition: 'color 0.2s'
                }}
                onMouseOver={(e) => !isLoadingHistory && (e.target.style.color = '#888')}
                onMouseOut={(e) => (e.target.style.color = '#aaa')}
              >
                {isLoadingHistory ? '載入中...' : '⟳ 點擊載入較舊的訊息 (每次 50 條)'}
              </button>
            )}

            {messages.map((msg, index) => {
              const isOwnMessage = msg.sender === username;
              
              if (msg.type === 'system') {
                return (
                  <div key={index} style={{ display: 'flex', justifyContent: 'center', width: '100%', margin: '5px 0' }}>
                    <div style={{ background: 'rgba(0,0,0,0.1)', padding: '6px 14px', borderRadius: '20px', fontSize: '0.8rem', color: '#555' }}>
                      🔔 {msg.content}
                    </div>
                  </div>
                );
              }

              return (
                <div key={index} style={{ 
                  display: 'flex', flexDirection: 'column', 
                  alignItems: isOwnMessage ? 'flex-end' : 'flex-start', width: '100%'
                }}>
                  <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '4px', padding: '0 5px', wordBreak: 'break-all' }}>
                    {msg.sender}
                  </div>
                  
                  <div style={{
                    background: isOwnMessage ? '#95ec69' : '#ffffff',
                    padding: '10px 15px',
                    borderRadius: isOwnMessage ? '15px 4px 15px 15px' : '4px 15px 15px 15px', 
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    maxWidth: '85%', display: 'flex', flexDirection: 'column', gap: '5px'
                  }}>
                    {msg.replyTo && (
                      <div style={{
                        background: isOwnMessage ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.04)',
                        borderLeft: `3px solid ${isOwnMessage ? '#5f9e40' : '#ccc'}`,
                        padding: '6px 8px', borderRadius: '4px', fontSize: '0.8rem',
                        color: isOwnMessage ? '#4a7a32' : '#666', marginBottom: '4px',
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                        overflow: 'hidden', wordBreak: 'break-word'
                      }}>
                        <strong style={{ opacity: 0.8 }}>{msg.replyTo.sender}</strong><br/>
                        {msg.replyTo.content}
                      </div>
                    )}

                    <div style={{ fontSize: '1rem', color: '#222', wordBreak: 'break-word' }}>
                      {renderContent(msg)}
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '2px', gap: '15px' }}>
                      <button
                        onClick={() => setReplyingTo(msg)}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                          fontSize: '0.75rem', fontWeight: 'bold', color: isOwnMessage ? 'rgba(0,0,0,0.3)' : '#aaa',
                        }}
                      >
                        ↩ 回覆
                      </button>
                      <span style={{ 
                        fontSize: '0.7rem', color: isOwnMessage ? '#5f9e40' : '#999', whiteSpace: 'nowrap'
                      }}>
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {unreadCount > 0 && (
            <button
              onClick={scrollToBottom}
              style={{
                position: 'absolute', bottom: '20px', right: '20px',
                background: '#4caf50', color: 'white', border: 'none',
                borderRadius: '20px', padding: '8px 16px',
                boxShadow: '0 4px 8px rgba(0,0,0,0.2)', cursor: 'pointer',
                fontWeight: 'bold', fontSize: '0.85rem', display: 'flex',
                alignItems: 'center', gap: '6px', zIndex: 10,
                transition: 'transform 0.2s'
              }}
            >
              <span>↓</span>
              <span>{unreadCount} 條新訊息</span>
            </button>
          )}

        </div>
  
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '8px', marginTop: '10px' }}>
          {replyingTo && (
            <div style={{ 
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
              background: 'rgba(255,255,255,0.9)', padding: '8px 12px', 
              borderRadius: '8px', borderLeft: '4px solid #4caf50',
              boxShadow: '0 2px 5px rgba(0,0,0,0.1)', fontSize: '0.85rem', color: '#555'
            }}>
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                正在回覆 <strong>{replyingTo.sender}</strong>: {replyingTo.type === 'text' ? replyingTo.content : '[圖片/檔案]'}
              </div>
              <button 
                onClick={() => setReplyingTo(null)} 
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', fontWeight: 'bold', padding: '0 5px' }}
              >
                ✕
              </button>
            </div>
          )}

          <div className="chat-input">
            <input
              type="text"
              value={message}
              placeholder="Type a message..."
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()} 
            />
            <button onClick={sendMessage}>Send</button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={sendFile}
              style={{ display: 'none' }}
            />
            <button onClick={() => fileInputRef.current.click()}>📎</button>
          </div>
        </div>
  
        <div className="buttonContainer" style={{ marginTop: '20px' }}>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <a href="https://www.google.com/" target="_blank" rel="noopener noreferrer">
              <button className="nav-button"><span role="img" aria-label="google">🌐</span> Google</button>
            </a>
            <button className='nav-button' onClick={handleLogout}>Log Out</button>
          </div>
          <div style={{ fontSize: '12px', marginTop: '10px', color: '#666' }}>(Your chat history is securely saved. Scroll up to load more.)</div>
        </div>
      </div>
    </div>
  );
}