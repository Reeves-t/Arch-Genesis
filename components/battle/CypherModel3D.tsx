import React, { useEffect, useRef, useCallback } from 'react';
import { GLView } from 'expo-gl';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { Renderer } from 'expo-three';

interface CypherModel3DProps {
  modelUrl: string;
  side: 'player' | 'opponent';
  width?: number;
  height?: number;
}

export default function CypherModel3D({
  modelUrl,
  side,
  width = 52,
  height = 64,
}: CypherModel3DProps) {
  const animationFrameRef = useRef<number>(0);
  const rendererRef = useRef<Renderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const modelRef = useRef<THREE.Group | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const clockRef = useRef(new THREE.Clock());
  const baseScaleRef = useRef<number>(1);
  const glRef = useRef<any>(null);

  const onContextCreate = useCallback(async (gl: any) => {
    glRef.current = gl;
    console.log('CYPHER3D: GL context created for', side, '— loading:', modelUrl.slice(0, 60));

    // ── Renderer ──────────────────────────────────────────────
    const renderer = new Renderer({ gl });
    renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
    renderer.setClearColor(0x000000, 0); // transparent
    rendererRef.current = renderer;

    // ── Scene ─────────────────────────────────────────────────
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // ── Camera ────────────────────────────────────────────────
    const aspect = gl.drawingBufferWidth / gl.drawingBufferHeight;
    const camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 100);
    camera.position.set(0, 0.8, 3);
    camera.lookAt(0, 0.4, 0);
    cameraRef.current = camera;

    // ── Lighting ──────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));

    const key = new THREE.DirectionalLight(0xffffff, 0.9);
    key.position.set(1, 2, 2);
    scene.add(key);

    const rim = new THREE.DirectionalLight(0x4488ff, 0.3);
    rim.position.set(-1, 1, -1);
    scene.add(rim);

    // ── Load GLB ─────────────────────────────────────────────
    try {
      const loader = new GLTFLoader();
      const gltf = await new Promise<any>((resolve, reject) => {
        loader.load(modelUrl, resolve, undefined, reject);
      });

      const model = gltf.scene;
      modelRef.current = model;

      // Normalize size
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 1.6 / maxDim;
      baseScaleRef.current = scale;
      model.scale.setScalar(scale);

      // Center
      const center = box.getCenter(new THREE.Vector3());
      model.position.sub(center.multiplyScalar(scale));
      model.position.y += size.y * scale * 0.08;

      // Opponent faces left (player faces right by default)
      if (side === 'opponent') {
        model.rotation.y = Math.PI;
      }

      scene.add(model);

      // Animations (if any embedded in GLB)
      if (gltf.animations?.length > 0) {
        const mixer = new THREE.AnimationMixer(model);
        mixerRef.current = mixer;
        mixer.clipAction(gltf.animations[0]).play();
      }

      console.log('CYPHER3D: Model loaded for', side);
    } catch (err) {
      console.error('CYPHER3D: Failed to load GLB for', side, err);
    }

    // ── Render loop ───────────────────────────────────────────
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);

      const delta = clockRef.current.getDelta();
      if (mixerRef.current) mixerRef.current.update(delta);

      // Idle breathing pulse
      if (modelRef.current) {
        const breathe = 1 + Math.sin(Date.now() * 0.002) * 0.018;
        modelRef.current.scale.setScalar(baseScaleRef.current * breathe);
      }

      renderer.render(scene, camera);
      gl.endFrameEXP();
    };

    animate();
  }, [modelUrl, side]);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(animationFrameRef.current);
      rendererRef.current?.dispose?.();
    };
  }, []);

  return (
    <GLView
      style={{ width, height }}
      onContextCreate={onContextCreate}
    />
  );
}
