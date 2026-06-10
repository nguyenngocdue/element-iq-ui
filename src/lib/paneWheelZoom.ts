export type ScaleUpdater = number | ((prev: number) => number);

export function attachPaneWheelZoom(
  pane: HTMLDivElement,
  onScaleChange: (value: ScaleUpdater) => void,
): () => void {
  const onWheel = (e: WheelEvent) => {
    if (!(e.ctrlKey || e.metaKey)) return;

    e.preventDefault();
    e.stopPropagation();

    const rect = pane.getBoundingClientRect();
    const pointerX = e.clientX - rect.left;
    const pointerY = e.clientY - rect.top;
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;

    onScaleChange((prevScale) => {
      const nextScale = Math.min(4, Math.max(0.1, prevScale * zoomFactor));
      if (nextScale === prevScale) return prevScale;

      const ratio = nextScale / prevScale;
      const contentX = pointerX + pane.scrollLeft;
      const contentY = pointerY + pane.scrollTop;

      setTimeout(() => {
        pane.scrollLeft = contentX * ratio - pointerX;
        pane.scrollTop = contentY * ratio - pointerY;
      }, 0);

      return nextScale;
    });
  };

  pane.addEventListener('wheel', onWheel, { passive: false });
  return () => pane.removeEventListener('wheel', onWheel);
}
