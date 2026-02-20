import * as THREE from "three";

/**
 * 星空背景生成类
 * 负责生成包含星星的 Cube Map 纹理
 */
export class StarField {
  // 星星配置常量
  private static readonly STAR_TOTAL = 5000;
  private static readonly STAR_COLORS = [
    new THREE.Color(0.8, 0.9, 1.0), // 蓝白色
    new THREE.Color(1.0, 1.0, 1.0), // 白色
    new THREE.Color(1.0, 0.95, 0.9), // 暖白色
  ];

  // 星云配置常量
  private static readonly NEBULA_COUNT = 6;
  private static readonly NEBULA_COLORS = [
    new THREE.Color(0.35, 0.15, 0.5), // 暗紫色
    new THREE.Color(0.15, 0.28, 0.5), // 暗蓝色
    new THREE.Color(0.5, 0.2, 0.25), // 暗红色
    new THREE.Color(0.2, 0.45, 0.3), // 暗青绿色
    new THREE.Color(0.5, 0.38, 0.15), // 暗金色
    new THREE.Color(0.28, 0.15, 0.38), // 暗深紫色
  ];

  // 纹理配置常量
  private static readonly RESOLUTION = 2048;
  private static readonly EDGE_MARGIN_RATIO = 0.01;

  // Perlin Noise 实现
  private static perlin: {
    noise2D: (x: number, y: number) => number;
    init: () => void;
  } = (() => {
    const permutation = new Uint8Array(512);
    const p = new Uint8Array(256);

    const init = () => {
      for (let i = 0; i < 256; i++) p[i] = i;
      // Shuffle
      for (let i = 255; i > 0; i--) {
        const n = Math.floor(Math.random() * (i + 1));
        [p[i], p[n]] = [p[n], p[i]];
      }
      for (let i = 0; i < 512; i++) permutation[i] = p[i & 255];
    };

    const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
    const lerp = (t: number, a: number, b: number) => a + t * (b - a);
    const grad = (hash: number, x: number, y: number) => {
      const h = hash & 15;
      const u = h < 8 ? x : y;
      const v = h < 4 ? y : h === 12 || h === 14 ? x : 0;
      return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    };

    const noise2D = (x: number, y: number) => {
      const X = Math.floor(x) & 255;
      const Y = Math.floor(y) & 255;

      x -= Math.floor(x);
      y -= Math.floor(y);

      const u = fade(x);
      const v = fade(y);

      const A = permutation[X] + Y;
      const B = permutation[X + 1] + Y;

      return lerp(
        v,
        lerp(u, grad(permutation[A], x, y), grad(permutation[B], x - 1, y)),
        lerp(
          u,
          grad(permutation[A + 1], x, y - 1),
          grad(permutation[B + 1], x - 1, y - 1),
        ),
      );
    };

    return { init, noise2D };
  })();

  /**
   * 生成星空 Cube Map（球面投影法）
   * 在3D球面上随机生成星星，然后投影到立方体的6个面上
   * @returns THREE.CubeTexture 生成的立方体纹理
   */
  static generateCubeMap(): THREE.CubeTexture {
    // 生成星星数据
    const stars = this.generateStars();

    // 生成星云数据
    // const nebulas = this.generateNebulas();

    // 创建6个面的 Canvas
    const faceCanvases: HTMLCanvasElement[] = [];
    for (let i = 0; i < 6; i++) {
      const canvas = document.createElement("canvas");
      canvas.width = StarField.RESOLUTION;
      canvas.height = StarField.RESOLUTION;
      faceCanvases.push(canvas);
    }

    // 绘制星云（先绘制星云，作为背景层）
    // this.drawNebulas(faceCanvases, nebulas);

    // 绘制星星
    this.drawStars(faceCanvases, stars);

    // 创建 CubeTexture
    const cubeTexture = new THREE.CubeTexture();
    cubeTexture.image = faceCanvases as any;
    cubeTexture.needsUpdate = true;
    cubeTexture.colorSpace = THREE.SRGBColorSpace;
    cubeTexture.minFilter = THREE.LinearFilter;
    cubeTexture.magFilter = THREE.LinearFilter;

    return cubeTexture;
  }

