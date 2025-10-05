import * as THREE from "three";

export class Snake {
  constructor(scene, textureLoader) {
    this.scene = scene;
    this.textureLoader = textureLoader;
    this.body = [];

    // Movement properties
    this.direction = new THREE.Vector3(1, 0, 0);
    this.nextDirection = this.direction.clone();
    this.speed = 1.5; // speed snake
    this.growPending = 0;
    this.isInitialized = false;

    // Materials
    this.headMaterial = null;
    this.bodyMaterial = null;

    // NEW: White eye material
    this.eyeMaterial = new THREE.MeshPhongMaterial({
      color: 0xffffff, // WHITE color
      shininess: 100,
      specular: 0x888888,
    });

    this.initializeSnake();
  }

  async initializeSnake() {
    await this.loadTextures();
    this.createHead();
    this.createBodyParts(3);
    this.isInitialized = true;
  }

  async loadTextures() {
    return new Promise((resolve) => {
      this.textureLoader.load(
        "assets/textures/snake-skin.jpg",
        (texture) => {
          // Configure texture
          texture.wrapS = THREE.RepeatWrapping;
          texture.wrapT = THREE.RepeatWrapping;
          texture.repeat.set(2, 2);

          // Create materials with texture
          this.headMaterial = new THREE.MeshPhongMaterial({
            map: texture,
            shininess: 80,
            specular: 0x222222,
          });

          this.bodyMaterial = new THREE.MeshPhongMaterial({
            map: texture,
            shininess: 60,
            specular: 0x111111,
          });

          console.log("🐍 Snake texture loaded successfully");
          resolve();
        },
        undefined,
        () => {
          // Fallback materials without texture
          this.headMaterial = new THREE.MeshPhongMaterial({
            color: 0x00ff00,
            shininess: 100,
          });
          this.bodyMaterial = new THREE.MeshPhongMaterial({
            color: 0x00cc00,
            shininess: 50,
          });
          console.log("🐍 Using fallback colors (texture not available)");
          resolve();
        }
      );
    });
  }

  createHead() {
    if (!this.headMaterial) {
      console.error("Head material not ready");
      return;
    }

    const geometry = new THREE.SphereGeometry(0.5, 16, 16);
    this.head = new THREE.Mesh(geometry, this.headMaterial);
    this.head.position.set(0, 5, 0);
    this.head.castShadow = true;

    this.addEyes();
    this.addTongue();
    this.scene.add(this.head);
    this.body.push(this.head);
  }

  addEyes() {
    const eyeGeometry = new THREE.SphereGeometry(0.15, 12, 12);

    // Left eye (WHITE)
    const leftEye = new THREE.Mesh(eyeGeometry, this.eyeMaterial);
    leftEye.position.set(0.4, 0.2, 0.3);
    this.head.add(leftEye);

    // Right eye (WHITE)
    const rightEye = new THREE.Mesh(eyeGeometry, this.eyeMaterial);
    rightEye.position.set(0.4, 0.2, -0.3);
    this.head.add(rightEye);

    // Add pupil for better visual
    this.addPupils();
  }

  addPupils() {
    const pupilGeometry = new THREE.SphereGeometry(0.06, 8, 8);
    const pupilMaterial = new THREE.MeshPhongMaterial({
      color: 0x000000,
      shininess: 150,
    });

    // Left pupil
    const leftPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
    leftPupil.position.set(0.45, 0.2, 0.25);
    this.head.add(leftPupil);

    // Right pupil
    const rightPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
    rightPupil.position.set(0.45, 0.2, -0.25);
    this.head.add(rightPupil);
  }

  addTongue() {
    const tongueGroup = new THREE.Group();

    // Tongue base
    const tongueGeometry = new THREE.CylinderGeometry(0.03, 0.05, 0.3, 8);
    const tongueMaterial = new THREE.MeshPhongMaterial({
      color: 0xff0066,
      shininess: 30,
    });

    const tongue = new THREE.Mesh(tongueGeometry, tongueMaterial);
    tongue.rotation.z = Math.PI / 2;
    tongue.position.set(0.5, 0, 0);
    tongueGroup.add(tongue);

    // Tongue tip
    const tipGeometry = new THREE.SphereGeometry(0.05, 6, 6);
    const tip = new THREE.Mesh(tipGeometry, tongueMaterial);
    tip.position.set(0.65, 0, 0);
    tongueGroup.add(tip);

    this.head.add(tongueGroup);
    this.tongue = tongueGroup;
  }

