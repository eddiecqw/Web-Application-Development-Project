import * as React from "react";
import { Link } from "react-router-dom";
import { usePerfectCursor } from "../hooks/usePerfectCursor";

export function Cursor() {
  const rCursor = React.useRef(null);
  const [cursorPos, setCursorPos] = React.useState([0, 0]);


  React.useEffect(() => {
    const handleMouseMove = (e) => {
      requestAnimationFrame(() => {
        setCursorPos([e.clientX, e.clientY]);
      });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

 
  const animateCursor = React.useCallback((point) => {
    const elm = rCursor.current;
    if (!elm) return;
    
    elm.style.transform = `translate(${point[0]}px, ${point[1]}px)`;
  }, []);

  const onPointMove = usePerfectCursor(animateCursor);

  
  React.useLayoutEffect(() => {
    const animationFrame = requestAnimationFrame(() => {
      onPointMove(cursorPos);
    });
    return () => cancelAnimationFrame(animationFrame);
  }, [cursorPos, onPointMove]);

  return (
    <div style={{ 
      position: "relative",
      height: "100vh",
      overflow: "hidden", 
      cursor: "none"      
    }}>
    
      <svg
        ref={rCursor}
        style={{
          position: "absolute",
          top: -15,
          left: -15,
          width: 35,
          height: 35,
          pointerEvents: "none",
          transition: "transform 0.15s cubic-bezier(0.4, 0, 0.2, 1)" // 平滑动画
        }}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 35 35"
        fill="none"
        fillRule="evenodd"
      >
     
        <g fill="rgba(0,0,0,.2)" transform="translate(1,1)">
          <path d="m12 24.4219v-16.015l11.591 11.619h-6.781l-.411.124z" />
          <path d="m21.0845 25.0962-3.605 1.535-4.682-11.089 3.686-1.553z" />
        </g>
        <g fill="white">
          <path d="m12 24.4219v-16.015l11.591 11.619h-6.781l-.411.124z" />
          <path d="m21.0845 25.0962-3.605 1.535-4.682-11.089 3.686-1.553z" />
        </g>
        <g fill={"red"}>
          <path d="m19.751 24.4155-1.844.774-3.1-7.374 1.841-.775z" />
          <path d="m13 10.814v11.188l2.969-2.866.428-.139h4.768z" />
        </g>
      </svg>

    
      <div style={{ 
        position: "fixed",
        top: 20,
        left: 20,
        zIndex: 1000,
        backgroundColor: "rgba(255,255,255,0.9)",
        padding: 8,
        borderRadius: 4,
        backdropFilter: "blur(4px)"
      }}>
        <Link to="/" style={{ textDecoration: "none" }}>
          <button 
            style={{
              padding: "8px 16px",
              background: "#007bff",
              color: "white",
              border: "none",
              borderRadius: 4,
              transition: "all 0.3s",
              transform: "scale(1)",
              ":hover": {
                background: "#0056b3",
                transform: "scale(1.05)"
              }
            }}
          >
            Back to Chat
          </button>
        </Link>
      </div>
    </div>
  );
}