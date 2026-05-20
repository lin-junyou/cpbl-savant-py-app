"use client";

/**
 * Interactive 3D strike-zone scene.
 *
 *   • Wireframe 9-grid strike zone (Savant style) + home plate + mound.
 *   • Per-pitch 3D curves rebuilt from PolyFit X/Y/Z polynomials.
 *   • Click a pitch → opens detail panel with Trackman metrics.
 *   • Click "▶ 播放" to animate the selected pitch with a spinning ball.
 *     The ball's rotation axis is inferred from observed break vs gravity
 *     (perpendicular to break direction, normalized).
 *   • OrbitControls: drag rotate / scroll zoom / right-drag pan.
 *
 * Trackman PolyFit convention (verified against PlateLocSide/Height/RelHeight):
 *   X(t) = forward distance, m  (X(0) ≈ 16-17, X(t_plate) = 0)
 *   Y(t) = height, m
 *   Z(t) = side, m — **sign-flipped vs catcher view**, so we negate it.
 */
import * as React from "react";
import { Canvas, useFrame, ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Line, Text, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { useMemo, useRef, useState, useEffect } from "react";
import type { TrajectoryPitch, PitchLocation } from "@/lib/api";

// Warm the ball texture on module load so the AnimatedBall doesn't suspend
// the Canvas mid-frame and leave a blank scene.
useTexture.preload("/textures/ball.jpg");

const PITCH_HEX: Record<string, string> = {
  "Four-Seam": "#dc2626",
  "Two-Seam": "#ef4444",
  Sinker: "#f97316",
  Cutter: "#a16207",
  Slider: "#7c3aed",
  Curveball: "#2563eb",
  Changeup: "#16a34a",
  Splitter: "#14b8a6",
  Knuckleball: "#6b7280",
};

const ZONE = { halfWidth: 0.215, bottom: 0.46, top: 1.07 };

function evalPoly(c: [number, number, number], t: number) {
  return c[0] + c[1] * t + c[2] * t * t;
}

function plateTime(p: TrajectoryPitch): number {
  if (!p.traj_x) return 0.45;
  const [c, b, a] = [p.traj_x[0], p.traj_x[1], p.traj_x[2]];
  const disc = b * b - 4 * a * c;
  if (disc < 0 || a === 0) return 0.45;
  const t1 = (-b - Math.sqrt(disc)) / (2 * a);
  const t2 = (-b + Math.sqrt(disc)) / (2 * a);
  const cs = [t1, t2].filter((t) => t > 0.01 && t < 1.5);
  return cs.length ? Math.min(...cs) : 0.45;
}

function evalAt(p: TrajectoryPitch, t: number): [number, number, number] | null {
  if (!p.traj_x || !p.traj_y || !p.traj_z) return null;
  return [
    evalPoly(p.traj_x, t),
    evalPoly(p.traj_y, t),
    -evalPoly(p.traj_z, t), // flip Z to catcher view
  ];
}

function pitchCurve(p: TrajectoryPitch, samples = 60): THREE.Vector3[] | null {
  if (!p.traj_x || !p.traj_y || !p.traj_z) return null;
  const tEnd = plateTime(p);
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = (tEnd * i) / samples;
    const xyz = evalAt(p, t);
    if (!xyz) return null;
    pts.push(new THREE.Vector3(xyz[0], xyz[1], xyz[2]));
  }
  return pts;
}

/**
 * Compute "break" — actual minus gravity-only — at the plate. Returns the
 * horizontal (Z, catcher right positive) and vertical (Y, up positive)
 * components in meters.
 */
function pitchBreak(p: TrajectoryPitch): { horiz: number; vert: number } | null {
  if (!p.traj_x || !p.traj_y || !p.traj_z) return null;
  const tEnd = plateTime(p);
  const vy0 = p.traj_y[1];
  const vz0 = -p.traj_z[1];
  // Gravity-only end position (parabolic) using release values
  const gy = p.traj_y[0] + vy0 * tEnd - 4.9 * tEnd * tEnd;
  const gz = -p.traj_z[0] + vz0 * tEnd;
  const actual = evalAt(p, tEnd);
  if (!actual) return null;
  return { horiz: actual[2] - gz, vert: actual[1] - gy };
}

/**
 * Inferred spin axis: magnus force is perpendicular to the spin axis,
 * so the spin axis is perpendicular to the break vector in the Y-Z plane.
 */
function spinAxis(p: TrajectoryPitch): THREE.Vector3 {
  const b = pitchBreak(p);
  if (!b) return new THREE.Vector3(1, 0, 0);
  const axis = new THREE.Vector3(0, -b.horiz, b.vert);
  if (axis.lengthSq() < 1e-6) return new THREE.Vector3(1, 0, 0);
  return axis.normalize();
}

