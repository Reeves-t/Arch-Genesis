import React from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

interface CypherModel3DProps {
  modelUrl: string;
  side: 'player' | 'opponent';
  width?: number;
  height?: number;
}

function buildHtml(modelUrl: string, side: 'player' | 'opponent'): string {
  const safeUrl = JSON.stringify(modelUrl);
  // Opponent faces left via rotation.y = Math.PI
  const initialRotationY = side === 'opponent' ? Math.PI : 0;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: transparent; overflow: hidden; width: 100vw; height: 100vh; }
    canvas { display: block; width: 100% !important; height: 100% !important; }
  </style>
</head>
<body>
  <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js"></script>
  <script>
    var MODEL_URL = ${safeUrl};
    var INITIAL_ROT_Y = ${initialRotationY};

    var scene = new THREE.Scene();

    var camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 1.2, 2.5);
    camera.lookAt(0, 0.3, 0);

    var renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio * 1.5);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);
    renderer.outputEncoding = THREE.sRGBEncoding;
    document.body.appendChild(renderer.domElement);

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    var key = new THREE.DirectionalLight(0xffffff, 1.0);
    key.position.set(1, 2, 2);
    scene.add(key);
    var fill = new THREE.DirectionalLight(0xffffff, 0.5);
    fill.position.set(0, 2, 3);
    scene.add(fill);
    var rim = new THREE.DirectionalLight(0x4488ff, 0.35);
    rim.position.set(-1, 1, -1);
    scene.add(rim);

    var modelRef = null;
    var baseScale = 1;
    var mixer = null;
    var clock = new THREE.Clock();

    var loader = new THREE.GLTFLoader();
    loader.load(
      MODEL_URL,
      function(gltf) {
        var model = gltf.scene;
        modelRef = model;

        // Normalize size
        var box = new THREE.Box3().setFromObject(model);
        var size = box.getSize(new THREE.Vector3());
        var maxDim = Math.max(size.x, size.y, size.z);
        baseScale = 1.7 / maxDim;
        model.scale.setScalar(baseScale);

        // Center model
        var center = box.getCenter(new THREE.Vector3());
        model.position.sub(center.multiplyScalar(baseScale));
        model.position.y += size.y * baseScale * 0.08;

        // Apply facing direction
        model.rotation.y = INITIAL_ROT_Y;

        scene.add(model);

        if (gltf.animations && gltf.animations.length > 0) {
          mixer = new THREE.AnimationMixer(model);
          mixer.clipAction(gltf.animations[0]).play();
        }
      },
      undefined,
      function(err) { console.error('GLB load error:', err); }
    );

    function animate() {
      requestAnimationFrame(animate);
      var delta = clock.getDelta();
      if (mixer) mixer.update(delta);
      // Subtle idle breathing
      if (modelRef) {
        var breathe = 1 + Math.sin(Date.now() * 0.002) * 0.018;
        modelRef.scale.setScalar(baseScale * breathe);
      }
      renderer.render(scene, camera);
    }
    animate();

    window.addEventListener('resize', function() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
  </script>
</body>
</html>`;
}

export default function CypherModel3D({
  modelUrl,
  side,
  width = 72,
  height = 90,
}: CypherModel3DProps) {
  return (
    <View style={{ width, height, overflow: 'hidden' }}>
      <WebView
        source={{ html: buildHtml(modelUrl, side) }}
        style={{ width, height, backgroundColor: 'transparent' }}
        scrollEnabled={false}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="always"
        backgroundColor="transparent"
      />
    </View>
  );
}
