varying vec2 vUv;

// Uniform 变量
uniform vec3 uCameraPosition;
uniform vec2 uResolution;
uniform float uFov;
uniform vec3 uBlackHolePosition;
uniform float uSchwarzschildRadius;
uniform bool uUseBlackHoleEffect;
uniform samplerCube uStarCubeMap;      // 星空 Cube Map
uniform samplerCube uNebulaCubeMap;     // 星云 Cube Map
uniform float uNebulaIntensity;         // 星云强度 [0, 1]
uniform int uMaxSteps;
uniform float uEscapeRadius;
// 吸积盘参数
uniform bool uAccretionDiskEnabled;
uniform float uDiskInnerRadius;
uniform float uDiskOuterRadius;
uniform float uTime;       // 时间参数（秒）
uniform float uTimeScale;  // 时间缩放因子（1.0 = 真实时间，0.001 = 慢放1000倍）
// 亮斑配置参数
uniform int uHotspotCount;      // 亮斑数量
uniform float uHotspotSize;     // 亮斑尺寸
uniform float uHotspotIntensity; // 亮斑亮度

/**
 * 简单的伪随机函数
 */
float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

/**
 * 2D 噪声函数
 */
float noise(vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);

    // 四个角的随机值
    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));

    // 平滑插值
    vec2 u = f * f * (3.0 - 2.0 * f);

    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

/**
 * 分形布朗运动（FBM）- 用于生成云状纹理
 */
float fbm(vec2 st) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;

    for (int i = 0; i < 6; i++) {
        value += amplitude * noise(st * frequency);
        st *= 2.0;
        amplitude *= 0.5;
    }

    return value;
}

/**
 * 生成吸积盘纹理颜色
 * @param position 交点位置
 * @return RGB 颜色
 */