/**
 * Spin tilt in clock notation (Statcast convention, viewed from catcher).
 *   12:00 = pure backspin (axis points to catcher's right)
 *   6:00  = pure topspin
 *   3:00  = side-spin to RHP gyro / RHP cutter
 * Returns "HH:MM" or "—" if no usable break.
 */
function spinTilt(p: TrajectoryPitch): string {
  const axis = spinAxis(p);
  // Project into Y-Z plane (drop X component)
  const y = axis.y, z = axis.z;
  if (Math.abs(y) + Math.abs(z) < 1e-3) return "—";
  // Statcast tilt is the direction the axis points, expressed as a clock face.
  // 12 o'clock = +Y (up). Angle measured clockwise from 12 when viewed from
  // the catcher (looking toward +X). +Z is catcher's right → 3 o'clock.
  let deg = Math.atan2(z, y) * (180 / Math.PI); // 0 = up, +90 = catcher right
  if (deg < 0) deg += 360;
  // Convert degrees to hours (360° = 12 hours)
  const totalMin = Math.round((deg / 360) * 12 * 60);
  let hh = Math.floor(totalMin / 60);
  const mm = totalMin % 60;
  if (hh === 0) hh = 12;
  return `${hh}:${mm.toString().padStart(2, "0")}`;
}

// ─── Scene primitives ─────────────────────────────────────────────────

function HomePlate() {
  const w = 0.215;
  const back = 0.43;
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, -w);
    s.lineTo(0, w);
    s.lineTo(back - 0.17, w);
    s.lineTo(back, 0);
    s.lineTo(back - 0.17, -w);
    s.lineTo(0, -w);
    return s;
  }, []);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
      <shapeGeometry args={[shape]} />
      <meshStandardMaterial color="#ffffff" side={THREE.DoubleSide} />
    </mesh>
  );
}

function StrikeZoneBox() {
  const { halfWidth, bottom, top } = ZONE;
  const front = 0;
  const back = 0.43;

  const edges: React.ReactElement[] = [];
  const stepX = (halfWidth * 2) / 3;
  const stepY = (top - bottom) / 3;
  for (let i = 0; i <= 3; i++) {
    const z = -halfWidth + i * stepX;
    edges.push(
      <Line
        key={`v${i}f`}
        points={[
          [front, bottom, z],
          [front, top, z],
        ]}
        color={i === 0 || i === 3 ? "#dc2626" : "#94a3b8"}
        lineWidth={i === 0 || i === 3 ? 1.6 : 0.9}
      />,
      <Line
        key={`v${i}b`}
        points={[
          [back, bottom, z],
          [back, top, z],
        ]}
        color={i === 0 || i === 3 ? "#fca5a5" : "#cbd5e1"}
        lineWidth={i === 0 || i === 3 ? 1.2 : 0.7}
      />,
    );
  }
  for (let i = 0; i <= 3; i++) {
    const y = bottom + i * stepY;
    edges.push(
      <Line
        key={`h${i}f`}
        points={[
          [front, y, -halfWidth],
          [front, y, halfWidth],
        ]}
        color={i === 0 || i === 3 ? "#dc2626" : "#94a3b8"}
        lineWidth={i === 0 || i === 3 ? 1.6 : 0.9}
      />,
      <Line
        key={`h${i}b`}
        points={[
          [back, y, -halfWidth],
          [back, y, halfWidth],
        ]}
        color={i === 0 || i === 3 ? "#fca5a5" : "#cbd5e1"}
        lineWidth={i === 0 || i === 3 ? 1.2 : 0.7}
      />,
    );
  }
  const corners: [number, number][] = [
    [-halfWidth, bottom],
    [halfWidth, bottom],
    [-halfWidth, top],
    [halfWidth, top],
  ];
  corners.forEach(([z, y], i) => {
    edges.push(
      <Line
        key={`c${i}`}
        points={[
          [front, y, z],
          [back, y, z],
        ]}
        color="#dc2626"
        lineWidth={1.3}
      />,
    );
  });
  return (
    <group>
      <mesh position={[0.001, (bottom + top) / 2, 0]}>
        <planeGeometry args={[halfWidth * 2, top - bottom]} />
        <meshBasicMaterial color="#dc2626" opacity={0.05} transparent side={THREE.DoubleSide} />
      </mesh>
      {edges}
    </group>
  );
}

/**
 * Stadium = grass outfield + dirt infield + base paths + bases + outfield wall.
 *
 * All distances in meters. The "field" coord system has home at the origin
 * with the centre-field line along +X (mound is at X=18.4).
 *
 *   Foul lines run from home toward 1B at azimuth -45° (–Z side) and toward
 *   3B at +45° (+Z side). In our scene X = forward, Z = side (+ = catcher right
 *   = 1B from pitcher's POV), so:
 *     1B foul line direction = (+X, 0, –Z)
 *     3B foul line direction = (+X, 0, +Z)
 *
 *   Base distance = 27.4 m. Pitcher's rubber 18.4 m. Outfield fence ~ 100 m.
 */

