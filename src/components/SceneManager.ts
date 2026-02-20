import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GUI } from "lil-gui";
import { RayTracer } from "./RayTracer";

/**
 * 场景管理类
 * 负责管理整个 Three.js 场景
 */
export class SceneManager {
  private scene!: THREE.Scene;
  private debugScene!: THREE.Scene; // 调试场景（坐标轴等）
  private camera!: THREE.PerspectiveCamera;
  private orthoCamera!: THREE.OrthographicCamera;
  private renderer!: THREE.WebGLRenderer;
  private controls!: OrbitControls;
  private gui!: GUI;
  private rayTracer!: RayTracer;
  private cameraControllers: any[] = []; // 保存相机位置相关的GUI控制器
  private axesHelper!: THREE.AxesHelper; // 坐标轴辅助线
  private clock = new THREE.Clock(); // 时钟（用于动画）

  // 图层常量
  private readonly MAIN_LAYER = 0; // 主图层（Quad）
  private readonly DEBUG_LAYER = 1; // 调试图层（坐标轴）

  private readonly AXIS_SCALE = 4.2; // 坐标轴辅助线缩放比例

  // 配置参数
  private params = {
    cameraPosition: { x: 0, y: 4, z: 40 }, // 单位：Rs
    fov: 60,
    showAxes: false, // 是否显示坐标轴
    useBlackHoleEffect: true, // 是否使用黑洞引力效果（默认开启）
    blackHole: {
      mass: 10, // 黑洞质量（太阳质量单位）
      position: { x: 0, y: 0, z: 0 }, // 黑洞位置（单位：km）
    },
    accretionDisk: {
      enabled: true, // 是否启用吸积盘（默认开启）
      innerRadius: 3, // 内半径（单位：rₛ）
      outerRadius: 12, // 外半径（单位：rₛ）
      timeScale: 0.5, // 时间缩放因子（控制吸积盘旋转速度）
      hotspots: {
        count: 500, // 亮斑数量
        size: 10.0, // 亮斑尺寸
        intensity: 1.5, // 亮斑亮度
      },
    },
  };

  // 物理常数
  private readonly SOLAR_MASS_TO_KM = 2.954; // 1太阳质量 ≈ 2.954公里史瓦西半径

  /**
   * 初始化场景
   */
  init(): void {
    this.createScene();
    this.createDebugScene();
    this.createCamera();
    this.createOrthoCamera();
    this.createRenderer();
    this.createControls();
    this.createRayTracer();
    this.createGUI();
    this.animate();

    // 窗口大小调整
    window.addEventListener("resize", this.onWindowResize.bind(this));
  }

