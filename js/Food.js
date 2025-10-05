import * as THREE from "three";

export class Food {
  constructor(scene, textureLoader, modelLoader) {
    this.scene = scene;
    this.textureLoader = textureLoader;
    this.modelLoader = modelLoader;
    this.mesh = null;
    this.position = new THREE.Vector3();
    this.gridSize = 20;
    this.isInitialized = false;
    this.lastSpawnPosition = null;
    this.use3DModel = true; // Flag untuk gunakan 3D model

    this.initializeFood();
  }

  async initializeFood() {
    try {
      // Coba load 3D model apple terlebih dahulu
      if (this.use3DModel) {
        await this.loadAppleModel();
      }
    } catch (error) {
      console.log("3D model not available, using fallback food");
      this.createFallbackFood();
    }

    // Jika 3D model gagal, buat fallback
    if (!this.mesh) {
      this.createFallbackFood();
    }

    this.scene.add(this.mesh);
    this.respawn(this.gridSize);
    this.isInitialized = true;
  }

  async loadAppleModel() {
    return new Promise((resolve, reject) => {
      this.modelLoader.load(
        "assets/models/apple.glb",
        (gltf) => {
          const model = gltf.scene;

          // Optimize model settings
          model.scale.set(0.8, 0.8, 0.8);
          model.castShadow = true;
          model.receiveShadow = true;

          // Enable shadows untuk semua children
          model.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });

          // Add glow effect
          this.addGlowEffect(model);

          this.mesh = model;
          console.log("🍎 3D Apple model loaded successfully");
          resolve();
        },
        undefined,
        (error) => {
          console.error("Failed to load apple model:", error);
          reject(error);
        }
      );
    });
  }

  addGlowEffect(model) {
    const glowLight = new THREE.PointLight(0xff4757, 0.6, 4);
    glowLight.position.set(0, 0.5, 0);
    model.add(glowLight);
  }

  createFallbackFood() {
    const group = new THREE.Group();

    // Main food body - lebih detail
    const geometry = new THREE.SphereGeometry(0.5, 32, 32);
    const material = new THREE.MeshPhongMaterial({
      color: 0xff4757,
      emissive: 0xff0000,
      emissiveIntensity: 0.3,
      shininess: 100,
      specular: 0x222222,
    });

    const foodMesh = new THREE.Mesh(geometry, material);
    foodMesh.castShadow = true;
    group.add(foodMesh);

    // Enhanced leaf dengan lebih detail
    this.createEnhancedLeaf(group);

    // Enhanced stem
    this.createEnhancedStem(group);

    // Glow effect
    const glowLight = new THREE.PointLight(0xff4757, 0.8, 3);
    group.add(glowLight);

    this.mesh = group;
  }

  createEnhancedLeaf(group) {
    const leafGroup = new THREE.Group();

    // Leaf base
    const leafGeometry = new THREE.ConeGeometry(0.25, 0.5, 8);
    const leafMaterial = new THREE.MeshPhongMaterial({
      color: 0x00ff00,
      shininess: 40,
      specular: 0x111111,
    });

    const leaf = new THREE.Mesh(leafGeometry, leafMaterial);
    leaf.rotation.z = Math.PI / 6;
    leafGroup.add(leaf);

    // Leaf detail
    const detailGeometry = new THREE.SphereGeometry(0.1, 6, 6);
    const detail = new THREE.Mesh(detailGeometry, leafMaterial);
    detail.position.set(0.1, 0.3, 0);
    detail.scale.set(1.5, 0.8, 1);
    leafGroup.add(detail);

    leafGroup.position.set(0.3, 0.5, 0);
    group.add(leafGroup);
  }

  createEnhancedStem(group) {
    const stemGeometry = new THREE.CylinderGeometry(0.04, 0.06, 0.25, 8);
    const stemMaterial = new THREE.MeshPhongMaterial({
      color: 0x5d4037,
      shininess: 20,
    });

    const stem = new THREE.Mesh(stemGeometry, stemMaterial);
    stem.position.set(0.15, 0.6, 0);
    stem.rotation.z = Math.PI / 6;
    group.add(stem);
  }

  respawn(gridSize = 20) {
    if (!this.isInitialized || !this.mesh) return;

    this.gridSize = gridSize;
    const bounds = this.calculateSpawnBounds();

    let newPosition;
    let attempts = 0;
    const maxAttempts = 8; // Reduced further for performance

    const spawnZone = this.getWeightedRandomZone([0.35, 0.25, 0.25, 0.15]);

    do {
      newPosition = this.generatePositionByZone(spawnZone, bounds);
      attempts++;

      if (attempts >= maxAttempts) {
        newPosition = this.generateFallbackPosition(bounds);
        break;
      }
    } while (
      this.isTooCloseToLastPosition(newPosition) &&
      attempts < maxAttempts
    );

    this.updatePosition(newPosition, spawnZone, attempts);
  }

  calculateSpawnBounds() {
    const halfGrid = this.gridSize / 2;
    const margin = 3;

    return {
      minX: -halfGrid + margin,
      maxX: halfGrid - margin,
      minY: 3,
      maxY: this.gridSize - 3,
      minZ: -halfGrid + margin,
      maxZ: halfGrid - margin,
      halfGrid: halfGrid,
    };
  }

  getWeightedRandomZone(weights) {
    const random = Math.random();
    let sum = 0;

    for (let i = 0; i < weights.length; i++) {
      sum += weights[i];
      if (random <= sum) return i;
    }

    return weights.length - 1;
  }

  generatePositionByZone(zone, bounds) {
    switch (zone) {
      case 0:
        return this.generateCenterPosition(bounds);
      case 1:
        return this.generateCornerPosition(bounds);
      case 2:
        return this.generateEdgePosition(bounds);
      case 3:
        return this.generateRandomPosition(bounds);
      default:
        return this.generateRandomPosition(bounds);
    }
  }

  generateCenterPosition(bounds) {
    const centerSize = Math.min(8, this.gridSize * 0.4);
    return new THREE.Vector3(
      (Math.random() - 0.5) * centerSize,
      bounds.minY +
        (bounds.maxY - bounds.minY) * 0.3 +
        Math.random() * (bounds.maxY - bounds.minY) * 0.4,
      (Math.random() - 0.5) * centerSize
    );
  }

  generateCornerPosition(bounds) {
    const corners = [
      [bounds.minX, bounds.minY, bounds.minZ],
      [bounds.minX, bounds.minY, bounds.maxZ],
      [bounds.maxX, bounds.minY, bounds.minZ],
      [bounds.maxX, bounds.minY, bounds.maxZ],
      [bounds.minX, bounds.maxY, bounds.minZ],
      [bounds.minX, bounds.maxY, bounds.maxZ],
      [bounds.maxX, bounds.maxY, bounds.minZ],
      [bounds.maxX, bounds.maxY, bounds.maxZ],
      [bounds.minX, (bounds.minY + bounds.maxY) / 2, bounds.minZ],
      [bounds.minX, (bounds.minY + bounds.maxY) / 2, bounds.maxZ],
      [bounds.maxX, (bounds.minY + bounds.maxY) / 2, bounds.minZ],
      [bounds.maxX, (bounds.minY + bounds.maxY) / 2, bounds.maxZ],
    ];

    const [baseX, baseY, baseZ] =
      corners[Math.floor(Math.random() * corners.length)];
    const offset = 1.2;

    return new THREE.Vector3(
      baseX + (Math.random() - 0.5) * offset,
      baseY + (Math.random() - 0.5) * offset,
      baseZ + (Math.random() - 0.5) * offset
    );
  }

  generateEdgePosition(bounds) {
    const edge = Math.floor(Math.random() * 6);
    const heightTiers = [
      bounds.minY + 2,
      (bounds.minY + bounds.maxY) / 2,
      bounds.maxY - 2,
    ];
    const randomHeight =
      heightTiers[Math.floor(Math.random() * heightTiers.length)];

    switch (edge) {
      case 0:
        return new THREE.Vector3( // Bottom
          bounds.minX + Math.random() * (bounds.maxX - bounds.minX),
          bounds.minY + 1.2,
          bounds.minZ + Math.random() * (bounds.maxZ - bounds.minZ)
        );
      case 1:
        return new THREE.Vector3( // Top
          bounds.minX + Math.random() * (bounds.maxX - bounds.minX),
          bounds.maxY - 1.2,
          bounds.minZ + Math.random() * (bounds.maxZ - bounds.minZ)
        );
      case 2:
        return new THREE.Vector3( // Left
          bounds.minX + 1.2,
          randomHeight,
          bounds.minZ + Math.random() * (bounds.maxZ - bounds.minZ)
        );
      case 3:
        return new THREE.Vector3( // Right
          bounds.maxX - 1.2,
          randomHeight,
          bounds.minZ + Math.random() * (bounds.maxZ - bounds.minZ)
        );
      case 4:
        return new THREE.Vector3( // Back
          bounds.minX + Math.random() * (bounds.maxX - bounds.minX),
          randomHeight,
          bounds.minZ + 1.2
        );
      default:
        return new THREE.Vector3( // Front
          bounds.minX + Math.random() * (bounds.maxX - bounds.minX),
          randomHeight,
          bounds.maxZ - 1.2
        );
    }
  }

  generateRandomPosition(bounds) {
    return new THREE.Vector3(
      bounds.minX + Math.random() * (bounds.maxX - bounds.minX),
      bounds.minY + Math.random() * (bounds.maxY - bounds.minY),
      bounds.minZ + Math.random() * (bounds.maxZ - bounds.minZ)
    );
  }

  generateFallbackPosition(bounds) {
    return new THREE.Vector3(
      (bounds.minX + bounds.maxX) / 2 + (Math.random() - 0.5) * 3,
      (bounds.minY + bounds.maxY) / 2 + (Math.random() - 0.5) * 3,
      (bounds.minZ + bounds.maxZ) / 2 + (Math.random() - 0.5) * 3
    );
  }

  isTooCloseToLastPosition(newPosition) {
    if (!this.lastSpawnPosition) return false;
    return newPosition.distanceTo(this.lastSpawnPosition) < 4;
  }

  updatePosition(newPosition, zone, attempts) {
    this.position.copy(newPosition);
    this.lastSpawnPosition = this.position.clone();

    console.log(
      `🍎 Food spawned at: [${this.position.x.toFixed(
        1
      )}, ${this.position.y.toFixed(1)}, ${this.position.z.toFixed(
        1
      )}] (zone: ${zone}, attempt: ${attempts})`
    );

    this.mesh.position.copy(this.position);
    this.animateSpawn();
  }

  animateSpawn() {
    if (!this.isInitialized || !this.mesh || typeof TWEEN === "undefined")
      return;

    // Reset state
    this.mesh.scale.set(0.1, 0.1, 0.1);
    this.mesh.rotation.set(0, 0, 0);

    // Clean previous animations
    TWEEN.removeAll();

    // Scale animation
    new TWEEN.Tween(this.mesh.scale)
      .to({ x: 1, y: 1, z: 1 }, 600)
      .easing(TWEEN.Easing.Elastic.Out)
      .start();

    // Rotation animation
    new TWEEN.Tween(this.mesh.rotation)
      .to({ x: Math.PI * 0.1, y: Math.PI * 4, z: Math.PI * 0.05 }, 1200)
      .easing(TWEEN.Easing.Cubic.Out)
      .start();

    // Floating animation (conditional)
    if (
      this.position.y > this.gridSize * 0.2 &&
      this.position.y < this.gridSize * 0.8
    ) {
      this.startFloatingAnimation();
    }
  }

  startFloatingAnimation() {
    const originalY = this.mesh.position.y;
    new TWEEN.Tween(this.mesh.position)
      .to({ y: originalY + 0.3 }, 2000)
      .easing(TWEEN.Easing.Sinusoidal.InOut)
      .yoyo(true)
      .repeat(Infinity)
      .start();
  }

  getPosition() {
    return this.isInitialized && this.mesh
      ? this.position
      : new THREE.Vector3(0, 5, 0);
  }

  destroy() {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      if (typeof TWEEN !== "undefined") {
        TWEEN.removeAll();
      }
    }
  }
}
