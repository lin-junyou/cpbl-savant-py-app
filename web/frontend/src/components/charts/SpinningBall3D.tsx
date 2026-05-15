"use client";

/**
 * Tiny Three.js sphere that spins around an arbitrary in-plane axis.
 *
 * Used inside each Spin Direction clock card so the visualisation shows a
 * REAL 3D baseball (with the MLB Savant texture wrapped on a sphere)
 * rotating around the inferred spin axis.
 *
 * Statcast convention: ``axisDeg`` is the spin TILT (the direction of the
 * magnus force projected onto the catcher's view, where 12:00 = pure
 * backspin). The actual rotation axis is perpendicular to the tilt — so
 * for a 12:00-tilt fastball the ball rotates about a HORIZONTAL axis with
 * the top of the ball moving away from the viewer (true backspin).
 *
 *   axisDeg =   0  (12:00 tilt, backspin)  →  axis = +X (horizontal right)
 *   axisDeg =  90  (3:00 tilt, glove run)  →  axis = -Y (vertical down)
 *   axisDeg = 180  (6:00 tilt, topspin)    →  axis = -X (horizontal left)
 *   axisDeg = 270  (9:00 tilt, arm run)    →  axis = +Y
 */
import { Canvas, useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { useEffect, useMemo, useRef } from "react";

function Ball({ axisDeg, rpm }: { axisDeg: number; rpm: number }) {
  const tex = useTexture("/textures/ball.jpg") as THREE.Texture;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;

  const ref = useRef<THREE.Mesh>(null);
  // Spin axis is *perpendicular* to the tilt direction:
  //   axis = rotate( (sin θ, cos θ), +90° ) = (cos θ, -sin θ)
  const axis = useMemo(() => {
    const rad = (axisDeg * Math.PI) / 180;
    return new THREE.Vector3(Math.cos(rad), -Math.sin(rad), 0).normalize();
  }, [axisDeg]);
  // Slow real RPM by 120× so a 2400 rpm ball spins ~one rev / 3 sec.
  const omega = useMemo(() => (rpm / 60) * 2 * Math.PI / 120, [rpm]);

  // Three.js SphereGeometry UV mapping (verified from source):
  //
  //   U=0.00 ↔ −X     U=0.25 ↔ +Z (front, faces camera)
  //   U=0.50 ↔ +X     U=0.75 ↔ −Z (back)
  //   U=1.00 ↔ −X (texture wrap edge)
  //
  // The Savant texture has its figure-8 seam crossings at U≈0.25 and
  // U≈0.75, with the MLB seal at U=0.5 (now mapped to +X — only the
  // edge is visible to a +Z camera). The Rawlings logo is on the +Y
  // pole. So the *default* orientation already shows a real seam
  // crossing centred in the camera. We only need a small Z-axis tilt
  // for a more dynamic 3-quarter view.

  useFrame((_, dt) => {
    if (!ref.current) return;
    ref.current.rotateOnAxis(axis, omega * dt);
  });

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[1, 48, 48]} />
      <meshStandardMaterial map={tex} roughness={0.55} metalness={0.05} />
    </mesh>
  );
}

interface Props {
  axisDeg: number;
  rpm: number;
  size?: number;
}

export function SpinningBall3D({ axisDeg, rpm, size = 56 }: Props) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
        background: "transparent",
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 2.6], fov: 38 }}
        gl={{ alpha: true, antialias: true }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.85} />
        <directionalLight position={[3, 4, 5]} intensity={0.9} />
        <Ball axisDeg={axisDeg} rpm={rpm} />
      </Canvas>
    </div>
  );
}
