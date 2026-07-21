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
  
  // ✨ 新增：追蹤在線人數與地圖人數的狀態
  const [onlineCount, setOnlineCount] = useState(1);
  const [mapCount, setMapCount] = useState(0);

  const fileInputRef = useRef(null);
  
  // ✨ 新增：用於自動滾動到最新訊息的隱形錨點
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
    if (!Array.isArray(lastJsonMessage)) return;
  
    // ✨ 新增：攔截並解析系統廣播的人數狀態
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
      setMessages((prev) => [...prev, ...validMessages]);
    }
  }, [lastJsonMessage]);

  // ✨ 新增：當 messages 改變時，自動平滑滾動到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
        return <img src={content} alt={filename} className="media" style={{ maxWidth: '100%', height: 'auto' }} />;
      } else if (mimeType?.startsWith('video/')) {
        return <video controls className="media" style={{ maxWidth: '100%' }}><source src={content} type={mimeType} /></video>;
      } else if (mimeType?.startsWith('audio/')) {
        return <audio controls className="media" style={{ maxWidth: '100%' }}><source src={content} type={mimeType} /></audio>;
      } else {
        return <a href={content} download={filename} className="file-link">📄 Download {filename}</a>;
      }
    }
    if (type === 'system') {
      return (
        <div className="system-message">
          <span className="system-icon">🔔</span>
          <span className="system-content">{content}</span>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="chat-container">
      <div className="background-blur" />
      <div className="content-wrapper">
        
        {/* ✨ 修改：將標題區塊改為 Flexbox，並在右上角加入人數統計面板 */}
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
          {messages.map((msg, index) => {
            // ✨ 判斷這則訊息是否是「我自己」發送的
            const isOwnMessage = msg.sender === username;
            
            // 🔔 系統訊息獨立排版 (置中顯示、灰色膠囊狀)
            if (msg.type === 'system') {
              return (
                <div key={index} style={{ display: 'flex', justifyContent: 'center', width: '100%', margin: '5px 0' }}>
                  <div style={{ background: 'rgba(0,0,0,0.1)', padding: '6px 14px', borderRadius: '20px', fontSize: '0.8rem', color: '#555' }}>
                    🔔 {msg.content}
                  </div>
                </div>
              );
            }

            // 💬 一般對話氣泡排版
            return (
              <div key={index} style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: isOwnMessage ? 'flex-end' : 'flex-start', // 自己靠右，別人靠左
                width: '100%'
              }}>
                {/* 名字顯示 */}
                <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '4px', padding: '0 5px', wordBreak: 'break-all' }}>
                  {msg.sender}
                </div>
                
                {/* 聊天氣泡本體 */}
                <div style={{
                  background: isOwnMessage ? '#95ec69' : '#ffffff', // 自己的用微信綠，別人的用純白
                  padding: '10px 15px',
                  // 氣泡尖角設計：自己的尖角在右下，別人的尖角在左下
                  borderRadius: isOwnMessage ? '15px 4px 15px 15px' : '4px 15px 15px 15px', 
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  maxWidth: '85%', // 避免氣泡太寬，讓排版更像手機 App
                  wordBreak: 'break-word',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '5px'
                }}>
                  {/* 訊息內容 */}
                  <div style={{ fontSize: '1rem', color: '#222' }}>
                    {renderContent(msg)}
                  </div>
                  
                  {/* 時間戳記 */}
                  <span style={{ 
                    fontSize: '0.7rem', 
                    // 配合背景色調整時間的顏色，確保對比度
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
          {/* ✨ 新增：自動滾動的隱形目標錨點 */}
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
          <div style={{ fontSize: '12px', marginTop: '10px', color: '#666' }}>(Be aware you may lose your chat history before the latest 8 msgs)</div>
        </div>
      </div>
    </div>
  );
}