import { useEffect, useRef, useCallback, useState } from 'react';

export default function useMatch3Socket(url) {
  const ws = useRef(null);
  const [roomId, setRoomId] = useState(null);
  const [roomData, setRoomData] = useState(null);

  useEffect(() => {
    ws.current = new WebSocket(url);
    ws.current.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (Array.isArray(parsed)) {
          const { type, data } = parsed[0];
          if (type === 'M3_ROOM_CREATED' || type === 'M3_ROOM_UPDATE') {
            setRoomId(data.room.id);
            setRoomData(data.room);
          } else if (type === 'M3_ERROR') {
            alert(data.message);
            setRoomId(null); setRoomData(null);
          }
        }
      } catch (e) {}
    };
    return () => { if (ws.current?.readyState === 1) ws.current.close(); };
  }, [url]);

  const send = useCallback((type, data = {}) => {
    if (ws.current?.readyState === 1) ws.current.send(JSON.stringify({ type, data }));
  }, []);

  const createRoom = useCallback((nickname) => send('M3_CREATE_ROOM', { nickname }), [send]);  
  const joinRoom = useCallback((id, nickname) => send('M3_JOIN_ROOM', { roomId: id, nickname }), [send]);
  const syncState = useCallback((board, score) => send('M3_SYNC_STATE', { roomId, board, score }), [send, roomId]);
  const leaveRoom = useCallback(() => {
    if (roomId) send('M3_LEAVE_ROOM', { roomId });
    setRoomId(null); setRoomData(null);
  }, [roomId, send]);

  return { createRoom, joinRoom, leaveRoom, syncState, gameState: { roomId, roomData } };
}