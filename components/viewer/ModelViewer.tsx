import React from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

interface ModelViewerProps {
  modelUrl: string;
  height?: number;
  autoRotate?: boolean;
}

function buildHtml(modelUrl: string, autoRotate: boolean): string {
  // JSON.stringify safely escapes the URL for injection into JS
  const safeUrl = JSON.stringify(modelUrl);
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #000814; overflow: hidden; width: 100vw; height: 100vh; }
    canvas { display: block; width: 100% !important; height: 100% !important; }
    #loading {
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      color: #3b82f6; font-family: -apple-system, sans-serif; font-size: 13px;
      text-align: center; pointer-events: none;
    }
    #error {
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      color: #ef4444; font-family: -apple-system, sans-serif; font-size: 12px;
      text-align: center; display: none; padding: 16px;
    }
  </style>
</head>
<body>
  <div id="loading">Loading 3D model...</div>
  <div id="error">Failed to load model</div>

  <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js"></script>

  <script>
    var MODEL_URL = ${safeUrl};
    var AUTO_ROTATE = ${autoRotate ? 'true' : 'false'};

    // ── Scene ──────────────────────────────────────────────────
    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000814);

    var camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.01, 1000);
    camera.position.set(0, 0.5, 3);

    var renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    document.body.appendChild(renderer.domElement);

    // ── Lighting ───────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));

    var key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(2, 4, 3);
    scene.add(key);

    var fill = new THREE.DirectionalLight(0x4488ff, 0.5);
    fill.position.set(-3, 1, -2);
    scene.add(fill);

    var rim = new THREE.DirectionalLight(0x0033ff, 0.3);
    rim.position.set(0, -2, -4);
    scene.add(rim);

    // ── Controls ───────────────────────────────────────────────
    var controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.autoRotate = AUTO_ROTATE;
    controls.autoRotateSpeed = 1.2;
    controls.minDistance = 0.5;
    controls.maxDistance = 10;
    controls.minPolarAngle = Math.PI * 0.1;
    controls.maxPolarAngle = Math.PI * 0.85;
    controls.target.set(0, 0, 0);

    // ── Load GLB ───────────────────────────────────────────────
    var loader = new THREE.GLTFLoader();
    loader.load(
      MODEL_URL,
      function(gltf) {
        document.getElementById('loading').style.display = 'none';

        var model = gltf.scene;

        // Center and fit model to view
        var box = new THREE.Box3().setFromObject(model);
        var center = box.getCenter(new THREE.Vector3());
        var size = box.getSize(new THREE.Vector3());
        var maxDim = Math.max(size.x, size.y, size.z);
        var scale = 2.2 / maxDim;

        model.scale.setScalar(scale);
        model.position.sub(center.multiplyScalar(scale));
        // Shift up slightly so character isn't cut at bottom
        model.position.y += size.y * scale * 0.1;

        scene.add(model);
        controls.update();
      },
      function(progress) {
        if (progress.total > 0) {
          var pct = Math.round((progress.loaded / progress.total) * 100);
          var el = document.getElementById('loading');
          if (el) el.textContent = 'Loading... ' + pct + '%';
        }
      },
      function(err) {
        console.error('GLB load error:', err);
        document.getElementById('loading').style.display = 'none';
        document.getElementById('error').style.display = 'block';
        document.getElementById('error').textContent = 'Failed to load 3D model';
      }
    );

    // ── Render loop ────────────────────────────────────────────
    function animate() {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    // ── Resize ─────────────────────────────────────────────────
    window.addEventListener('resize', function() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
  </script>
</body>
</html>`;
}

export const ModelViewer: React.FC<ModelViewerProps> = ({
  modelUrl,
  height = 340,
  autoRotate = true,
}) => {
  return (
    <View style={[styles.container, { height }]}>
      <WebView
        source={{ html: buildHtml(modelUrl, autoRotate) }}
        style={styles.webview}
        scrollEnabled={false}
        originWhitelist={['*']}
        allowsInlineMediaPlayback
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="always"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000814',
    borderWidth: 1,
    borderColor: '#003566',
  },
  webview: {
    flex: 1,
    backgroundColor: '#000814',
  },
});