vec3 getAccretionDiskColor(vec3 position) {
    // 计算到黑洞中心的距离（xz 平面）
    vec2 fromCenter = position.xz - uBlackHolePosition.xz;
    float r = length(fromCenter);

    // 归一化半径（0 = 内半径，1 = 外半径）
    float innerRadius = uDiskInnerRadius * uSchwarzschildRadius;
    float outerRadius = uDiskOuterRadius * uSchwarzschildRadius;
    float normalizedRadius = (r - innerRadius) / (outerRadius - innerRadius);

    // 计算极坐标角度
    float angle = atan(fromCenter.y, fromCenter.x);

    // 计算旋转角度（统一旋转速度，逆时针）
    // 使用时间缩放因子来控制视觉上的旋转速度
    float rotationAngle = angle - uTime * uTimeScale;

    // 转换回笛卡尔坐标用于纹理采样
    vec2 texCoord = vec2(cos(rotationAngle), sin(rotationAngle)) * r * 4.0;

    // === 多层噪声纹理 ===
    // 粗糙纹理（大尺度结构）
    float coarsePattern = fbm(texCoord * 0.5);

    // 细节纹理（小尺度细节）
    float detailPattern = fbm(texCoord * 2.0 + 10.0);

    // 径向噪声（增加径向变化）
    float radialNoise = fbm(vec2(normalizedRadius * 5.0, angle * 3.0));

    // 组合多层噪声，增强对比度
    float combinedNoise = coarsePattern * 0.6 + detailPattern * 0.3 + radialNoise * 0.1;
    // 增强对比度
    combinedNoise = pow(combinedNoise, 1.5);

    // === 增强螺旋臂结构 ===
    float spiralPhase = r * 3.0 - rotationAngle * 3.0;
    float spiral = sin(spiralPhase) * 0.5 + 0.5;
    float spiral2 = sin(spiralPhase * 1.5 + 1.0) * 0.5 + 0.5;
    float spiralCombined = spiral * 0.7 + spiral2 * 0.3;

    // 螺旋臂强度：随半径变化
    float spiralIntensity = (1.0 - normalizedRadius * 0.5) * 0.5;
    float patternWithSpiral = combinedNoise + spiralCombined * spiralIntensity;

    // === 增加随机亮斑（热点）===
    // 亮斑根据其轨道半径以不同的角速度旋转（开普勒轨道）
    // 内圈密度更高，所以亮斑更多；外圈密度低，亮斑更少
    float hotspots = 0.0;
    float hotspotSeed = 42.0;  // 随机种子

    // 生成亮斑（GLSL循环需要常量，所以用固定上限，通过条件判断控制数量）
    const int MAX_HOTSPOTS = 1000;
    for (int i = 0; i < MAX_HOTSPOTS; i++) {
        // 只处理配置数量的亮斑
        if (i >= uHotspotCount) break;

        float seed = float(i) + hotspotSeed;

        // 随机位置（使用平方根分布使内圈亮斑更多）
        float radiusOffset = sqrt(random(vec2(seed, 1.0))) * 0.8;
        float hotspotR = innerRadius + radiusOffset * (outerRadius - innerRadius);

        // 计算到黑洞中心的归一化距离（0=内圈，1=外圈）
        float normalizedR = (hotspotR - innerRadius) / (outerRadius - innerRadius);

        // 外圈亮斑概率更低（密度递减）
        float densityFactor = 1.0 - normalizedR * 0.7;  // 外圈密度降低到30%
        if (random(vec2(seed, 4.0)) > densityFactor) {
            continue;  // 跳过这个亮斑
        }

        float angleOffset = random(vec2(seed, 0.0)) * 6.28318;

        // 计算亮斑的角速度（基于开普勒第三定律）
        // 角速度 ω = v/r ∝ 1/r^(3/2)
        // 归一化半径下的角速度因子
        float absNormalizedR = hotspotR / uSchwarzschildRadius;
        float angularVelocity = 1.0 / pow(absNormalizedR, 1.5);

        // 计算当前旋转角度（初始角度 + 角速度 × 时间）
        float currentAngle = angleOffset - uTime * uTimeScale * angularVelocity;

        // 亮斑当前位置（与texCoord相同的坐标系）
        vec2 hotspotPos = vec2(cos(currentAngle), sin(currentAngle)) * hotspotR * 4.0;

        // 计算从采样点到亮斑中心的向量
        vec2 toSample = texCoord - hotspotPos;

        // 计算径向方向（从黑洞中心指向亮斑）
        vec2 radialDir = normalize(vec2(cos(currentAngle), sin(currentAngle)));

        // 计算切向方向（垂直于径向，沿旋转方向）
        vec2 tangentDir = vec2(-radialDir.y, radialDir.x);

        // 将向量分解到径向和切向
        float radialDist = dot(toSample, radialDir);
        float tangentDist = dot(toSample, tangentDir);

        // 亮斑大小（使用uniform配置）
        float hotspotSize = uHotspotSize;

        // 椭圆拉伸：切向方向是径向的2倍长度（沿运动方向拉长）
        float stretchFactor = 2.0;

        // 计算椭圆距离
        float radialTerm = (radialDist * radialDist) / (hotspotSize * hotspotSize);
        float tangentTerm = (tangentDist * tangentDist) / (hotspotSize * hotspotSize * stretchFactor * stretchFactor);
        float ellipticalDist = sqrt(radialTerm + tangentTerm);

        // 使用椭圆距离的高斯衰减
        float hotspot = exp(-ellipticalDist * ellipticalDist);

        // 亮斑强度（内圈更亮，使用uniform配置作为基准）
        // 添加脉动效果：每个亮斑有独立的相位和频率
        float pulsePhase = seed * 13.7;  // 随机相位
        float pulseSpeed = 2.0 + random(vec2(seed, 5.0)) * 3.0;  // 随机脉动速度
        float pulseBase = sin(uTime * pulseSpeed + pulsePhase) * 0.5 + 0.5;  // 0-1 周期变化

        // 添加随机闪烁（高频变化）
        float flickerSpeed = 10.0 + random(vec2(seed, 6.0)) * 15.0;
        float flicker = sin(uTime * flickerSpeed + seed * 7.3) * 0.5 + 0.5;

        // 组合脉动和闪烁
        float pulsation = mix(pulseBase * 0.7 + 0.3, flicker, 0.3);  // 70%脉动 + 30%闪烁

        float hotspotIntensity = uHotspotIntensity * (1.0 + (1.0 - normalizedR) * 0.5) * (0.5 + pulsation * 0.5);
        hotspots += hotspot * hotspotIntensity;
    }

    // === 添加径向条纹（模拟吸积流）===
    float rings = sin(normalizedRadius * 20.0 + coarsePattern * 2.0) * 0.5 + 0.5;
    float ringIntensity = 0.15 * (1.0 - normalizedRadius);

    // 组合所有纹理特征
    float finalPattern = patternWithSpiral + rings * ringIntensity;

    // === 颜色映射 ===
    // 基础颜色（橙金黄色吸积盘）
    vec3 color1 = vec3(1.0, 0.9, 0.3);  // 亮黄白色
    vec3 color2 = vec3(1.0, 0.6, 0.1);  // 金橙色
    vec3 color3 = vec3(0.9, 0.3, 0.0);  // 深橙红色
    vec3 color4 = vec3(0.6, 0.1, 0.0);  // 暗红色

    // 根据半径和噪声混合颜色
    vec3 baseColor = mix(color1, color2, normalizedRadius);
    baseColor = mix(baseColor, color3, finalPattern * 0.5);
    baseColor = mix(baseColor, color4, pow(finalPattern, 2.0) * 0.3);

    // 添加亮度变化（暗区更暗）
    float brightness = 0.7 + finalPattern * 0.8;
    baseColor *= brightness;

    // 内圈更亮（温度更高）
    float tempGradient = 1.0 - normalizedRadius * 0.6;
    baseColor *= tempGradient;

    // 添加边缘辉光
    float edgeGlow = smoothstep(0.0, 0.1, normalizedRadius) * smoothstep(1.0, 0.9, normalizedRadius);
    baseColor *= (0.8 + edgeGlow * 0.4);

    // === 亮斑单独处理：叠加亮白色 ===
    // 使用亮斑强度创建纯白色高光
    vec3 hotspotColor = vec3(1.2, 1.15, 1.0);  // 接近纯白色，略带暖色
    baseColor = mix(baseColor, hotspotColor, smoothstep(0.0, 2.0, hotspots));

    return baseColor;
}