const BASE_DIST = 27.4;
const FENCE_R_L = 99;
const FENCE_R_C = 122;
const FENCE_R_R = 99;

function dirGreen() { return "#15803d"; }
function dirDirt()  { return "#9c6f3d"; }
function dirClay()  { return "#a16207"; }

function GrassOutfield() {
  // Approximate outfield grass as a fan-shape mesh from infield grass arc to fence.
  const seg = 80;
  const verts: number[] = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    const angDeg = -45 + 90 * t; // foul line to foul line through center
    const a = (angDeg * Math.PI) / 180;
    // Fence radius interpolated between L→C→R
    let r: number;
    if (angDeg < 0) r = FENCE_R_L + ((FENCE_R_C - FENCE_R_L) * (angDeg + 45)) / 45;
    else r = FENCE_R_C + ((FENCE_R_R - FENCE_R_C) * angDeg) / 45;
    const x = r * Math.cos(a);
    const z = r * Math.sin(a);
    verts.push(0, 0, 0, x, 0, z);
  }
  // Build a TRIANGLE_FAN-equivalent set of triangles.
  const positions: number[] = [];
  for (let i = 0; i < seg; i++) {
    const i0 = i * 6 + 3;       // outer point i
    const i1 = (i + 1) * 6 + 3; // outer point i+1
    positions.push(0, 0, 0);
    positions.push(verts[i0], verts[i0 + 1], verts[i0 + 2]);
    positions.push(verts[i1], verts[i1 + 1], verts[i1 + 2]);
  }
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    g.computeVertexNormals();
    return g;
  }, [positions]);
  return (
    <mesh geometry={geom} receiveShadow>
      <meshStandardMaterial color={dirGreen()} roughness={1} />
    </mesh>
  );
}

function FoulTerritoryGrass() {
  // Two thin grass wedges outside the foul lines for visual fill.
  const wedge = (signZ: 1 | -1) => {
    const angStart = signZ > 0 ? 45 : -45;
    const seg = 30;
    const positions: number[] = [];
    for (let i = 0; i < seg; i++) {
      const a0 = ((angStart + (i * (90 - 0)) / seg) * Math.PI) / 180;
      const a1 = ((angStart + ((i + 1) * (90 - 0)) / seg) * Math.PI) / 180;
      const r0 = 100, r1 = 100;
      positions.push(0, 0, 0);
      positions.push(r0 * Math.cos(a0), 0, r0 * Math.sin(a0));
      positions.push(r1 * Math.cos(a1), 0, r1 * Math.sin(a1));
    }
    return positions;
  };
  const geomL = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(wedge(1), 3));
    g.computeVertexNormals();
    return g;
  }, []);
  const geomR = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(wedge(-1), 3));
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <group>
      <mesh geometry={geomL}>
        <meshStandardMaterial color="#166534" roughness={1} />
      </mesh>
      <mesh geometry={geomR}>
        <meshStandardMaterial color="#166534" roughness={1} />
      </mesh>
    </group>
  );
}

function InfieldDirt() {
  // Inner dirt arc with radius ~28-30m from home plate.
  const seg = 48;
  const r = 29.0;
  const positions: number[] = [];
  for (let i = 0; i < seg; i++) {
    const a0 = ((-45 + (i * 90) / seg) * Math.PI) / 180;
    const a1 = ((-45 + ((i + 1) * 90) / seg) * Math.PI) / 180;
    positions.push(0, 0, 0);
    positions.push(r * Math.cos(a0), 0, r * Math.sin(a0));
    positions.push(r * Math.cos(a1), 0, r * Math.sin(a1));
  }
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <mesh geometry={geom} position={[0, 0.002, 0]} receiveShadow>
      <meshStandardMaterial color={dirDirt()} roughness={1} />
    </mesh>
  );
}

function InfieldGrass() {
  // The grass diamond inside the bases (cuts out the dirt around bases).
  // It's a square rotated 45°, with corners at the 4 bases.
  const half = BASE_DIST;
  const positions = [
    half, 0, 0,
    half / 1.4, 0, half / 1.4,
    0, 0, half,
    half / 1.4, 0, -half / 1.4, // wait this is wrong, let me redo
  ];
  // Correct diamond with 4 corners at home (0,0,0), 1B (b,0,-b), 2B (2b,0,0), 3B (b,0,b) where b = BASE_DIST/√2
  const b = BASE_DIST / Math.sqrt(2);
  const corners = [
    [0, 0, 0],         // home
    [b, 0, -b],        // 1B
    [2 * b, 0, 0],     // 2B
    [b, 0, b],         // 3B
  ];
  // Two triangles forming the diamond
  const pos2: number[] = [];
  // Triangle 1: home, 1B, 2B
  pos2.push(...corners[0], ...corners[1], ...corners[2]);
  // Triangle 2: home, 2B, 3B
  pos2.push(...corners[0], ...corners[2], ...corners[3]);
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos2, 3));
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <mesh geometry={geom} position={[0, 0.005, 0]} receiveShadow>
      <meshStandardMaterial color={dirGreen()} roughness={1} />
    </mesh>
  );
}

