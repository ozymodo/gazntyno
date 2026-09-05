"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import HomeButton from "@/components/scene/HomeButton";
import { SceneContext, type SceneContextValue } from "@/components/scene/scene-context";

const CURSOR_REACH = 170;
const TARGET_REACH = 230;

const SPREAD_X = 700;
const SPREAD_Y = 420;
const SPREAD_Z = 320;

const SPAWN_POOL = 150;

const DEFAULT_ACCENT = "120, 200, 140";

// Resting camera depth per top-level route. Clicking a nav element flies the
// camera from its current depth to the target route's depth "through" the
// clicked element; direct loads / back-forward just settle there.
const ROUTE_DEPTH: Record<string, number> = {
  "/": 420,
  "/games": 70,
  "/blog": 70,
  "/media": 70,
};
const DEFAULT_DEPTH = 200;

function depthForPath(pathname: string) {
  if (ROUTE_DEPTH[pathname] !== undefined) return ROUTE_DEPTH[pathname];
  const base = "/" + (pathname.split("/")[1] ?? "");
  return ROUTE_DEPTH[base] ?? DEFAULT_DEPTH;
}

// Each section's interior carries its button's own hue blended into the
// forest-green baseline, so the particle field (and cursor lines) pick up a
// little of "the button that was pressed" the deeper you go.
const ROUTE_ACCENT: Record<string, { color: [number, number, number]; mix: number; line: string }> = {
  "/games": { color: [52 / 255, 199 / 255, 110 / 255], mix: 0.4, line: "90, 210, 140" },
  "/blog": { color: [45 / 255, 158 / 255, 138 / 255], mix: 0.4, line: "90, 190, 175" },
  "/media": { color: [214 / 255, 168 / 255, 68 / 255], mix: 0.4, line: "220, 190, 120" },
};
const HOME_ACCENT = { color: [0.32, 0.5, 0.34] as [number, number, number], mix: 0, line: "140, 220, 150" };

function accentForPath(pathname: string) {
  const base = "/" + (pathname.split("/")[1] ?? "");
  return ROUTE_ACCENT[base] ?? HOME_ACCENT;
}

function easeInOutCubic(x: number) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

const VERTEX_SHADER = /* glsl */ `
  attribute float aPhase;
  attribute float aSpeed;
  attribute float aSize;
  attribute float aActive;
  attribute float aBirth;
  attribute float aHighlight;
  uniform float uTime;
  varying float vAlpha;
  varying float vHighlight;
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    float breathe = 0.55 + 0.45 * sin(uTime * aSpeed + aPhase);
    float age = max(uTime - aBirth, 0.0);
    float pop = 1.0 + 0.9 * exp(-age * 3.0);
    float flash = 0.7 * exp(-age * 2.0);
    gl_PointSize = aSize * breathe * pop * aActive * (220.0 / -mvPosition.z);
    vAlpha = (0.22 + 0.38 * breathe + flash) * aActive;
    vHighlight = aHighlight;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uBaseColor;
  uniform vec3 uHighlightColor;
  uniform vec3 uAccent;
  uniform float uAccentMix;
  varying float vAlpha;
  varying float vHighlight;
  void main() {
    vec2 uv = gl_PointCoord - vec2(0.5);
    float d = length(uv);
    if (d > 0.5) discard;
    float edge = smoothstep(0.5, 0.0, d);
    vec3 base = mix(uBaseColor, uHighlightColor, clamp(vHighlight, 0.0, 1.0));
    vec3 color = mix(base, uAccent, uAccentMix * (0.7 + 0.3 * vHighlight));
    float alpha = edge * vAlpha * (1.0 + 0.6 * vHighlight);
    gl_FragColor = vec4(color, alpha);
  }
`;