  /**
   * 生成星星数据
   * 在3D球面上随机生成星星
   * @returns 星星数组
   */
  private static generateStars(): Array<{
    direction: THREE.Vector3;
    brightness: number;
    color: THREE.Color;
    size: number;
  }> {
    // 在3D球面上随机生成星星（完全随机分布）
    const seed = Math.random() * 10000;

    // 简单的伪随机函数
    const random = (i: number) => {
      const x = Math.sin(seed + i) * 10000;
      return x - Math.floor(x);
    };

    const stars: Array<{
      direction: THREE.Vector3;
      brightness: number;
      color: THREE.Color;
      size: number;
    }> = [];

    for (let i = 0; i < StarField.STAR_TOTAL; i++) {
      // 完全随机在球面上生成点
      const theta = Math.acos(1 - 2 * random(i));
      const phi = 2 * Math.PI * random(i + 1000);

      const x = Math.sin(theta) * Math.cos(phi);
      const y = Math.sin(theta) * Math.sin(phi);
      const z = Math.cos(theta);

      const direction = new THREE.Vector3(x, y, z).normalize();

      // 随机选择颜色和亮度
      const colorIndex = Math.floor(
        Math.random() * StarField.STAR_COLORS.length,
      );
      const brightness = 0.3 + Math.random() * 0.7; // 0.3 ~ 1.0
      const size = 0.5 + Math.random() * 1; // 星星大小

      stars.push({
        direction,
        brightness,
        color: StarField.STAR_COLORS[colorIndex],
        size,
      });
    }

    return stars;
  }