/**
 * 计算吸积盘在指定位置的物质速度（开普勒轨道速度）
 * @param position 世界坐标位置（xz 平面）
 * @return 速度向量（单位：c，光速归一化为1）
 */
vec3 getDiskVelocity(vec3 position) {
    // 计算到黑洞中心的径向向量（xz 平面）
    vec2 fromCenter = position.xz - uBlackHolePosition.xz;
    float r = length(fromCenter);

    // 开普勒速度大小：v = c * sqrt(rs / (2r))
    // 我们使用归一化单位（c=1），所以直接是 beta
    float speed = sqrt(uSchwarzschildRadius / (2.0 * r));

    // 速度方向垂直于径向（逆时针旋转）
    // 在 xz 平面：如果径向是，切向速度就是
    vec2 radialDir = normalize(fromCenter);
    vec2 tangentDir = vec2(-radialDir.y, radialDir.x);

    return vec3(tangentDir * speed, 0.0);
}

/**
 * 计算相对论多普勒频移系数
 * @param velocity 物质速度向量（单位：c）
 * @param viewDir 观察方向（从物质指向相机，归一化）
 * @return 多普勒系数 D（>1 蓝移，<1 红移）
 */
float getDopplerFactor(vec3 velocity, vec3 viewDir) {
    float speed = length(velocity);
    float beta = speed;  // v/c（我们使用归一化单位，c=1）
    float gamma = 1.0 / sqrt(1.0 - beta * beta);

    // 计算速度方向与观察方向的夹角余弦值
    float cosTheta = dot(normalize(velocity), viewDir);

    // 多普勒系数：D = 1 / (gamma * (1 - beta * cosTheta))
    float D = 1.0 / (gamma * (1.0 - beta * cosTheta));

    return D;
}

/**
 * 根据多普勒系数调整颜色（物理准确）
 * @param baseColor 基础颜色
 * @param dopplerFactor 多普勒系数 D
 * @return 调整后的颜色
 */
vec3 applyDopplerEffect(vec3 baseColor, float dopplerFactor) {
    // 多普勒频移导致颜色的变化
    // D > 1（蓝移）：频率变高，颜色偏蓝，亮度增加
    // D < 1（红移）：频率变低，颜色偏红，亮度降低

    // 计算频移量：D - 1
    float shift = dopplerFactor - 1.0;

    // RGB 颜色偏移（红减蓝增）
    vec3 colorShift = vec3(-shift, 0.0, shift);
    vec3 shiftedColor = baseColor + colorShift;

    // 亮度调整（蓝移更亮，红移更暗）
    // 根据相对论，能量变化与频率成正比
    float brightness = dopplerFactor;
    shiftedColor *= brightness;

    // 钳制到有效范围
    return clamp(shiftedColor, 0.0, 1.0);
}

