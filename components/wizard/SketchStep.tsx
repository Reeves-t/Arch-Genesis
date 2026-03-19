import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  Modal,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  StatusBar,
  SafeAreaView,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useGameStore } from '../../store/useGameStore';
import { generateCypherImages } from '../../lib/falClient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── HTML5 Canvas sketch tool injected into WebView ─────────────────────────
const CANVAS_HTML = `
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 100%; height: 100%; overflow: hidden; background: #111827; touch-action: none; }
  canvas { display: block; touch-action: none; }
</style>
</head>
<body>
<canvas id="c"></canvas>
<script>
  var canvas = document.getElementById('c');
  var ctx = canvas.getContext('2d');
  var paths = [];
  var currentPath = null;
  var tool = 'pen';
  var strokeColor = '#00d4ff';
  var strokeSize = 6;
  var isDrawing = false;
  var bgColor = '#111827';

  function setup() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    fill();
  }

  function fill() {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function redraw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    fill();
    for (var i = 0; i < paths.length; i++) { drawPath(paths[i]); }
    if (currentPath) drawPath(currentPath);
  }

  function drawPath(p) {
    if (!p || !p.points || p.points.length < 1) return;
    ctx.save();
    ctx.strokeStyle = p.tool === 'eraser' ? bgColor : p.color;
    ctx.lineWidth = p.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(p.points[0].x, p.points[0].y);
    for (var i = 1; i < p.points.length; i++) {
      ctx.lineTo(p.points[i].x, p.points[i].y);
    }
    ctx.stroke();
    ctx.restore();
  }

  function getPos(e) {
    var rect = canvas.getBoundingClientRect();
    var sx = canvas.width / rect.width;
    var sy = canvas.height / rect.height;
    var t = e.touches ? e.touches[0] : e;
    return { x: (t.clientX - rect.left) * sx, y: (t.clientY - rect.top) * sy };
  }

  canvas.addEventListener('touchstart', function(e) {
    e.preventDefault();
    isDrawing = true;
    var pos = getPos(e);
    currentPath = { color: strokeColor, size: strokeSize, tool: tool, points: [pos] };
  }, { passive: false });

  canvas.addEventListener('touchmove', function(e) {
    e.preventDefault();
    if (!isDrawing || !currentPath) return;
    currentPath.points.push(getPos(e));
    redraw();
  }, { passive: false });

  canvas.addEventListener('touchend', function(e) {
    e.preventDefault();
    if (currentPath) paths.push(currentPath);
    currentPath = null;
    isDrawing = false;
  }, { passive: false });

  function handleMessage(msg) {
    if (msg.indexOf('tool:') === 0) { tool = msg.substring(5); }
    else if (msg.indexOf('color:') === 0) { strokeColor = msg.substring(6); }
    else if (msg.indexOf('size:') === 0) { strokeSize = parseInt(msg.substring(5)); }
    else if (msg === 'undo') { paths.pop(); redraw(); }
    else if (msg === 'clear') { paths = []; currentPath = null; redraw(); }
    else if (msg === 'export') {
      var b64 = canvas.toDataURL('image/jpeg', 0.75).split(',')[1];
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'exported', data: b64 }));
    }
  }

  document.addEventListener('message', function(e) { handleMessage(e.data); });
  window.addEventListener('message', function(e) { handleMessage(e.data); });

  setup();
</script>
</body>
</html>
`;

// ─── Color presets ───────────────────────────────────────────────────────────
const COLORS = ['#00d4ff', '#ff4444', '#44ff88', '#ffcc00', '#ffffff', '#cc44ff'];

