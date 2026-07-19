import React, { useEffect, useState, useRef } from 'react';
import useWebSocket from 'react-use-websocket';
import { Link } from "react-router-dom";
import { useNavigate } from 'react-router-dom';

export function Home({ username ,onLogout}) {
  const WS_URL = (window.location.protocol === 'https:' ? 'wss:' : 'ws:') + 
               '//' + window.location.host + '/ws';
  const navigate = useNavigate();
  const { sendJsonMessage, lastJsonMessage } = useWebSocket(WS_URL, {
    share: true,
    queryParams: { username },
  });

  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const fileInputRef = useRef(null);
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

  // 🛠️ Bug 修復：加入檔案大小限制 (5MB)
  const sendFile = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_FILE_SIZE) {
      alert('File is too large! Please upload a file smaller than 5MB.');
      event.target.value = ''; // 清空選擇
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
    const { type, content, mimeType, filename, sender } = msg;

    if (type === 'text') {
      return <span>{content}</span>;
    }

    if (type === 'file') {
      if (mimeType?.startsWith('image/')) {
        return <img src={content} alt={filename} className="media" style={{ maxWidth: '100%', height: 'auto' }} />;
      } else if (mimeType?.startsWith('video/')) {
        return (
          <video controls className="media" style={{ maxWidth: '100%' }}>
            <source src={content} type={mimeType} />
          </video>
        );
      } else if (mimeType?.startsWith('audio/')) {
        return (
          <audio controls className="media" style={{ maxWidth: '100%' }}>
            <source src={content} type={mimeType} />
          </audio>
        );
      } else {
        return (
          <a href={content} download={filename} className="file-link">
            📄 Download {filename}
          </a>
        );
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
        <h1 className='rainbow-text'>Chat Room</h1>
        <div className='name'>Some extra functions:</div>
        
        {/* 📱 手機端自適應：加入 flex-wrap 讓按鈕在小螢幕自動換行 */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center', margin: '15px 0' }}>
          <Link to="/cursor"><button className="nav-button">Go to Cursor Page</button></Link>
          <Link to="/map"><button className="nav-button">View Map</button></Link>
          <Link to="/draw-guess"><button className="nav-button">🎨 Start Drawing Game</button></Link>
        </div>
  
        <div className="chat-box">
          {messages.map((msg, index) => (
            <div key={index} className="chat-message">
              <strong>{msg.sender}:</strong>
              {renderContent(msg)}
              <span className="timestamp">
                {new Date(msg.timestamp).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
  
        <div className="chat-input">
          <input
            type="text"
            value={message}
            placeholder="Type a message..."
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()} // 支援 Enter 發送
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