/**
 * 检测光线是否穿过吸积盘平面
 * 返回: 相交参数 t，如果不相交返回 -1
 * 吸积盘位于 xz 平面（y=0）
 */
float intersectAccretionDisk(vec3 rayOrigin, vec3 rayDir) {
    // 吸积盘位于 xz 平面（y=0），法向量为 (0, 1, 0)
    // 如果光线方向与平面平行，不相交
    if (abs(rayDir.y) < 0.0001) {
        return -1.0;
    }

    // 计算光线到 xz 平面的距离参数 t
    // 平面方程: y = 0
    // 光线方程: p(t) = origin + t * dir
    // 相交时: origin.y + t * dir.y = 0
    // 解得: t = -origin.y / dir.y
    float t = -rayOrigin.y / rayDir.y;

    // 如果 t < 0，交点在光线起点后面，不相交
    if (t < 0.0) {
        return -1.0;
    }

    // 计算交点位置
    vec3 intersection = rayOrigin + t * rayDir;

    // 计算交点到黑洞中心的距离（在 xz 平面上）
    float distanceToCenter = length(intersection.xz - uBlackHolePosition.xz);

    // 判断是否在内半径和外半径之间
    float innerRadius = uDiskInnerRadius * uSchwarzschildRadius;
    float outerRadius = uDiskOuterRadius * uSchwarzschildRadius;

    if (distanceToCenter >= innerRadius && distanceToCenter <= outerRadius) {
        return t;
    }

    return -1.0;
}

void flatSpaceRayMarching(inout vec3 rayOrigin, inout vec3 rayDir) {
    // 计算到黑洞中心的向量
    vec3 toBlackHole = rayOrigin - uBlackHolePosition;
    float curDistance = length(toBlackHole);

    // 自适应步长：越接近黑洞，步长越小
    float stepSize = curDistance * 0.05;
    stepSize = clamp(stepSize, 0.01, curDistance * 0.2);

    // 平直空间：光线方向不变，只更新位置
    rayOrigin += rayDir * stepSize;
}

void geodesicRayMarching(inout vec3 rayOrigin, inout vec3 rayDir) {
    // 计算到黑洞中心的向量
    vec3 rDir = rayOrigin - uBlackHolePosition;
    float rMod = length(rDir);

    // 自适应步长：越接近黑洞，步长越小
    float stepSize = rMod * 0.05;
    stepSize = clamp(stepSize, 0.01, rMod * 0.2);

    // 计算角动量 h = |r × d| (光线到黑洞中心的垂直距离)
    vec3 rCrossD = cross(rDir, rayDir);
    float h = length(rCrossD);
    float h2 = h * h;

    // 计算广义相对论加速度
    // a = -(3GM/c²) · h² / r⁵ · r̂
    // 其中 3GM/c² = 1.5 * r_s
    float r5 = rMod * rMod * rMod * rMod * rMod;
    float accelMag = -1.5 * uSchwarzschildRadius * h2 / r5;

    vec3 acceleration = rDir * accelMag;

    // 更新光线方向（光线被引力弯曲）
    rayDir = normalize(rayDir + acceleration * stepSize);

    // 更新光线位置
    rayOrigin += rayDir * stepSize;
}