// ─── Component ───────────────────────────────────────────────────────────────
export const SketchStep: React.FC = () => {
  const { genesisWizard, updateWizardStep } = useGameStore();
  const webViewRef = useRef<WebView>(null);

  const [sketchBase64, setSketchBase64] = useState<string | null>(
    genesisWizard.sketchData ?? null
  );
  const [visualDescription, setVisualDescription] = useState(
    genesisWizard.visualDescription ?? ''
  );
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(
    genesisWizard.selectedImageUrl ?? null
  );

  const [drawingOpen, setDrawingOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [generationMeta, setGenerationMeta] = useState<{ prompt: string; seed: number } | null>(null);
  const [selectingOpen, setSelectingOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const [activeTool, setActiveTool] = useState<'pen' | 'eraser'>('pen');
  const [activeColor, setActiveColor] = useState('#00d4ff');
  const [activeSize, setActiveSize] = useState<'S' | 'M' | 'L'>('M');
  const sizeMap: Record<string, number> = { S: 3, M: 6, L: 14 };

  const inject = (cmd: string) =>
    webViewRef.current?.injectJavaScript(`handleMessage('${cmd}'); true;`);

  const handleToolSelect = (t: 'pen' | 'eraser') => {
    setActiveTool(t);
    inject(`tool:${t}`);
  };

  const handleColorSelect = (c: string) => {
    setActiveColor(c);
    inject(`color:${c}`);
    if (activeTool === 'eraser') handleToolSelect('pen');
  };

  const handleSizeSelect = (s: 'S' | 'M' | 'L') => {
    setActiveSize(s);
    inject(`size:${sizeMap[s]}`);
  };

  const handleWebViewMessage = (event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'exported') {
        const b64 = msg.data as string;
        setSketchBase64(b64);
        updateWizardStep(genesisWizard.step, { sketchData: b64 });
        setDrawingOpen(false);
      }
    } catch {}
  };

  const handleDescriptionChange = (text: string) => {
    setVisualDescription(text);
    updateWizardStep(genesisWizard.step, { visualDescription: text });
  };

  const handleGenerate = async () => {
    if (!visualDescription.trim()) return;
    setIsGenerating(true);
    setGenerationError(null);
    setGeneratedImages([]);
    try {
      const result = await generateCypherImages(visualDescription.trim(), sketchBase64);
      if (result.urls.length === 0) {
        setGenerationError('No images returned. Check your API key and try again.');
        setIsGenerating(false);
        return;
      }
      setGeneratedImages(result.urls);
      setGenerationMeta({ prompt: result.basePrompt, seed: result.seed });
      setSelectedIndex(null);
      setIsGenerating(false);
      setSelectingOpen(true);
    } catch (err: any) {
      setGenerationError(err?.message ?? 'Generation failed. Please try again.');
      setIsGenerating(false);
    }
  };

  const handleConfirmSelection = () => {
    if (selectedIndex === null) return;
    const url = generatedImages[selectedIndex];
    setSelectedImageUrl(url);
    updateWizardStep(genesisWizard.step, {
      selectedImageUrl: url,
      generationPrompt: generationMeta?.prompt ?? undefined,
      generationSeed: generationMeta?.seed ?? undefined,
    });
    setSelectingOpen(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.stepTitle}>Step 1: Sketch</Text>
      <Text style={styles.stepDescription}>
        Optionally sketch your Cypher, then describe its appearance. The AI will generate your visual.
      </Text>

      {/* Sketch Preview / Tap Target */}
      <TouchableOpacity style={styles.sketchPreview} onPress={() => setDrawingOpen(true)}>
        {sketchBase64 ? (
          <>
            <Image
              source={{ uri: `data:image/jpeg;base64,${sketchBase64}` }}
              style={styles.sketchImage}
              resizeMode="cover"
            />
            <View style={styles.editBadge}>
              <Ionicons name="pencil" size={13} color="#fff" />
              <Text style={styles.editBadgeText}>Edit Sketch</Text>
            </View>
          </>
        ) : (
          <View style={styles.sketchEmpty}>
            <Ionicons name="brush-outline" size={36} color="#003566" />
            <Text style={styles.sketchEmptyTitle}>Tap to sketch your Cypher</Text>
            <Text style={styles.sketchEmptySub}>Optional — adds visual context for AI generation</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Visual Description */}
      <View style={styles.field}>
        <Text style={styles.label}>Cypher Visual Description *</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={visualDescription}
          onChangeText={handleDescriptionChange}
          placeholder="Describe how your cypher looks — body type, features, materials, energy, anything visual. This guides the AI generation."
          placeholderTextColor="#6b7280"
          multiline
          numberOfLines={5}
        />
      </View>

      {/* Error */}
      {generationError ? (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={15} color="#ef4444" />
          <Text style={styles.errorText}>{generationError}</Text>
        </View>
      ) : null}

      {/* Generate Button */}
      <TouchableOpacity
        style={[
          styles.generateBtn,
          (!visualDescription.trim() || isGenerating) && styles.generateBtnDisabled,
        ]}
        onPress={handleGenerate}
        disabled={!visualDescription.trim() || isGenerating}
      >
        {isGenerating ? (
          <View style={styles.btnRow}>
            <ActivityIndicator color="#ffffff" size="small" />
            <Text style={styles.generateBtnText}>Generating your Cypher...</Text>
          </View>
        ) : (
          <View style={styles.btnRow}>
            <Ionicons name="sparkles" size={18} color="#ffffff" />
            <Text style={styles.generateBtnText}>Generate Cypher</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Selected Image Preview */}
      {selectedImageUrl ? (
        <View style={styles.selectedPreview}>
          <Image
            source={{ uri: selectedImageUrl }}
            style={styles.selectedImage}
            resizeMode="cover"
          />
          <View style={styles.selectedInfo}>
            <View style={styles.selectedBadge}>
              <Ionicons name="checkmark-circle" size={16} color="#10b981" />
              <Text style={styles.selectedBadgeText}>Cypher Selected</Text>
            </View>
            <TouchableOpacity onPress={() => setSelectingOpen(true)}>
              <Text style={styles.changeText}>Choose Different</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {/* ════════════════════════════════════════════
          DRAWING MODAL
      ════════════════════════════════════════════ */}
      <Modal visible={drawingOpen} animationType="slide" statusBarTranslucent>
        <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />
        <View style={styles.drawModal}>
          <SafeAreaView style={styles.drawSafe}>
            {/* Toolbar row 1 */}
            <View style={styles.toolbar1}>
              <TouchableOpacity style={styles.iconBtn} onPress={() => setDrawingOpen(false)}>
                <Ionicons name="close" size={22} color="#9ca3af" />
              </TouchableOpacity>
              <View style={styles.colorRow}>
                {COLORS.map((c) => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => handleColorSelect(c)}
                    style={[
                      styles.colorSwatch,
                      { backgroundColor: c },
                      activeColor === c && activeTool === 'pen' && styles.colorSwatchActive,
                    ]}
                  />
                ))}
              </View>
              <View style={styles.toolbar1Right}>
                <TouchableOpacity style={styles.iconBtn} onPress={() => inject('undo')}>
                  <Ionicons name="arrow-undo" size={20} color="#9ca3af" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconBtn} onPress={() => inject('clear')}>
                  <Ionicons name="trash-outline" size={20} color="#9ca3af" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.doneBtn} onPress={() => inject('export')}>
                  <Text style={styles.doneBtnText}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Toolbar row 2 */}
            <View style={styles.toolbar2}>
              <View style={styles.toolToggle}>
                {(['pen', 'eraser'] as const).map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.toolBtn, activeTool === t && styles.toolBtnActive]}
                    onPress={() => handleToolSelect(t)}
                  >
                    <Ionicons
                      name={t === 'pen' ? 'pencil' : 'remove-circle-outline'}
                      size={15}
                      color={activeTool === t ? '#fff' : '#9ca3af'}
                    />
                    <Text style={[styles.toolBtnText, activeTool === t && styles.toolBtnTextActive]}>
                      {t === 'pen' ? 'Pen' : 'Eraser'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.sizeRow}>
                {(['S', 'M', 'L'] as const).map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.sizeBtn, activeSize === s && styles.sizeBtnActive]}
                    onPress={() => handleSizeSelect(s)}
                  >
                    <Text style={[styles.sizeBtnText, activeSize === s && styles.sizeBtnTextActive]}>
                      {s}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Canvas */}
            <WebView
              ref={webViewRef}
              source={{ html: CANVAS_HTML }}
              style={styles.webView}
              scrollEnabled={false}
              bounces={false}
              overScrollMode="never"
              onMessage={handleWebViewMessage}
              javaScriptEnabled
              domStorageEnabled
              originWhitelist={['*']}
              allowsBackForwardNavigationGestures={false}
            />
          </SafeAreaView>
        </View>
      </Modal>

      {/* ════════════════════════════════════════════
          IMAGE SELECTION MODAL
      ════════════════════════════════════════════ */}
      <Modal visible={selectingOpen} animationType="slide" statusBarTranslucent>
        <StatusBar barStyle="light-content" backgroundColor="#000814" />
        <View style={styles.selectModal}>
          <SafeAreaView style={styles.selectSafe}>
            <View style={styles.selectHeader}>
              <Text style={styles.selectTitle}>Choose Your Cypher</Text>
              <Text style={styles.selectSub}>Tap an image to select it</Text>
            </View>

            <ScrollView
              style={styles.selectScroll}
              contentContainerStyle={styles.selectContent}
              showsVerticalScrollIndicator={false}
            >
              {generatedImages.map((uri, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.selectItem,
                    selectedIndex === idx && styles.selectItemActive,
                  ]}
                  onPress={() => setSelectedIndex(idx)}
                  activeOpacity={0.85}
                >
                  <Image
                    source={{ uri }}
                    style={styles.selectImage}
                    resizeMode="cover"
                  />
                  {selectedIndex === idx && (
                    <View style={styles.selectCheck}>
                      <Ionicons name="checkmark-circle" size={38} color="#3b82f6" />
                    </View>
                  )}
                  <Text style={styles.selectLabel}>Variant {idx + 1}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.selectFooter}>
              <TouchableOpacity
                style={[styles.useBtn, selectedIndex === null && styles.useBtnDisabled]}
                onPress={handleConfirmSelection}
                disabled={selectedIndex === null}
              >
                <Text style={styles.useBtnText}>Use This Cypher</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setSelectingOpen(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { gap: 20 },
  stepTitle: { fontSize: 20, fontWeight: 'bold', color: '#ffffff' },
  stepDescription: { fontSize: 14, color: '#9ca3af', lineHeight: 20 },

  sketchPreview: {
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#003566',
    backgroundColor: '#001d3d',
  },
  sketchImage: { width: '100%', height: '100%' },
  editBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  editBadgeText: { fontSize: 12, color: '#fff', fontWeight: '600' },
  sketchEmpty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  sketchEmptyTitle: { fontSize: 15, color: '#3b82f6', fontWeight: '600' },
  sketchEmptySub: { fontSize: 12, color: '#6b7280', textAlign: 'center', paddingHorizontal: 20 },

  field: { gap: 8 },
  label: { fontSize: 14, fontWeight: '600', color: '#ffffff' },
  input: {
    backgroundColor: '#001d3d',
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#003566',
  },
  textArea: { minHeight: 120, textAlignVertical: 'top' },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  errorText: { flex: 1, fontSize: 13, color: '#fca5a5', lineHeight: 18 },

  generateBtn: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  generateBtnDisabled: { opacity: 0.45 },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  generateBtnText: { fontSize: 16, fontWeight: '700', color: '#ffffff' },

  selectedPreview: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#10b981',
    backgroundColor: '#001d3d',
  },
  selectedImage: { width: '100%', height: 240 },
  selectedInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#003566',
  },
  selectedBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  selectedBadgeText: { fontSize: 13, color: '#10b981', fontWeight: '600' },
  changeText: { fontSize: 13, color: '#3b82f6', fontWeight: '600' },

  // Drawing modal
  drawModal: { flex: 1, backgroundColor: '#0a0a0a' },
  drawSafe: { flex: 1 },
  toolbar1: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0d1117',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
    gap: 4,
  },
  iconBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center', borderRadius: 8 },
  colorRow: { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 8, alignItems: 'center' },
  colorSwatch: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: 'transparent' },
  colorSwatchActive: { borderColor: '#ffffff', transform: [{ scale: 1.2 }] },
  toolbar1Right: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  doneBtn: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginLeft: 4,
  },
  doneBtnText: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
  toolbar2: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0d1117',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  toolToggle: { flexDirection: 'row', gap: 8 },
  toolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
  },
  toolBtnActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  toolBtnText: { fontSize: 13, color: '#9ca3af', fontWeight: '600' },
  toolBtnTextActive: { color: '#ffffff' },
  sizeRow: { flexDirection: 'row', gap: 6 },
  sizeBtn: {
    width: 34,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#374151',
  },
  sizeBtnActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  sizeBtnText: { fontSize: 13, fontWeight: '700', color: '#9ca3af' },
  sizeBtnTextActive: { color: '#ffffff' },
  webView: { flex: 1 },

  // Selection modal
  selectModal: { flex: 1, backgroundColor: '#000814' },
  selectSafe: { flex: 1 },
  selectHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#003566',
  },
  selectTitle: { fontSize: 22, fontWeight: 'bold', color: '#ffffff' },
  selectSub: { fontSize: 13, color: '#9ca3af', marginTop: 4 },
  selectScroll: { flex: 1 },
  selectContent: { padding: 16, gap: 16, paddingBottom: 20 },
  selectItem: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#003566',
  },
  selectItemActive: { borderColor: '#3b82f6' },
  selectImage: { width: '100%', height: SCREEN_WIDTH * 1.1 },
  selectCheck: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 22,
  },
  selectLabel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    textAlign: 'center',
    paddingVertical: 8,
    fontSize: 12,
    fontWeight: '600',
    color: '#9ca3af',
    backgroundColor: 'rgba(0,8,20,0.8)',
  },
  selectFooter: { padding: 16, gap: 10, borderTopWidth: 1, borderTopColor: '#003566' },
  useBtn: { backgroundColor: '#3b82f6', borderRadius: 12, padding: 16, alignItems: 'center' },
  useBtnDisabled: { backgroundColor: '#003566', opacity: 0.5 },
  useBtnText: { fontSize: 16, fontWeight: '700', color: '#ffffff' },
  cancelBtn: {
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#374151',
  },
  cancelBtnText: { fontSize: 15, color: '#9ca3af', fontWeight: '600' },
});