  /**
   * 将星星绘制到立方体纹理的各个面上
   * @param faceCanvases 立方体6个面的canvas数组
   * @param stars 星星数据数组
   */
  private static drawStars(
    faceCanvases: HTMLCanvasElement[],
    stars: Array<{
      direction: THREE.Vector3;
      brightness: number;
      color: THREE.Color;
      size: number;
    }>,
  ): void {
    // 边缘留白（避免接缝问题）
    const edgeMargin = StarField.RESOLUTION * StarField.EDGE_MARGIN_RATIO;

    // 将每个星星投影到对应的面上
    for (const star of stars) {
      const dir = star.direction;

      // 确定星星在哪个面上
      let faceIndex = -1;
      let u = 0,
        v = 0;

      const absX = Math.abs(dir.x);
      const absY = Math.abs(dir.y);
      const absZ = Math.abs(dir.z);

      if (absX >= absY && absX >= absZ) {
        // X轴方向
        if (dir.x > 0) {
          faceIndex = 0; // +X
          u = -dir.z / absX;
          v = -dir.y / absX;
        } else {
          faceIndex = 1; // -X
          u = dir.z / absX;
          v = -dir.y / absX;
        }
      } else if (absY >= absX && absY >= absZ) {
        // Y轴方向
        if (dir.y > 0) {
          faceIndex = 2; // +Y
          u = dir.x / absY;
          v = dir.z / absY;
        } else {
          faceIndex = 3; // -Y
          u = dir.x / absY;
          v = -dir.z / absY;
        }
      } else {
        // Z轴方向
        if (dir.z > 0) {
          faceIndex = 4; // +Z
          u = dir.x / absZ;
          v = -dir.y / absZ;
        } else {
          faceIndex = 5; // -Z
          u = -dir.x / absZ;
          v = -dir.y / absZ;
        }
      }

      // 转换到 [0, 1] 范围
      u = u * 0.5 + 0.5;
      v = v * 0.5 + 0.5;

      // 计算像素位置
      const pixelX = u * StarField.RESOLUTION;
      const pixelY = (1 - v) * StarField.RESOLUTION;

      // 边缘检查（避免在边缘绘制）
      if (
        pixelX > edgeMargin &&
        pixelX < StarField.RESOLUTION - edgeMargin &&
        pixelY > edgeMargin &&
        pixelY < StarField.RESOLUTION - edgeMargin
      ) {
        const canvas = faceCanvases[faceIndex];
        const ctx = canvas.getContext("2d")!;

        // 绘制星星（使用径向渐变模拟光晕效果）
        const gradient = ctx.createRadialGradient(
          pixelX,
          pixelY,
          0,
          pixelX,
          pixelY,
          star.size,
        );
        gradient.addColorStop(
          0,
          `rgba(${star.color.r * 255}, ${star.color.g * 255}, ${star.color.b * 255}, ${star.brightness})`,
        );
        gradient.addColorStop(
          1,
          `rgba(${star.color.r * 255}, ${star.color.g * 255}, ${star.color.b * 255}, 0)`,
        );

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(pixelX, pixelY, star.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /**
   * 生成星云数据
   * 在3D球面上随机生成星云，避免接缝附近
   * @returns 星云数组
   */
  private static generateNebulas(): Array<{
    direction: THREE.Vector3;
    color: THREE.Color;
    size: number;
    seed: number;
  }> {
    // 初始化 Perlin noise
    StarField.perlin.init();

    const seed = Math.random() * 10000;

    // 简单的伪随机函数
    const random = (i: number) => {
      const x = Math.sin(seed + i) * 10000;
      return x - Math.floor(x);
    };

    const nebulas: Array<{
      direction: THREE.Vector3;
      color: THREE.Color;
      size: number;
      seed: number;
    }> = [];

    for (let i = 0; i < StarField.NEBULA_COUNT; i++) {
      // 在球面上随机生成方向，但避免靠近接缝
      let theta: number, phi: number;
      let validPosition = false;
      let attempts = 0;

      while (!validPosition && attempts < 100) {
        theta = Math.acos(1 - 2 * random(i * 3 + attempts));
        phi = 2 * Math.PI * random(i * 3 + attempts + 1);

        const x = Math.sin(theta) * Math.cos(phi);
        const y = Math.sin(theta) * Math.sin(phi);
        const z = Math.cos(theta);

        // 检查是否远离接缝（避免在立方体面的边缘附近）
        const absX = Math.abs(x);
        const absY = Math.abs(y);
        const absZ = Math.abs(z);

        const maxAxis = Math.max(absX, absY, absZ);
        const minAxis = Math.min(absX, absY, absZ);

        // 如果最小轴与最大轴的比值大于阈值，说明接近接缝
        const ratio = minAxis / maxAxis;

        if (ratio < 0.3) {
          validPosition = true;

          const direction = new THREE.Vector3(x, y, z).normalize();

          // 随机选择颜色
          const colorIndex = Math.floor(
            random(i * 3 + attempts + 2) * StarField.NEBULA_COLORS.length,
          );

          // 星云大小（像素）- 更小的尺寸
          const size = 60 + random(i * 3 + attempts + 3) * 80; // 60-140 像素

          nebulas.push({
            direction,
            color: StarField.NEBULA_COLORS[colorIndex],
            size,
            seed: Math.random() * 10000,
          });
        }

        attempts++;
      }
    }

    return nebulas;
  }

  /**
   * 将星云绘制到立方体纹理的各个面上
   * 使用 Perlin Noise + FBM 生成真实的星云效果
   * @param faceCanvases 立方体6个面的canvas数组
   * @param nebulas 星云数据数组
   */
  private static drawNebulas(
    faceCanvases: HTMLCanvasElement[],
    nebulas: Array<{
      direction: THREE.Vector3;
      color: THREE.Color;
      size: number;
      seed: number;
    }>,
  ): void {
    // 边缘留白（避免接缝问题）
    const edgeMargin = StarField.RESOLUTION * StarField.EDGE_MARGIN_RATIO;

    // 将每个星云投影到对应的面上
    for (const nebula of nebulas) {
      const dir = nebula.direction;

      // 确定星云在哪个面上
      let faceIndex = -1;
      let u = 0,
        v = 0;

      const absX = Math.abs(dir.x);
      const absY = Math.abs(dir.y);
      const absZ = Math.abs(dir.z);

      if (absX >= absY && absX >= absZ) {
        // X轴方向
        if (dir.x > 0) {
          faceIndex = 0; // +X
          u = -dir.z / absX;
          v = -dir.y / absX;
        } else {
          faceIndex = 1; // -X
          u = dir.z / absX;
          v = -dir.y / absX;
        }
      } else if (absY >= absX && absY >= absZ) {
        // Y轴方向
        if (dir.y > 0) {
          faceIndex = 2; // +Y
          u = dir.x / absY;
          v = dir.z / absY;
        } else {
          faceIndex = 3; // -Y
          u = dir.x / absY;
          v = -dir.z / absY;
        }
      } else {
        // Z轴方向
        if (dir.z > 0) {
          faceIndex = 4; // +Z
          u = dir.x / absZ;
          v = -dir.y / absZ;
        } else {
          faceIndex = 5; // -Z
          u = -dir.x / absZ;
          v = -dir.y / absZ;
        }
      }

      // 转换到 [0, 1] 范围
      u = u * 0.5 + 0.5;
      v = v * 0.5 + 0.5;

      // 计算像素位置
      const centerX = u * StarField.RESOLUTION;
      const centerY = (1 - v) * StarField.RESOLUTION;

      // 边缘检查（避免在边缘绘制）
      if (
        centerX > edgeMargin &&
        centerX < StarField.RESOLUTION - edgeMargin &&
        centerY > edgeMargin &&
        centerY < StarField.RESOLUTION - edgeMargin
      ) {
        const canvas = faceCanvases[faceIndex];
        const ctx = canvas.getContext("2d")!;

        // 使用像素操作绘制星云
        const radius = nebula.size;
        const startX = Math.max(0, Math.floor(centerX - radius));
        const startY = Math.max(0, Math.floor(centerY - radius));
        const endX = Math.min(
          StarField.RESOLUTION,
          Math.ceil(centerX + radius),
        );
        const endY = Math.min(
          StarField.RESOLUTION,
          Math.ceil(centerY + radius),
        );

        const imageData = ctx.getImageData(
          startX,
          startY,
          endX - startX,
          endY - startY,
        );
        const data = imageData.data;

        // FBM 参数
        const octaves = 5;
        const scale = 0.02; // 噪声缩放
        const persistence = 0.5; // 持续度
        const lacunarity = 2.0; // 间隙度

        // 遍历每个像素
        for (let dy = 0; dy < endY - startY; dy++) {
          for (let dx = 0; dx < endX - startX; dx++) {
            const px = startX + dx;
            const py = startY + dy;

            // 计算到中心的距离
            const distX = px - centerX;
            const distY = py - centerY;
            const dist = Math.sqrt(distX * distX + distY * distY);

            // 只在圆形区域内绘制
            if (dist < radius) {
              // 归一化距离 [0, 1]
              const normDist = dist / radius;

              // FBM 噪声
              let noise = 0;
              let amplitude = 1;
              let frequency = 1;
              let maxValue = 0;

              for (let o = 0; o < octaves; o++) {
                const sampleX = (px + nebula.seed) * scale * frequency;
                const sampleY = (py + nebula.seed) * scale * frequency;

                noise +=
                  (StarField.perlin.noise2D(sampleX, sampleY) * 0.5 + 0.5) *
                  amplitude;

                maxValue += amplitude;
                amplitude *= persistence;
                frequency *= lacunarity;
              }

              noise /= maxValue;

              // 径向衰减（中心亮，边缘暗）
              const falloff = Math.pow(1 - normDist, 2);

              // 噪声增强（提高对比度）
              const enhancedNoise = Math.pow(noise, 1.5);

              // 最终强度
              const intensity = enhancedNoise * falloff * 0.8; // 提高透明度

              // 应用颜色
              const r = nebula.color.r * 255;
              const g = nebula.color.g * 255;
              const b = nebula.color.b * 255;

              // 混合模式：叠加
              const idx = (dy * (endX - startX) + dx) * 4;
              data[idx] = Math.min(255, data[idx] + r * intensity); // R
              data[idx + 1] = Math.min(255, data[idx + 1] + g * intensity); // G
              data[idx + 2] = Math.min(255, data[idx + 2] + b * intensity); // B
              data[idx + 3] = Math.min(255, data[idx + 3] + 255 * intensity); // A
            }
          }
        }

        ctx.putImageData(imageData, startX, startY);
      }
    }
  }
}
