import * as THREE from "three";
import { createNoise2D, createNoise3D } from "simplex-noise";

/**
 * 星云背景生成类
 * 负责生成包含星云的 Cube Map 纹理
 * 使用分形噪声和域扭曲算法生成真实的星云效果
 */
export class NebulaField {
  // 纹理配置常量
  private static readonly RESOLUTION = 1024;
  private static readonly EDGE_MARGIN_RATIO = 0.01;

  private static readonly FBM_OCTAVES = 5; // 分形叠加层数
  private static readonly NOISE_SCALE = 2.5; // 噪声基础缩放
  private static readonly WARP_STRENGTH = 0.8; // 域扭曲强度
  private static readonly FACE_OFFSET = 0.3; // 距离面中心的偏移范围 [0, 1]

  // 星云亮度配置
  // 亮度由三个因素共同决定：
  // 1. 颜色主题中的 alpha 值（每个颜色停止点的透明度）
  // 2. 单个星云的 intensity 随机值（NEBULA_INTENSITY_MIN ~ NEBULA_INTENSITY_MAX）
  // 3. 全局亮度倍数 BRIGHTNESS_MULTIPLIER
  // 最终亮度 = 颜色RGB * alpha * intensity * BRIGHTNESS_MULTIPLIER
  private static readonly NEBULA_INTENSITY_MIN = 0.7; // 单个星云最小强度
  private static readonly NEBULA_INTENSITY_MAX = 1.0; // 单个星云最大强度
  private static readonly BRIGHTNESS_MULTIPLIER = 2.5; // 全局亮度倍数

  // 星云大小配置（角直径，单位：弧度）
  // 这个值决定了星云在球面上的大小，越大星云覆盖面积越大
  // 例如：0.5 弧度 ≈ 28.6°，1.0 弧度 ≈ 57.3°，1.5 弧度 ≈ 85.9°
  private static readonly NEBULA_SIZE_MIN = 0.3; // 最小角直径（弧度）
  private static readonly NEBULA_SIZE_MAX = 0.6; // 最大角直径（弧度）

