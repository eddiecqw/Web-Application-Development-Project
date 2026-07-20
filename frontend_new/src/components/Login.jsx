import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:53840';

export function Login({ onLogin  }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  
  // 👁️ 新增：控制密碼是否顯示的狀態
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
      state: {
        prefilledEmail: email,
        prefilledPassword: password
      }
    });
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

          {/* 👁️ 修改：將密碼輸入框包裝起來，加入小眼睛按鈕 */}
          <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
            <input
              className="inputBox"
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ paddingRight: '40px', width: '100%' }} 
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute',
                right: '15px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '1.2rem',
                padding: 0
              }}
            >
              {showPassword ? '🙈' : '👁️'}
            </button>
          </div>
          {passwordError && <div className="errorLabel">{passwordError}</div>}

          <div className="buttonContainer">
            <button type="submit">Login</button>
            <button type="button" onClick={() => navigate('/register')}>
              Register
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}