import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export function Login({ onLogin  }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
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
      const response = await fetch('http://localhost:53840/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({email:email, password:password}),
      });

      // 添加 HTTP 状态码检查
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
    // 导航到注册页面并携带当前表单数据
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
      // 檢查賬戶是否存在
      const checkResponse = await fetch('http://localhost:53840/api/auth/check-account', {
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
          //await handleLogin();
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
          <div>which designed by ierg3840 student CHEN Quanwei</div>
          <div>UID:1155192043</div>
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

          <input
            className="inputBox"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
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