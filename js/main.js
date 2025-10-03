import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import { Snake } from "./Snake.js";
import { Food } from "./Food.js";

class SoundManager {
  constructor() {
    this.sounds = {};
    this.muted = false;
  }

  loadSound(id, volume = 0.7) {
    const audio = document.getElementById(id);
    if (audio) {
      audio.volume = volume;
      this.sounds[id] = audio;
    }
  }

  play(id) {
    if (this.muted || !this.sounds[id]) return;

    // Reset sound untuk bisa play multiple times
    this.sounds[id].currentTime = 0;
    this.sounds[id].play().catch((e) => {
      console.log("Audio play failed:", e);
    });
  }

  stop(id) {
    if (this.sounds[id]) {
      this.sounds[id].pause();
      this.sounds[id].currentTime = 0;
    }
  }

  setMuted(muted) {
    this.muted = muted;
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }
}

class Game {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = null;
    this.renderer = null;
    this.snake = null;
    this.food = null;
    this.controls = null;

    this.textureLoader = new THREE.TextureLoader();
    this.modelLoader = new GLTFLoader();
    this.soundManager = new SoundManager();

    this.score = 0;
    this.gameOver = false;
    this.paused = false;
    this.gridSize = 30;

    this.clock = new THREE.Clock();
    this.moveDelay = 0.1;
    this.moveTimer = 0;
    this.baseSpeed = 0.1;