export default function SceneProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const mountRef = useRef<HTMLDivElement>(null);
  const lineCanvasRef = useRef<HTMLCanvasElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const mouse = useRef<{ x: number; y: number } | null>(null);
  const pathnameRef = useRef(pathname);

  const [contentVisible, setContentVisible] = useState(true);

  const diveToImplRef = useRef<(href: string, el?: HTMLElement | null) => void>(() => {});
  const diveTo = useCallback((href: string, originEl?: HTMLElement | null) => {
    diveToImplRef.current(href, originEl);
  }, []);
  const contextValue = useMemo<SceneContextValue>(() => ({ diveTo }), [diveTo]);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    const mount = mountRef.current;
    const lineCanvas = lineCanvasRef.current;
    if (!mount || !lineCanvas) return;
    const lineCtx = lineCanvas.getContext("2d");
    if (!lineCtx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, width / height, 1, 2000);
    camera.position.set(0, 0, depthForPath(pathnameRef.current));

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch (err) {
      console.error(
        "[SceneProvider] WebGL is unavailable in this browser/context, so the particle field can't render.",
        err,
      );
      return;
    }
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height);
    mount.appendChild(renderer.domElement);

    const BASE_COUNT = Math.min(220, Math.max(90, Math.floor((width * height) / 9000)));
    const TOTAL = BASE_COUNT + SPAWN_POOL;

    const positions = new Float32Array(TOTAL * 3);
    const velocities = new Float32Array(TOTAL * 3);
    const phases = new Float32Array(TOTAL);
    const speeds = new Float32Array(TOTAL);
    const sizes = new Float32Array(TOTAL);
    const actives = new Float32Array(TOTAL);
    const births = new Float32Array(TOTAL);
    const highlights = new Float32Array(TOTAL);

    for (let i = 0; i < BASE_COUNT; i++) {
      positions[i * 3] = (Math.random() * 2 - 1) * SPREAD_X;
      positions[i * 3 + 1] = (Math.random() * 2 - 1) * SPREAD_Y;
      positions[i * 3 + 2] = (Math.random() * 2 - 1) * SPREAD_Z;
      velocities[i * 3] = (Math.random() - 0.5) * 0.15;
      velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.15;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.15;
      phases[i] = Math.random() * Math.PI * 2;
      speeds[i] = 0.5 + Math.random() * 1;
      sizes[i] = 40 + Math.random() * 60;
      actives[i] = 1;
      births[i] = -1000;
    }
    for (let i = BASE_COUNT; i < TOTAL; i++) {
      actives[i] = 0;
      births[i] = -1000;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute("aSpeed", new THREE.BufferAttribute(speeds, 1));
    geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute("aActive", new THREE.BufferAttribute(actives, 1));
    geometry.setAttribute("aBirth", new THREE.BufferAttribute(births, 1));
    geometry.setAttribute("aHighlight", new THREE.BufferAttribute(highlights, 1));

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uBaseColor: { value: new THREE.Color(0.32, 0.5, 0.34) },
        uHighlightColor: { value: new THREE.Color(0.56, 1.0, 0.6) },
        uAccent: { value: new THREE.Color(...accentForPath(pathnameRef.current).color) },
        uAccentMix: { value: accentForPath(pathnameRef.current).mix },
      },
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    let currentAccentMix = accentForPath(pathnameRef.current).mix;
    let currentLineAccent = accentForPath(pathnameRef.current).line;

    const timer = new THREE.Timer();
    const targetCam = { x: 0, y: 0 };
    const raycaster = new THREE.Raycaster();
    let nextSpawnSlot = 0;

    const spawnParticle = (clientX: number, clientY: number) => {
      const ndcX = (clientX / width) * 2 - 1;
      const ndcY = -(clientY / height) * 2 + 1;
      raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
      const { origin, direction } = raycaster.ray;
      if (Math.abs(direction.z) < 1e-6) return;
      const t = -origin.z / direction.z;
      const world = origin.clone().addScaledVector(direction, t);
      const local = points.worldToLocal(world);

      const idx = BASE_COUNT + nextSpawnSlot;
      nextSpawnSlot = (nextSpawnSlot + 1) % SPAWN_POOL;

      positions[idx * 3] = local.x;
      positions[idx * 3 + 1] = local.y;
      positions[idx * 3 + 2] = local.z;
      velocities[idx * 3] = (Math.random() - 0.5) * 0.3;
      velocities[idx * 3 + 1] = (Math.random() - 0.5) * 0.3;
      velocities[idx * 3 + 2] = (Math.random() - 0.5) * 0.3;
      phases[idx] = Math.random() * Math.PI * 2;
      speeds[idx] = 0.5 + Math.random();
      sizes[idx] = 55 + Math.random() * 55;
      births[idx] = timer.getElapsed();
      actives[idx] = 1;

      geometry.attributes.position.needsUpdate = true;
      (geometry.attributes.aPhase as THREE.BufferAttribute).needsUpdate = true;
      (geometry.attributes.aSpeed as THREE.BufferAttribute).needsUpdate = true;
      (geometry.attributes.aSize as THREE.BufferAttribute).needsUpdate = true;
      (geometry.attributes.aBirth as THREE.BufferAttribute).needsUpdate = true;
      (geometry.attributes.aActive as THREE.BufferAttribute).needsUpdate = true;
    };

    type Dive = {
      startTime: number;
      duration: number;
      fromZ: number;
      toZ: number;
      href: string;
      pushed: boolean;
    };
    type Settle = { startTime: number; duration: number; fromZ: number; toZ: number };

    let dive: Dive | null = null;
    let settle: Settle | null = null;
    let pendingDiveTarget: string | null = null;
    let diveAim: { x: number; y: number } | null = null;
    let lastPath = pathnameRef.current;

    // Cursor wake: soft displacement blobs that drift, slowly rise, and
    // expand while fading — like disturbing a thick, glowing liquid rather
    // than leaving a spark trail. Faster movement stirs up more of them.
    type TrailDot = {
      x: number;
      y: number;
      vx: number;
      vy: number;
      born: number;
      life: number;
      baseSize: number;
      growth: number;
      peakAlpha: number;
      phase: number;
    };
    const trail: TrailDot[] = [];
    let lastTrailMouse: { x: number; y: number } | null = null;

    diveToImplRef.current = (href: string, originEl?: HTMLElement | null) => {
      if (dive) return;
      let ndcX = targetCam.x;
      let ndcY = targetCam.y;
      if (originEl) {
        const rect = originEl.getBoundingClientRect();
        ndcX = ((rect.left + rect.width / 2) / width - 0.5) * 2;
        ndcY = ((rect.top + rect.height / 2) / height - 0.5) * 2;
      }
      diveAim = { x: ndcX, y: ndcY };
      pendingDiveTarget = href;
      dive = {
        startTime: timer.getElapsed(),
        duration: 1.0,
        fromZ: camera.position.z,
        toZ: depthForPath(href),
        href,
        pushed: false,
      };
      setContentVisible(false);
    };

    const onPointerMove = (e: PointerEvent) => {
      mouse.current = { x: e.clientX, y: e.clientY };
      if (!dive) {
        targetCam.x = (e.clientX / width - 0.5) * 2;
        targetCam.y = (e.clientY / height - 0.5) * 2;
      }
    };
    const onPointerLeave = () => {
      mouse.current = null;
    };
    const onPointerDown = (e: PointerEvent) => {
      spawnParticle(e.clientX, e.clientY);
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("pointerdown", onPointerDown);

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      lineCanvas.width = width * dpr;
      lineCanvas.height = height * dpr;
      lineCanvas.style.width = `${width}px`;
      lineCanvas.style.height = `${height}px`;
      lineCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const projected = new THREE.Vector3();
    let rafId = 0;

    const tick = (timestamp: number) => {
      timer.update(timestamp);
      const t = timer.getElapsed();
      const dt = timer.getDelta();
      material.uniforms.uTime.value = t;

      if (pathnameRef.current !== lastPath) {
        const newPath = pathnameRef.current;
        lastPath = newPath;
        if (dive && pendingDiveTarget === newPath) {
          pendingDiveTarget = null;
        } else {
          dive = null;
          diveAim = null;
          pendingDiveTarget = null;
          settle = { startTime: t, duration: 0.6, fromZ: camera.position.z, toZ: depthForPath(newPath) };
          setContentVisible(true);
        }
      }

      const posAttr = geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < TOTAL; i++) {
        let x = positions[i * 3] + velocities[i * 3];
        let y = positions[i * 3 + 1] + velocities[i * 3 + 1];
        let z = positions[i * 3 + 2] + velocities[i * 3 + 2];
        if (x > SPREAD_X) x = -SPREAD_X;
        if (x < -SPREAD_X) x = SPREAD_X;
        if (y > SPREAD_Y) y = -SPREAD_Y;
        if (y < -SPREAD_Y) y = SPREAD_Y;
        if (z > SPREAD_Z) z = -SPREAD_Z;
        if (z < -SPREAD_Z) z = SPREAD_Z;
        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;
      }
      posAttr.needsUpdate = true;

      points.rotation.y = t * 0.025;
      points.rotation.x = Math.sin(t * 0.05) * 0.05;

      const targetAccent = accentForPath(pathnameRef.current);
      const uAccent = material.uniforms.uAccent.value as THREE.Color;
      uAccent.lerp(new THREE.Color(...targetAccent.color), 0.04);
      currentAccentMix += (targetAccent.mix - currentAccentMix) * 0.04;
      material.uniforms.uAccentMix.value = currentAccentMix;
      currentLineAccent = targetAccent.line;

      if (dive) {
        const progress = Math.min((t - dive.startTime) / dive.duration, 1);
        const eased = easeInOutCubic(progress);
        camera.position.z = dive.fromZ + (dive.toZ - dive.fromZ) * eased;
        camera.fov = 60 + Math.sin(progress * Math.PI) * 14;
        camera.updateProjectionMatrix();

        if (diveAim) {
          camera.position.x += (diveAim.x * 90 - camera.position.x) * 0.12;
          camera.position.y += (-diveAim.y * 60 - camera.position.y) * 0.12;
        }

        if (progress >= 0.55 && !dive.pushed) {
          dive.pushed = true;
          router.push(dive.href);
        }
        if (progress >= 1) {
          dive = null;
          diveAim = null;
          camera.fov = 60;
          camera.updateProjectionMatrix();
          setContentVisible(true);
        }
      } else if (settle) {
        const progress = Math.min((t - settle.startTime) / settle.duration, 1);
        const eased = easeInOutCubic(progress);
        camera.position.z = settle.fromZ + (settle.toZ - settle.fromZ) * eased;
        if (progress >= 1) settle = null;
        camera.position.x += (targetCam.x * 70 - camera.position.x) * 0.04;
        camera.position.y += (-targetCam.y * 45 - camera.position.y) * 0.04;
      } else {
        camera.position.x += (targetCam.x * 70 - camera.position.x) * 0.04;
        camera.position.y += (-targetCam.y * 45 - camera.position.y) * 0.04;
      }

      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);

      if (contentRef.current) {
        const rx = -targetCam.y * 5;
        const ry = targetCam.x * 5;
        contentRef.current.style.transform = `perspective(1400px) rotateX(${rx}deg) rotateY(${ry}deg)`;
      }

      lineCtx.clearRect(0, 0, width, height);
      const m = mouse.current;

      if (m) {
        if (lastTrailMouse) {
          const dx = m.x - lastTrailMouse.x;
          const dy = m.y - lastTrailMouse.y;
          const dist = Math.hypot(dx, dy);
          const speed = dist / Math.max(dt, 1 / 240); // px/sec
          const intensity = Math.min(speed / 2600, 1);
          // Mostly quiet at rest — just the occasional faint stir, like
          // ambient motion in the liquid rather than a cursor marker.
          const spawnCount = intensity > 0.04 ? Math.round(1 + intensity * 2) : Math.random() < 0.12 ? 1 : 0;
          for (let s = 0; s < spawnCount; s++) {
            const along = spawnCount > 1 ? s / (spawnCount - 1) : 1;
            trail.push({
              x: lastTrailMouse.x + dx * along,
              y: lastTrailMouse.y + dy * along,
              vx: dx / Math.max(dt, 1 / 240) * 0.05 + (Math.random() - 0.5) * 5,
              vy: dy / Math.max(dt, 1 / 240) * 0.05 + (Math.random() - 0.5) * 5,
              born: t,
              life: 0.9 + intensity * 0.5 + Math.random() * 0.3,
              baseSize: 4 + intensity * 5,
              growth: 9 + intensity * 15,
              peakAlpha: 0.1 + intensity * 0.16,
              phase: Math.random() * Math.PI * 2,
            });
          }
          if (trail.length > 90) trail.splice(0, trail.length - 90);
        }
        lastTrailMouse = { x: m.x, y: m.y };
      } else {
        lastTrailMouse = null;
      }

      const targets = Array.from(document.querySelectorAll<HTMLElement>("[data-particle-target]")).map(
        (el) => {
          const rect = el.getBoundingClientRect();
          return {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
            accent: el.dataset.accent || DEFAULT_ACCENT,
          };
        },
      );

      for (let i = 0; i < TOTAL; i++) {
        if (actives[i] < 0.5) continue;

        projected.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
        projected.applyMatrix4(points.matrixWorld);
        projected.project(camera);
        if (projected.z > 1) continue;

        const sx = (projected.x * 0.5 + 0.5) * width;
        const sy = (1 - (projected.y * 0.5 + 0.5)) * height;

        let highlight = 0;

        if (m) {
          const dx = sx - m.x;
          const dy = sy - m.y;
          const dist = Math.hypot(dx, dy);
          if (dist < CURSOR_REACH) {
            const proximity = 1 - dist / CURSOR_REACH;
            highlight = Math.max(highlight, proximity);
            lineCtx.beginPath();
            lineCtx.moveTo(m.x, m.y);
            lineCtx.lineTo(sx, sy);
            lineCtx.strokeStyle = `rgba(${currentLineAccent}, ${proximity * 0.5})`;
            lineCtx.lineWidth = 1;
            lineCtx.stroke();
          }
        }

        targets.forEach((tg) => {
          const dx = sx - tg.x;
          const dy = sy - tg.y;
          const dist = Math.hypot(dx, dy);
          if (dist < TARGET_REACH) {
            const proximity = 1 - dist / TARGET_REACH;
            highlight = Math.max(highlight, proximity);
            lineCtx.beginPath();
            lineCtx.moveTo(tg.x, tg.y);
            lineCtx.lineTo(sx, sy);
            lineCtx.strokeStyle = `rgba(${tg.accent}, ${proximity * 0.45})`;
            lineCtx.lineWidth = 1;
            lineCtx.stroke();
          }
        });

        highlights[i] = highlight;
      }
      (geometry.attributes.aHighlight as THREE.BufferAttribute).needsUpdate = true;

      for (let i = trail.length - 1; i >= 0; i--) {
        const dot = trail[i];
        const age = t - dot.born;
        if (age >= dot.life) {
          trail.splice(i, 1);
          continue;
        }

        // Viscous drag, a slow buoyant rise, and a light wobble — it drifts
        // like something suspended in liquid, not a marker snapped to the
        // cursor's path.
        const drag = Math.exp(-2.2 * dt);
        dot.vx = dot.vx * drag + Math.sin(t * 1.6 + dot.phase) * 2 * dt;
        dot.vy = dot.vy * drag - 3 * dt;
        dot.x += dot.vx * dt;
        dot.y += dot.vy * dt;

        const k = age / dot.life;
        const size = dot.baseSize + dot.growth * k;
        const alpha = dot.peakAlpha * (1 - k) * (1 - k);
        if (alpha <= 0.002) continue;

        const gradient = lineCtx.createRadialGradient(dot.x, dot.y, 0, dot.x, dot.y, size);
        gradient.addColorStop(0, `rgba(${currentLineAccent}, ${alpha.toFixed(3)})`);
        gradient.addColorStop(1, `rgba(${currentLineAccent}, 0)`);
        lineCtx.fillStyle = gradient;
        lineCtx.beginPath();
        lineCtx.arc(dot.x, dot.y, size, 0, Math.PI * 2);
        lineCtx.fill();
      }

      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("pointerdown", onPointerDown);
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [router]);

  return (
    <SceneContext.Provider value={contextValue}>
      <div ref={mountRef} className="fixed inset-0 z-0" />
      <canvas ref={lineCanvasRef} className="pointer-events-none fixed inset-0 z-[1]" />
      {pathname !== "/" && <HomeButton />}
      <div
        ref={contentRef}
        className="relative z-10 transition-opacity duration-300 ease-out"
        style={{
          opacity: contentVisible ? 1 : 0,
          pointerEvents: contentVisible ? "auto" : "none",
          transformStyle: "preserve-3d",
        }}
      >
        {children}
      </div>
    </SceneContext.Provider>
  );
}
