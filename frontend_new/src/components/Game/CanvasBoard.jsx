import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { fabric } from 'fabric';

const CanvasBoard = forwardRef(({ isPainter, sendDraw, brushColor, brushSize }, ref) => {
  const wrapperRef = useRef(null);
  const canvasRef = useRef(null);
  const fabricCanvas = useRef(null);
  const isInitialized = useRef(false);

  const isPainterRef = useRef(isPainter);
  const sendDrawRef = useRef(sendDraw);
  
  // 📝 新增：用來儲存被撤銷的筆畫，以便「重做」
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
      
      // 只要畫了新的一筆，重做的歷史紀錄就必須清空
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

  // 暴露更多方法給 DrawGuessPage 控制
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
    // ⏪ 撤銷 (向後)
    undo: (broadcast = true) => {
      if (!fabricCanvas.current) return;
      const objects = fabricCanvas.current.getObjects();
      if (objects.length > 0) {
        const lastObj = objects[objects.length - 1];
        if (broadcast) {
          redoStack.current.push(lastObj.toObject());
          sendDrawRef.current({ action: 'UNDO' }); // 透過網路通知其他人撤銷
        }
        fabricCanvas.current.remove(lastObj);
        fabricCanvas.current.renderAll();
      }
    },
    // ⏩ 重做 (向前)
    redo: () => {
      if (!fabricCanvas.current || redoStack.current.length === 0) return;
      const pathData = redoStack.current.pop();
      // 在本地畫出來
      fabric.util.enlivenObjects([pathData], (objects) => {
        objects.forEach(obj => {
          obj.selectable = false;
          obj.evented = false;
          fabricCanvas.current.add(obj);
        });
        fabricCanvas.current.renderAll();
      });
      // 把重做的筆跡當作新的筆跡發送給其他人
      sendDrawRef.current(pathData);
    },
    // 🗑️ 清空畫板
    clear: (broadcast = true) => {
      if (fabricCanvas.current) {
        fabricCanvas.current.clear();
        fabricCanvas.current.backgroundColor = '#ffffff';
        fabricCanvas.current.renderAll();
        if (broadcast) {
          redoStack.current = [];
          sendDrawRef.current({ action: 'CLEAR' }); // 透過網路通知其他人清空
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