  createBodyParts(count) {
    for (let i = 0; i < count; i++) {
      this.addBodyPart();
    }
  }

  addBodyPart() {
    if (!this.bodyMaterial) return;

    const geometry = new THREE.SphereGeometry(0.45, 12, 12);
    const bodyPart = new THREE.Mesh(geometry, this.bodyMaterial);
    bodyPart.castShadow = true;

    const lastPart = this.body[this.body.length - 1];

    if (this.body.length === 1) {
      // First body part behind head
      bodyPart.position.copy(lastPart.position);
      bodyPart.position.add(this.direction.clone().multiplyScalar(-1.2));
    } else {
      // Subsequent body parts
      const secondLast = this.body[this.body.length - 2];
      const direction = new THREE.Vector3()
        .subVectors(lastPart.position, secondLast.position)
        .normalize();
      bodyPart.position.copy(lastPart.position);
      bodyPart.position.add(direction.multiplyScalar(-1.2));
    }

    this.scene.add(bodyPart);
    this.body.push(bodyPart);
  }

  update() {
    if (!this.isInitialized || !this.head) return;

    // Update direction
    this.direction.copy(this.nextDirection);

    // Save previous positions for body movement
    const previousPositions = this.body.map((part) => part.position.clone());

    // Move head
    this.head.position.add(this.direction.clone().multiplyScalar(this.speed));

    // Update body parts to follow head
    for (let i = 1; i < this.body.length; i++) {
      this.body[i].position.copy(previousPositions[i - 1]);
    }

    // Handle tongue animation
    this.updateTongueAnimation();

    // Handle growth
    if (this.growPending > 0) {
      this.addBodyPart();
      this.growPending--;
    }
  }

  updateTongueAnimation() {
    if (!this.tongue) return;

    // Random tongue flick (2% chance per frame)
    if (Math.random() < 0.02) {
      this.tongue.scale.y = 1.2;
      setTimeout(() => {
        if (this.tongue) this.tongue.scale.y = 1.0;
      }, 200);
    }
  }

  changeDirection(newDirection) {
    if (!this.isInitialized || !this.head) return;

    const currentDir = this.direction.clone();

    // Prevent 180-degree turns
    if (newDirection.dot(currentDir) < -0.5) {
      return;
    }

    this.nextDirection.copy(newDirection.normalize());
  }

  grow() {
    if (!this.isInitialized) return;
    this.growPending++;
  }

  checkSelfCollision() {
    if (!this.isInitialized || !this.head) return false;

    const headPos = this.head.position;

    // Check collision with body parts (skip first 3 parts)
    for (let i = 3; i < this.body.length; i++) {
      const bodyPart = this.body[i];
      if (headPos.distanceTo(bodyPart.position) < 0.8) {
        return true;
      }
    }
    return false;
  }

  checkWallCollision(gridSize) {
    if (!this.isInitialized || !this.head) return false;

    const halfGrid = gridSize / 2;
    const pos = this.head.position;

    // Collision detection with margin
    const margin = 0.6;
    const hitWall =
      pos.x <= -halfGrid + margin ||
      pos.x >= halfGrid - margin ||
      pos.y <= -margin ||
      pos.y >= gridSize - margin ||
      pos.z <= -halfGrid + margin ||
      pos.z >= halfGrid - margin;

    return hitWall;
  }

  getHeadPosition() {
    if (!this.isInitialized || !this.head) {
      return new THREE.Vector3(0, 5, 0);
    }
    return this.head.position;
  }

  // Cleanup method for game restart
  destroy() {
    // Remove all body parts from scene
    this.body.forEach((part) => {
      this.scene.remove(part);
    });

    this.body = [];
    this.isInitialized = false;
  }
}
