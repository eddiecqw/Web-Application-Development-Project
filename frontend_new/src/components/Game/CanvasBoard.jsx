import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { fabric } from 'fabric';

const CanvasBoard = forwardRef(({ isPainter, sendDraw, brushColor, brushSize }, ref) => {
  const wrapperRef = useRef(null);
  const fabricCanvas = useRef(null);
  
  const isPainterRef = useRef(isPainter);
  const sendDrawRef = useRef(sendDraw);
  const redoStack = useRef([]);

  useEffect(() => {
    isPainterRef.current = isPainter;
    if (fabricCanvas.current) {
      fabricCanvas.current.isDrawingMode = isPainter;
    }
  }, [isPainter]);

  useEffect(() => {
    sendDrawRef.current = sendDraw;
  }, [sendDraw]);

  useEffect(() => {
    if (fabricCanvas.current && fabricCanvas.current.freeDrawingBrush) {
      fabricCanvas.current.freeDrawingBrush.color = brushColor;
      fabricCanvas.current.freeDrawingBrush.width = parseInt(brushSize, 10);
    }
  }, [brushColor, brushSize]);

  useEffect(() => {
    if (!wrapperRef.current) return;

    // 🌟 核心修復 1：徹底解決「幽靈畫布」
    // 每次掛載前，徹底清空容器，然後動態生成全新的 canvas 標籤
    wrapperRef.current.innerHTML = ''; 
    const canvasEl = document.createElement('canvas');
    wrapperRef.current.appendChild(canvasEl);

    const canvas = new fabric.Canvas(canvasEl, {
      isDrawingMode: isPainterRef.current,
      width: 800,
      height: 600,
      backgroundColor: '#ffffff',
    });

    canvas.freeDrawingBrush.color = brushColor || '#000000';
    canvas.freeDrawingBrush.width = parseInt(brushSize || 5, 10);

    fabricCanvas.current = canvas;

    const handlePathCreated = (e) => {
      if (!isPainterRef.current) return;
      redoStack.current = [];
      const path = e.path.toObject();
      sendDrawRef.current(path);
    };

    canvas.on('path:created', handlePathCreated);

    const handleResize = () => {
      if (fabricCanvas.current && wrapperRef.current) {
        const wrapperWidth = wrapperRef.current.clientWidth;
        const scale = Math.min(wrapperWidth / 800, 1);
        fabricCanvas.current.setDimensions({
          width: 800 * scale,
          height: 600 * scale
        });
        fabricCanvas.current.setZoom(scale);
        fabricCanvas.current.calcOffset(); // 確保畫筆座標精準
      }
    };

    window.addEventListener('resize', handleResize);
    setTimeout(handleResize, 100);

    return () => {
      window.removeEventListener('resize', handleResize);
      canvas.off('path:created', handlePathCreated);
      canvas.dispose();
      fabricCanvas.current = null;
      // 卸載時徹底銷毀 DOM 節點，不留殘骸
      if (wrapperRef.current) {
        wrapperRef.current.innerHTML = '';
      }
    };
  }, []); 

  useImperativeHandle(ref, () => ({
    drawPath: (pathData) => {
      // 💡 畫家絕對不處理回傳的廣播，避免回音干擾
      if (!fabricCanvas.current || isPainterRef.current) return;
      
      // 🌟 核心修復 2：改回最穩定、不會雙重位移的 enlivenObjects，保證猜測者能看見
      fabric.util.enlivenObjects([pathData], (objects) => {
        objects.forEach(obj => {
          obj.set({ selectable: false, evented: false });
          fabricCanvas.current.add(obj);
        });
        fabricCanvas.current.renderAll();
      });
    },
    undo: (broadcast = true) => {
      if (!fabricCanvas.current) return;
      const objects = fabricCanvas.current.getObjects();
      if (objects.length > 0) {
        const lastObj = objects[objects.length - 1];
        if (broadcast) {
          redoStack.current.push(lastObj.toObject());
          sendDrawRef.current({ action: 'UNDO' }); 
        }
        fabricCanvas.current.remove(lastObj);
        fabricCanvas.current.renderAll();
      }
    },
    redo: () => {
      if (!fabricCanvas.current || redoStack.current.length === 0) return;
      const pathData = redoStack.current.pop();
      fabric.util.enlivenObjects([pathData], (objects) => {
        objects.forEach(obj => {
          obj.set({ selectable: false, evented: false });
          fabricCanvas.current.add(obj);
        });
        fabricCanvas.current.renderAll();
        sendDrawRef.current(pathData);
      });
    },
    clear: (broadcast = true) => {
      if (!broadcast && isPainterRef.current) return;
      if (fabricCanvas.current) {
        fabricCanvas.current.clear();
        fabricCanvas.current.backgroundColor = '#ffffff';
        fabricCanvas.current.renderAll();
        if (broadcast) {
          redoStack.current = [];
          sendDrawRef.current({ action: 'CLEAR' }); 
        }
      }
    }
  }));

  return (
    <div 
      ref={wrapperRef} 
      style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        width: '100%', 
        overflow: 'hidden', 
        marginBottom: '1rem',
        border: '2px solid #ddd', 
        borderRadius: '8px', 
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)', 
        backgroundColor: 'white', 
        touchAction: 'none' 
      }} 
    />
  );
});

export default CanvasBoard;
