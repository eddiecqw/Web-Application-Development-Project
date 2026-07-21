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

  // ✨ 新增：用於歷史訊息載入的狀態
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  
  // ✨ 新增：精準控制滾動的計數器 (只有新訊息來時才觸發滾動)
  const [scrollTick, setScrollTick] = useState(0);

  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  const { getWebSocket } = useWebSocket(WS_URL, {
    share: true,
    queryParams: { username },
  });

  const handleLogout = () => {
    const ws = getWebSocket();
    if (ws) {
      ws.close(1000, 'User logout'); 
    }
    localStorage.removeItem('user');
    if (typeof onLogout === 'function') {
      onLogout();
    }
    navigate('/login', { replace: true });
  };

  useEffect(() => {
    if (!lastJsonMessage) return;

    // 處理陣列 (初始載入 或 別人發送的新訊息)
    if (Array.isArray(lastJsonMessage)) {
      const statusMsg = lastJsonMessage.find(msg => msg?.type === 'SYSTEM_STATUS');
      if (statusMsg) {
        setOnlineCount(statusMsg.data.online);
        setMapCount(statusMsg.data.map);
      }

      const validMessages = lastJsonMessage.filter(
        (msg) => 
          msg?.type === 'text' || 
          msg?.type === 'file' ||
          msg?.type === 'system' 
      );
    
      if (validMessages.length > 0) {
        // 將新訊息加到最下方
        setMessages((prev) => [...prev, ...validMessages]);
        // ✨ 只有在收到新訊息時，才觸發滾動！
        setScrollTick(t => t + 1);
      }
    } 
    // ✨ 新增：處理單獨回傳的歷史訊息 (將舊訊息塞到最上方)
    else if (lastJsonMessage.type === 'MORE_HISTORY') {
      setIsLoadingHistory(false);
      const historyMsgs = lastJsonMessage.data;
      if (historyMsgs.length > 0) {
        setMessages((prev) => [...historyMsgs, ...prev]);
        // 如果回傳的數量少於 50 條，代表資料庫已經被掏空了
        if (historyMsgs.length < 50) setHasMore(false);
      } else {
        setHasMore(false);
      }
    }
  }, [lastJsonMessage]);

  // ✨ 修改：依賴 scrollTick，確保載入舊訊息時不會被強制往下拉
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [scrollTick]);

  // ✨ 新增：向後端請求載入更多歷史訊息
  const loadMoreMessages = () => {
    if (isLoadingHistory || !hasMore) return;
    setIsLoadingHistory(true);
    sendJsonMessage({
      type: 'LOAD_MORE_MESSAGES',
      data: { skip: messages.length, limit: 50 } // 告訴後端我們要跳過目前已經顯示的數量，再拿 50 條
    });
  };

  const sendMessage = () => {
    if (!message.trim()) return;
    sendJsonMessage({
      type: 'CHAT_MESSAGE',
      data: {
        content: message,
        type: 'text',
      },
    });
    setMessage('');
  };

  const sendFile = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
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
        },
      });
    };
    reader.readAsDataURL(file);
  };

  const renderContent = (msg) => {
    const { type, content, mimeType, filename } = msg;

    if (type === 'text') return <span>{content}</span>;

    if (type === 'file') {
      if (mimeType?.startsWith('image/')) {
        return <img src={content} alt={filename} className="media" style={{ maxWidth: '100%', height: 'auto', borderRadius: '8px' }} />;
      } else if (mimeType?.startsWith('video/')) {
        return <video controls className="media" style={{ maxWidth: '100%', borderRadius: '8px' }}><source src={content} type={mimeType} /></video>;
      } else if (mimeType?.startsWith('audio/')) {
        return <audio controls className="media" style={{ maxWidth: '100%' }}><source src={content} type={mimeType} /></audio>;
      } else {
        return <a href={content} download={filename} className="file-link">📄 Download {filename}</a>;
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
  
        <div className="chat-box" style={{ display: 'flex', flexDirection: 'column', gap: '15px', padding: '15px' }}>
          
          {/* ✨ 新增：低調的「載入更多」按鈕 */}
          {hasMore && messages.length >= 20 && (
            <button 
              onClick={loadMoreMessages}
              disabled={isLoadingHistory}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#aaa',
                fontSize: '0.85rem',
                cursor: isLoadingHistory ? 'default' : 'pointer',
                padding: '5px 0 15px 0',
                textAlign: 'center',
                width: '100%',
                outline: 'none',
                transition: 'color 0.2s'
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
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: isOwnMessage ? 'flex-end' : 'flex-start',
                width: '100%'
              }}>
                <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '4px', padding: '0 5px', wordBreak: 'break-all' }}>
                  {msg.sender}
                </div>
                
                <div style={{
                  background: isOwnMessage ? '#95ec69' : '#ffffff',
                  padding: '10px 15px',
                  borderRadius: isOwnMessage ? '15px 4px 15px 15px' : '4px 15px 15px 15px', 
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  maxWidth: '85%', 
                  wordBreak: 'break-word',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '5px'
                }}>
                  <div style={{ fontSize: '1rem', color: '#222' }}>
                    {renderContent(msg)}
                  </div>
                  
                  <span style={{ 
                    fontSize: '0.7rem', 
                    color: isOwnMessage ? '#5f9e40' : '#999', 
                    alignSelf: 'flex-end',
                    whiteSpace: 'nowrap'
                  }}>
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
  
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
  
        <div className="buttonContainer" style={{ marginTop: '20px' }}>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <a href="https://www.google.com/" target="_blank" rel="noopener noreferrer">
              <button className="nav-button"><span role="img" aria-label="google">🌐</span> Google</button>
            </a>
            <button className='nav-button' onClick={handleLogout}>Log Out</button>
          </div>
          {/* ✨ 替換掉原本會嚇到用戶的文字 */}
          <div style={{ fontSize: '12px', marginTop: '10px', color: '#666' }}>(Your chat history is securely saved. Scroll up to load more.)</div>
        </div>
      </div>
    </div>
  );
}