  // 真实星云颜色主题（基于实际星云的发射光谱）
  private static readonly COLOR_THEMES: NebulaColorTheme[] = [
    {
      name: "猎户座大星云型 (M42)",
      // Hα发射(红) + OIII发射(蓝绿)
      colors: [
        {
          threshold: 0.0,
          color: new THREE.Color(0.02, 0.02, 0.05),
          alpha: 0.0,
        },
        {
          threshold: 0.25,
          color: new THREE.Color(0.12, 0.08, 0.15),
          alpha: 0.35,
        },
        {
          threshold: 0.4,
          color: new THREE.Color(0.55, 0.25, 0.18),
          alpha: 0.65,
        }, // Hα红
        {
          threshold: 0.6,
          color: new THREE.Color(0.28, 0.48, 0.58),
          alpha: 0.8,
        }, // OIII蓝绿
        {
          threshold: 0.8,
          color: new THREE.Color(0.95, 0.85, 0.75),
          alpha: 0.9,
        },
        {
          threshold: 0.95,
          color: new THREE.Color(1.0, 0.98, 0.95),
          alpha: 0.95,
        },
      ],
    },
    {
      name: "鹰状星云型 (M16)",
      // 以Hα为主的红色发射星云
      colors: [
        {
          threshold: 0.0,
          color: new THREE.Color(0.01, 0.01, 0.03),
          alpha: 0.0,
        },
        {
          threshold: 0.3,
          color: new THREE.Color(0.15, 0.1, 0.08),
          alpha: 0.35,
        },
        { threshold: 0.5, color: new THREE.Color(0.65, 0.35, 0.2), alpha: 0.7 },
        {
          threshold: 0.75,
          color: new THREE.Color(0.85, 0.65, 0.5),
          alpha: 0.85,
        },
        { threshold: 0.92, color: new THREE.Color(1.0, 0.9, 0.8), alpha: 0.95 },
      ],
    },
    {
      name: "礁湖星云型 (M8)",
      // Hα和SII的混合（红橙色）
      colors: [
        {
          threshold: 0.0,
          color: new THREE.Color(0.02, 0.02, 0.04),
          alpha: 0.0,
        },
        {
          threshold: 0.28,
          color: new THREE.Color(0.08, 0.12, 0.18),
          alpha: 0.4,
        },
        {
          threshold: 0.45,
          color: new THREE.Color(0.35, 0.25, 0.45),
          alpha: 0.7,
        },
        {
          threshold: 0.65,
          color: new THREE.Color(0.6, 0.45, 0.65),
          alpha: 0.85,
        },
        {
          threshold: 0.85,
          color: new THREE.Color(0.9, 0.85, 0.9),
          alpha: 0.92,
        },
        {
          threshold: 0.96,
          color: new THREE.Color(1.0, 0.98, 1.0),
          alpha: 0.96,
        },
      ],
    },
    {
      name: "北美洲星云型 (NGC 7000)",
      // 红色发射星云
      colors: [
        {
          threshold: 0.0,
          color: new THREE.Color(0.015, 0.01, 0.035),
          alpha: 0.0,
        },
        {
          threshold: 0.32,
          color: new THREE.Color(0.18, 0.08, 0.1),
          alpha: 0.38,
        },
        { threshold: 0.5, color: new THREE.Color(0.7, 0.3, 0.25), alpha: 0.75 },
        {
          threshold: 0.72,
          color: new THREE.Color(0.88, 0.6, 0.55),
          alpha: 0.88,
        },
        {
          threshold: 0.9,
          color: new THREE.Color(0.98, 0.9, 0.88),
          alpha: 0.95,
        },
      ],
    },
    {
      name: "螺旋星云型",
      // 行星状星云，OIII强（蓝绿色）
      colors: [
        {
          threshold: 0.0,
          color: new THREE.Color(0.01, 0.02, 0.04),
          alpha: 0.0,
        },
        { threshold: 0.3, color: new THREE.Color(0.05, 0.1, 0.15), alpha: 0.4 },
        {
          threshold: 0.48,
          color: new THREE.Color(0.15, 0.35, 0.45),
          alpha: 0.7,
        },
        {
          threshold: 0.68,
          color: new THREE.Color(0.25, 0.55, 0.65),
          alpha: 0.85,
        },
        {
          threshold: 0.86,
          color: new THREE.Color(0.7, 0.85, 0.9),
          alpha: 0.92,
        },
        {
          threshold: 0.97,
          color: new THREE.Color(0.98, 0.97, 1.0),
          alpha: 0.97,
        },
      ],
    },
  ];

  /**
   * 生成星云 Cube Map
   * @returns THREE.CubeTexture 生成的立方体纹理
   */
  static generateCubeMap(): THREE.CubeTexture {
    console.log("开始生成星云贴图...");

    // 生成星云数据
    const nebulaClouds = this.generateNebulaClouds();

    // 创建6个面的 Canvas
    const faceCanvases: HTMLCanvasElement[] = [];
    for (let i = 0; i < 6; i++) {
      const canvas = document.createElement("canvas");
      canvas.width = NebulaField.RESOLUTION;
      canvas.height = NebulaField.RESOLUTION;
      faceCanvases.push(canvas);
    }

    // 绘制星云
    this.drawNebulae(faceCanvases, nebulaClouds);

    // 创建 CubeTexture
    const cubeTexture = new THREE.CubeTexture();
    cubeTexture.image = faceCanvases as any;
    cubeTexture.needsUpdate = true;
    cubeTexture.colorSpace = THREE.SRGBColorSpace;
    cubeTexture.minFilter = THREE.LinearFilter;
    cubeTexture.magFilter = THREE.LinearFilter;

    console.log("星云贴图生成完成！");

    return cubeTexture;
  }

