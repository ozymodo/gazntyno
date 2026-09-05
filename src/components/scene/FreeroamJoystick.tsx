"use client";

import { useRef } from "react";

const BASE_SIZE = 104;
const KNOB_SIZE = 44;
const MAX_RADIUS = (BASE_SIZE - KNOB_SIZE) / 2;

/**
 * A single-thumb virtual joystick for freeroam movement on touch devices -
 * dragging it reports a `{x, z}` vector (each in [-1, 1], analog rather than
 * on/off like WASD) matching the same strafe/forward axes the keyboard
 * drives, so SceneProvider's movement code doesn't need to know which
 * input produced it. Tracks one pointer at a time via pointer capture, so
 * the knob keeps following even if the finger slides outside its base.
 */
export default function FreeroamJoystick({ onMove }: { onMove: (x: number, z: number) => void }) {
  const baseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const activePointerId = useRef<number | null>(null);

  const setKnob = (dx: number, dz: number) => {
    const knob = knobRef.current;
    if (knob) knob.style.transform = `translate(${dx * MAX_RADIUS}px, ${-dz * MAX_RADIUS}px)`;
  };

  const updateFromPoint = (clientX: number, clientY: number) => {
    const base = baseRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const dist = Math.hypot(dx, dy) || 1;
    const clamped = Math.min(1, dist / MAX_RADIUS);
    const x = (dx / dist) * clamped;
    // Screen-down is positive dy, but dragging the thumb up should mean
    // "forward" - flip it so z follows the same convention as the "w" key.
    const z = (-dy / dist) * clamped;
    setKnob(x, z);
    onMove(x, z);
  };

  const release = () => {
    activePointerId.current = null;
    setKnob(0, 0);
    onMove(0, 0);
  };

  return (
    <div
      ref={baseRef}
      className="pointer-events-auto fixed bottom-10 left-8 z-30 touch-none rounded-full border border-white/15 bg-white/5 backdrop-blur-md"
      style={{ width: BASE_SIZE, height: BASE_SIZE }}
      onPointerDown={(e) => {
        e.stopPropagation();
        if (activePointerId.current !== null) return;
        activePointerId.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        updateFromPoint(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        e.stopPropagation();
        if (e.pointerId !== activePointerId.current) return;
        updateFromPoint(e.clientX, e.clientY);
      }}
      onPointerUp={(e) => {
        e.stopPropagation();
        if (e.pointerId !== activePointerId.current) return;
        release();
      }}
      onPointerCancel={(e) => {
        e.stopPropagation();
        if (e.pointerId !== activePointerId.current) return;
        release();
      }}
    >
      <div
        ref={knobRef}
        className="pointer-events-none absolute rounded-full bg-white/25"
        style={{
          width: KNOB_SIZE,
          height: KNOB_SIZE,
          left: "50%",
          top: "50%",
          marginLeft: -KNOB_SIZE / 2,
          marginTop: -KNOB_SIZE / 2,
        }}
      />
    </div>
  );
}
