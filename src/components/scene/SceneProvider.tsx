"use client";

import { LayoutGroup } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import HomeButton from "@/components/scene/HomeButton";
import { SceneContext, type SceneContextValue } from "@/components/scene/scene-context";

const CURSOR_REACH = 170;
const TARGET_REACH = 230;
const TARGET_LINK_REACH = 140;

const SPREAD_X = 700;
const SPREAD_Y = 420;
const SPREAD_Z = 320;

// Generous pool: a page dive bursts a few hundred at once (the "dissolve"),
// so a small pool would just mean the burst eats its own tail.
const SPAWN_POOL = 700;
const DIVE_BURST_COUNT = 170;
const ENTITY_BURST_COUNT = 28;

// Burst particles ease in, hold, then ease back out over their lifetime
// instead of snapping on/off — and peak below full brightness, so a burst
// reads as subtle and translucent like the rest of the field rather than a
// flash. Ambient and click-spawned particles (expiresAt left at Infinity)
// are untouched by this and stay at full, permanent brightness.
const BURST_FADE_IN = 0.5;
const BURST_FADE_OUT = 2.2;
const BURST_PEAK_ACTIVE = 0.42;

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
  "/blog": { color: [56 / 255, 145 / 255, 255 / 255], mix: 0.4, line: "120, 185, 255" },
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

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
  return t * t * (3 - 2 * t);
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

  const diveToImplRef = useRef<(href: string, el?: HTMLElement | null) => void>(() => {});
  const diveTo = useCallback((href: string, originEl?: HTMLElement | null) => {
    diveToImplRef.current(href, originEl);
  }, []);
  const burstAtImplRef = useRef<(x: number, y: number, count?: number) => void>(() => {});
  const burstAt = useCallback((x: number, y: number, count?: number) => {
    burstAtImplRef.current(x, y, count);
  }, []);
  const emitDustImplRef = useRef<(x: number, y: number, count?: number) => void>(() => {});
  const emitDust = useCallback((x: number, y: number, count?: number) => {
    emitDustImplRef.current(x, y, count);
  }, []);
  const getPointer = useCallback(() => mouse.current, []);
  const contextValue = useMemo<SceneContextValue>(
    () => ({ diveTo, burstAt, getPointer, emitDust }),
    [diveTo, burstAt, getPointer, emitDust],
  );

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
    // Burst particles (dive dissolves, entity bursts) fade back out after a
    // few seconds so a session's worth of transitions doesn't permanently
    // densify the field; click-spawned ones keep the prior "lasts forever"
    // behavior (Infinity).
    const expiresAt = new Float32Array(TOTAL).fill(Infinity);

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

    // Projects a screen point onto the particle field's z=0 plane, in the
    // points object's local space — shared by single clicks and bursts.
    const screenToLocal = (clientX: number, clientY: number) => {
      const ndcX = (clientX / width) * 2 - 1;
      const ndcY = -(clientY / height) * 2 + 1;
      raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
      const { origin, direction } = raycaster.ray;
      if (Math.abs(direction.z) < 1e-6) return null;
      const t = -origin.z / direction.z;
      const world = origin.clone().addScaledVector(direction, t);
      return points.worldToLocal(world);
    };

    const markDirty = () => {
      geometry.attributes.position.needsUpdate = true;
      (geometry.attributes.aPhase as THREE.BufferAttribute).needsUpdate = true;
      (geometry.attributes.aSpeed as THREE.BufferAttribute).needsUpdate = true;
      (geometry.attributes.aSize as THREE.BufferAttribute).needsUpdate = true;
      (geometry.attributes.aBirth as THREE.BufferAttribute).needsUpdate = true;
      (geometry.attributes.aActive as THREE.BufferAttribute).needsUpdate = true;
    };

    const spawnParticle = (clientX: number, clientY: number) => {
      const local = screenToLocal(clientX, clientY);
      if (!local) return;

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
      expiresAt[idx] = Infinity;

      markDirty();
    };

    // A scatter of many particles at once from one screen point — the
    // "dissolve" beat for page dives, and shared with other entities (an
    // opened post, an uploaded photo) via burstAt so the whole site reads
    // as built from the same drifting field.
    const burstParticles = (clientX: number, clientY: number, count: number) => {
      const local = screenToLocal(clientX, clientY);
      if (!local) return;

      for (let n = 0; n < count; n++) {
        const idx = BASE_COUNT + nextSpawnSlot;
        nextSpawnSlot = (nextSpawnSlot + 1) % SPAWN_POOL;

        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random() * 2 - 1);
        const speed = 0.5 + Math.random() * 1.8;

        positions[idx * 3] = local.x + (Math.random() - 0.5) * 4;
        positions[idx * 3 + 1] = local.y + (Math.random() - 0.5) * 4;
        positions[idx * 3 + 2] = local.z + (Math.random() - 0.5) * 4;
        velocities[idx * 3] = Math.sin(phi) * Math.cos(theta) * speed;
        velocities[idx * 3 + 1] = Math.sin(phi) * Math.sin(theta) * speed;
        velocities[idx * 3 + 2] = Math.cos(phi) * speed * 0.6;
        phases[idx] = Math.random() * Math.PI * 2;
        speeds[idx] = 1 + Math.random() * 1.5;
        sizes[idx] = 14 + Math.random() * 28;
        births[idx] = timer.getElapsed();
        actives[idx] = 0;
        expiresAt[idx] = timer.getElapsed() + BURST_FADE_IN + 3 + Math.random() * 2 + BURST_FADE_OUT;
      }

      markDirty();
    };

    type Dive = {
      startTime: number;
      duration: number;
      fromZ: number;
      toZ: number;
      href: string;
      pushed: boolean;
      originClientX: number;
      originClientY: number;
      arrivalBurstFired: boolean;
    };
    type Settle = { startTime: number; duration: number; fromZ: number; toZ: number };

    let dive: Dive | null = null;
    let settle: Settle | null = null;
    let pendingDiveTarget: string | null = null;
    let diveAim: { x: number; y: number } | null = null;
    let lastPath = pathnameRef.current;

    // Cursor wake: tiny motes that drift, slowly rise, and fade — like dust
    // disturbed by something moving through it, not a smoke trail. Faster
    // movement stirs up more of them.
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

    // querySelectorAll + getBoundingClientRect force a layout read; doing
    // that every frame was the single biggest cost in this loop. Targets
    // (nav orbs, the home button) barely move, so a periodic refresh reads
    // as instant while cutting that cost by ~15x.
    type Target = { x: number; y: number; accent: string };
    let cachedTargets: Target[] = [];
    let lastTargetsRefresh = -Infinity;
    const TARGETS_REFRESH_INTERVAL = 0.25;

    // Lets other elements (a hovered letter) borrow the exact same subtle
    // motes as the cursor's own trail, instead of a separate effect.
    const emitDust = (x: number, y: number, count: number) => {
      for (let n = 0; n < count; n++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 3 + Math.random() * 8;
        trail.push({
          x: x + (Math.random() - 0.5) * 6,
          y: y + (Math.random() - 0.5) * 6,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 4,
          born: timer.getElapsed(),
          life: 0.7 + Math.random() * 0.5,
          baseSize: 0.6 + Math.random() * 0.6,
          growth: 1 + Math.random() * 1.5,
          peakAlpha: 0.14 + Math.random() * 0.1,
          phase: Math.random() * Math.PI * 2,
        });
      }
      if (trail.length > 90) trail.splice(0, trail.length - 90);
    };
    emitDustImplRef.current = (x: number, y: number, count = 2) => emitDust(x, y, count);

    diveToImplRef.current = (href: string, originEl?: HTMLElement | null) => {
      if (dive) return;
      let ndcX = targetCam.x;
      let ndcY = targetCam.y;
      let clientX = width / 2;
      let clientY = height / 2;
      if (originEl) {
        const rect = originEl.getBoundingClientRect();
        clientX = rect.left + rect.width / 2;
        clientY = rect.top + rect.height / 2;
        ndcX = (clientX / width - 0.5) * 2;
        ndcY = (clientY / height - 0.5) * 2;
      }
      diveAim = { x: ndcX, y: ndcY };
      pendingDiveTarget = href;
      dive = {
        startTime: timer.getElapsed(),
        duration: 1.6,
        fromZ: camera.position.z,
        toZ: depthForPath(href),
        href,
        pushed: false,
        originClientX: clientX,
        originClientY: clientY,
        arrivalBurstFired: false,
      };
      // The page you're leaving dissolves into this burst.
      burstParticles(clientX, clientY, DIVE_BURST_COUNT);
    };

    burstAtImplRef.current = (x: number, y: number, count = ENTITY_BURST_COUNT) => {
      burstParticles(x, y, count);
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
      lastTargetsRefresh = -Infinity;
    };
    resize();
    window.addEventListener("resize", resize);

    const projected = new THREE.Vector3();
    let rafId = 0;

    // Digital-molecule cursor: a soft pulsing core with a few small, dim
    // satellite orbs drifting around it on tilted, out-of-phase orbits — no
    // ring outlines or bond lines, just glowing bodies, so it reads as a
    // tiny organism drifting through the field rather than a textbook
    // diagram. Each orbit's sine phase doubles as a pseudo-depth: satellites
    // swinging "toward" the viewer render larger, brighter, and on top.
    const MOLECULE_ORBS = [
      { rx: 18, ry: 7, tilt: 0, speed: 0.75, phase: 0 },
      { rx: 15, ry: 6, tilt: (Math.PI * 2) / 3, speed: 0.6, phase: 2.1 },
      { rx: 21, ry: 6, tilt: (Math.PI * 4) / 3, speed: 0.5, phase: 4.2 },
    ];

    const drawCursorMolecule = (cx: number, cy: number, elapsed: number) => {
      lineCtx.save();
      lineCtx.translate(cx, cy);

      const orbs = MOLECULE_ORBS.map((orbit) => {
        const angle = elapsed * orbit.speed + orbit.phase;
        const localX = Math.cos(angle) * orbit.rx;
        const localY = Math.sin(angle) * orbit.ry;
        const x = localX * Math.cos(orbit.tilt) - localY * Math.sin(orbit.tilt);
        const y = localX * Math.sin(orbit.tilt) + localY * Math.cos(orbit.tilt);
        const depth = Math.sin(angle) * 0.5 + 0.5; // 0 = far side, 1 = near side
        return { x, y, depth };
      }).sort((a, b) => a.depth - b.depth);

      const pulse = 0.88 + 0.12 * Math.sin(elapsed * 1.4);

      for (const orb of orbs) {
        const size = (2.2 + orb.depth * 1.4) * pulse;
        const alpha = 0.1 + orb.depth * 0.14;
        const glow = lineCtx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, size * 2.4);
        glow.addColorStop(0, `rgba(${currentLineAccent}, ${alpha.toFixed(3)})`);
        glow.addColorStop(1, `rgba(${currentLineAccent}, 0)`);
        lineCtx.fillStyle = glow;
        lineCtx.beginPath();
        lineCtx.arc(orb.x, orb.y, size * 2.4, 0, Math.PI * 2);
        lineCtx.fill();

        lineCtx.beginPath();
        lineCtx.fillStyle = `rgba(255, 255, 255, ${(0.16 + orb.depth * 0.18).toFixed(3)})`;
        lineCtx.arc(orb.x, orb.y, size, 0, Math.PI * 2);
        lineCtx.fill();
      }

      const coreSize = 7 * pulse;
      const coreGlow = lineCtx.createRadialGradient(0, 0, 0, 0, 0, coreSize * 1.8);
      coreGlow.addColorStop(0, `rgba(${currentLineAccent}, 0.4)`);
      coreGlow.addColorStop(1, `rgba(${currentLineAccent}, 0)`);
      lineCtx.fillStyle = coreGlow;
      lineCtx.beginPath();
      lineCtx.arc(0, 0, coreSize * 1.8, 0, Math.PI * 2);
      lineCtx.fill();

      lineCtx.beginPath();
      lineCtx.fillStyle = "rgba(255, 255, 255, 0.7)";
      lineCtx.arc(0, 0, 2.6, 0, Math.PI * 2);
      lineCtx.fill();

      lineCtx.restore();
    };

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
          settle = { startTime: t, duration: 0.9, fromZ: camera.position.z, toZ: depthForPath(newPath) };
        }
      }

      const posAttr = geometry.attributes.position as THREE.BufferAttribute;
      let activeDirty = false;
      for (let i = 0; i < TOTAL; i++) {
        if (i >= BASE_COUNT && expiresAt[i] !== Infinity) {
          const age = t - births[i];
          const remaining = expiresAt[i] - t;
          const fadeIn = smoothstep(0, BURST_FADE_IN, age);
          const fadeOut = smoothstep(0, BURST_FADE_OUT, remaining);
          actives[i] = Math.min(fadeIn, fadeOut) * BURST_PEAK_ACTIVE;
          activeDirty = true;
        }

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
      if (activeDirty) (geometry.attributes.aActive as THREE.BufferAttribute).needsUpdate = true;
      posAttr.needsUpdate = true;

      points.rotation.y = t * 0.025;
      points.rotation.x = Math.sin(t * 0.05) * 0.05;

      const targetAccent = accentForPath(pathnameRef.current);
      const uAccent = material.uniforms.uAccent.value as THREE.Color;
      uAccent.lerp(new THREE.Color(...targetAccent.color), 0.04);
      currentAccentMix += (targetAccent.mix - currentAccentMix) * 0.04;
      material.uniforms.uAccentMix.value = currentAccentMix;
      currentLineAccent = targetAccent.line;

      // Drives the DOM content's fade directly off dive/settle progress
      // instead of a fixed-duration CSS transition, so the page visibly
      // dissolves early in the dive (leaving only the particle burst and
      // camera motion), then reassembles once the new page has mounted.
      let contentOpacity = 1;

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

        contentOpacity = 1 - smoothstep(0, 0.4, progress) + smoothstep(0.62, 1, progress);

        if (progress >= 0.55 && !dive.pushed) {
          dive.pushed = true;
          router.push(dive.href);
        }
        if (progress >= 0.6 && !dive.arrivalBurstFired) {
          dive.arrivalBurstFired = true;
          // The new page reassembles out of this second burst.
          burstParticles(dive.originClientX, dive.originClientY, Math.round(DIVE_BURST_COUNT * 0.6));
        }
        if (progress >= 1) {
          dive = null;
          diveAim = null;
          camera.fov = 60;
          camera.updateProjectionMatrix();
        }
      } else if (settle) {
        const progress = Math.min((t - settle.startTime) / settle.duration, 1);
        const eased = easeInOutCubic(progress);
        camera.position.z = settle.fromZ + (settle.toZ - settle.fromZ) * eased;
        contentOpacity = smoothstep(0, 1, progress);
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
        contentRef.current.style.opacity = contentOpacity.toFixed(3);
        contentRef.current.style.pointerEvents = contentOpacity > 0.4 ? "auto" : "none";
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
              baseSize: 0.6 + intensity * 0.8,
              growth: 1.2 + intensity * 1.8,
              peakAlpha: 0.1 + intensity * 0.14,
              phase: Math.random() * Math.PI * 2,
            });
          }
          if (trail.length > 90) trail.splice(0, trail.length - 90);
        }
        lastTrailMouse = { x: m.x, y: m.y };
      } else {
        lastTrailMouse = null;
      }

      if (t - lastTargetsRefresh > TARGETS_REFRESH_INTERVAL) {
        lastTargetsRefresh = t;
        cachedTargets = Array.from(document.querySelectorAll<HTMLElement>("[data-particle-target]")).map((el) => {
          const rect = el.getBoundingClientRect();
          return {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
            accent: el.dataset.accent || DEFAULT_ACCENT,
          };
        });
      }
      const targets = cachedTargets;

      // The cursor draws a line to nearby particles; it draws the same kind
      // of line straight to a nearby target (a hero letter, a nav orb) too,
      // once per target rather than per particle.
      if (m) {
        for (const tg of targets) {
          const dx = tg.x - m.x;
          const dy = tg.y - m.y;
          const dist = Math.hypot(dx, dy);
          if (dist < TARGET_REACH) {
            const proximity = 1 - dist / TARGET_REACH;
            lineCtx.beginPath();
            lineCtx.moveTo(m.x, m.y);
            lineCtx.lineTo(tg.x, tg.y);
            lineCtx.strokeStyle = `rgba(${tg.accent}, ${proximity * 0.5})`;
            lineCtx.lineWidth = 1;
            lineCtx.stroke();
          }
        }
      }

      // Targets link up with each other when close together too — this is
      // what turns a word into a constellation: adjacent hero letters (or
      // the home button's scattered ones) draw lines between themselves,
      // not just out to particles and the cursor.
      for (let a = 0; a < targets.length; a++) {
        for (let b = a + 1; b < targets.length; b++) {
          const ta = targets[a];
          const tb = targets[b];
          const dx = tb.x - ta.x;
          const dy = tb.y - ta.y;
          const dist = Math.hypot(dx, dy);
          if (dist < TARGET_LINK_REACH) {
            const proximity = 1 - dist / TARGET_LINK_REACH;
            lineCtx.beginPath();
            lineCtx.moveTo(ta.x, ta.y);
            lineCtx.lineTo(tb.x, tb.y);
            lineCtx.strokeStyle = `rgba(${ta.accent}, ${proximity * 0.35})`;
            lineCtx.lineWidth = 1;
            lineCtx.stroke();
          }
        }
      }

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
        if (alpha <= 0.004) continue;

        // A plain small fill reads as a discrete particle; a soft gradient
        // at this alpha just smears into a haze.
        lineCtx.beginPath();
        lineCtx.fillStyle = `rgba(${currentLineAccent}, ${alpha.toFixed(3)})`;
        lineCtx.arc(dot.x, dot.y, size, 0, Math.PI * 2);
        lineCtx.fill();
      }

      if (m) drawCursorMolecule(m.x, m.y, t);

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
      {/* Shared across routes so the "TECHNATURE" wordmark can hand its
          letters off between the home hero and this button by layoutId,
          rather than one fading out while the other fades in. */}
      <LayoutGroup>
        {pathname !== "/" && <HomeButton />}
        <div ref={contentRef} className="relative z-10" style={{ opacity: 1, transformStyle: "preserve-3d" }}>
          {children}
        </div>
      </LayoutGroup>
    </SceneContext.Provider>
  );
}
