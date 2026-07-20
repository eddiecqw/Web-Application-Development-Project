import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { fabric } from 'fabric';

const CanvasBoard = forwardRef(({ isPainter, sendDraw, brushColor, brushSize }, ref) => {
  const wrapperRef = useRef(null);
  const canvasRef = useRef(null);
  const fabricCanvas = useRef(null);
  const isInitialized = useRef(false);

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
    if (!canvasRef.current || isInitialized.current) return;

    const canvas = new fabric.Canvas(canvasRef.current, {
      isDrawingMode: isPainterRef.current,
      width: 800,
      height: 600,
      backgroundColor: '#ffffff',
    });

    canvas.freeDrawingBrush.color = brushColor || '#000000';
    canvas.freeDrawingBrush.width = parseInt(brushSize || 5, 10);

    fabricCanvas.current = canvas;
    isInitialized.current = true;

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
        fabricCanvas.current.calcOffset();
      }
    };

    window.addEventListener('resize', handleResize);
    setTimeout(handleResize, 50);

    return () => {
      window.removeEventListener('resize', handleResize);
      canvas.off('path:created', handlePathCreated);
      canvas.dispose();
      fabricCanvas.current = null;
      isInitialized.current = false;
    };
  }, []); 

  // 暴露方法給 DrawGuessPage 控制
  useImperativeHandle(ref, () => ({
    drawPath: (pathData) => {
      // 💡 關鍵修復 1：如果是畫家自己，絕對不處理從伺服器回傳的筆畫！避免回音導致畫布崩潰
      if (!fabricCanvas.current || isPainterRef.current) return;
      
      try {
        // 💡 關鍵修復 2：放棄不穩定的 enlivenObjects，直接手動建立 Path 物件！確保所有玩家都能看到
        const pathObj = new fabric.Path(pathData.path, pathData);
        pathObj.set({
          selectable: false,
          evented: false
        });
        fabricCanvas.current.add(pathObj);
        fabricCanvas.current.renderAll();
      } catch (error) {
        console.error("Canvas draw error:", error);
      }
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
      
      try {
        const pathObj = new fabric.Path(pathData.path, pathData);
        pathObj.set({ selectable: false, evented: false });
        fabricCanvas.current.add(pathObj);
        fabricCanvas.current.renderAll();
        sendDrawRef.current(pathData);
      } catch (error) {
        console.error("Redo error:", error);
      }
    },
    clear: (broadcast = true) => {
      // 💡 確保畫家不會被別人的 clear 廣播意外清空
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
    <div ref={wrapperRef} style={{ display: 'flex', justifyContent: 'center', width: '100%', overflow: 'hidden', marginBottom: '1rem' }}>
      <canvas ref={canvasRef} style={{ border: '2px solid #ddd', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', backgroundColor: 'white', touchAction: 'none' }} />
    </div>
  );
});

export default CanvasBoard;
