"use client";

import type { PointerEvent, ReactNode, WheelEvent } from "react";
import { useRef, useState } from "react";

export function SampleTableScroll({ children }: { children: ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef({ x: 0, left: 0 });
  const activePointer = useRef<number | null>(null);
  const dragged = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  function scrollBy(amount: number) {
    scrollRef.current?.scrollBy({ left: amount, behavior: "smooth" });
  }

  function startDrag(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    const element = scrollRef.current;
    if (!element || element.scrollWidth <= element.clientWidth) return;
    dragStart.current = { x: event.clientX, left: element.scrollLeft };
    activePointer.current = event.pointerId;
    dragged.current = false;
  }

  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    if (activePointer.current !== event.pointerId) return;
    const element = scrollRef.current;
    if (!element) return;
    const distance = event.clientX - dragStart.current.x;
    if (Math.abs(distance) <= 5 && !dragged.current) return;
    if (!dragged.current) {
      dragged.current = true;
      setIsDragging(true);
      element.setPointerCapture(event.pointerId);
    }
    element.scrollLeft = dragStart.current.left - distance;
  }

  function stopDrag(event: PointerEvent<HTMLDivElement>) {
    if (activePointer.current !== event.pointerId) return;
    const element = scrollRef.current;
    if (element?.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
    activePointer.current = null;
    setIsDragging(false);
    if (dragged.current) window.setTimeout(() => { dragged.current = false; }, 0);
  }

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    const element = scrollRef.current;
    if (!element || !event.shiftKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    event.preventDefault();
    element.scrollLeft += event.deltaY;
  }

  return <>
    <div className="sample-table-scroll-tools" aria-label="Horizontal table controls">
      <button type="button" onClick={() => scrollBy(-420)} aria-label="Scroll table left">←</button>
      <span><span data-th>ลากตารางด้วยเมาส์ หรือใช้ Shift + ลูกกลิ้ง เพื่อดูด้านขวา</span><span data-en>Drag the table, or use Shift + mouse wheel, to view the right side</span></span>
      <button type="button" onClick={() => scrollBy(420)} aria-label="Scroll table right">→</button>
    </div>
    <div
      ref={scrollRef}
      className={`table-wrap sample-table-drag-scroll ${isDragging ? "is-dragging" : ""}`}
      onPointerDown={startDrag}
      onPointerMove={moveDrag}
      onPointerUp={stopDrag}
      onPointerCancel={stopDrag}
      onWheel={handleWheel}
      onClickCapture={(event) => {
        if (!dragged.current) return;
        event.preventDefault();
        event.stopPropagation();
        dragged.current = false;
      }}
    >
      {children}
    </div>
  </>;
}