vec3 rayMarching(vec3 rayOrigin, vec3 rayDir) {
    float lastDistance = length(uCameraPosition - uBlackHolePosition);
    vec3 lastPosition = rayOrigin; // 记录上一步的位置

    for (int i = 0; i < uMaxSteps; i++) {
        // 计算当前到黑洞的距离
        vec3 toBlackHole = rayOrigin - uBlackHolePosition;
        float curDistance = length(toBlackHole);

        // 终止条件1: 进入事件视界（优先级最高）
        if (curDistance <= uSchwarzschildRadius) {
            return vec3(0.0);
        }

        // 终止条件2: 光线距离黑洞大于逃逸半径, 且还在进一步远离黑洞
        if (curDistance > uSchwarzschildRadius * uEscapeRadius && lastDistance < curDistance) {
            break;
        }

        // 计算自适应步长
        float stepSize = curDistance * 0.05;
        stepSize = clamp(stepSize, 0.01, curDistance * 0.2);

        // 根据开关选择光线追踪算法
        if (uUseBlackHoleEffect) {
            // 执行测地线积分步进
            geodesicRayMarching(rayOrigin, rayDir);
        } else {
            // 使用平直空间（直线传播）
            flatSpaceRayMarching(rayOrigin, rayDir);
        }

        // 检测吸积盘相交（如果启用）
        // 检查光线是否刚刚穿过 xz 平面（y 坐标符号改变）
        if (uAccretionDiskEnabled && sign(lastPosition.y) != sign(rayOrigin.y)) {
            // 计算精确的交点位置（使用线性插值）
            // lastPosition.y 到 rayOrigin.y，找到 y=0 的点
            float t = -lastPosition.y / (rayOrigin.y - lastPosition.y);
            vec3 intersection = lastPosition + t * (rayOrigin - lastPosition);

            // 计算交点到黑洞中心的距离（在 xz 平面上）
            float distanceToCenter = length(intersection.xz - uBlackHolePosition.xz);

            // 判断是否在内半径和外半径之间
            float innerRadius = uDiskInnerRadius * uSchwarzschildRadius;
            float outerRadius = uDiskOuterRadius * uSchwarzschildRadius;

            if (distanceToCenter >= innerRadius && distanceToCenter <= outerRadius) {
                // 生成吸积盘程序化纹理颜色
                vec3 diskColor = getAccretionDiskColor(intersection);

                // 计算相机的右方向向量（屏幕向右）
                vec3 target = vec3(0.0, 0.0, 0.0);
                vec3 forward = normalize(target - uCameraPosition);
                vec3 cameraUp = vec3(0.0, 1.0, 0.0);
                vec3 cameraRight = normalize(cross(cameraUp, forward));

                // 计算从相机到交点的向量
                vec3 fromCamera = intersection - uCameraPosition;

                // 计算该点在相机右方向上的投影
                // 负值 = 左边（蓝移），正值 = 右边（红移）
                float screenPos = dot(fromCamera, cameraRight);

                // 计算到黑洞中心的距离，归一化到 [0, 1]
                float normalizedRadius = (distanceToCenter - innerRadius) / (outerRadius - innerRadius);

                // 根据半径调整多普勒强度：内圈更强，外圈更弱
                // 内圈速度快，多普勒效应更明显
                float baseDopplerStrength = 4.5;
                float radiusFactor = 1.0 - normalizedRadius * 0.9; // 外圈降为 40%
                float dopplerStrength = baseDopplerStrength * radiusFactor;

                // 根据屏幕位置计算多普勒因子
                // 左边：screenPos < 0 → 蓝移（D > 1）
                // 右边：screenPos > 0 → 红移（D < 1）
                float dopplerFactor = 1.0 - screenPos * dopplerStrength / length(fromCamera);

                // 应用多普勒效应到颜色
                vec3 finalColor = applyDopplerEffect(diskColor, dopplerFactor);

                return finalColor;
            }
        }

        // 更新上一帧的位置
        lastPosition = rayOrigin;
    }

    // 采样星空背景
    vec3 starColor = texture(uStarCubeMap, rayDir).rgb;

    // 采样星云背景（如果有）
    vec4 nebulaColor = texture(uNebulaCubeMap, rayDir);

    // 混合星空和星云
    // 星云有 alpha 通道，使用 alpha 混合
    // uNebulaIntensity 控制整体星云强度
    vec3 finalBgColor = starColor;
    if (nebulaColor.a > 0.0) {
        float alpha = nebulaColor.a * uNebulaIntensity;
        finalBgColor = mix(starColor, nebulaColor.rgb, alpha);
    }

    return finalBgColor;
}

void main() {
    // 将 UV 坐标转换到 -1 到 1 范围
    vec2 uv = (vUv * 2.0 - 1.0) * vec2(uResolution.x / uResolution.y, 1.0);

    // 根据视场角计算光线方向
    float fovRad = uFov * 3.14159265 / 180.0;
    float halfFov = fovRad * 0.5;

    // 相机看向原点
    vec3 target = vec3(0.0, 0.0, 0.0);
    vec3 forward = normalize(target - uCameraPosition);
    vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), forward));
    vec3 up = cross(forward, right);

    // 生成初始光线方向
    // 标准视锥体计算：使用 tan(halfFov) 计算边缘偏移
    vec3 rayDir = normalize(forward + (uv.x * right + uv.y * up) * tan(halfFov));
    vec3 rayOrigin = uCameraPosition;

    vec3 col = rayMarching(rayOrigin, rayDir);
    gl_FragColor = vec4(col, 1.0);
}
