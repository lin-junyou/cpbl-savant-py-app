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
import { useMemo, useRef, useState } from "react";
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
  // Outfield grass fan — triangle strip from home plate out to the fence,
  // sweeping the −X..+X foul-line wedge (deg = −45 .. +45 from straight CF).
  const grassGeom = useMemo(() => {
    const seg = 60;
    const positions: number[] = [];
    for (let i = 0; i < seg; i++) {
      const d0 = -45 + (90 * i) / seg;
      const d1 = -45 + (90 * (i + 1)) / seg;
      const a0 = (d0 * Math.PI) / 180;
      const a1 = (d1 * Math.PI) / 180;
      const r0 = d0 < 0 ? L + ((C - L) * (d0 + 45)) / 45 : C + ((R - C) * d0) / 45;
      const r1 = d1 < 0 ? L + ((C - L) * (d1 + 45)) / 45 : C + ((R - C) * d1) / 45;
      positions.push(0, 0, 0);
      positions.push(r0 * Math.sin(a0), 0, -r0 * Math.cos(a0));
      positions.push(r1 * Math.sin(a1), 0, -r1 * Math.cos(a1));
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    g.computeVertexNormals();
    return g;
  }, [L, C, R]);

  // Skinned infield dirt — a smooth wedge in the SAME orientation as the
  // grass fan (90° spread, but only ~27m deep so it sits inside the diamond).
  const dirtGeom = useMemo(() => {
    const dirtRadius = 27;
    const seg = 30;
    const positions: number[] = [];
    for (let i = 0; i < seg; i++) {
      const d0 = -45 + (90 * i) / seg;
      const d1 = -45 + (90 * (i + 1)) / seg;
      const a0 = (d0 * Math.PI) / 180;
      const a1 = (d1 * Math.PI) / 180;
      positions.push(0, 0, 0);
      positions.push(dirtRadius * Math.sin(a0), 0, -dirtRadius * Math.cos(a0));
      positions.push(dirtRadius * Math.sin(a1), 0, -dirtRadius * Math.cos(a1));
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    g.computeVertexNormals();
    return g;
  }, []);

  // Base-path diamond outline (home → 1B → 2B → 3B → home)
  const bases = useMemo(() => {
    const s = 27.43 / Math.SQRT2; // 27.43m base distance projected
    return [
      [0, 0.06, 0],          // home
      [s, 0.06, -s],         // 1B (right of home from catcher view)
      [0, 0.06, -2 * s],     // 2B
      [-s, 0.06, -s],        // 3B
      [0, 0.06, 0],          // back to home
    ] as [number, number, number][];
  }, []);

  return (
    <group>
      {/* Outfield grass */}
      <mesh geometry={grassGeom} receiveShadow>
        <meshStandardMaterial color="#1f8a3a" roughness={1} />
      </mesh>
      {/* Slight grass overlay outside diamond to suggest "skin" boundary */}
      <mesh geometry={dirtGeom} position={[0, 0.02, 0]} receiveShadow>
        <meshStandardMaterial color="#b27a48" roughness={1} />
      </mesh>
      {/* Inner grass diamond — replaces the centre of the dirt fan */}
      <mesh
        rotation={[-Math.PI / 2, 0, Math.PI / 4]}
        position={[0, 0.03, -19.4]}
      >
        <planeGeometry args={[19.4, 19.4]} />
        <meshStandardMaterial color="#1f8a3a" roughness={1} />
      </mesh>
      {/* Base-path white lines */}
      {bases.slice(0, -1).map(([x, y, z], i) => {
        const [x2, , z2] = bases[i + 1];
        const pts: [number, number, number][] = [[x, y, z], [x2, y, z2]];
        return (
          <Line key={i} points={pts} color="#fafaf9" lineWidth={2.2} />
        );
      })}
      {/* Foul lines */}
      <Line points={[[0, 0.05, 0], [L * Math.sin(-Math.PI / 4), 0.05, -L * Math.cos(-Math.PI / 4)]] as [number, number, number][]}
        color="#fafaf9" lineWidth={2} />
      <Line points={[[0, 0.05, 0], [R * Math.sin(Math.PI / 4), 0.05, -R * Math.cos(Math.PI / 4)]] as [number, number, number][]}
        color="#fafaf9" lineWidth={2} />
      {/* Pitcher's mound */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, -18.4]}>
        <circleGeometry args={[2.7, 24]} />
        <meshStandardMaterial color="#b27a48" />
      </mesh>
      {/* Home plate */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <planeGeometry args={[0.43, 0.43]} />
        <meshStandardMaterial color="#fafaf9" />
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
    // Only land_distance + land_bearing are strictly required to draw an arc.
    // land_hang_time is missing for a lot of CPBL rows; estimate it from EV+LA
    // (or fall back to 2.0s) so the canvas isn't blank.
    let arr = data.filter(
      (d) => d.land_distance_m != null && d.land_bearing != null,
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

  const [contextLost, setContextLost] = useState(false);

  return (
    <div
      style={{ height }}
      className="w-full rounded-lg overflow-hidden border bg-slate-900 relative"
    >
      <Canvas
        camera={{ position: [0, 75, 95], fov: 45 }}
        shadows="basic"
        dpr={[1, 1.5]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          const canvas = gl.domElement;
          canvas.addEventListener("webglcontextlost", (e) => {
            e.preventDefault();
            setContextLost(true);
          });
          canvas.addEventListener("webglcontextrestored", () => setContextLost(false));
        }}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[40, 110, 40]} intensity={1.0} castShadow />
        <Field L={fenceL} C={fenceC} R={fenceR} />
        <FenceCurve L={fenceL} C={fenceC} R={fenceR} />
        {arcs.map((a, i) => (
          <Line key={i} points={a.pts} color={a.color} lineWidth={1.4} transparent opacity={0.6} />
        ))}
        {arcs.length > 0 && <FlyingBall pts={arcs[0].pts} />}
        <OrbitControls
          target={[0, 0, -60]}
          maxPolarAngle={Math.PI / 2 - 0.05}
          minDistance={30} maxDistance={300}
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
    </div>
  );
}