function Base({ x, z, label }: { x: number; z: number; label: string }) {
  return (
    <group position={[x, 0.015, z]}>
      <mesh rotation={[-Math.PI / 2, 0, Math.PI / 4]}>
        <planeGeometry args={[0.38, 0.38]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      <Text
        position={[0, 0.005, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.22}
        color="#dc2626"
      >
        {label}
      </Text>
    </group>
  );
}

function Bases() {
  const b = BASE_DIST / Math.sqrt(2);
  return (
    <group>
      <Base x={b} z={-b} label="1" />
      <Base x={2 * b} z={0} label="2" />
      <Base x={b} z={b} label="3" />
    </group>
  );
}

function FoulLines() {
  const r = 100;
  const a = Math.PI / 4;
  return (
    <group>
      {/* Chalk lines from home to outfield, foul line side */}
      <Line
        points={[
          [0, 0.025, 0],
          [r * Math.cos(a), 0.025, -r * Math.sin(a)],
        ]}
        color="#ffffff"
        lineWidth={2}
      />
      <Line
        points={[
          [0, 0.025, 0],
          [r * Math.cos(a), 0.025, r * Math.sin(a)],
        ]}
        color="#ffffff"
        lineWidth={2}
      />
    </group>
  );
}

function OutfieldFence() {
  const seg = 60;
  const pts: [number, number, number][] = [];
  for (let i = 0; i <= seg; i++) {
    const deg = -45 + (90 * i) / seg;
    const a = (deg * Math.PI) / 180;
    const r =
      deg < 0
        ? FENCE_R_L + ((FENCE_R_C - FENCE_R_L) * (deg + 45)) / 45
        : FENCE_R_C + ((FENCE_R_R - FENCE_R_C) * deg) / 45;
    pts.push([r * Math.cos(a), 0.01, r * Math.sin(a)]);
  }
  // Build a low wall (height ~ 2.5m) along this curve as a ribbon of triangles.
  const positions: number[] = [];
  const wallH = 2.5;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, , z1] = pts[i];
    const [x2, , z2] = pts[i + 1];
    // Two triangles between (x1,0,z1)-(x2,0,z2)-(x2,wallH,z2)-(x1,wallH,z1)
    positions.push(x1, 0, z1, x2, 0, z2, x2, wallH, z2);
    positions.push(x1, 0, z1, x2, wallH, z2, x1, wallH, z1);
  }
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    g.computeVertexNormals();
    return g;
  }, [positions]);
  return (
    <group>
      <mesh geometry={geom} receiveShadow>
        <meshStandardMaterial color="#1e3a8a" roughness={0.7} side={THREE.DoubleSide} />
      </mesh>
      {/* Yellow line on top of the fence */}
      <Line points={pts.map(([x, , z]): [number, number, number] => [x, wallH, z])} color="#fbbf24" lineWidth={2} />
    </group>
  );
}

function Mound() {
  return (
    <group>
      <mesh position={[18.4, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[2.7, 32]} />
        <meshStandardMaterial color={dirClay()} roughness={1} />
      </mesh>
      {/* Rubber */}
      <mesh position={[18.4, 0.04, 0]}>
        <boxGeometry args={[0.15, 0.06, 0.6]} />
        <meshStandardMaterial color="#fff" />
      </mesh>
    </group>
  );
}

function CatcherCircle() {
  // Dirt circle around home plate (catcher's box area)
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0]} receiveShadow>
      <circleGeometry args={[3.5, 32]} />
      <meshStandardMaterial color={dirClay()} roughness={1} />
    </mesh>
  );
}

