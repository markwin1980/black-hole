import * as THREE from "three";

// 导入着色器
// @ts-ignore
import vertexShader from "../shaders/rayTracerVertex.glsl?raw";
// @ts-ignore
import fragmentShader from "../shaders/rayTracerFragment.glsl?raw";

// 导入星空和星云生成器
import { StarField } from "./StarField";
import { NebulaField } from "./NebulaField";

/**
 * 亮斑配置参数
 */
export interface HotspotConfig {
  count: number; // 亮斑数量
  size: number; // 亮斑尺寸
  intensity: number; // 亮斑亮度
}

/**
 * 可配置参数（统一管理）
 */
export const ACCRETION_DISK_CONFIG = {
  // 吸积盘半径
  innerRadius: 3.0,   // 内半径（单位：rₛ）
  outerRadius: 12.0,  // 外半径（单位：rₛ）

  // 时间参数
  timeScale: 0.001,   // 时间缩放（1.0 = 真实时间，0.001 = 慢放1000倍）

  // 亮斑参数
  hotspots: {
    count: 300,       // 亮斑数量
    size: 5.0,        // 亮斑尺寸
    intensity: 1.0,   // 亮斑亮度
  } as HotspotConfig,
};

/**
 * 光线追踪器类
 * 管理光线追踪着色器材质
 */
export class RayTracer {
  private material!: THREE.ShaderMaterial;
  private geometry!: THREE.PlaneGeometry;
  private mesh!: THREE.Mesh;

  // Uniform 变量
  private uniforms = {
    uCameraPosition: { value: new THREE.Vector3(0, 0, 0) },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uFov: { value: 0 },
    uBlackHolePosition: { value: new THREE.Vector3(0, 0, 0) },
    uSchwarzschildRadius: { value: 0 },
    uUseBlackHoleEffect: { value: false }, // 是否使用黑洞引力效果
    uStarCubeMap: { value: null as THREE.CubeTexture | null }, // 星空 Cube Map
    uNebulaCubeMap: { value: null as THREE.CubeTexture | null }, // 星云 Cube Map
    uNebulaIntensity: { value: 1.0 }, // 星云强度 [0, 1]
    uMaxSteps: { value: 500 },
    uEscapeRadius: { value: 50.0 },
    // 吸积盘参数
    uAccretionDiskEnabled: { value: false }, // 是否启用吸积盘
    uDiskInnerRadius: { value: 0 }, // 吸积盘内半径（单位：rₛ）
    uDiskOuterRadius: { value: 0 }, // 吸积盘外半径（单位：rₛ）
    uTime: { value: 0 }, // 时间参数（秒）
    uTimeScale: { value: 0.001 }, // 时间缩放因子（默认慢放1000倍）
    // 亮斑参数
    uHotspotCount: { value: ACCRETION_DISK_CONFIG.hotspots.count }, // 亮斑数量
    uHotspotSize: { value: ACCRETION_DISK_CONFIG.hotspots.size }, // 亮斑尺寸
    uHotspotIntensity: { value: ACCRETION_DISK_CONFIG.hotspots.intensity }, // 亮斑亮度
  };

  // 图层常量
  private readonly MAIN_LAYER = 0; // 主图层（Quad）

  /**
   * 构造函数
   * @param scene Three.js 场景对象
   */
  constructor(scene: THREE.Scene) {
    // 分别生成星空和星云的 Cube Map
    this.uniforms.uStarCubeMap.value = StarField.generateCubeMap();
    this.uniforms.uNebulaCubeMap.value = NebulaField.generateCubeMap();
    this.createShader(scene);
  }

  /**
   * 创建着色器材质和全屏 Quad
   */
  private createShader(scene: THREE.Scene): void {
    // 创建平面几何体（覆盖全屏）
    this.geometry = new THREE.PlaneGeometry(2, 2);

    // 创建着色器材质
    this.material = new THREE.ShaderMaterial({
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      uniforms: this.uniforms,
      depthWrite: false,
      depthTest: false,
    });

    // 创建全屏 Quad 并添加到场景
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.layers.set(this.MAIN_LAYER);
    scene.add(this.mesh);
  }