  /**
   * 生成星云数据
   * 每个立方体面生成一片星云
   */
  private static generateNebulaClouds(): NebulaCloud[] {
    const seed = Math.random() * 10000;
    const random = (i: number) => {
      const x = Math.sin(seed + i) * 10000;
      return x - Math.floor(x);
    };

    const clouds: NebulaCloud[] = [];
    const offsetRange = NebulaField.FACE_OFFSET;

    // 为每个面生成一片星云
    // 面索引: 0=+X, 1=-X, 2=+Y, 3=-Y, 4=+Z, 5=-Z
    for (let faceIndex = 0; faceIndex < 6; faceIndex++) {
      // 生成该面中心方向附近的随机点
      const offsetX = (random(faceIndex * 3) - 0.5) * offsetRange;
      const offsetY = (random(faceIndex * 3 + 1) - 0.5) * offsetRange;
      const offsetZ = (random(faceIndex * 3 + 2) - 0.5) * offsetRange;

      let center: THREE.Vector3;

      switch (faceIndex) {
        case 0: // +X 面
          center = new THREE.Vector3(1, offsetY, offsetZ).normalize();
          break;
        case 1: // -X 面
          center = new THREE.Vector3(-1, offsetY, offsetZ).normalize();
          break;
        case 2: // +Y 面
          center = new THREE.Vector3(offsetX, 1, offsetZ).normalize();
          break;
        case 3: // -Y 面
          center = new THREE.Vector3(offsetX, -1, offsetZ).normalize();
          break;
        case 4: // +Z 面
          center = new THREE.Vector3(offsetX, offsetY, 1).normalize();
          break;
        case 5: // -Z 面
          center = new THREE.Vector3(offsetX, offsetY, -1).normalize();
          break;
        default:
          center = new THREE.Vector3(0, 0, 1);
      }

      // 随机选择颜色主题
      const themeIndex = Math.floor(
        random(faceIndex + 100) * NebulaField.COLOR_THEMES.length,
      );
      const theme = NebulaField.COLOR_THEMES[themeIndex];

      // 随机大小（星云的角直径，单位：弧度）
      const sizeRange =
        NebulaField.NEBULA_SIZE_MAX - NebulaField.NEBULA_SIZE_MIN;
      const size =
        NebulaField.NEBULA_SIZE_MIN + random(faceIndex + 200) * sizeRange;

      // 随机强度
      const intensityRange =
        NebulaField.NEBULA_INTENSITY_MAX - NebulaField.NEBULA_INTENSITY_MIN;
      const intensity =
        NebulaField.NEBULA_INTENSITY_MIN +
        random(faceIndex + 300) * intensityRange;

      // 噪声偏移（每团星云使用不同的噪声样本）
      const noiseOffset = new THREE.Vector3(
        random(faceIndex + 400) * 100,
        random(faceIndex + 500) * 100,
        random(faceIndex + 600) * 100,
      );

      clouds.push({
        center,
        size,
        theme,
        intensity,
        noiseOffset,
      });
    }

    return clouds;
  }

  /**
   * 将星云绘制到立方体纹理的各个面上
   */
  private static drawNebulae(
    faceCanvases: HTMLCanvasElement[],
    clouds: NebulaCloud[],
  ): void {
    const resolution = NebulaField.RESOLUTION;
    const edgeMargin = resolution * NebulaField.EDGE_MARGIN_RATIO;

    // 创建噪声函数
    const noise2D = createNoise2D();
    const noise3D = createNoise3D();

    // 为每个面生成像素数据
    for (let faceIndex = 0; faceIndex < 6; faceIndex++) {
      const canvas = faceCanvases[faceIndex];
      const ctx = canvas.getContext("2d")!;

      // 创建 ImageData
      const imageData = ctx.createImageData(resolution, resolution);
      const data = imageData.data;

      console.log(`正在生成面 ${faceIndex + 1}/6...`);

      // 逐像素计算
      for (let y = 0; y < resolution; y++) {
        for (let x = 0; x < resolution; x++) {
          const pixelIndex = (y * resolution + x) * 4;

          // 边缘留透明
          if (
            x < edgeMargin ||
            x > resolution - edgeMargin ||
            y < edgeMargin ||
            y > resolution - edgeMargin
          ) {
            data[pixelIndex] = 0;
            data[pixelIndex + 1] = 0;
            data[pixelIndex + 2] = 0;
            data[pixelIndex + 3] = 0;
            continue;
          }

          // 转换到 UV 坐标
          const u = x / resolution;
          const v = 1 - y / resolution;

          // 采样星云颜色
          const color = this.sampleNebulaColor(
            faceIndex,
            u,
            v,
            clouds,
            noise2D,
            noise3D,
          );

          data[pixelIndex] = Math.floor(color.r * 255);
          data[pixelIndex + 1] = Math.floor(color.g * 255);
          data[pixelIndex + 2] = Math.floor(color.b * 255);
          data[pixelIndex + 3] = Math.floor(color.a * 255);
        }
      }

      ctx.putImageData(imageData, 0, 0);
    }
  }

