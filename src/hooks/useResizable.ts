import React, { useState, useEffect, useCallback, useRef } from 'react';

interface UseResizableParams {
  initialWidth: number;
  minWidth: number;
  maxWidth: number;
  direction: 'left' | 'right';
}

export function useResizable({ initialWidth, minWidth, maxWidth, direction }: UseResizableParams) {
  const [width, setWidth] = useState(initialWidth);
  const [isDragging, setIsDragging] = useState(false);
  const startPos = useRef(0);
  const startWidth = useRef(0);
  
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startPos.current = e.clientX;
    startWidth.current = width;
  }, [width]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - startPos.current;
      let newWidth = startWidth.current;
      
      if (direction === 'left') {
        newWidth += delta;
      } else {
        newWidth -= delta;
      }
      
      if (newWidth < minWidth) newWidth = minWidth;
      if (newWidth > maxWidth) newWidth = maxWidth;
      
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
    };
  }, [isDragging, direction, minWidth, maxWidth]);

  return { width, isDragging, handleMouseDown };
}