  /**
   * 创建场景
   */
  private createScene(): void {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);
  }

  /**
   * 创建调试场景（用于显示坐标轴等辅助线）
   */
  private createDebugScene(): void {
    this.debugScene = new THREE.Scene();

    const schwarzschildRadius =
      this.params.blackHole.mass * this.SOLAR_MASS_TO_KM;
    // 创建坐标轴辅助线（X:红, Y:绿, Z:蓝）
    this.axesHelper = new THREE.AxesHelper(
      this.AXIS_SCALE * schwarzschildRadius,
    );
    this.axesHelper.visible = this.params.showAxes;
    this.axesHelper.layers.set(this.DEBUG_LAYER);
    this.debugScene.add(this.axesHelper);
  }

  /**
   * 创建相机
   */
  private createCamera(): void {
    const container = document.getElementById("canvas-container");
    if (!container) return;

    const aspect = container.clientWidth / container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(
      this.params.fov,
      aspect,
      0.1,
      100000,
    );
    const schwarzschildRadius =
      this.params.blackHole.mass * this.SOLAR_MASS_TO_KM;
    this.camera.position.set(
      this.params.cameraPosition.x * schwarzschildRadius,
      this.params.cameraPosition.y * schwarzschildRadius,
      this.params.cameraPosition.z * schwarzschildRadius,
    );
    // 透视相机只渲染调试图层（坐标轴）
    this.camera.layers.enable(this.DEBUG_LAYER);
    this.camera.layers.disable(this.MAIN_LAYER);
  }

  /**
   * 创建正交相机（用于渲染全屏Quad）
   */
  private createOrthoCamera(): void {
    this.orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    // 正交相机只渲染主图层（Quad）
    this.orthoCamera.layers.enable(this.MAIN_LAYER);
    this.orthoCamera.layers.disable(this.DEBUG_LAYER);
  }

  /**
   * 创建渲染器
   */
  private createRenderer(): void {
    const container = document.getElementById("canvas-container");
    if (!container) return;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);
  }

  /**
   * 创建轨道控制器
   */
  private createControls(): void {
    const schwarzschildRadius =
      this.params.blackHole.mass * this.SOLAR_MASS_TO_KM;
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = 0.5 * schwarzschildRadius; // 最小距离：0.5个史瓦西半径
    this.controls.maxDistance = 1000 * schwarzschildRadius; // 最大距离：1000个史瓦西半径
  }

  /**
   * 创建光线追踪器
   */
  private createRayTracer(): void {
    this.rayTracer = new RayTracer(this.scene);

    this.rayTracer.setUseBlackHoleEffect(this.params.useBlackHoleEffect);
    this.rayTracer.setAccretionDiskEnabled(this.params.accretionDisk.enabled);
    this.rayTracer.setDiskInnerRadius(this.params.accretionDisk.innerRadius);
    this.rayTracer.setDiskOuterRadius(this.params.accretionDisk.outerRadius);
    this.rayTracer.setTimeScale(this.params.accretionDisk.timeScale);
    this.updateHotspotConfig(); // 初始化亮斑配置
    this.updateBlackHoleParams();

    // 设置初始分辨率
    const container = document.getElementById("canvas-container");
    if (container) {
      this.rayTracer.setResolution(
        container.clientWidth,
        container.clientHeight,
      );
    }
  }

  /**
   * 更新黑洞参数
   */
  private updateBlackHoleParams(): void {
    const schwarzschildRadius =
      this.params.blackHole.mass * this.SOLAR_MASS_TO_KM;
    this.rayTracer.setBlackHolePosition(
      new THREE.Vector3(
        this.params.blackHole.position.x,
        this.params.blackHole.position.y,
        this.params.blackHole.position.z,
      ),
    );
    this.rayTracer.setSchwarzschildRadius(schwarzschildRadius);

    // 质量改变时，同步更新相机位置（保持相对于史瓦西半径的比例）
    this.camera.position.set(
      this.params.cameraPosition.x * schwarzschildRadius,
      this.params.cameraPosition.y * schwarzschildRadius,
      this.params.cameraPosition.z * schwarzschildRadius,
    );

    // 更新轨道控制器的距离限制
    this.controls.minDistance = 0.5 * schwarzschildRadius;
    this.controls.maxDistance = 1000 * schwarzschildRadius;

    // 更新坐标轴辅助线的大小（5倍史瓦西半径）
    this.debugScene.remove(this.axesHelper);
    this.axesHelper.dispose();
    this.axesHelper = new THREE.AxesHelper(
      this.AXIS_SCALE * schwarzschildRadius,
    );
    this.axesHelper.visible = this.params.showAxes;
    this.axesHelper.layers.set(this.DEBUG_LAYER);
    this.debugScene.add(this.axesHelper);
  }

  /**
   * 更新亮斑配置
   */
  private updateHotspotConfig(): void {
    this.rayTracer.setHotspotConfig(this.params.accretionDisk.hotspots);
  }

  /**
   * 创建 GUI 控制面板
   */
  private createGUI(): void {
    this.gui = new GUI({ title: "控制面板" });

    // 调试控制
    const debugFolder = this.gui.addFolder("调试");
    debugFolder
      .add(this.params, "showAxes")
      .name("显示坐标轴")
      .onChange(() => {
        this.axesHelper.visible = this.params.showAxes;
      });
    debugFolder
      .add(this.params, "useBlackHoleEffect")
      .name("黑洞引力效果")
      .onChange(() => {
        this.rayTracer.setUseBlackHoleEffect(this.params.useBlackHoleEffect);
      });
    debugFolder.open();

    // 相机控制
    const cameraFolder = this.gui.addFolder("相机");
    const ctrlX = cameraFolder
      .add(this.params.cameraPosition, "x", -500, 500)
      .name("X 位置（Rs）")
      .onChange(() => {
        const schwarzschildRadius =
          this.params.blackHole.mass * this.SOLAR_MASS_TO_KM;
        this.camera.position.x =
          this.params.cameraPosition.x * schwarzschildRadius;
        this.rayTracer.setCameraPosition(this.camera.position);
      });
    this.cameraControllers.push(ctrlX);

    const ctrlY = cameraFolder
      .add(this.params.cameraPosition, "y", -500, 500)
      .name("Y 位置（Rs）")
      .onChange(() => {
        const schwarzschildRadius =
          this.params.blackHole.mass * this.SOLAR_MASS_TO_KM;
        this.camera.position.y =
          this.params.cameraPosition.y * schwarzschildRadius;
        this.rayTracer.setCameraPosition(this.camera.position);
      });
    this.cameraControllers.push(ctrlY);

    const ctrlZ = cameraFolder
      .add(this.params.cameraPosition, "z", 0.5, 1000)
      .name("Z 位置（Rs）")
      .onChange(() => {
        const schwarzschildRadius =
          this.params.blackHole.mass * this.SOLAR_MASS_TO_KM;
        this.camera.position.z =
          this.params.cameraPosition.z * schwarzschildRadius;
        this.rayTracer.setCameraPosition(this.camera.position);
      });
    this.cameraControllers.push(ctrlZ);

    cameraFolder
      .add(this.params, "fov", 30, 120)
      .name("视场角")
      .onChange(() => {
        this.camera.fov = this.params.fov;
        this.camera.updateProjectionMatrix();
        this.rayTracer.setFov(this.params.fov);
      });
    cameraFolder.open();

    // 黑洞控制
    const blackHoleFolder = this.gui.addFolder("黑洞");
    blackHoleFolder
      .add(this.params.blackHole, "mass", 1, 10000000)
      .name("质量 (M☉)")
      .onChange(() => {
        this.updateBlackHoleParams();
      });
    blackHoleFolder
      .add(this.params.blackHole.position, "x", -500, 500)
      .name("位置 X")
      .onChange(() => {
        this.updateBlackHoleParams();
      });
    blackHoleFolder
      .add(this.params.blackHole.position, "y", -500, 500)
      .name("位置 Y")
      .onChange(() => {
        this.updateBlackHoleParams();
      });
    blackHoleFolder
      .add(this.params.blackHole.position, "z", -500, 500)
      .name("位置 Z")
      .onChange(() => {
        this.updateBlackHoleParams();
      });
    blackHoleFolder.open();

    // 吸积盘控制
    const accretionDiskFolder = this.gui.addFolder("吸积盘");
    accretionDiskFolder
      .add(this.params.accretionDisk, "enabled")
      .name("启用吸积盘")
      .onChange(() => {
        this.rayTracer.setAccretionDiskEnabled(
          this.params.accretionDisk.enabled,
        );
      });
    accretionDiskFolder
      .add(this.params.accretionDisk, "innerRadius", 3, 6)
      .name("内半径 (rₛ)")
      .onChange(() => {
        this.rayTracer.setDiskInnerRadius(
          this.params.accretionDisk.innerRadius,
        );
      });
    accretionDiskFolder
      .add(this.params.accretionDisk, "outerRadius", 8, 20)
      .name("外半径 (rₛ)")
      .onChange(() => {
        this.rayTracer.setDiskOuterRadius(
          this.params.accretionDisk.outerRadius,
        );
      });

    // 添加时间缩放控制（使用对数刻度）
    const timeScaleController = accretionDiskFolder
      .add(this.params.accretionDisk, "timeScale", 0.0001, 1.0)
      .name("时间缩放")
      .onChange(() => {
        this.rayTracer.setTimeScale(this.params.accretionDisk.timeScale);
      });

    // 亮斑控制
    const hotspotFolder = accretionDiskFolder.addFolder("亮斑配置");
    hotspotFolder
      .add(this.params.accretionDisk.hotspots, "count", 0, 1000, 10)
      .name("数量")
      .onChange(() => {
        this.updateHotspotConfig();
      });
    hotspotFolder
      .add(this.params.accretionDisk.hotspots, "size", 0.1, 10, 0.1)
      .name("尺寸")
      .onChange(() => {
        this.updateHotspotConfig();
      });
    hotspotFolder
      .add(this.params.accretionDisk.hotspots, "intensity", 0.1, 5, 0.1)
      .name("亮度")
      .onChange(() => {
        this.updateHotspotConfig();
      });
    hotspotFolder.close();

    accretionDiskFolder.open();
  }

  /**
   * 窗口大小调整处理
   */
  private onWindowResize(): void {
    const container = document.getElementById("canvas-container");
    if (!container) return;

    this.camera.aspect = container.clientWidth / container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.rayTracer.setResolution(container.clientWidth, container.clientHeight);
  }

  /**
   * 动画循环
   */
  private animate(): void {
    requestAnimationFrame(this.animate.bind(this));

    // 更新控制器
    this.controls.update();

    // 更新时间参数
    const elapsedTime = this.clock.getElapsedTime();
    this.rayTracer.setTime(elapsedTime);

    // 同步相机位置到参数（用于GUI显示）
    const schwarzschildRadius =
      this.params.blackHole.mass * this.SOLAR_MASS_TO_KM;

    this.params.cameraPosition.x =
      Math.round((this.camera.position.x / schwarzschildRadius) * 10000) /
      10000;
    this.params.cameraPosition.y =
      Math.round((this.camera.position.y / schwarzschildRadius) * 10000) /
      10000;
    this.params.cameraPosition.z =
      Math.round((this.camera.position.z / schwarzschildRadius) * 10000) /
      10000;

    // 更新GUI显示
    this.cameraControllers.forEach((ctrl) => ctrl.updateDisplay());
    // 更新着色器的相机参数
    this.rayTracer.setCameraPosition(this.camera.position);
    this.rayTracer.setFov(this.params.fov);

    // 使用正交相机渲染全屏Quad（光线追踪效果）
    this.renderer.render(this.scene, this.orthoCamera);

    // 如果启用坐标轴，用透视相机渲染调试图层
    if (this.params.showAxes) {
      this.renderer.autoClear = false;
      this.renderer.clearDepth();
      this.renderer.render(this.debugScene, this.camera);
      this.renderer.autoClear = true;
    }
  }
}
