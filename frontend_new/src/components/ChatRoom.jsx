import React, { useEffect, useState, useRef } from 'react';
import useWebSocket from 'react-use-websocket';
import { Link } from "react-router-dom";
import { useNavigate } from 'react-router-dom';

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

  // ✨ 新增：滾動控制與未讀訊息狀態
  const [unreadCount, setUnreadCount] = useState(0);
  const chatBoxRef = useRef(null);
  const messagesEndRef = useRef(null);
  const isAtBottomRef = useRef(true); // 記錄用戶是否在最底部

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

  // ✨ 新增：平滑滾動到底部，並清空未讀
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setUnreadCount(0);
    isAtBottomRef.current = true;
  };

  // ✨ 新增：監聽用戶的手動滾動
  const handleScroll = () => {
    if (!chatBoxRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatBoxRef.current;
    
    // 判斷是否在底部 (給予 100px 的容錯區間)
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
    isAtBottomRef.current = isAtBottom;

    // 如果用戶手動滑到底部了，自動清空未讀標記
    if (isAtBottom && unreadCount > 0) {
      setUnreadCount(0);
    }
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
          // 檢查這是不是初始載入 (如果是初始載入，強制滾到底部)
          const isInitialLoad = prev.length === 0;
          // 檢查這批新訊息中，有沒有「我自己發送的」
          const hasMyMessage = validMessages.some(m => m.sender === username);

          // ✨ 智慧滾動判斷：如果在底部、是第一次載入、或是自己發的訊息，才滾動！
          if (isInitialLoad || isAtBottomRef.current || hasMyMessage) {
            setTimeout(scrollToBottom, 100);
          } else {
            // 如果用戶正在看歷史訊息，增加未讀數字，不干擾畫面
            setUnreadCount(c => c + validMessages.length);
          }
          return [...prev, ...validMessages];
        });
      }
    } else if (lastJsonMessage.type === 'MORE_HISTORY') {
      // ✨ 進階優化：載入歷史訊息時，保持目前的閱讀進度，不讓畫面亂跳
      const previousScrollHeight = chatBoxRef.current?.scrollHeight || 0;
      setIsLoadingHistory(false);
      const historyMsgs = lastJsonMessage.data;
      
      if (historyMsgs.length > 0) {
        setMessages((prev) => [...historyMsgs, ...prev]);
        if (historyMsgs.length < 50) setHasMore(false);

        // 無縫插入：將捲動條推回原本的位置
        setTimeout(() => {
          if (chatBoxRef.current) {
            const newScrollHeight = chatBoxRef.current.scrollHeight;
            chatBoxRef.current.scrollTop += (newScrollHeight - previousScrollHeight);
          }
        }, 0);
      } else {
        setHasMore(false);
      }
    }
  }, [lastJsonMessage, username]);

  const loadMoreMessages = () => {
    if (isLoadingHistory || !hasMore) return;
    setIsLoadingHistory(true);
    sendJsonMessage({
      type: 'LOAD_MORE_MESSAGES',
      data: { skip: messages.length, limit: 50 } 
    });
  };

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
    scrollToBottom(); // 發送訊息後強制滾到底部
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
      scrollToBottom();
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
          <Link to="/cursor"><button className="nav-button">Go to Cursor Page</button></Link>
          <Link to="/map"><button className="nav-button">View Map</button></Link>
          <Link to="/draw-guess"><button className="nav-button">🎨 Start Drawing Game</button></Link>
        </div>
  
        {/* ✨ 修改：將 chat-box 包裝在一個相對定位的容器中，讓未讀按鈕可以浮在上面 */}
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', width: '100%', flex: 1, overflow: 'hidden' }}>
          
          <div 
            className="chat-box" 
            ref={chatBoxRef}
            onScroll={handleScroll} // 綁定滾動監聽
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

          {/* ✨ 微信風格的「未讀新訊息」懸浮按鈕 */}
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
                transition: 'transform 0.2s', animation: 'bounceIn 0.3s'
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