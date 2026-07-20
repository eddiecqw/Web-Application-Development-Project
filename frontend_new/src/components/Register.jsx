import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:53840';

// 🎨 自訂的精美 SVG 圖標
const EyeOpenIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '20px', height: '20px', color: '#666' }}>
    <path d="M2 12c0 0 5-7 10-7s10 7 10 7-5 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

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

export default function Register() {
  const location = useLocation();

  const [email, setEmail] = useState(location.state?.prefilledEmail || "");
  const [password, setPassword] = useState(location.state?.prefilledPassword || "");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [message, setMessage] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const navigate = useNavigate();

  const validateForm = () => {
    let isValid = true;
    setEmailError("");
    setPasswordError("");
    setConfirmPasswordError("");
    setMessage("");

    if (!email) {
      setEmailError("Please enter your email");
      isValid = false;
    } else if (!/^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)) {
      setEmailError("Invalid email format");
      isValid = false;
    }

    if (!password) {
      setPasswordError("Please enter a password");
      isValid = false;
    } else if (password.length < 8 || password.length > 20) {
      setPasswordError("Password must be 8-20 characters");
      isValid = false;
    }

    if (!confirmPassword) {
      setConfirmPasswordError("Please confirm your password");
      isValid = false;
    } else if (password !== confirmPassword) {
      setConfirmPasswordError("Passwords do not match");
      isValid = false;
    }

    return isValid;
  };

  const checkAccountExists = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/auth/check-account`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      return data?.userExists;
    } catch (error) {
      setMessage("❌ Error checking account");
      return true;
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    const exists = await checkAccountExists();
    if (exists) {
      setMessage("❌ Account already exists");
      return;
    }

    try {
      const res = await fetch(`${apiUrl}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Registration failed");

      alert("✅ Registration successful! Please login.");
      navigate("/login");
    } catch (err) {
      alert(err.message);
    }
  };

  const handleVerifyEmail = async () => {
    if (!email || !/^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)) {
      setMessage("❌ Invalid email address");
      setEmailVerified(false);
      return;
    }

    try {
      const response = await fetch(`${apiUrl}/api/auth/check-account`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      if (data.userExists) {
        setMessage("❌ Account already exists");
        setEmailVerified(false);
      } else {
        setMessage("✅ Email is available!");
        setEmailVerified(true);
      }
    } catch (error) {
      setMessage("❌ Error verifying email");
    }
  };

  return (
    <div className="mainContainer">
      <div className="titleContainer">
        <div>Register</div>
      </div>

      <form onSubmit={handleRegister} className="inputContainer">
        <input
          className="inputBox"
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {emailError && <div className="errorLabel">{emailError}</div>}

        <button
          type="button"
          onClick={handleVerifyEmail}
          className="verifyButton"
        >
          Verify Email
        </button>

        {message && <label className="errorLabel">{message}</label>}

        {/* ✨ 第一個密碼框 */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <input
            className="inputBox"
            type={showPassword ? "text" : "password"}
            placeholder="Enter your Password"
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
        {passwordError && <label className="errorLabel">{passwordError}</label>}

        {/* ✨ 第二個確認密碼框 */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <input
            className="inputBox"
            type={showConfirmPassword ? "text" : "password"}
            placeholder="Confirm your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            style={{ paddingRight: '40px' }}
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
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
            {showConfirmPassword ? <EyeOpenIcon /> : <EyeClosedIcon />}
          </button>
        </div>
        {confirmPasswordError && (
          <label className="errorLabel">{confirmPasswordError}</label>
        )}

        <div className="buttonContainer">
          <button type="submit">Register</button>
          <button type="button" onClick={() => navigate("/login")}>
            Back to Login
          </button>
        </div>
      </form>
    </div>
  );
}