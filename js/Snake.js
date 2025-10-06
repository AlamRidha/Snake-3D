import * as THREE from "three";

export class Snake {
  constructor(scene, textureLoader) {
    this.scene = scene;
    this.textureLoader = textureLoader;
    this.body = [];

    // Movement properties
    this.direction = new THREE.Vector3(1, 0, 0);
    this.nextDirection = this.direction.clone();
    this.speed = 1.5;
    this.growPending = 0;
    this.isInitialized = false;

    // Materials
    this.headMaterial = null;
    this.bodyMaterial = null;
    this.eyeMaterials = {};

    // PERBAIKAN: Simpan rotasi sebelumnya untuk smoothing
    this.targetRotation = new THREE.Euler();
    this.currentRotation = new THREE.Euler();

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
          texture.wrapS = THREE.RepeatWrapping;
          texture.wrapT = THREE.RepeatWrapping;
          texture.repeat.set(3, 3);

          this.headMaterial = new THREE.MeshPhongMaterial({
            map: texture,
            shininess: 100,
            specular: 0x333333,
          });

          this.bodyMaterial = new THREE.MeshPhongMaterial({
            map: texture,
            shininess: 80,
            specular: 0x222222,
          });

          console.log("🐍 Snake texture loaded successfully");
          resolve();
        },
        undefined,
        () => {
          // Enhanced fallback materials
          this.headMaterial = new THREE.MeshPhongMaterial({
            color: 0x2ed573,
            shininess: 120,
            specular: 0x444444,
          });

          this.bodyMaterial = new THREE.MeshPhongMaterial({
            color: 0x25b562,
            shininess: 80,
            specular: 0x222222,
          });

          console.log("🐍 Using enhanced fallback colors");
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

    // Create head as a Group untuk kontrol yang lebih baik
    this.head = new THREE.Group();
    this.head.position.set(0, 5, 0);

    // Main head body
    const headGeometry = new THREE.SphereGeometry(0.5, 16, 16);
    const headMesh = new THREE.Mesh(headGeometry, this.headMaterial);
    headMesh.castShadow = true;
    this.head.add(headMesh);

    // Add dynamic eyes
    this.addDynamicEyes();

    // Add tongue
    this.addTongue();

    this.scene.add(this.head);
    this.body.push(this.head);
    this.headMesh = headMesh;
  }

  addDynamicEyes() {
    // Eye materials
    this.eyeMaterials.white = new THREE.MeshPhongMaterial({
      color: 0xffffff,
      shininess: 150,
      specular: 0x888888,
    });

    this.eyeMaterials.pupil = new THREE.MeshPhongMaterial({
      color: 0x000000,
      shininess: 200,
    });

    // Create eye groups
    this.leftEyeGroup = new THREE.Group();
    this.rightEyeGroup = new THREE.Group();

    // White of the eye
    const eyeGeometry = new THREE.SphereGeometry(0.12, 12, 12);
    const leftEye = new THREE.Mesh(eyeGeometry, this.eyeMaterials.white);
    const rightEye = new THREE.Mesh(eyeGeometry, this.eyeMaterials.white);

    this.leftEyeGroup.add(leftEye);
    this.rightEyeGroup.add(rightEye);

    // Pupils
    const pupilGeometry = new THREE.SphereGeometry(0.06, 8, 8);
    this.leftPupil = new THREE.Mesh(pupilGeometry, this.eyeMaterials.pupil);
    this.rightPupil = new THREE.Mesh(pupilGeometry, this.eyeMaterials.pupil);

    this.leftEyeGroup.add(this.leftPupil);
    this.rightEyeGroup.add(this.rightPupil);

    // Position eye groups on head
    this.leftEyeGroup.position.set(0.3, 0.1, 0.2);
    this.rightEyeGroup.position.set(0.3, 0.1, -0.2);

    this.head.add(this.leftEyeGroup);
    this.head.add(this.rightEyeGroup);
  }

  addTongue() {
    this.tongueGroup = new THREE.Group();

    // Tongue material
    const tongueMaterial = new THREE.MeshPhongMaterial({
      color: 0xff3366,
      shininess: 50,
    });

    // Tongue base (simple version)
    const tongueGeometry = new THREE.CylinderGeometry(0.02, 0.03, 0.3, 6);
    const tongue = new THREE.Mesh(tongueGeometry, tongueMaterial);
    tongue.rotation.z = Math.PI / 2;
    tongue.position.set(0.4, 0, 0);
    this.tongueGroup.add(tongue);

    // Position tongue at front of head
    this.tongueGroup.position.set(0.1, 0, 0);

    this.head.add(this.tongueGroup);
  }

  createBodyParts(count) {
    for (let i = 0; i < count; i++) {
      this.addBodyPart();
    }
  }

  addBodyPart() {
    if (!this.bodyMaterial) return;

    const bodyGeometry = new THREE.SphereGeometry(0.45, 12, 12);
    const bodyPart = new THREE.Mesh(bodyGeometry, this.bodyMaterial);
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

    // PERBAIKAN: Update head rotation dengan cara yang lebih baik
    this.updateHeadRotation();

    // Update body parts to follow head
    for (let i = 1; i < this.body.length; i++) {
      this.body[i].position.copy(previousPositions[i - 1]);
    }

    // Update eye direction
    this.updateEyeDirection();

    // Handle growth
    if (this.growPending > 0) {
      this.addBodyPart();
      this.growPending--;
    }
  }

  updateHeadRotation() {
    if (!this.head) return;

    // PERBAIKAN: Rotasi kepala yang lebih sederhana dan efektif
    // Hitung sudut rotasi berdasarkan arah
    let targetYRotation = 0;

    if (this.direction.x > 0) {
      targetYRotation = 0; // Kanan
    } else if (this.direction.x < 0) {
      targetYRotation = Math.PI; // Kiri
    } else if (this.direction.z > 0) {
      targetYRotation = Math.PI / 2; // Bawah
    } else if (this.direction.z < 0) {
      targetYRotation = -Math.PI / 2; // Atas
    }

    // Smooth rotation menggunakan lerp
    this.head.rotation.y = THREE.MathUtils.lerp(
      this.head.rotation.y,
      targetYRotation,
      0.3
    );
  }

  updateEyeDirection() {
    if (!this.leftPupil || !this.rightPupil) return;

    // PERBAIKAN: Mata mengikuti arah dengan benar
    // Untuk sekarang, biarkan pupil tetap di tengah mata
    // Rotasi kepala sudah menangani arah pandang

    // Blink animation (random)
    if (Math.random() < 0.005) {
      this.animateBlink();
    }
  }

  animateBlink() {
    const originalScale = new THREE.Vector3(1, 1, 1);
    const blinkScale = new THREE.Vector3(1, 0.1, 1);

    this.leftEyeGroup.scale.copy(blinkScale);
    this.rightEyeGroup.scale.copy(blinkScale);

    setTimeout(() => {
      if (this.leftEyeGroup && this.rightEyeGroup) {
        this.leftEyeGroup.scale.copy(originalScale);
        this.rightEyeGroup.scale.copy(originalScale);
      }
    }, 100);
  }

  changeDirection(newDirection) {
    if (!this.isInitialized || !this.head) return;

    const currentDir = this.direction.clone();

    // PERBAIKAN: Prevent 180-degree turns dengan cara yang lebih baik
    const dotProduct = newDirection.dot(currentDir);

    // Jika mencoba berbalik 180 derajat, tolak
    if (dotProduct < -0.8) {
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

  getDirection() {
    return this.direction.clone();
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
