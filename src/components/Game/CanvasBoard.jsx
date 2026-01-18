import React, { useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';
import { fabric } from 'fabric';

const CanvasBoard = forwardRef(({ isPainter, sendDraw }, ref) => {
  const canvasRef = useRef(null);
  const fabricCanvas = useRef(null);
  const isInitialized = useRef(false);

  // 初始化画布（只执行一次）
  const initCanvas = useCallback(() => {
    if (!canvasRef.current || isInitialized.current) return;

    const canvas = new fabric.Canvas(canvasRef.current, {
      isDrawingMode: isPainter,
      width: 800,
      height: 600,
      backgroundColor: '#ffffff',
    });

    fabricCanvas.current = canvas;
    isInitialized.current = true;

    // 绘图事件监听
    canvas.on('path:created', handlePathCreated);

    // 非画家模式初始化清空
    if (!isPainter) {
      //canvas.clear();
      canvas.isDrawingMode = false;
    }

    return () => {
      canvas.off('path:created', handlePathCreated);
      canvas.dispose();
    };
  }, [isPainter]);

  // 路径创建处理
  const handlePathCreated = useCallback((e) => {
    if (!isPainter) return;
    
    const path = e.path.toObject(); // 使用toObject保留更多元数据
    sendDraw('GAME_DRAW_DATA', path);
  }, [isPainter, sendDraw]);

  // 画布模式切换处理
  useEffect(() => {
    if (!fabricCanvas.current) return;

    // 切换绘图模式时清空画布
    fabricCanvas.current.isDrawingMode = isPainter;
    if (!isPainter) {
      fabricCanvas.current.clear();
    }
  }, [isPainter]);

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

  // 初始化和清理
  useEffect(() => {
    initCanvas();
    return () => {
      if (fabricCanvas.current) {
        fabricCanvas.current.dispose();
        fabricCanvas.current = null;
        isInitialized.current = false;
      }
    };
  }, [initCanvas]);

  return <canvas ref={canvasRef} className="border border-gray-300" />;
});

export default CanvasBoard;