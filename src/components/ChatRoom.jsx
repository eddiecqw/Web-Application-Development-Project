import React, { useEffect, useState, useRef } from 'react';
import useWebSocket from 'react-use-websocket';
import { Link } from "react-router-dom";
import { useNavigate } from 'react-router-dom';

export function Home({ username ,onLogout}) {
  const WS_URL = `ws://127.0.0.1:53840`;
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

  const sendFile = (event) => {
    const file = event.target.files[0];
    if (!file) return;
  
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
        return <img src={content} alt={filename} className="media" />;
      } else if (mimeType?.startsWith('video/')) {
        return (
          <video controls className="media">
            <source src={content} type={mimeType} />
            Your browser does not support the video tag.
          </video>
        );
      } else if (mimeType?.startsWith('audio/')) {
        return (
          <audio controls className="media">
            <source src={content} type={mimeType} />
            Your browser does not support the audio element.
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
    
    if (!type) return null;
      console.warn('Unsupport WebSocket message：', msg);
      return null; // 忽略未知類型，不顯示任何東西
  };

  return (
    <div className="chat-container">
      <div className="background-blur" />
      <div className="content-wrapper">
        
        <h1 className='rainbow-text'>Chat Room</h1>
        <div className='name'>Some extra functions:</div>
        <Link to="/cursor">
          <button className="nav-button">Go to Cursor Page</button>
        </Link>
        <Link to="/map">
          <button className="nav-button">View Map</button>
        </Link>
        <Link to="/draw-guess">
          <button className="nav-button">
            🎨 Start Drawing Game
          </button>
        </Link>
  
        {/* 聊天内容区域 */}
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
  
        {/* 输入区域 */}
        <div className="chat-input">
          <input
            type="text"
            value={message}
            placeholder="Type a message..."
            onChange={(e) => setMessage(e.target.value)}
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
  
        {/* 底部按钮 */}
        <div className="buttonContainer">
          <a 
            href="https://www.google.com/" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ marginRight: '10px' }}
          >
            <button className="nav-botton">
              <span role="img" aria-label="google">🌐</span> Google
            </button>
          </a>
          
          <button className='nav-botton' onClick={handleLogout}>
            Refresh your page
          </button>
          <div>(Be ware you may lose your chat history before the latest 8 msgs)</div>
        </div>
      </div>
    </div>
  );
}