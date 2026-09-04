"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import * as THREE from "three";

type NavOrb = {
  label: string;
  href: string;
  accent: string;
  delay: string;
  duration: string;
};

// Forest/natural palette: emerald (growth), moss teal (water/shade), amber (sunlight through canopy).
const NAV_ORBS: NavOrb[] = [
  { label: "Games", href: "/games", accent: "52, 199, 110", delay: "0s", duration: "6.5s" },
  { label: "Blog", href: "/blog", accent: "45, 158, 138", delay: "-2.1s", duration: "7.2s" },
  { label: "Media", href: "/media", accent: "214, 168, 68", delay: "-4.4s", duration: "5.8s" },
];

const CURSOR_REACH = 170;
const ORB_REACH = 230;

const SPREAD_X = 700;
const SPREAD_Y = 420;
const SPREAD_Z = 320;

const SPAWN_POOL = 150;

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
  varying float vAlpha;
  varying float vHighlight;
  void main() {
    vec2 uv = gl_PointCoord - vec2(0.5);
    float d = length(uv);
    if (d > 0.5) discard;
    float edge = smoothstep(0.5, 0.0, d);
    vec3 color = mix(uBaseColor, uHighlightColor, clamp(vHighlight, 0.0, 1.0));
    float alpha = edge * vAlpha * (1.0 + 0.6 * vHighlight);
    gl_FragColor = vec4(color, alpha);
  }
`;

export default function LandingHero() {
  const mountRef = useRef<HTMLDivElement>(null);
  const lineCanvasRef = useRef<HTMLCanvasElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const orbRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const mouse = useRef<{ x: number; y: number } | null>(null);

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
    camera.position.set(0, 0, 420);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch (err) {
      console.error(
        "[LandingHero] WebGL is unavailable in this browser/context, so the particle field can't render.",
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
    // Spawn-pool slots start dormant (invisible) until a click activates them.
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
      },
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

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

    const onPointerMove = (e: PointerEvent) => {
      mouse.current = { x: e.clientX, y: e.clientY };
      targetCam.x = (e.clientX / width - 0.5) * 2;
      targetCam.y = (e.clientY / height - 0.5) * 2;
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
      material.uniforms.uTime.value = t;

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

      camera.position.x += (targetCam.x * 70 - camera.position.x) * 0.04;
      camera.position.y += (-targetCam.y * 45 - camera.position.y) * 0.04;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);

      if (contentRef.current) {
        const rx = -targetCam.y * 5;
        const ry = targetCam.x * 5;
        contentRef.current.style.transform = `perspective(1400px) rotateX(${rx}deg) rotateY(${ry}deg)`;
      }

      lineCtx.clearRect(0, 0, width, height);
      const m = mouse.current;
      const centers = orbRefs.current.map((el) => {
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      });

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
            lineCtx.strokeStyle = `rgba(140, 220, 150, ${proximity * 0.5})`;
            lineCtx.lineWidth = 1;
            lineCtx.stroke();
          }
        }

        centers.forEach((c, i2) => {
          if (!c) return;
          const dx = sx - c.x;
          const dy = sy - c.y;
          const dist = Math.hypot(dx, dy);
          if (dist < ORB_REACH) {
            const proximity = 1 - dist / ORB_REACH;
            highlight = Math.max(highlight, proximity);
            lineCtx.beginPath();
            lineCtx.moveTo(c.x, c.y);
            lineCtx.lineTo(sx, sy);
            lineCtx.strokeStyle = `rgba(${NAV_ORBS[i2].accent}, ${proximity * 0.45})`;
            lineCtx.lineWidth = 1;
            lineCtx.stroke();
          }
        });

        highlights[i] = highlight;
      }
      (geometry.attributes.aHighlight as THREE.BufferAttribute).needsUpdate = true;

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
  }, []);

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#060b07]">
      <div ref={mountRef} className="absolute inset-0" />
      <canvas ref={lineCanvasRef} className="pointer-events-none absolute inset-0" />

      <div
        ref={contentRef}
        className="relative z-10 flex min-h-screen flex-col items-center justify-center gap-16 px-6 text-center transition-transform duration-100 ease-out"
        style={{ transformStyle: "preserve-3d" }}
      >
        <div className="flex flex-col items-center gap-4">
          <h1 className="animate-breathe-slow bg-gradient-to-b from-white to-emerald-200/40 bg-clip-text text-5xl font-semibold tracking-[0.2em] text-transparent drop-shadow-[0_0_25px_rgba(80,200,120,0.35)] sm:text-7xl">
            TECHNATURE
          </h1>
          <p className="max-w-md text-balance text-sm text-white/50 sm:text-base">
            An evolving space for games, stories, and everything in between.
          </p>
        </div>

        <nav className="flex flex-wrap items-center justify-center gap-10 sm:gap-16">
          {NAV_ORBS.map((orb, i) => (
            <Link
              key={orb.label}
              href={orb.href}
              ref={(el) => {
                orbRefs.current[i] = el;
              }}
              className="animate-breathe group relative flex h-32 w-32 items-center justify-center rounded-full border border-white/15 bg-white/5 text-sm font-medium tracking-wide text-white/80 backdrop-blur-md transition-transform duration-300 hover:scale-110 hover:text-white sm:h-36 sm:w-36"
              style={
                {
                  animationDelay: orb.delay,
                  animationDuration: orb.duration,
                  "--orb-glow": `rgba(${orb.accent}, 0.35)`,
                } as React.CSSProperties
              }
            >
              <span
                className="absolute inset-0 rounded-full opacity-60 blur-xl transition-opacity duration-300 group-hover:opacity-100"
                style={{ background: `radial-gradient(circle, rgba(${orb.accent}, 0.35), transparent 70%)` }}
              />
              <span className="relative">{orb.label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