  /**
   * 采样某点的星云颜色
   */
  private static sampleNebulaColor(
    faceIndex: number,
    u: number,
    v: number,
    clouds: NebulaCloud[],
    noise2D: (x: number, y: number) => number,
    noise3D: (x: number, y: number, z: number) => number,
  ): { r: number; g: number; b: number; a: number } {
    // 将 UV 转换为 3D 方向
    const dir = this.cubeUVToDirection(faceIndex, u, v);

    let accumulatedColor = new THREE.Color(0, 0, 0);
    let accumulatedAlpha = 0;

    // 叠加所有星云的贡献
    for (const cloud of clouds) {
      // 计算该方向到星云中心的角距离
      const angleDistance = dir.angleTo(cloud.center);

      // 如果在星云范围内
      if (angleDistance < cloud.size) {
        // 归一化距离 [0, 1]，中心为 0，边缘为 1
        const normalizedDist = angleDistance / cloud.size;

        // 计算基础衰减（边缘渐隐）
        const falloff = 1 - normalizedDist;
        const distanceFactor = Math.pow(falloff, 1.5); // 指数衰减

        // 域扭曲 + FBM 采样
        const warpedPos = this.domainWarp(
          dir.x * NebulaField.NOISE_SCALE + cloud.noiseOffset.x,
          dir.y * NebulaField.NOISE_SCALE + cloud.noiseOffset.y,
          dir.z * NebulaField.NOISE_SCALE + cloud.noiseOffset.z,
          noise3D,
        );

        const noiseValue = this.fbm(
          warpedPos.x,
          warpedPos.y,
          warpedPos.z,
          NebulaField.FBM_OCTAVES,
          noise3D,
        );

        // 归一化噪声值到 [0, 1]
        const normalizedNoise = (noiseValue + 1) * 0.5;

        // 根据噪声值获取颜色
        const colorSample = this.getColorFromTheme(
          normalizedNoise,
          cloud.theme,
        );

        // 综合计算最终贡献
        const contribution = normalizedNoise * distanceFactor * cloud.intensity;

        // 累加颜色（使用 alpha 混合）
        accumulatedColor.r += colorSample.r * contribution * colorSample.a;
        accumulatedColor.g += colorSample.g * contribution * colorSample.a;
        accumulatedColor.b += colorSample.b * contribution * colorSample.a;
        accumulatedAlpha += contribution * colorSample.a;
      }
    }

    // 限制 alpha 范围
    accumulatedAlpha = Math.min(accumulatedAlpha, 1);

    // 应用亮度倍数
    accumulatedColor.r *= NebulaField.BRIGHTNESS_MULTIPLIER;
    accumulatedColor.g *= NebulaField.BRIGHTNESS_MULTIPLIER;
    accumulatedColor.b *= NebulaField.BRIGHTNESS_MULTIPLIER;

    return {
      r: accumulatedColor.r,
      g: accumulatedColor.g,
      b: accumulatedColor.b,
      a: accumulatedAlpha,
    };
  }

