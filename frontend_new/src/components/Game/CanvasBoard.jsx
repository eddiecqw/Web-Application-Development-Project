import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { fabric } from 'fabric';

const CanvasBoard = forwardRef(({ isPainter, sendDraw }, ref) => {
  const canvasRef = useRef(null);
  const fabricCanvas = useRef(null);
  const isInitialized = useRef(false);

  // 用 ref 追蹤狀態和函數，避免觸發 useEffect
  const isPainterRef = useRef(isPainter);
  const sendDrawRef = useRef(sendDraw);

  // 1. 同步最新狀態，不銷毀畫布
  useEffect(() => {
    isPainterRef.current = isPainter;
    if (fabricCanvas.current) {
      fabricCanvas.current.isDrawingMode = isPainter;
    }
  }, [isPainter]);

  // 2. 同步最新的發送函數
  useEffect(() => {
    sendDrawRef.current = sendDraw;
  }, [sendDraw]);

  // 3. 畫布初始化 (依賴設為空陣列 []，保證只執行一次！)
  useEffect(() => {
    if (!canvasRef.current || isInitialized.current) return;

    const canvas = new fabric.Canvas(canvasRef.current, {
      isDrawingMode: isPainterRef.current,
      width: 800,
      height: 600,
      backgroundColor: '#ffffff',
    });

    fabricCanvas.current = canvas;
    isInitialized.current = true;

    // 繪圖事件監聽
    const handlePathCreated = (e) => {
      if (!isPainterRef.current) return;
      const path = e.path.toObject();
      sendDrawRef.current(path); // 永遠使用最新的發送函數
    };

    canvas.on('path:created', handlePathCreated);

    const handleResize = () => {
      if (fabricCanvas.current) {
        fabricCanvas.current.calcOffset();
      }
    };
    window.addEventListener('resize', handleResize);
    setTimeout(handleResize, 100);

    return () => {
      window.removeEventListener('resize', handleResize);
      canvas.off('path:created', handlePathCreated);
      canvas.dispose();
      fabricCanvas.current = null;
      isInitialized.current = false;
    };
  }, []); // 👈 關鍵修復：這裡變成空陣列，保證畫布不會在遊戲中途消失！

  // 暴露外部操作方法
  useImperativeHandle(ref, () => ({
    drawPath: (pathData) => {
      if (!fabricCanvas.current) return;
      fabric.util.enlivenObjects([pathData], (objects) => {
        objects.forEach(obj => {
          obj.selectable = false;
          obj.evented = false;
          fabricCanvas.current.add(obj);
        });
        fabricCanvas.current.renderAll();
      });
    },
    clear: () => {
      if (fabricCanvas.current) {
        fabricCanvas.current.clear();
      }
    }
  }));

  return (
    <div style={{ display: 'flex', justifyContent: 'center', width: '100%', overflow: 'hidden', marginBottom: '1rem' }}>
      <canvas ref={canvasRef} style={{ border: '2px solid #ddd', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
    </div>
  );
});

export default CanvasBoard;