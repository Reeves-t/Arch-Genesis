import React from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import { Canvas, Line, vec, Group, BlurMask } from '@shopify/react-native-skia';

const { width, height } = Dimensions.get('window');

interface FrameworkBackgroundProps {
  opacity?: number;
}

export const FrameworkBackground: React.FC<FrameworkBackgroundProps> = ({ opacity = 0.3 }) => {
  const gridSize = 40;
  const centerX = width / 2;
  const centerY = height * 0.6;
  const vanishingY = height * 0.3;

  const lines: Array<{ start: { x: number; y: number }; end: { x: number; y: number } }> = [];

  // Vertical lines with perspective
  for (let i = -10; i <= 10; i++) {
    const offsetX = i * gridSize;
    const startX = centerX + offsetX;
    const startY = height;

    // Calculate vanishing point convergence
    const vanishFactor = 1 - Math.abs(i) * 0.05;
    const endX = centerX + offsetX * vanishFactor;
    const endY = vanishingY;

    lines.push({
      start: { x: startX, y: startY },
      end: { x: endX, y: endY },
    });
  }

  // Horizontal lines with perspective
  for (let i = 0; i <= 20; i++) {
    const y = height - i * gridSize;
    if (y < vanishingY) continue;

    // Calculate width based on perspective
    const factor = (height - y) / (height - vanishingY);
    const lineWidth = width * (1 - factor * 0.7);

    lines.push({
      start: { x: centerX - lineWidth / 2, y },
      end: { x: centerX + lineWidth / 2, y },
    });
  }

  return (
    <Canvas style={StyleSheet.absoluteFill}>
      <Group opacity={opacity}>
        {lines.map((line, index) => {
          const isHorizontal = line.start.y === line.end.y;
          const distanceFromBottom = height - line.start.y;
          const fadeOpacity = isHorizontal
            ? Math.max(0.2, 1 - distanceFromBottom / height)
            : 0.4;

          return (
            <Line
              key={index}
              p1={vec(line.start.x, line.start.y)}
              p2={vec(line.end.x, line.end.y)}
              color={`rgba(59, 130, 246, ${fadeOpacity})`}
              style="stroke"
              strokeWidth={isHorizontal ? 1 : 1.5}
            >
              <BlurMask blur={0.5} style="normal" />
            </Line>
          );
        })}
      </Group>
    </Canvas>
  );
};
