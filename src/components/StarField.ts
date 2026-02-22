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

  // 纹理配置常量
  private static readonly RESOLUTION = 2048;
  private static readonly EDGE_MARGIN_RATIO = 0.01;

  /**
   * 生成星空 Cube Map（球面投影法）
   * 在3D球面上随机生成星星，然后投影到立方体的6个面上
   * @returns THREE.CubeTexture 生成的立方体纹理
   */
  static generateCubeMap(): THREE.CubeTexture {
    // 生成星星数据
    const stars = this.generateStars();

    // 创建6个面的 Canvas
    const faceCanvases: HTMLCanvasElement[] = [];
    for (let i = 0; i < 6; i++) {
      const canvas = document.createElement("canvas");
      canvas.width = StarField.RESOLUTION;
      canvas.height = StarField.RESOLUTION;
      faceCanvases.push(canvas);
    }

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
}
