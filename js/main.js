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

    // Camera Modes - PERBAIKAN: Gunakan string yang sama dengan data-mode di HTML
    this.cameraModes = {
      FOLLOW: "follow",
      ORBIT: "orbit",
      TOP: "top",
    };

    this.currentCameraMode = this.cameraModes.FOLLOW;

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
    this.soundManager.loadSound("eatSound", 0.6);
    this.soundManager.loadSound("gameOverSound", 0.5);
    this.setupMuteToggle();
  }

  setupMuteToggle() {
    const muteBtn = document.createElement("button");
    muteBtn.innerHTML = "🔊";
    muteBtn.className = "mute-btn";
    muteBtn.addEventListener("click", () => {
      const muted = this.soundManager.toggleMute();
      muteBtn.innerHTML = muted ? "🔇" : "🔊";
    });

    document.getElementById("gameContainer").appendChild(muteBtn);
  }

  // PERBAIKAN: Setup camera controls yang benar
  setupCameraControls() {
    const cameraModeItems = document.querySelectorAll(".camera-mode-item");

    cameraModeItems.forEach((item) => {
      item.addEventListener("click", () => {
        const mode = item.dataset.mode;
        console.log("Camera mode clicked:", mode); // Debug
        this.setCameraMode(mode);

        // Update active state
        cameraModeItems.forEach((i) => i.classList.remove("active"));
        item.classList.add("active");
      });
    });

    // Mobile camera button
    const mobileCameraBtn = document.getElementById("mobileCameraBtn");
    if (mobileCameraBtn) {
      mobileCameraBtn.addEventListener("click", () => {
        console.log("Mobile camera button clicked"); // Debug
        this.cycleCameraMode();
      });
    }
  }

  setCameraMode(mode) {
    console.log("Setting camera mode to:", mode); // Debug
    this.currentCameraMode = mode;
    this.resetCamera();
    this.updateCameraControls();
    this.updateCameraModeDisplay();
  }

  updateCameraModeDisplay() {
    const modeDisplay = document.getElementById("cameraMode");
    if (modeDisplay) {
      const modeNames = {
        [this.cameraModes.FOLLOW]: "Follow",
        [this.cameraModes.ORBIT]: "Orbit",
        [this.cameraModes.TOP]: "Top Down",
      };
      modeDisplay.textContent = modeNames[this.currentCameraMode];
      console.log("Camera mode display updated to:", modeDisplay.textContent); // Debug
    }
  }

  cycleCameraMode() {
    const modes = Object.values(this.cameraModes);
    const currentIndex = modes.indexOf(this.currentCameraMode);
    this.currentCameraMode = modes[(currentIndex + 1) % modes.length];

    console.log("Cycling camera mode to:", this.currentCameraMode); // Debug

    this.resetCamera();
    this.updateCameraControls();
    this.updateCameraModeDisplay();

    // Update UI active state
    const cameraModeItems = document.querySelectorAll(".camera-mode-item");
    cameraModeItems.forEach((item) => {
      item.classList.remove("active");
      if (item.dataset.mode === this.currentCameraMode) {
        item.classList.add("active");
      }
    });
  }

  // PERBAIKAN: Reset camera yang lebih baik
  resetCamera() {
    console.log("Resetting camera for mode:", this.currentCameraMode); // Debug

    switch (this.currentCameraMode) {
      case this.cameraModes.FOLLOW:
        this.camera.position.set(25, 20, 25);
        this.camera.lookAt(0, 5, 0);
        break;
      case this.cameraModes.ORBIT:
        this.camera.position.set(0, 15, 25);
        this.controls.target.set(0, 5, 0);
        this.camera.lookAt(this.controls.target);
        break;
      case this.cameraModes.TOP:
        this.camera.position.set(0, 35, 0.1); // Sedikit offset untuk menghindari issues
        this.controls.target.set(0, 0, 0);
        this.camera.lookAt(this.controls.target);
        break;
    }

    this.controls.update();
  }

  updateCameraControls() {
    console.log("Updating camera controls for mode:", this.currentCameraMode); // Debug

    switch (this.currentCameraMode) {
      case this.cameraModes.FOLLOW:
        this.controls.enabled = false;
        this.controls.minDistance = 10;
        this.controls.maxDistance = 30;
        break;
      case this.cameraModes.ORBIT:
        this.controls.enabled = true;
        this.controls.minDistance = 8;
        this.controls.maxDistance = 40;
        this.controls.maxPolarAngle = Math.PI * 0.8;
        break;
      case this.cameraModes.TOP:
        this.controls.enabled = true;
        this.controls.minDistance = 20;
        this.controls.maxDistance = 60;
        this.controls.maxPolarAngle = Math.PI / 2;
        break;
    }
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

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = 10;
    this.controls.maxDistance = 50;
    this.controls.maxPolarAngle = Math.PI * 0.8;

    // Initialize camera
    this.resetCamera();
    this.updateCameraControls();
  }

  setupLights() {
    const ambientLight = new THREE.AmbientLight(0x404040, 0.8);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(20, 30, 20);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    this.scene.add(directionalLight);

    const pointLight = new THREE.PointLight(0xff4757, 0.6, 30);
    pointLight.position.set(0, 10, 0);
    this.scene.add(pointLight);
  }

  async createEnvironment() {
    try {
      this.scene.background = await new Promise((resolve) => {
        this.textureLoader.load(
          "assets/textures/space-bg.jpg",
          resolve,
          undefined,
          () => {
            resolve(new THREE.Color(0x001122));
          }
        );
      });
    } catch (error) {
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

  createGrid() {
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

    this.create3DBoundaries(halfSize);
  }

  create3DBoundaries(halfSize) {
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

    const wallMaterial = new THREE.MeshPhongMaterial({
      color: 0xff4757,
      transparent: true,
      opacity: 0.1,
      side: THREE.DoubleSide,
    });

    // Walls
    const backWall = new THREE.Mesh(
      new THREE.PlaneGeometry(this.gridSize, this.gridSize),
      wallMaterial
    );
    backWall.position.set(0, halfSize, -halfSize);
    this.scene.add(backWall);

    const frontWall = new THREE.Mesh(
      new THREE.PlaneGeometry(this.gridSize, this.gridSize),
      wallMaterial
    );
    frontWall.position.set(0, halfSize, halfSize);
    frontWall.rotation.y = Math.PI;
    this.scene.add(frontWall);

    const leftWall = new THREE.Mesh(
      new THREE.PlaneGeometry(this.gridSize, this.gridSize),
      wallMaterial
    );
    leftWall.position.set(-halfSize, halfSize, 0);
    leftWall.rotation.y = Math.PI / 2;
    this.scene.add(leftWall);

    const rightWall = new THREE.Mesh(
      new THREE.PlaneGeometry(this.gridSize, this.gridSize),
      wallMaterial
    );
    rightWall.position.set(halfSize, halfSize, 0);
    rightWall.rotation.y = -Math.PI / 2;
    this.scene.add(rightWall);

    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(this.gridSize, this.gridSize),
      wallMaterial
    );
    ceiling.position.set(0, this.gridSize, 0);
    ceiling.rotation.x = Math.PI / 2;
    this.scene.add(ceiling);
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

    // Reset camera
    this.resetCamera();
    this.updateCameraModeDisplay();
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

  // PERBAIKAN: Update camera yang lebih robust
  updateCamera() {
    if (!this.snake || !this.snake.head) return;

    const snakePos = this.snake.getHeadPosition();

    switch (this.currentCameraMode) {
      case this.cameraModes.FOLLOW:
        // PERBAIKAN: Camera follow yang lebih baik
        const followDistance = 15;
        const followHeight = 10;

        // Dapatkan arah ular yang sudah dinormalisasi
        const snakeDirection = this.snake.getDirection().clone().normalize();

        // Hitung posisi kamera di belakang ular
        const targetCamPos = new THREE.Vector3(
          snakePos.x - snakeDirection.x * followDistance,
          snakePos.y + followHeight,
          snakePos.z - snakeDirection.z * followDistance
        );

        // Smooth camera movement dengan lerp
        this.camera.position.lerp(targetCamPos, 0.1);

        // Look at point di depan ular
        const lookTarget = new THREE.Vector3(
          snakePos.x + snakeDirection.x * 5,
          snakePos.y + 2,
          snakePos.z + snakeDirection.z * 5
        );

        this.camera.lookAt(lookTarget);
        break;

      case this.cameraModes.ORBIT:
        // Orbit mode - update target untuk mengikuti ular
        this.controls.target.lerp(snakePos, 0.05);
        break;

      case this.cameraModes.TOP:
        // Top-down view - update target untuk mengikuti ular
        this.controls.target.lerp(snakePos, 0.05);
        break;
    }
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

      this.soundManager.play("eatSound");
      this.moveDelay = Math.max(0.03, this.moveDelay * 0.95);
      this.updateSpeedDisplay();
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
    this.soundManager.play("gameOverSound");
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
        case "KeyC":
          event.preventDefault();
          console.log("C key pressed - changing camera mode"); // Debug
          this.cycleCameraMode();
          break;
      }
    });

    document.getElementById("restart").addEventListener("click", () => {
      this.startGame();
    });

    document.getElementById("resume").addEventListener("click", () => {
      this.togglePause();
    });

    // PERBAIKAN: Panggil setupCameraControls setelah DOM siap
    setTimeout(() => {
      this.setupCameraControls();
      this.updateCameraModeDisplay(); // Initial display update
    }, 100);

    this.setupMobileControls();

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

    // PERBAIKAN: Only update controls if they are enabled
    if (this.controls.enabled) {
      this.controls.update();
    }

    this.renderer.render(this.scene, this.camera);
  }
}

// Initialize game
window.addEventListener("load", () => {
  new Game();
});