function Ground() {
  return (
    <group>
      {/* Dark ring outside the field (stands suggestion) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <circleGeometry args={[150, 64]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
      <FoulTerritoryGrass />
      <GrassOutfield />
      <InfieldDirt />
      <InfieldGrass />
      <CatcherCircle />
      <OutfieldFence />
      <Bases />
      <FoulLines />
    </group>
  );
}

// ─── Stylized figurines (pitcher / catcher / batter / umpire) ──────────

/**
 * A minimal humanoid built from primitives. ``facing`` is the world-space
 * direction the figure faces (radians around +Y).
 */
function Person({
  position,
  facing = 0,
  bodyColor = "#fafafa",
  pantsColor = "#cbd5e1",
  capColor = "#dc2626",
  skin = "#fcd9b6",
  pose = "stand",
  scale = 1,
}: {
  position: [number, number, number];
  facing?: number;
  bodyColor?: string;
  pantsColor?: string;
  capColor?: string;
  skin?: string;
  pose?: "stand" | "pitch" | "crouch" | "bat";
  scale?: number;
}) {
  // Approximate adult: 1.75m total height when standing.
  const isCrouch = pose === "crouch";
  const torsoY = isCrouch ? 0.55 : 1.05;
  const headY = isCrouch ? 0.9 : 1.55;
  const armOutward = pose === "bat" ? 0.3 : 0.0;
  const armForward = pose === "pitch" ? 0.35 : 0.0;
  return (
    <group position={position} rotation={[0, facing, 0]} scale={scale}>
      {/* Legs */}
      {!isCrouch ? (
        <>
          <mesh position={[0, 0.3, 0.12]} castShadow>
            <cylinderGeometry args={[0.085, 0.085, 0.6, 12]} />
            <meshStandardMaterial color={pantsColor} />
          </mesh>
          <mesh position={[0, 0.3, -0.12]} castShadow>
            <cylinderGeometry args={[0.085, 0.085, 0.6, 12]} />
            <meshStandardMaterial color={pantsColor} />
          </mesh>
        </>
      ) : (
        <>
          {/* Crouched legs (bent forward) */}
          <mesh position={[0, 0.2, 0.16]} rotation={[Math.PI / 5, 0, 0]} castShadow>
            <cylinderGeometry args={[0.09, 0.09, 0.4, 12]} />
            <meshStandardMaterial color={pantsColor} />
          </mesh>
          <mesh position={[0, 0.2, -0.16]} rotation={[-Math.PI / 5, 0, 0]} castShadow>
            <cylinderGeometry args={[0.09, 0.09, 0.4, 12]} />
            <meshStandardMaterial color={pantsColor} />
          </mesh>
        </>
      )}
      {/* Torso */}
      <mesh position={[0, torsoY - 0.05, 0]} castShadow>
        <capsuleGeometry args={[0.16, 0.45, 6, 12]} />
        <meshStandardMaterial color={bodyColor} />
      </mesh>
      {/* Head */}
      <mesh position={[0, headY, 0]} castShadow>
        <sphereGeometry args={[0.13, 18, 18]} />
        <meshStandardMaterial color={skin} />
      </mesh>
      {/* Cap */}
      <mesh position={[0, headY + 0.1, 0]}>
        <sphereGeometry args={[0.135, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2.2]} />
        <meshStandardMaterial color={capColor} />
      </mesh>
      {/* Cap bill */}
      <mesh
        position={[0.12, headY + 0.05, 0]}
        rotation={[0, 0, -Math.PI / 16]}
      >
        <boxGeometry args={[0.15, 0.025, 0.18]} />
        <meshStandardMaterial color={capColor} />
      </mesh>
      {/* Arms */}
      <mesh
        position={[armForward, torsoY, 0.27 + armOutward]}
        rotation={[0, 0, pose === "pitch" ? -Math.PI / 3 : 0]}
        castShadow
      >
        <cylinderGeometry args={[0.06, 0.06, 0.55, 10]} />
        <meshStandardMaterial color={bodyColor} />
      </mesh>
      <mesh
        position={[armForward, torsoY, -0.27 - armOutward]}
        rotation={[0, 0, pose === "pitch" ? Math.PI / 3 : 0]}
        castShadow
      >
        <cylinderGeometry args={[0.06, 0.06, 0.55, 10]} />
        <meshStandardMaterial color={bodyColor} />
      </mesh>
    </group>
  );
}

function Bat({ position, facing }: { position: [number, number, number]; facing: number }) {
  return (
    <group position={position} rotation={[0, facing, 0]}>
      <mesh
        position={[-0.05, 1.4, 0.1]}
        rotation={[Math.PI / 2.5, 0, Math.PI / 2.6]}
        castShadow
      >
        <cylinderGeometry args={[0.025, 0.05, 0.85, 12]} />
        <meshStandardMaterial color="#7c3a14" />
      </mesh>
    </group>
  );
}

function Mitt({ position, color = "#1e3a8a" }: { position: [number, number, number]; color?: string }) {
  return (
    <mesh position={position} castShadow>
      <sphereGeometry args={[0.13, 16, 12]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

function People() {
  // Catcher and umpire face the mound (face +X).
  // Pitcher faces the plate (face -X, π).
  // RHB stands on the catcher's left side (− Z), facing the pitcher (–Z then turned).
  return (
    <group>
      {/* Pitcher on the mound, facing home */}
      <Person
        position={[18.4, 0.05, 0]}
        facing={Math.PI}
        bodyColor="#fafafa"
        pantsColor="#cbd5e1"
        capColor="#dc2626"
        pose="pitch"
      />
      {/* Catcher behind home plate, crouched, facing pitcher */}
      <Person
        position={[-0.55, 0.05, 0]}
        facing={0}
        bodyColor="#0f172a"
        pantsColor="#1e293b"
        capColor="#1e293b"
        pose="crouch"
      />
      <Mitt position={[-0.0, 0.7, 0]} color="#1e3a8a" />
      {/* Home plate umpire — standing behind & slightly above the catcher */}
      <Person
        position={[-0.95, 0.05, 0]}
        facing={0}
        bodyColor="#0a0a0a"
        pantsColor="#0a0a0a"
        capColor="#0a0a0a"
        skin="#fcd9b6"
        pose="stand"
        scale={1.05}
      />
      {/* Right-handed batter in batter's box (catcher's right = −Z in our system) */}
      <Person
        position={[-0.15, 0.05, -0.55]}
        facing={Math.PI / 2}
        bodyColor="#dcfce7"
        pantsColor="#86efac"
        capColor="#15803d"
        pose="bat"
      />
      <Bat position={[-0.15, 0.05, -0.55]} facing={Math.PI / 2} />
      {/* Batter's boxes — chalk rectangles on dirt */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-0.15, 0.012, -0.55]}>
        <planeGeometry args={[1.2, 0.9]} />
        <meshStandardMaterial color="#a16207" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-0.15, 0.012, 0.55]}>
        <planeGeometry args={[1.2, 0.9]} />
        <meshStandardMaterial color="#a16207" />
      </mesh>
    </group>
  );
}

function PitchCurves({
  pitches,
  selected,
  onSelect,
  highlightAcnt,
}: {
  pitches: TrajectoryPitch[];
  selected: number | null;
  onSelect: (i: number) => void;
  highlightAcnt?: string | null;
}) {
  return (
    <group>
      {pitches.map((p, i) => {
        const pts = pitchCurve(p);
        if (!pts || pts.length < 2) return null;
        const color = PITCH_HEX[p.auto_pitch_type ?? ""] ?? "#9ca3af";
        const isOn = !highlightAcnt || p.pitcher_acnt === highlightAcnt;
        const isSel = selected === i;
        return (
          <group
            key={i}
            onClick={(e: ThreeEvent<MouseEvent>) => {
              e.stopPropagation();
              onSelect(i);
            }}
          >
            <Line
              points={pts}
              color={isSel ? "#facc15" : color}
              lineWidth={isSel ? 3.4 : isOn ? 1.6 : 0.7}
              transparent
              opacity={isSel ? 1 : isOn ? 0.7 : 0.12}
            />
            <mesh position={pts[pts.length - 1]}>
              <sphereGeometry args={[isSel ? 0.04 : 0.022, 16, 16]} />
              <meshStandardMaterial color={isSel ? "#facc15" : color} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function PlateDots({
  locations,
  onSelect,
}: {
  locations: PitchLocation[];
  onSelect: (l: PitchLocation) => void;
}) {
  return (
    <group>
      {locations.map((l, i) => {
        if (l.plate_loc_side == null || l.plate_loc_height == null) return null;
        return (
          <mesh
            key={i}
            position={[0, l.plate_loc_height, -l.plate_loc_side]}
            onClick={(e: ThreeEvent<MouseEvent>) => {
              e.stopPropagation();
              onSelect(l);
            }}
          >
            <sphereGeometry args={[0.028, 12, 12]} />
            <meshStandardMaterial
              color={PITCH_HEX[l.auto_pitch_type ?? ""] ?? "#9ca3af"}
              transparent
              opacity={0.9}
            />
          </mesh>
        );
      })}
    </group>
  );
}


/**
 * Use the official Baseball Savant ball texture (downloaded from
 * https://baseballsavant.mlb.com/sections/player-update/images/ball.jpg
 * and served from /public/textures/ball.jpg). The image is an unwrapped
 * 2:1 sphere map showing the figure-8 seam, Rawlings logo, and MLB seal.
 */
function Baseball({ radius }: { radius: number }) {
  const tex = useTexture("/textures/ball.jpg") as THREE.Texture;
  // Make sure the loaded texture is treated as sRGB so colours look right.
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return (
    <mesh castShadow>
      <sphereGeometry args={[radius, 64, 64]} />
      <meshStandardMaterial map={tex} roughness={0.55} metalness={0.05} />
    </mesh>
  );
}

function AnimatedBall({
  pitch,
  playing,
  speed,
}: {
  pitch: TrajectoryPitch;
  playing: boolean;
  speed: number;
}) {
  const ballRef = useRef<THREE.Group>(null);
  const axisRef = useRef<THREE.Group>(null);
  const tRef = useRef(0);
  const tEnd = plateTime(pitch);
  const axis = useMemo(() => spinAxis(pitch), [pitch]);
  const rpm = pitch.spin_rate ?? 2000;
  const omega = (rpm / 60) * 2 * Math.PI; // rad/s

  useEffect(() => {
    tRef.current = 0;
  }, [pitch, playing]);

  useFrame((_, dt) => {
    if (!ballRef.current) return;
    if (playing) {
      tRef.current += dt * speed;
      if (tRef.current > tEnd) tRef.current = tEnd;
    } else {
      tRef.current = 0.001;
    }
    const xyz = evalAt(pitch, tRef.current);
    if (xyz) ballRef.current.position.set(xyz[0], xyz[1], xyz[2]);
    // Spin around the inferred axis; slow factor so the seam is visible.
    ballRef.current.rotateOnAxis(axis, omega * dt * 0.03);
    if (axisRef.current && xyz) axisRef.current.position.set(xyz[0], xyz[1], xyz[2]);
  });

  const axisLine = useMemo(() => {
    const half = axis.clone().multiplyScalar(0.22);
    return [half.clone().negate().toArray(), half.toArray()] as [
      [number, number, number],
      [number, number, number],
    ];
  }, [axis]);

  return (
    <group>
      <group ref={ballRef}>
        {/* 2.2× real size for visibility; trajectory still uses real units. */}
        <Baseball radius={0.082} />
      </group>
      <group ref={axisRef}>
        <Line points={axisLine} color="#fde047" lineWidth={2.8} />
      </group>
    </group>
  );
}

// ─── Public component ────────────────────────────────────────────────

interface Props {
  pitches?: TrajectoryPitch[];
  locations?: PitchLocation[];
  height?: number;
  highlightAcnt?: string | null;
}

export function StrikeZone3D({
  pitches = [],
  locations = [],
  height = 540,
  highlightAcnt = null,
}: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const [selectedLoc, setSelectedLoc] = useState<PitchLocation | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(0.6);

  const pitch = selected != null ? pitches[selected] : null;

  const [contextLost, setContextLost] = useState(false);

  return (
    <div className="grid gap-3 md:grid-cols-[1fr_280px]">
      <div
        style={{ height }}
        className="w-full rounded-lg overflow-hidden border bg-slate-900 relative"
      >
        <Canvas
          camera={{ position: [-3.5, 2.4, 4.5], fov: 38 }}
          shadows="basic"
          dpr={[1, 1.5]}
          gl={{ antialias: true, powerPreference: "high-performance" }}
          onCreated={({ gl }) => {
            const canvas = gl.domElement;
            canvas.addEventListener("webglcontextlost", (e) => {
              e.preventDefault();
              setContextLost(true);
            });
            canvas.addEventListener("webglcontextrestored", () => {
              setContextLost(false);
            });
          }}
        >
          <ambientLight intensity={0.7} />
          <directionalLight position={[6, 10, 5]} intensity={0.9} castShadow />
          <Ground />
          <Mound />
          <HomePlate />
          <StrikeZoneBox />
          {pitches.length > 0 && (
            <PitchCurves
              pitches={pitches}
              selected={selected}
              onSelect={setSelected}
              highlightAcnt={highlightAcnt}
            />
          )}
          {locations.length > 0 && (
            <PlateDots locations={locations} onSelect={setSelectedLoc} />
          )}
          {/* Texture-suspending Baseball is wrapped so the rest of the scene
              renders even while the JPG is still loading. */}
          {pitch && (
            <React.Suspense fallback={null}>
              <AnimatedBall pitch={pitch} playing={playing} speed={speed} />
            </React.Suspense>
          )}
          <OrbitControls
            target={[1.2, 0.85, 0]}
            enablePan
            minDistance={1.5}
            maxDistance={35}
            maxPolarAngle={Math.PI / 2 - 0.02}
          />
        </Canvas>
        {contextLost && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/90 text-slate-100 text-sm">
            <div className="font-semibold">3D 場景中斷（WebGL context lost）</div>
            <div className="text-xs text-slate-300 max-w-md text-center px-4">
              瀏覽器釋放了 3D 算繪 context — 通常因為頁面開太多 3D 視圖或分頁切換。
            </div>
            <button
              onClick={() => location.reload()}
              className="px-3 py-1.5 rounded bg-amber-500 text-slate-900 font-semibold text-xs"
            >
              重新整理頁面
            </button>
          </div>
        )}
        {pitches.length > 0 && (
          <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2 rounded-md bg-slate-950/85 px-3 py-2 text-xs text-slate-200 backdrop-blur">
            <button
              onClick={() => setPlaying((p) => !p)}
              className="px-2 py-1 rounded bg-amber-500 text-slate-900 font-semibold disabled:opacity-50"
              disabled={selected == null}
            >
              {playing ? "❚❚ 暫停" : "▶ 播放"}
            </button>
            <span className="ml-1">速度</span>
            <input
              type="range"
              min={0.05}
              max={1.0}
              step={0.05}
              value={speed}
              onChange={(e) => setSpeed(parseFloat(e.target.value))}
              className="w-20"
            />
            <span className="ml-auto opacity-75">
              {selected == null
                ? "點擊任一條軌跡選擇球路"
                : `已選 #${selected + 1} / ${pitches.length}`}
            </span>
          </div>
        )}
      </div>
      <PitchDetailPanel pitch={pitch} loc={selectedLoc} />
    </div>
  );
}

function PitchDetailPanel({
  pitch,
  loc,
}: {
  pitch: TrajectoryPitch | null;
  loc: PitchLocation | null;
}) {
  if (!pitch && !loc) {
    return (
      <div className="rounded-lg border bg-card p-4 text-sm">
        <div className="font-semibold mb-2">球路詳情</div>
        <p className="text-muted-foreground">
          點擊 3D 場景內的軌跡或進壘點以顯示細節。
        </p>
        <ul className="list-disc pl-5 mt-3 text-xs text-muted-foreground space-y-1">
          <li>滑鼠拖曳：旋轉視角</li>
          <li>滾輪：縮放</li>
          <li>右鍵拖曳：平移</li>
          <li>選好球路後可按 ▶ 播放動畫</li>
          <li>黃色短線 = 推算的旋轉軸</li>
        </ul>
      </div>
    );
  }
  if (pitch) {
    return (
      <div className="rounded-lg border bg-card p-4 text-sm space-y-2">
        <div className="font-semibold flex items-center gap-2">
          <span
            className="inline-block w-3 h-3 rounded-full"
            style={{
              background: PITCH_HEX[pitch.auto_pitch_type ?? ""] ?? "#888",
            }}
          />
          {pitch.auto_pitch_type ?? "—"}
        </div>
        <Row label="投手" value={pitch.pitcher_name ?? "—"} />
        <Row label="打者" value={pitch.hitter_name ?? "—"} />
        <Row label="局數" value={`${pitch.inning ?? "—"}局 / ${pitch.out_cnt ?? "—"} 出局`} />
        <Row label="球數" value={`${pitch.ball_cnt}-${pitch.strike_cnt} (第 ${pitch.pitch_cnt} 球)`} />
        <Row
          label="球速"
          value={pitch.rel_speed_kph != null
            ? `${pitch.rel_speed_kph.toFixed(1)} kph`
            : "—"}
        />
        <Row
          label="轉速"
          value={pitch.spin_rate != null
            ? `${pitch.spin_rate.toFixed(0)} rpm`
            : "—"}
        />
        <Row label="判定" value={pitch.pitch_call ?? "—"} />
        <Row
          label="進壘點"
          value={
            pitch.plate_loc_side != null && pitch.plate_loc_height != null
              ? `(${pitch.plate_loc_side.toFixed(2)}, ${pitch.plate_loc_height.toFixed(2)}) m`
              : "—"
          }
        />
        <hr className="my-2" />
        <div className="text-xs uppercase text-muted-foreground tracking-wide">
          推算旋轉 / 球路位移
        </div>
        <Row label="旋轉軸 (時鐘)" value={spinTilt(pitch)} />
        {(() => {
          const b = pitchBreak(pitch);
          if (!b) return null;
          const cm = (m: number) => `${(m * 100).toFixed(1)} cm`;
          return (
            <>
              <Row
                label="水平位移"
                value={`${cm(b.horiz)} ${b.horiz > 0 ? "(向捕手右)" : b.horiz < 0 ? "(向捕手左)" : ""}`}
              />
              <Row
                label="垂直位移"
                value={`${cm(b.vert)} ${b.vert > 0 ? "(較重力高)" : "(較重力低)"}`}
              />
              <Row
                label="總位移"
                value={cm(Math.hypot(b.horiz, b.vert))}
              />
            </>
          );
        })()}
        <p className="text-[10px] text-muted-foreground mt-1">
          位移 = 實際進壘點 − 純重力拋體預測。旋轉軸由位移方向反推（馬格努斯效應垂直於軸）。
        </p>
      </div>
    );
  }
  if (loc) {
    return (
      <div className="rounded-lg border bg-card p-4 text-sm space-y-2">
        <div className="font-semibold flex items-center gap-2">
          <span
            className="inline-block w-3 h-3 rounded-full"
            style={{
              background: PITCH_HEX[loc.auto_pitch_type ?? ""] ?? "#888",
            }}
          />
          {loc.auto_pitch_type ?? "—"}
        </div>
        <Row label="判定" value={loc.pitch_call ?? "—"} />
        <Row
          label="球速"
          value={loc.rel_speed_kph != null
            ? `${loc.rel_speed_kph.toFixed(1)} kph`
            : "—"}
        />
        <Row
          label="進壘點"
          value={`(${loc.plate_loc_side.toFixed(2)}, ${loc.plate_loc_height.toFixed(2)}) m`}
        />
      </div>
    );
  }
  return null;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
