import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import {Cursor} from './components/Cursor';
import { Login } from './components/Login';
import Register from './components/Register';
import DrawGuessPage from './pages/DrawGuessPage';
import { Home } from './components/ChatRoom'; // 確保你的 ChatRoom.jsx 有 export { Home }
import MapComponent from './components/MapComponent';
import './App.css';
const App = () => {
  const [user, setUser] = useState(null);

  return (
    <BrowserRouter>
      <Routes>
        <Route 
          path="/login" 
          element={!user ? <Login onLogin={setUser} /> : <Navigate to="/" replace />} 
        />
        <Route 
          path="/register" 
          element={!user ? <Register /> : <Navigate to="/" replace />} 
        />
        <Route 
          path="/" 
          element={user ? <Home username={user.email} /> : <Navigate to="/login" replace />} 
        />
        <Route 
          path="/cursor" 
          element={user ? <Cursor /> : <Navigate to="/login" replace />} 
        />
        <Route 
          path="/map" 
          element={user ? <MapComponent /> : <Navigate to="/login" replace />} 
        />    
        <Route 
          path="/draw-guess" 
          element={user ? <DrawGuessPage user={user} /> : <Navigate to="/login" replace />} 
        />  
      </Routes>
    </BrowserRouter>
  );
};

export default App;
/*
function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.jsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  )
}
*/

