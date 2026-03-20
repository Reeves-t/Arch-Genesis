import React, { useEffect, useRef, useCallback } from 'react';
import { GLView } from 'expo-gl';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

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
  const animFrameRef = useRef<number>(0);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const modelRef = useRef<THREE.Group | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const clockRef = useRef(new THREE.Clock());
  const baseScaleRef = useRef<number>(1);

  const onContextCreate = useCallback(async (gl: any) => {
    console.log('CYPHER3D: GL context for', side);

    // ── Canvas shim — bridges expo-gl with Three.js WebGLRenderer ────────────
    const canvasShim = {
      width: gl.drawingBufferWidth,
      height: gl.drawingBufferHeight,
      style: {},
      addEventListener: () => {},
      removeEventListener: () => {},
      clientWidth: gl.drawingBufferWidth,
      clientHeight: gl.drawingBufferHeight,
      getContext: () => gl,
    } as unknown as HTMLCanvasElement;

    const renderer = new THREE.WebGLRenderer({
      canvas: canvasShim,
      context: gl,
      antialias: false, // keep light for mobile
    });
    renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight, false);
    renderer.setPixelRatio(1);
    renderer.outputEncoding = (THREE as any).sRGBEncoding ?? 3001;
    renderer.autoClear = true;
    renderer.setClearColor(0x000000, 0);
    rendererRef.current = renderer;

    // ── Scene ─────────────────────────────────────────────────────────────────
    const scene = new THREE.Scene();

    // ── Camera ────────────────────────────────────────────────────────────────
    const aspect = gl.drawingBufferWidth / gl.drawingBufferHeight;
    const camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 100);
    camera.position.set(0, 0.8, 3);
    camera.lookAt(0, 0.4, 0);

    // ── Lighting ──────────────────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const key = new THREE.DirectionalLight(0xffffff, 0.9);
    key.position.set(1, 2, 2);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x4488ff, 0.3);
    rim.position.set(-1, 1, -1);
    scene.add(rim);

    // ── Load GLB ──────────────────────────────────────────────────────────────
    try {
      const loader = new GLTFLoader();
      const gltf = await new Promise<any>((resolve, reject) => {
        loader.load(modelUrl, resolve, undefined, reject);
      });

      const model = gltf.scene;
      modelRef.current = model;

      // Normalize to consistent display size
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 1.6 / maxDim;
      baseScaleRef.current = scale;
      model.scale.setScalar(scale);

      // Center model
      const center = box.getCenter(new THREE.Vector3());
      model.position.sub(center.multiplyScalar(scale));
      model.position.y += size.y * scale * 0.08;

      // Opponent faces left — handled in 3D scene (no scaleX: -1 on container)
      if (side === 'opponent') {
        model.rotation.y = Math.PI;
      }

      scene.add(model);

      // Embedded animations
      if (gltf.animations?.length > 0) {
        const mixer = new THREE.AnimationMixer(model);
        mixerRef.current = mixer;
        mixer.clipAction(gltf.animations[0]).play();
      }

      console.log('CYPHER3D: Loaded for', side);
    } catch (err) {
      console.error('CYPHER3D: GLB load failed for', side, err);
    }

    // ── Render loop ───────────────────────────────────────────────────────────
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);

      const delta = clockRef.current.getDelta();
      if (mixerRef.current) mixerRef.current.update(delta);

      // Breathing idle pulse
      if (modelRef.current) {
        const breathe = 1 + Math.sin(Date.now() * 0.002) * 0.018;
        modelRef.current.scale.setScalar(baseScaleRef.current * breathe);
      }

      renderer.render(scene, camera);
      gl.endFrameEXP(); // required by expo-gl
    };

    animate();
  }, [modelUrl, side]);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      rendererRef.current?.dispose();
    };
  }, []);

  return (
    <GLView
      style={{ width, height }}
      onContextCreate={onContextCreate}
    />
  );
}