  /**
   * 设置相机位置
   */
  setCameraPosition(pos: THREE.Vector3): void {
    this.uniforms.uCameraPosition.value.copy(pos);
  }

  /**
   * 设置视场角
   */
  setFov(fov: number): void {
    this.uniforms.uFov.value = fov;
  }

  /**
   * 设置黑洞位置
   */
  setBlackHolePosition(pos: THREE.Vector3): void {
    this.uniforms.uBlackHolePosition.value.copy(pos);
  }

  /**
   * 设置史瓦西半径
   */
  setSchwarzschildRadius(radius: number): void {
    this.uniforms.uSchwarzschildRadius.value = radius;
  }

  /**
   * 设置是否使用黑洞引力效果
   */
  setUseBlackHoleEffect(use: boolean): void {
    this.uniforms.uUseBlackHoleEffect.value = use;
  }

  /**
   * 设置分辨率
   */
  setResolution(width: number, height: number): void {
    this.uniforms.uResolution.value.set(width, height);
  }

  /**
   * 设置最大积分步数
   */
  setMaxSteps(steps: number): void {
    this.uniforms.uMaxSteps.value = steps;
  }

  /**
   * 设置逃逸半径（单位：rₛ）
   */
  setEscapeRadius(radius: number): void {
    this.uniforms.uEscapeRadius.value = radius;
  }

  /**
   * 设置是否启用吸积盘
   */
  setAccretionDiskEnabled(enabled: boolean): void {
    this.uniforms.uAccretionDiskEnabled.value = enabled;
  }

  /**
   * 设置吸积盘内半径（单位：rₛ）
   */
  setDiskInnerRadius(radius: number): void {
    this.uniforms.uDiskInnerRadius.value = radius;
  }

  /**
   * 设置吸积盘外半径（单位：rₛ）
   */
  setDiskOuterRadius(radius: number): void {
    this.uniforms.uDiskOuterRadius.value = radius;
  }

  /**
   * 设置时间参数
   */
  setTime(time: number): void {
    this.uniforms.uTime.value = time;
  }

  /**
   * 设置时间缩放因子
   */
  setTimeScale(scale: number): void {
    this.uniforms.uTimeScale.value = scale;
  }

  /**
   * 设置亮斑数量
   */
  setHotspotCount(count: number): void {
    this.uniforms.uHotspotCount.value = count;
  }

  /**
   * 设置亮斑尺寸
   */
  setHotspotSize(size: number): void {
    this.uniforms.uHotspotSize.value = size;
  }

  /**
   * 设置亮斑亮度
   */
  setHotspotIntensity(intensity: number): void {
    this.uniforms.uHotspotIntensity.value = intensity;
  }

  /**
   * 批量设置亮斑配置
   */
  setHotspotConfig(config: HotspotConfig): void {
    this.uniforms.uHotspotCount.value = config.count;
    this.uniforms.uHotspotSize.value = config.size;
    this.uniforms.uHotspotIntensity.value = config.intensity;
  }

  /**
   * 设置星云强度
   * @param intensity 星云强度 [0, 1]，0 表示只显示星空，1 表示星云全强度
   */
  setNebulaIntensity(intensity: number): void {
    this.uniforms.uNebulaIntensity.value = Math.max(0, Math.min(1, intensity));
  }

  /**
   * 销毁资源
   */
  dispose(): void {
    if (this.mesh) {
      this.mesh.geometry.dispose();
      (this.mesh.material as THREE.ShaderMaterial).dispose();
    }
    if (this.geometry) {
      this.geometry.dispose();
    }
    if (this.material) {
      this.material.dispose();
    }
    if (this.uniforms.uStarCubeMap.value) {
      this.uniforms.uStarCubeMap.value.dispose();
    }
    if (this.uniforms.uNebulaCubeMap.value) {
      this.uniforms.uNebulaCubeMap.value.dispose();
    }
  }
}
