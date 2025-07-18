import { useRef, useCallback } from "react";

export function useDraggable(initial = { x: 0, y: 0 }) {
  const posRef = useRef({ x: initial.x, y: initial.y });
  const nodeRef = useRef<HTMLDivElement | null>(null);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (!nodeRef.current) return;
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const { x, y } = posRef.current;

    function onMove(ev: MouseEvent) {
      const nx = x + (ev.clientX - startX);
      const ny = y + (ev.clientY - startY);
      posRef.current = { x: nx, y: ny };
      if (nodeRef.current) {
        nodeRef.current.style.transform = `translate(${nx}px, ${ny}px)`;
      }
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

  return { nodeRef, onMouseDown };
}
