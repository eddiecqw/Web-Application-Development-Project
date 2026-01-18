import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
export default function Register() {
  const location = useLocation();

  const [email, setEmail] = useState(
    location.state?.prefilledEmail || ""
  );
  const [password, setPassword] = useState(
    location.state?.prefilledPassword || ""
  );
  const [confirmPassword, setConfirmPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [message, setMessage] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
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
      const response = await fetch("http://localhost:53840/api/auth/check-account", {
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
      const res = await fetch("http://localhost:53840/api/auth/register", {
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
      const response = await fetch("http://localhost:53840/api/auth/check-account", {
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

        <input
          className="inputBox"
          type="password"
          placeholder="Enter your Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {passwordError && <label className="errorLabel">{passwordError}</label>}

        <input
          className="inputBox"
          type="password"
          placeholder="Confirm your password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
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