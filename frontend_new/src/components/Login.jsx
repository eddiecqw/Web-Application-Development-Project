import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:53840';

// 🎨 自訂的精美 SVG 圖標 (睜眼)
const EyeOpenIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '20px', height: '20px', color: '#666' }}>
    <path d="M2 12c0 0 5-7 10-7s10 7 10 7-5 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

// 🎨 自訂的精美 SVG 圖標 (閉眼 - 依照你提供的圖片風格)
const EyeClosedIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '20px', height: '20px', color: '#666' }}>
    <path d="M3 10C8 16 16 16 21 10" />
    <path d="M12 15V19" />
    <path d="M8 14L6 17" />
    <path d="M16 14L18 17" />
    <path d="M4.5 11.5L2 13" />
    <path d="M19.5 11.5L22 13" />
  </svg>
);

export function Login({ onLogin  }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const validateForm = () => {
    let isValid = true;
    
    if (!email) {
      setEmailError('Please enter your email');
      isValid = false;
    } else if (!/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)) {
      setEmailError('Invalid email format');
      isValid = false;
    }

    if (!password) {
      setPasswordError('Please enter a password');
      isValid = false;
    } else if (password.length < 8 || password.length > 20) {
      setPasswordError('Password must be 8-20 characters');
      isValid = false;
    }

    return isValid;
  };

  const handleLogin = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({email:email, password:password}),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Login failed');
      }

      const data = await response.json();
      if (data.success) {
        localStorage.setItem('user', JSON.stringify({ email }));
        onLogin({ email }); 
        navigate('/'); 
      }
    } catch (error) {
      console.error('Login error:', error);
      alert(error.message);
    }
  };

  const handleRegister = () => {
    navigate('/register', {
      state: { prefilledEmail: email, prefilledPassword: password }
    });
  };

  // ✨ 新增：遊客登入邏輯
  const handleGuestLogin = () => {
    // 隨機生成一個四位數的遊客 ID
    const guestId = `Guest_${Math.floor(1000 + Math.random() * 9000)}`;
    // 加上 isGuest: true 的標記
    const guestUser = { email: guestId, isGuest: true }; 
    
    localStorage.setItem('user', JSON.stringify(guestUser));
    onLogin(guestUser); 
    navigate('/'); 
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setEmailError('');
    setPasswordError('');

    if (!validateForm()) return;

    try {
      const checkResponse = await fetch(`${apiUrl}/api/auth/check-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const checkData = await checkResponse.json();
      if (checkData.userExists) {
        await handleLogin();
      } else {
        const confirmCreate = window.confirm('Account not found. Create new account?');
        if (confirmCreate) {
          handleRegister();
        }
      }
    } catch (error) {
      console.error('Error:', error);
      alert('An error occurred');
    }
  };

  return (
    <div className="mainContainer">
      <div className="background-blur" />
      <div className="content-wrapper">
        <div className="titleContainer">
          <div>Welcome to "<span className="rainbow-text">Happy Chat</span>"</div>
        </div>
        <div className='name'>
          <div>A peaceful place where you can enjoy chatting and having fun without any worries.</div>
          <div>Designer：CHEN QUANWEI (Eddie)</div>
        </div>
        <form onSubmit={handleSubmit} className="inputContainer">
          
          <input
            className="inputBox"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {emailError && <div className="errorLabel">{emailError}</div>}

          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <input
              className="inputBox"
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ paddingRight: '40px' }} 
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute',
                right: '10px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {showPassword ? <EyeOpenIcon /> : <EyeClosedIcon />}
            </button>
          </div>
          {passwordError && <div className="errorLabel">{passwordError}</div>}

          <div className="buttonContainer">
            <button type="submit">Login</button>
            <button type="button" onClick={() => navigate('/register')}>
              Register
            </button>
          </div>
          
          {/* ✨ 新增：遊客登入按鈕 */}
          <button 
            type="button" 
            onClick={handleGuestLogin}
            style={{
              marginTop: '0px', width: '40%', padding: '12px', background: 'rgba(255, 255, 255, 0.2)',
              color: 'black', border: '1px solid rgba(255, 255, 255, 0.4)', borderRadius: '8px', 
              fontWeight: 'bold', cursor: 'pointer', transition: 'background 0.2s',backdropFilter: 'blur(5px)'
            }}
            onMouseOver={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.3)'}
            onMouseOut={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.2)'}
          >
            👻 Guest mode
          </button>
        </form>
      </div>
    </div>
  );
}