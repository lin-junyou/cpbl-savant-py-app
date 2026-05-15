"use client";

/**
 * 3D stadium scene with batted-ball trajectories rendered as parabolic arcs.
 *
 * Each ball has a known launch direction (bearing), distance and hang time,
 * which determines the apex height. We render the ball's parabolic flight
 * from home plate to its landing position.
 */
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Line } from "@react-three/drei";
import * as THREE from "three";
import { useMemo, useRef } from "react";
import type { SprayPoint } from "@/lib/api";

interface Props {
  data: SprayPoint[];
  fenceL?: number;
  fenceC?: number;
  fenceR?: number;
  height?: number;
  /** If true, only render the longest ~50 hits to keep the scene snappy. */
  topOnly?: boolean;
}

const OUTCOME_COLOR = (content: string | null | undefined): string => {
  if (!content) return "#888";
  if (content.includes("全壘打")) return "#dc2626";
  if (content.includes("三壘安打")) return "#9333ea";
  if (content.includes("二壘安打")) return "#2563eb";
  if (content.includes("安打")) return "#16a34a";
  return "#94a3b8";
};

function parabolaPoints(
  bearingDeg: number,
  distance: number,
  hangTime: number,
  segments = 30,
): THREE.Vector3[] {
  // Convert bearing/distance to landing (x, z); home is at origin.
  const a = (bearingDeg * Math.PI) / 180;
  const x = distance * Math.sin(a);
  const z = -distance * Math.cos(a);
  // Apex height proportional to hang time²·g/8 — simplified
  const g = 9.8;
  const apex = (g * hangTime * hangTime) / 8 || (distance / 6);
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const px = x * t;
    const pz = z * t;
    const py = 4 * apex * t * (1 - t) + 1.0; // parabola, +1m so it leaves the bat above ground
    pts.push(new THREE.Vector3(px, py, pz));
  }
  return pts;
}

function FenceCurve({ L, C, R }: { L: number; C: number; R: number }) {
  const pts = useMemo(() => {
    const out: [number, number, number][] = [];
    for (let deg = -45; deg <= 45; deg += 2) {
      const a = (deg * Math.PI) / 180;
      const r = deg < 0
        ? L + ((C - L) * (deg + 45)) / 45
        : C + ((R - C) * deg) / 45;
      out.push([r * Math.sin(a), 0.05, -r * Math.cos(a)]);
    }
    return out;
  }, [L, C, R]);
  // Wall mesh: ribbon of triangles
  const positions = useMemo(() => {
    const wallH = 3;
    const arr: number[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, , z1] = pts[i];
      const [x2, , z2] = pts[i + 1];
      arr.push(x1, 0, z1, x2, 0, z2, x2, wallH, z2);
      arr.push(x1, 0, z1, x2, wallH, z2, x1, wallH, z1);
    }
    return new Float32Array(arr);
  }, [pts]);
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.computeVertexNormals();
    return g;
  }, [positions]);
  return (
    <group>
      <mesh geometry={geom}>
        <meshStandardMaterial color="#1e3a8a" side={THREE.DoubleSide} />
      </mesh>
      <Line points={pts.map(([x, , z]) => [x, 3, z]) as [number, number, number][]}
        color="#fbbf24" lineWidth={2} />
    </group>
  );
}

function Field({ L, C, R }: { L: number; C: number; R: number }) {
  // Outfield grass fan
  const geom = useMemo(() => {
    const seg = 60;
    const positions: number[] = [];
    for (let i = 0; i < seg; i++) {
      const a0 = ((-45 + (90 * i) / seg) * Math.PI) / 180;
      const a1 = ((-45 + (90 * (i + 1)) / seg) * Math.PI) / 180;
      const r0 = (function (d: number) {
        return d < 0 ? L + ((C - L) * (d + 45)) / 45 : C + ((R - C) * d) / 45;
      })(-45 + (90 * i) / seg);
      const r1 = (function (d: number) {
        return d < 0 ? L + ((C - L) * (d + 45)) / 45 : C + ((R - C) * d) / 45;
      })(-45 + (90 * (i + 1)) / seg);
      positions.push(0, 0, 0);
      positions.push(r0 * Math.sin(a0), 0, -r0 * Math.cos(a0));
      positions.push(r1 * Math.sin(a1), 0, -r1 * Math.cos(a1));
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    g.computeVertexNormals();
    return g;
  }, [L, C, R]);
  return (
    <group>
      <mesh geometry={geom} receiveShadow>
        <meshStandardMaterial color="#15803d" roughness={1} />
      </mesh>
      {/* Infield dirt arc */}
      <mesh position={[0, 0.005, 0]}>
        <ringGeometry args={[0, 29, 32, 1, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#9c6f3d" />
      </mesh>
      {/* Home plate */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[0.43, 0.43]} />
        <meshStandardMaterial color="#fff" />
      </mesh>
    </group>
  );
}

function FlyingBall({ pts }: { pts: THREE.Vector3[] }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current || pts.length < 2) return;
    const t = (clock.elapsedTime % 6) / 6; // 6 seconds per ball
    const i = Math.floor(t * (pts.length - 1));
    const f = t * (pts.length - 1) - i;
    const a = pts[i];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    ref.current.position.lerpVectors(a, b, f);
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.4, 16, 16]} />
      <meshStandardMaterial color="#fff" />
    </mesh>
  );
}

export function Stadium3D({
  data,
  fenceL = 99,
  fenceC = 122,
  fenceR = 99,
  height = 480,
  topOnly = false,
}: Props) {
  const filtered = useMemo(() => {
    let arr = data.filter(
      (d) =>
        d.land_distance_m != null &&
        d.land_bearing != null &&
        d.land_hang_time != null,
    );
    if (topOnly) {
      arr = arr
        .sort((a, b) => (b.land_distance_m ?? 0) - (a.land_distance_m ?? 0))
        .slice(0, 50);
    }
    return arr;
  }, [data, topOnly]);

  const arcs = useMemo(
    () =>
      filtered.map((d) => ({
        pts: parabolaPoints(
          d.land_bearing!,
          d.land_distance_m!,
          d.land_hang_time ?? 2.0,
        ),
        color: OUTCOME_COLOR(d.content),
      })),
    [filtered],
  );

  return (
    <div
      style={{ height }}
      className="w-full rounded-lg overflow-hidden border bg-slate-900"
    >
      <Canvas camera={{ position: [50, 60, 90], fov: 40 }} shadows>
        <ambientLight intensity={0.65} />
        <directionalLight position={[50, 80, 30]} intensity={0.9} castShadow />
        <Field L={fenceL} C={fenceC} R={fenceR} />
        <FenceCurve L={fenceL} C={fenceC} R={fenceR} />
        {arcs.map((a, i) => (
          <Line key={i} points={a.pts} color={a.color} lineWidth={1.4} transparent opacity={0.55} />
        ))}
        {arcs.length > 0 && <FlyingBall pts={arcs[0].pts} />}
        <OrbitControls
          target={[0, 5, -50]}
          maxPolarAngle={Math.PI / 2 - 0.05}
          minDistance={20} maxDistance={250}
        />
      </Canvas>
    </div>
  );
}