  /**
   * 域扭曲 - 制造漩涡效果
   */
  private static domainWarp(
    x: number,
    y: number,
    z: number,
    noise3D: (x: number, y: number, z: number) => number,
  ): { x: number; y: number; z: number } {
    const strength = NebulaField.WARP_STRENGTH;

    // 第一层扭曲
    const q1 = noise3D(x, y, z);
    const q2 = noise3D(x + 5.2, y + 1.3, z + 2.5);

    const wx = x + strength * q1;
    const wy = y + strength * q2;
    const wz = z + strength * noise3D(x + 3.7, y + 4.1, z + 1.8);

    // 第二层扭曲
    const r1 = noise3D(
      wx + 4.0 * q1 + 1.7,
      wy + 4.0 * q2 + 9.2,
      wz + 4.0 * noise3D(x, y, z) + 3.5,
    );
    const r2 = noise3D(
      wx + 4.0 * q1 + 8.3,
      wy + 4.0 * q2 + 2.8,
      wz + 4.0 * noise3D(x, y, z) + 6.1,
    );

    return {
      x: wx + strength * r1,
      y: wy + strength * r2,
      z: wz + strength * noise3D(wx, wy, wz),
    };
  }

  /**
   * 分形布朗运动 (FBM) - 多层噪声叠加
   */
  private static fbm(
    x: number,
    y: number,
    z: number,
    octaves: number,
    noise3D: (x: number, y: number, z: number) => number,
  ): number {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      value += amplitude * noise3D(x * frequency, y * frequency, z * frequency);
      maxValue += amplitude;

      amplitude *= 0.5; // 振幅减半
      frequency *= 2.0; // 频率翻倍
    }

    return value / maxValue;
  }

  /**
   * 根据噪声值从主题中获取颜色
   */
  private static getColorFromTheme(
    noiseValue: number,
    theme: NebulaColorTheme,
  ): { r: number; g: number; b: number; a: number } {
    // 找到对应的颜色区间
    for (let i = 0; i < theme.colors.length - 1; i++) {
      const current = theme.colors[i];
      const next = theme.colors[i + 1];

      if (noiseValue >= current.threshold && noiseValue <= next.threshold) {
        // 在当前区间内插值
        const t =
          (noiseValue - current.threshold) /
          (next.threshold - current.threshold);

        return {
          r: current.color.r + (next.color.r - current.color.r) * t,
          g: current.color.g + (next.color.g - current.color.g) * t,
          b: current.color.b + (next.color.b - current.color.b) * t,
          a: current.alpha + (next.alpha - current.alpha) * t,
        };
      }
    }

    // 如果超出范围，返回最后一个颜色
    const last = theme.colors[theme.colors.length - 1];
    return {
      r: last.color.r,
      g: last.color.g,
      b: last.color.b,
      a: last.alpha,
    };
  }

  /**
   * 将立方体面 UV 坐标转换为 3D 方向向量
   */
  private static cubeUVToDirection(
    faceIndex: number,
    u: number,
    v: number,
  ): THREE.Vector3 {
    const uc = u * 2 - 1;
    const vc = v * 2 - 1;

    switch (faceIndex) {
      case 0:
        return new THREE.Vector3(1, -vc, -uc).normalize(); // +X
      case 1:
        return new THREE.Vector3(-1, -vc, uc).normalize(); // -X
      case 2:
        return new THREE.Vector3(uc, 1, vc).normalize(); // +Y
      case 3:
        return new THREE.Vector3(uc, -1, -vc).normalize(); // -Y
      case 4:
        return new THREE.Vector3(uc, -vc, 1).normalize(); // +Z
      case 5:
        return new THREE.Vector3(-uc, -vc, -1).normalize(); // -Z
      default:
        return new THREE.Vector3(0, 0, 1);
    }
  }
}

/**
 * 星云颜色主题接口
 */
interface NebulaColorTheme {
  name: string;
  colors: ColorStop[];
}

/**
 * 颜色停止点
 */
interface ColorStop {
  threshold: number; // 噪声阈值 [0, 1]
  color: THREE.Color; // 颜色
  alpha: number; // 透明度 [0, 1]
}

/**
 * 单个星云数据
 */
interface NebulaCloud {
  center: THREE.Vector3; // 星云中心方向（球面上）
  size: number; // 星云大小（角直径，弧度）
  theme: NebulaColorTheme; // 颜色主题
  intensity: number; // 强度 [0, 1]
  noiseOffset: THREE.Vector3; // 噪声偏移，使每团星云独特
}
