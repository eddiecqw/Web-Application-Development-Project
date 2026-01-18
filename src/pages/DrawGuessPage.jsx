import React, { useRef, useState } from 'react';
import useGameSocket from '../hooks/useGameSocket';
import CanvasBoard from '../components/Game/CanvasBoard';
import GameLobby from '../components/Game/GameLobby';
import PlayerList from '../components/Game/PlayerList';
import GuessInput from '../components/Game/GuestInput';

export default function DrawGuessPage({ user }) {
  const canvasRef = useRef();
  const [messages, setMessages] = useState([]);
  
  const {
    createRoom,
    joinRoom,
    sendDrawData,
    submitGuess,
    gameState: { roomId, players, isPainter, playerId, currentWord },
  } = useGameSocket(`ws://localhost:53840/game?username=${encodeURIComponent(user.email)}`, {
    DRAW_DATA_RECEIVED: (data) => {
      console.log('🖌️ Draw data received:', data);
      // 調用 CanvasBoard 中的方法
      canvasRef.current?.drawPath(data.path);
    },
    GUESS_RECEIVED: (data) => {
      setMessages((prev) => [...prev, data]);
    },
    GUESS_RESULT: (data) => {
      setMessages(prev => [...prev, {
        ...data,
        text: data.isCorrect 
          ? `🎉 猜中了！正确答案：${data.correctWord}`
          : `❌ 猜错了，继续努力！`
      }]);
    },
    GAME_NEW_ROUND: (data) => {
      canvasRef.current?.clear(); // ✅ 清除畫布
    }
  });

  const handleCreateRoom = () => {
    createRoom();
  };

  const handleJoinRoom = (roomIdInput) => {
    joinRoom(roomIdInput);
  };

  const handleSubmitGuess = (guess) => {
    submitGuess(guess);
  };

  return (
    <div className="flex flex-col items-center w-full p-4">
      {!roomId ? (
        <GameLobby onCreateRoom={handleCreateRoom} onJoinRoom={handleJoinRoom} />
      ) : (
        <div className="flex flex-col md:flex-row w-full max-w-6xl">
          <div className="flex-1">
            <div className="mb-4 text-center font-bold text-blue-600">
              房間號：{roomId}
            </div>
            <CanvasBoard ref={canvasRef} isPainter={isPainter} sendDraw={sendDrawData} />
              <GuessInput
                isPainter={isPainter}
                currentWord={currentWord}
                onSubmitGuess={handleSubmitGuess}
              />
          </div>
          <div className="w-full md:w-1/3 p-4">
            <PlayerList players={players} currentUserId={playerId} />
            <div className="mt-4">
              <h4 className="font-bold">猜詞紀錄：</h4>
              <ul className="text-sm">
                {messages.map((msg, idx) => (
                  <li key={idx}>
                    🗣️ <strong>{msg.playerName}</strong> 猜：「{msg.guess}」
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}