    this.init();
  }

  async init() {
    this.setupRenderer();
    this.setupCamera();
    this.setupLights();
    await this.createEnvironment();
    this.setupSound();
    this.setupEventListeners();

    this.hideLoading();
    this.startGame();
    this.animate();
  }

  setupSound() {
    // NEW: Load game sounds
    this.soundManager.loadSound("eatSound", 0.6);
    this.soundManager.loadSound("gameOverSound", 0.5);

    // Optional: Add mute toggle button handler
    this.setupMuteToggle();
  }

  setupMuteToggle() {
    // Optional: Add mute button to UI
    const muteBtn = document.createElement("button");
    muteBtn.innerHTML = "🔊";
    muteBtn.className = "mute-btn";
    muteBtn.style.cssText = `
            position: absolute;
            top: 20px;
            right: 20px;
            z-index: 100;
            background: var(--glass-bg);
            border: 1px solid var(--glass-border);
            color: white;
            padding: 10px;
            border-radius: 50%;
            cursor: pointer;
            backdrop-filter: blur(10px);
        `;

    muteBtn.addEventListener("click", () => {
      const muted = this.soundManager.toggleMute();
      muteBtn.innerHTML = muted ? "🔇" : "🔊";
    });

    document.getElementById("gameContainer").appendChild(muteBtn);
  }

  // UPDATE: Tambahkan sound di checkFoodCollision
  checkFoodCollision() {
    if (!this.snake.head || !this.food.mesh) return;

    const headPos = this.snake.getHeadPosition();
    const foodPos = this.food.getPosition();

    if (headPos.distanceTo(foodPos) < 1.5) {
      this.snake.grow();
      this.food.respawn(this.gridSize);
      this.score += 10;
      this.updateScore();

      // NEW: Play eat sound
      this.soundManager.play("eatSound");

      this.moveDelay = Math.max(0.03, this.moveDelay * 0.95);
      this.updateSpeedDisplay();

      this.showScoreEffect();
    }
  }

  // UPDATE: Tambahkan sound di endGame
  endGame() {
    this.gameOver = true;
    document.getElementById("finalScore").textContent = this.score;

    // NEW: Play game over sound
    this.soundManager.play("gameOverSound");

    this.showGameOver();
  }

  async createEnvironment() {
    try {
      this.scene.background = await new Promise((resolve) => {
        this.textureLoader.load(
          "assets/textures/space-bg.jpg",
          resolve,
          undefined,
          () => {
            console.log("Background texture not found, using default color");
            resolve(new THREE.Color(0x001122));
          }
        );
      });
    } catch (error) {
      console.log("Background texture error, using default color");
      this.scene.background = new THREE.Color(0x0a0a1a);
    }

    this.createGrid();
    this.createParticles();
  }

  createParticles() {
    const particleGeometry = new THREE.BufferGeometry();
    const particleCount = 500;
    const posArray = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i++) {
      posArray[i] = (Math.random() - 0.5) * 200;
    }

    particleGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(posArray, 3)
    );

    const particleMaterial = new THREE.PointsMaterial({
      size: 0.2,
      color: 0xffffff,
      transparent: true,
      opacity: 0.4,
    });

    const particlesMesh = new THREE.Points(particleGeometry, particleMaterial);
    this.scene.add(particlesMesh);
  }

  setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(this.renderer.domElement);
  }

  setupCamera() {
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    // FIXED: Camera position untuk melihat seluruh arena
    this.camera.position.set(25, 20, 25);
    this.camera.lookAt(0, 5, 0);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = 15;
    this.controls.maxDistance = 60;
    this.controls.maxPolarAngle = Math.PI * 0.8; // Prevent camera from going underneath
  }

  setupLights() {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0x404040, 0.8);
    this.scene.add(ambientLight);

    // Directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(20, 30, 20);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    this.scene.add(directionalLight);

    // Point light for food glow
    const pointLight = new THREE.PointLight(0xff4757, 0.6, 30);
    pointLight.position.set(0, 10, 0);
    this.scene.add(pointLight);
  }

  createGrid() {
    // FIXED: Grid di level yang terlihat
    const gridHelper = new THREE.GridHelper(
      this.gridSize,
      this.gridSize,
      0x666666,
      0x333333
    );
    gridHelper.position.y = 0;
    this.scene.add(gridHelper);

    this.createBoundaries();
  }

  createBoundaries() {
    const halfSize = this.gridSize / 2;

    // Transparent floor
    const floorGeometry = new THREE.PlaneGeometry(this.gridSize, this.gridSize);
    const floorMaterial = new THREE.MeshPhongMaterial({
      color: 0x444444,
      transparent: true,
      opacity: 0.05,
      side: THREE.DoubleSide,
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    this.scene.add(floor);

    // Enhanced 3D boundaries dengan visual yang jelas
    this.create3DBoundaries(halfSize);
    this.createBoundaryIndicators(halfSize);
  }

  create3DBoundaries(halfSize) {
    // Create wireframe cube untuk boundaries
    const boundaryGeometry = new THREE.BoxGeometry(
      this.gridSize,
      this.gridSize,
      this.gridSize
    );

    const edges = new THREE.EdgesGeometry(boundaryGeometry);
    const boundaryLines = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({
        color: 0xff4757,
        linewidth: 3,
        transparent: true,
        opacity: 0.8,
      })
    );
    boundaryLines.position.y = halfSize;
    this.scene.add(boundaryLines);

    // Add semi-transparent walls untuk depth perception
    const wallMaterial = new THREE.MeshPhongMaterial({
      color: 0xff4757,
      transparent: true,
      opacity: 0.1,
      side: THREE.DoubleSide,
    });

    // Back wall
    const backWall = new THREE.Mesh(
      new THREE.PlaneGeometry(this.gridSize, this.gridSize),
      wallMaterial
    );
    backWall.position.set(0, halfSize, -halfSize);
    this.scene.add(backWall);

    // Front wall
    const frontWall = new THREE.Mesh(
      new THREE.PlaneGeometry(this.gridSize, this.gridSize),
      wallMaterial
    );
    frontWall.position.set(0, halfSize, halfSize);
    frontWall.rotation.y = Math.PI;
    this.scene.add(frontWall);

    // Left wall
    const leftWall = new THREE.Mesh(
      new THREE.PlaneGeometry(this.gridSize, this.gridSize),
      wallMaterial
    );
    leftWall.position.set(-halfSize, halfSize, 0);
    leftWall.rotation.y = Math.PI / 2;
    this.scene.add(leftWall);

    // Right wall
    const rightWall = new THREE.Mesh(
      new THREE.PlaneGeometry(this.gridSize, this.gridSize),
      wallMaterial
    );
    rightWall.position.set(halfSize, halfSize, 0);
    rightWall.rotation.y = -Math.PI / 2;
    this.scene.add(rightWall);

    // Ceiling
    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(this.gridSize, this.gridSize),
      wallMaterial
    );
    ceiling.position.set(0, this.gridSize, 0);
    ceiling.rotation.x = Math.PI / 2;
    this.scene.add(ceiling);
  }

  createBoundaryIndicators(halfSize) {
    // Corner indicators dengan warna berbeda
    const colors = [0xff4757, 0x3742fa, 0x2ed573, 0xffa502];

    const cornerGeometry = new THREE.SphereGeometry(0.4, 6, 6);

    const corners = [
      { pos: [-halfSize, 0, -halfSize], color: colors[0], label: "Back-Left" },
      { pos: [-halfSize, 0, halfSize], color: colors[1], label: "Front-Left" },
      { pos: [halfSize, 0, -halfSize], color: colors[2], label: "Back-Right" },
      { pos: [halfSize, 0, halfSize], color: colors[3], label: "Front-Right" },
      {
        pos: [-halfSize, this.gridSize, -halfSize],
        color: colors[0],
        label: "Top-Back-Left",
      },
      {
        pos: [-halfSize, this.gridSize, halfSize],
        color: colors[1],
        label: "Top-Front-Left",
      },
      {
        pos: [halfSize, this.gridSize, -halfSize],
        color: colors[2],
        label: "Top-Back-Right",
      },
      {
        pos: [halfSize, this.gridSize, halfSize],
        color: colors[3],
        label: "Top-Front-Right",
      },
    ];

    corners.forEach((corner) => {
      const material = new THREE.MeshPhongMaterial({
        color: corner.color,
        emissive: corner.color,
        emissiveIntensity: 0.3,
        transparent: true,
        opacity: 0.7,
      });

      const indicator = new THREE.Mesh(cornerGeometry, material);
      indicator.position.set(corner.pos[0], corner.pos[1], corner.pos[2]);
      this.scene.add(indicator);
    });

    // Center point references
    const centerGeometry = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    const centerMaterial = new THREE.MeshPhongMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 0.2,
    });

    // Center floor point
    const centerFloor = new THREE.Mesh(centerGeometry, centerMaterial);
    centerFloor.position.set(0, 0.15, 0);
    this.scene.add(centerFloor);

    // Center ceiling point
    const centerCeiling = new THREE.Mesh(centerGeometry, centerMaterial);
    centerCeiling.position.set(0, this.gridSize - 0.15, 0);
    this.scene.add(centerCeiling);
  }

  createWireframeBoundaries(halfSize) {
    const boundaryColor = 0xff4757;
    const boundaryGeometry = new THREE.BoxGeometry(
      this.gridSize,
      this.gridSize,
      this.gridSize
    );
    const boundaryEdges = new THREE.EdgesGeometry(boundaryGeometry);

    const boundaryLine = new THREE.LineSegments(
      boundaryEdges,
      new THREE.LineBasicMaterial({
        color: boundaryColor,
        transparent: true,
        opacity: 0.6,
        linewidth: 2,
      })
    );
    boundaryLine.position.y = halfSize;
    this.scene.add(boundaryLine);
  }

  createBoundaryMarkers(halfSize) {
    const markerMaterial = new THREE.MeshPhongMaterial({
      color: 0xff4757,
      emissive: 0xff0000,
      emissiveIntensity: 0.3,
      transparent: true,
      opacity: 0.8,
    });

    const markerGeometry = new THREE.SphereGeometry(0.3, 8, 8);

    // Markers di setiap sudut
    const cornerPositions = [
      [-halfSize, 0, -halfSize],
      [-halfSize, 0, halfSize],
      [halfSize, 0, -halfSize],
      [halfSize, 0, halfSize],
      [-halfSize, this.gridSize, -halfSize],
      [-halfSize, this.gridSize, halfSize],
      [halfSize, this.gridSize, -halfSize],
      [halfSize, this.gridSize, halfSize],
    ];

    cornerPositions.forEach((pos) => {
      const marker = new THREE.Mesh(markerGeometry, markerMaterial);
      marker.position.set(pos[0], pos[1], pos[2]);
      this.scene.add(marker);
    });

    // Center markers untuk orientasi
    const centerMarkerGeometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    const centerMarkerMaterial = new THREE.MeshPhongMaterial({
      color: 0x00ff00,
      emissive: 0x00ff00,
      emissiveIntensity: 0.2,
    });

    // Center floor marker
    const centerFloor = new THREE.Mesh(
      centerMarkerGeometry,
      centerMarkerMaterial
    );
    centerFloor.position.set(0, 0.1, 0);
    this.scene.add(centerFloor);

    // Center ceiling marker
    const centerCeiling = new THREE.Mesh(
      centerMarkerGeometry,
      centerMarkerMaterial
    );
    centerCeiling.position.set(0, this.gridSize - 0.1, 0);
    this.scene.add(centerCeiling);
  }
  createWalls(halfSize, material) {
    const wallGeometry = new THREE.PlaneGeometry(this.gridSize, this.gridSize);

    // Back wall (Z-negative)
    const backWall = new THREE.Mesh(wallGeometry, material);
    backWall.position.set(0, halfSize, -halfSize);
    backWall.rotation.y = 0;
    this.scene.add(backWall);

    // Front wall (Z-positive)
    const frontWall = new THREE.Mesh(wallGeometry, material);
    frontWall.position.set(0, halfSize, halfSize);
    frontWall.rotation.y = Math.PI;
    this.scene.add(frontWall);

    // Left wall (X-negative)
    const leftWall = new THREE.Mesh(wallGeometry, material);
    leftWall.position.set(-halfSize, halfSize, 0);
    leftWall.rotation.y = Math.PI / 2;
    this.scene.add(leftWall);

    // Right wall (X-positive)
    const rightWall = new THREE.Mesh(wallGeometry, material);
    rightWall.position.set(halfSize, halfSize, 0);
    rightWall.rotation.y = -Math.PI / 2;
    this.scene.add(rightWall);
  }

  createCeiling(halfSize, material) {
    // Ceiling (atap)
    const ceilingGeometry = new THREE.PlaneGeometry(
      this.gridSize,
      this.gridSize
    );
    const ceiling = new THREE.Mesh(ceilingGeometry, material);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = this.gridSize; // Atap di atas arena
    this.scene.add(ceiling);
  }

  createCornerPillars(halfSize) {
    const pillarMaterial = new THREE.MeshPhongMaterial({
      color: 0x3742fa,
      transparent: true,
      opacity: 0.4,
    });

    const pillarGeometry = new THREE.BoxGeometry(0.5, this.gridSize, 0.5);

    // 8 pillars di setiap sudut
    const positions = [
      [-halfSize, halfSize / 2, -halfSize], // back-left-bottom
      [-halfSize, halfSize / 2, halfSize], // front-left-bottom
      [halfSize, halfSize / 2, -halfSize], // back-right-bottom
      [halfSize, halfSize / 2, halfSize], // front-right-bottom
      [-halfSize, halfSize / 2 + halfSize, -halfSize], // back-left-top
      [-halfSize, halfSize / 2 + halfSize, halfSize], // front-left-top
      [halfSize, halfSize / 2 + halfSize, -halfSize], // back-right-top
      [halfSize, halfSize / 2 + halfSize, halfSize], // front-right-top
    ];

    positions.forEach((pos) => {
      const pillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
      pillar.position.set(pos[0], pos[1], pos[2]);
      this.scene.add(pillar);
    });
  }

  hideLoading() {
    document.getElementById("loading").style.display = "none";
    document.getElementById("gameContainer").classList.remove("hidden");
  }

  startGame() {
    // Clear existing objects
    if (this.snake) {
      this.snake.body.forEach((part) => this.scene.remove(part));
    }
    if (this.food && this.food.mesh) {
      this.scene.remove(this.food.mesh);
    }

    // Reset game state
    this.score = 0;
    this.gameOver = false;
    this.paused = false;
    this.moveDelay = this.baseSpeed;
    this.updateScore();
    this.hideGameOver();
    this.hidePause();
    this.updateSpeedDisplay();

    // Create new objects
    this.snake = new Snake(this.scene, this.textureLoader);
    this.food = new Food(this.scene, this.textureLoader, this.modelLoader);

    // FIXED: Reset camera position
    this.camera.position.set(25, 20, 25);
    this.controls.target.set(0, 5, 0);
  }

  update() {
    if (this.paused || this.gameOver) return;

    const delta = this.clock.getDelta();
    this.moveTimer += delta;

    if (this.moveTimer >= this.moveDelay) {
      this.snake.update();
      this.moveTimer = 0;

      this.checkFoodCollision();

      if (
        this.snake.checkSelfCollision() ||
        this.snake.checkWallCollision(this.gridSize)
      ) {
        this.endGame();
      }
    }

    this.updateCamera();
  }

  updateCamera() {
    if (!this.snake || !this.snake.head) return;

    const snakePos = this.snake.getHeadPosition();

    // FIXED: Better camera follow
    const targetCamPos = new THREE.Vector3(
      snakePos.x + 15,
      Math.max(15, snakePos.y + 12),
      snakePos.z + 15
    );

    this.camera.position.lerp(targetCamPos, 0.03);
    this.controls.target.lerp(snakePos, 0.03);
  }

  checkFoodCollision() {
    if (!this.snake.head || !this.food.mesh) return;

    const headPos = this.snake.getHeadPosition();
    const foodPos = this.food.getPosition();

    if (headPos.distanceTo(foodPos) < 1.5) {
      this.snake.grow();
      this.food.respawn(this.gridSize);
      this.score += 10;
      this.updateScore();

      // Increase speed gradually
      this.moveDelay = Math.max(0.03, this.moveDelay * 0.95);
      this.updateSpeedDisplay();

      // Visual feedback
      this.showScoreEffect();
    }
  }

  showScoreEffect() {
    const scoreValue = document.getElementById("scoreValue");
    scoreValue.style.transform = "scale(1.2)";
    scoreValue.style.color = "#2ed573";

    setTimeout(() => {
      scoreValue.style.transform = "scale(1)";
      scoreValue.style.color = "";
    }, 300);
  }

  updateScore() {
    document.getElementById("scoreValue").textContent = this.score;
  }

  updateSpeedDisplay() {
    const speed = (this.baseSpeed / this.moveDelay).toFixed(1);
    document.getElementById("speedValue").textContent = speed + "x";
  }

  endGame() {
    this.gameOver = true;
    document.getElementById("finalScore").textContent = this.score;
    this.showGameOver();
  }

  showGameOver() {
    document.getElementById("gameOver").classList.remove("hidden");
  }

  hideGameOver() {
    document.getElementById("gameOver").classList.add("hidden");
  }

  showPause() {
    document.getElementById("pause").classList.remove("hidden");
  }

  hidePause() {
    document.getElementById("pause").classList.add("hidden");
  }

  togglePause() {
    this.paused = !this.paused;
    if (this.paused) {
      this.showPause();
    } else {
      this.hidePause();
    }
  }

  setupEventListeners() {
    document.addEventListener("keydown", (event) => {
      if (this.gameOver && event.code !== "KeyR") return;

      switch (event.code) {
        case "KeyW":
        case "ArrowUp":
          event.preventDefault();
          this.snake.changeDirection(new THREE.Vector3(0, 0, -1));
          break;
        case "KeyS":
        case "ArrowDown":
          event.preventDefault();
          this.snake.changeDirection(new THREE.Vector3(0, 0, 1));
          break;
        case "KeyA":
        case "ArrowLeft":
          event.preventDefault();
          this.snake.changeDirection(new THREE.Vector3(-1, 0, 0));
          break;
        case "KeyD":
        case "ArrowRight":
          event.preventDefault();
          this.snake.changeDirection(new THREE.Vector3(1, 0, 0));
          break;
        case "KeyQ":
          event.preventDefault();
          this.snake.changeDirection(new THREE.Vector3(0, -1, 0));
          break;
        case "KeyE":
          event.preventDefault();
          this.snake.changeDirection(new THREE.Vector3(0, 1, 0));
          break;
        case "Space":
          event.preventDefault();
          this.togglePause();
          break;
        case "KeyR":
          event.preventDefault();
          this.startGame();
          break;
      }
    });

    // UI Buttons
    document.getElementById("restart").addEventListener("click", () => {
      this.startGame();
    });

    document.getElementById("resume").addEventListener("click", () => {
      this.togglePause();
    });

    // Mobile controls
    this.setupMobileControls();

    // Window resize
    window.addEventListener("resize", () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  setupMobileControls() {
    const upBtn = document.getElementById("upBtn");
    const downBtn = document.getElementById("downBtn");
    const leftBtn = document.getElementById("leftBtn");
    const rightBtn = document.getElementById("rightBtn");

    if (upBtn) {
      upBtn.addEventListener("click", () => {
        this.snake.changeDirection(new THREE.Vector3(0, 0, -1));
      });
    }
    if (downBtn) {
      downBtn.addEventListener("click", () => {
        this.snake.changeDirection(new THREE.Vector3(0, 0, 1));
      });
    }
    if (leftBtn) {
      leftBtn.addEventListener("click", () => {
        this.snake.changeDirection(new THREE.Vector3(-1, 0, 0));
      });
    }
    if (rightBtn) {
      rightBtn.addEventListener("click", () => {
        this.snake.changeDirection(new THREE.Vector3(1, 0, 0));
      });
    }
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    if (typeof TWEEN !== "undefined") {
      TWEEN.update();
    }

    this.update();
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}

// Initialize game
window.addEventListener("load", () => {
  new Game();
});
