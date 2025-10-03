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

    this.initializeFood();
  }

  initializeFood() {
    this.createFallbackFood();
    this.scene.add(this.mesh);
    this.respawn(this.gridSize);
    this.isInitialized = true;
  }

  createFallbackFood() {
    const group = new THREE.Group();

    // Main food body
    const geometry = new THREE.SphereGeometry(0.5, 16, 16);
    const material = new THREE.MeshPhongMaterial({
      color: 0xff4757,
      emissive: 0xff0000,
      emissiveIntensity: 0.4,
      shininess: 100,
    });

    const foodMesh = new THREE.Mesh(geometry, material);
    foodMesh.castShadow = true;
    group.add(foodMesh);

    // Leaf
    const leafGeometry = new THREE.ConeGeometry(0.2, 0.4, 8);
    const leafMaterial = new THREE.MeshPhongMaterial({
      color: 0x00ff00,
      shininess: 30,
    });
    const leaf = new THREE.Mesh(leafGeometry, leafMaterial);
    leaf.position.set(0.3, 0.5, 0);
    leaf.rotation.z = Math.PI / 6;
    group.add(leaf);

    // Stem
    const stemGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.2, 8);
    const stemMaterial = new THREE.MeshPhongMaterial({ color: 0x8b4513 });
    const stem = new THREE.Mesh(stemGeometry, stemMaterial);
    stem.position.set(0.15, 0.6, 0);
    stem.rotation.z = Math.PI / 6;
    group.add(stem);

    // Glow effect
    const glowLight = new THREE.PointLight(0xff4757, 0.8, 3);
    group.add(glowLight);

    this.mesh = group;
  }

  respawn(gridSize = 20) {
    if (!this.isInitialized || !this.mesh) return;

    this.gridSize = gridSize;
    const halfGrid = gridSize / 2;

    // FIXED: Adjusted margins untuk boundaries yang lebih baik
    const margin = 3; // Increased margin untuk hindari boundaries
    const minX = -halfGrid + margin;
    const maxX = halfGrid - margin;
    const minY = 3; // Increased dari 2 ke 3
    const maxY = gridSize - 3; // Increased dari 2 ke 3
    const minZ = -halfGrid + margin;
    const maxZ = halfGrid - margin;

    let newPosition;
    let attempts = 0;
    const maxAttempts = 10; // Reduced dari 15 ke 10

    // FIXED: Weighted random zones untuk distribusi yang lebih baik
    const zoneWeights = [0.3, 0.25, 0.25, 0.2]; // Center, Corner, Edge, Random
    const spawnZone = this.getWeightedRandomZone(zoneWeights);

    do {
      switch (spawnZone) {
        case 0: // Zone 1: Area tengah
          newPosition = this.generateCenterPosition(
            minX,
            maxX,
            minY,
            maxY,
            minZ,
            maxZ
          );
          break;
        case 1: // Zone 2: Area corners
          newPosition = this.generateCornerPosition(
            minX,
            maxX,
            minY,
            maxY,
            minZ,
            maxZ
          );
          break;
        case 2: // Zone 3: Area edges
          newPosition = this.generateEdgePosition(
            minX,
            maxX,
            minY,
            maxY,
            minZ,
            maxZ
          );
          break;
        case 3: // Zone 4: Completely random
        default:
          newPosition = this.generateRandomPosition(
            minX,
            maxX,
            minY,
            maxY,
            minZ,
            maxZ
          );
          break;
      }

      attempts++;

      if (attempts >= maxAttempts) {
        console.log("Max attempts reached, using fallback position");
        newPosition = this.generateFallbackPosition(
          minX,
          maxX,
          minY,
          maxY,
          minZ,
          maxZ
        );
        break;
      }
    } while (
      this.isTooCloseToLastPosition(newPosition) &&
      attempts < maxAttempts
    );

    this.position.copy(newPosition);
    this.lastSpawnPosition = this.position.clone();

    console.log(
      `🍎 Food spawned at:`,
      this.position.toArray(),
      `(zone: ${spawnZone}, attempt: ${attempts})`
    );

    this.mesh.position.copy(this.position);
    this.animateSpawn();
  }

  // FIXED: Added weighted random function
  getWeightedRandomZone(weights) {
    const random = Math.random();
    let sum = 0;

    for (let i = 0; i < weights.length; i++) {
      sum += weights[i];
      if (random <= sum) return i;
    }

    return weights.length - 1; // Fallback ke zone terakhir
  }

  generateCenterPosition(minX, maxX, minY, maxY, minZ, maxZ) {
    // FIXED: Center area yang lebih proportional
    const centerSize = Math.min(10, this.gridSize * 0.5); // Max 10 units atau 50% grid
    const centerMinX = -centerSize / 2;
    const centerMaxX = centerSize / 2;
    const centerMinY = this.gridSize * 0.3; // 30% dari tinggi
    const centerMaxY = this.gridSize * 0.7; // 70% dari tinggi
    const centerMinZ = -centerSize / 2;
    const centerMaxZ = centerSize / 2;

    const x = centerMinX + Math.random() * (centerMaxX - centerMinX);
    const y = centerMinY + Math.random() * (centerMaxY - centerMinY);
    const z = centerMinZ + Math.random() * (centerMaxZ - centerMinZ);

    return new THREE.Vector3(x, y, z);
  }

  generateCornerPosition(minX, maxX, minY, maxY, minZ, maxZ) {
    // FIXED: Corner positions dengan variasi height yang lebih baik
    const corners = [
      new THREE.Vector3(minX, minY + 1, minZ), // Back-left-bottom
      new THREE.Vector3(minX, minY + 1, maxZ), // Front-left-bottom
      new THREE.Vector3(maxX, minY + 1, minZ), // Back-right-bottom
      new THREE.Vector3(maxX, minY + 1, maxZ), // Front-right-bottom
      new THREE.Vector3(minX, maxY - 1, minZ), // Back-left-top
      new THREE.Vector3(minX, maxY - 1, maxZ), // Front-left-top
      new THREE.Vector3(maxX, maxY - 1, minZ), // Back-right-top
      new THREE.Vector3(maxX, maxY - 1, maxZ), // Front-right-top
      // Middle height corners
      new THREE.Vector3(minX, (minY + maxY) / 2, minZ),
      new THREE.Vector3(minX, (minY + maxY) / 2, maxZ),
      new THREE.Vector3(maxX, (minY + maxY) / 2, minZ),
      new THREE.Vector3(maxX, (minY + maxY) / 2, maxZ),
    ];

    const randomCorner = corners[Math.floor(Math.random() * corners.length)];

    // FIXED: Smaller offset untuk tetap dekat corner
    const offset = 1.5;
    const x = randomCorner.x + (Math.random() - 0.5) * offset;
    const y = randomCorner.y + (Math.random() - 0.5) * offset;
    const z = randomCorner.z + (Math.random() - 0.5) * offset;

    return new THREE.Vector3(x, y, z);
  }

  generateEdgePosition(minX, maxX, minY, maxY, minZ, maxZ) {
    // FIXED: Edge positions dengan height distribution yang lebih baik
    const edge = Math.floor(Math.random() * 6);

    // Height tiers untuk variasi vertikal
    const heightTiers = [minY + 2, (minY + maxY) / 2, maxY - 2];
    const randomHeight =
      heightTiers[Math.floor(Math.random() * heightTiers.length)];

    let x, y, z;

    switch (edge) {
      case 0: // Bottom edge (Y = minY)
        x = minX + Math.random() * (maxX - minX);
        y = minY + 1.5;
        z = minZ + Math.random() * (maxZ - minZ);
        break;
      case 1: // Top edge (Y = maxY)
        x = minX + Math.random() * (maxX - minX);
        y = maxY - 1.5;
        z = minZ + Math.random() * (maxZ - minZ);
        break;
      case 2: // Left edge (X = minX)
        x = minX + 1.5;
        y = randomHeight;
        z = minZ + Math.random() * (maxZ - minZ);
        break;
      case 3: // Right edge (X = maxX)
        x = maxX - 1.5;
        y = randomHeight;
        z = minZ + Math.random() * (maxZ - minZ);
        break;
      case 4: // Back edge (Z = minZ)
        x = minX + Math.random() * (maxX - minX);
        y = randomHeight;
        z = minZ + 1.5;
        break;
      case 5: // Front edge (Z = maxZ)
      default:
        x = minX + Math.random() * (maxX - minX);
        y = randomHeight;
        z = maxZ - 1.5;
        break;
    }

    return new THREE.Vector3(x, y, z);
  }

  generateRandomPosition(minX, maxX, minY, maxY, minZ, maxZ) {
    const x = minX + Math.random() * (maxX - minX);
    const y = minY + Math.random() * (maxY - minY);
    const z = minZ + Math.random() * (maxZ - minZ);

    return new THREE.Vector3(x, y, z);
  }

  generateFallbackPosition(minX, maxX, minY, maxY, minZ, maxZ) {
    // FIXED: Fallback position yang lebih aman (bukan tepat di center)
    const x = (minX + maxX) / 2 + (Math.random() - 0.5) * 4;
    const y = (minY + maxY) / 2 + (Math.random() - 0.5) * 4;
    const z = (minZ + maxZ) / 2 + (Math.random() - 0.5) * 4;

    return new THREE.Vector3(x, y, z);
  }

  isTooCloseToLastPosition(newPosition) {
    if (!this.lastSpawnPosition) return false;

    const distance = newPosition.distanceTo(this.lastSpawnPosition);
    const minDistance = 4; // FIXED: Increased dari 3 ke 4 untuk lebih variety

    return distance < minDistance;
  }

  animateSpawn() {
    if (!this.isInitialized || !this.mesh || typeof TWEEN === "undefined")
      return;

    // FIXED: Reset animation state
    this.mesh.scale.set(0.1, 0.1, 0.1);
    this.mesh.rotation.set(0, 0, 0);

    // Stop any existing animations
    TWEEN.removeAll();

    // Scale animation
    new TWEEN.Tween(this.mesh.scale)
      .to({ x: 1, y: 1, z: 1 }, 600)
      .easing(TWEEN.Easing.Elastic.Out)
      .start();

    // Rotation animation
    new TWEEN.Tween(this.mesh.rotation)
      .to(
        {
          x: Math.PI * 0.1,
          y: Math.PI * 4, // FIXED: Increased rotation untuk effect lebih dramatis
          z: Math.PI * 0.05,
        },
        1200
      )
      .easing(TWEEN.Easing.Cubic.Out)
      .start();

    // Floating animation - hanya jika tidak di lantai/atap
    if (
      this.position.y > this.gridSize * 0.2 &&
      this.position.y < this.gridSize * 0.8
    ) {
      const originalY = this.mesh.position.y;
      new TWEEN.Tween(this.mesh.position)
        .to({ y: originalY + 0.4 }, 1800) // FIXED: Increased float height dan duration
        .easing(TWEEN.Easing.Sinusoidal.InOut)
        .yoyo(true)
        .repeat(Infinity)
        .start();
    }
  }

  getPosition() {
    if (!this.isInitialized || !this.mesh) return new THREE.Vector3(0, 5, 0);
    return this.position;
  }

  // FIXED: Added cleanup method
  destroy() {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      // Clean up Tween animations
      if (typeof TWEEN !== "undefined") {
        TWEEN.removeAll();
      }
    }
  }
}
