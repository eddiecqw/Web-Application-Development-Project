import React, { useState, useEffect } from 'react';

export default function GuessInput({ isPainter, currentWord, onSubmitGuess }) {
  const [guess, setGuess] = useState('');
  const [result, setResult] = useState('');

  useEffect(() => {
    if (!isPainter) setResult('');
  }, [isPainter]);

  useEffect(() => {
    if (result) {
      const timer = setTimeout(() => setResult(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [result]);
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (guess.trim()) {
      onSubmitGuess(guess.trim());
      setGuess('');
    }
  };

  return (
    <div className="guess-section">
      {isPainter ? (
        <div className="painter-word">
          <h4>你的关键词：</h4>
          <div className="secret-word">{currentWord}</div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="guess-form">
          <input
            type="text"
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            placeholder="输入你的猜测..."
            disabled={!!result}
          />
          <button type="submit" disabled={!!result}>
            {result ? '✓' : '提交'}
          </button>
          {result && <div className={`guess-result ${result.type}`}>{result.text}</div>}
        </form>
      )}
    </div>
  );
}