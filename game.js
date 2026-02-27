/**
 * Toon Drive - Optimized Low Poly Engine
 */

class ToonGame {
    constructor() {
        this.init();
        this.createWorld();
        this.createCar();
        this.setupInput();
        this.setupMusic();
        this.animate();
    }

    init() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87ceeb);
        this.scene.fog = new THREE.Fog(0x87ceeb, 20, 300);

        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('game'), antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        this.renderer.shadowMap.enabled = true; // Enable Shadows
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        const ambient = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambient);

        const sun = new THREE.DirectionalLight(0xffffff, 0.8);
        sun.position.set(50, 100, 50);
        sun.castShadow = true;
        sun.shadow.mapSize.width = 1024;
        sun.shadow.mapSize.height = 1024;
        sun.shadow.camera.left = -200;
        sun.shadow.camera.right = 200;
        sun.shadow.camera.top = 200;
        sun.shadow.camera.bottom = -200;
        this.scene.add(sun);

        this.speed = 0;
        this.angle = 0;
        this.driftAngle = 0;
        this.isCruiseMode = false;
        this.cruiseSpeed = 0;
        this.isDrifting = false;
        this.particles = []; 
        this.collidables = []; // Static objects with bounds
        this.keys = {};
        this.clock = new THREE.Clock();
        
        // Game States: 'MENU', 'PLAYING', 'PAUSED'
        this.gameState = 'MENU';
        this.ui = {
            mainMenu: document.getElementById('main-menu'),
            pauseMenu: document.getElementById('pause-menu'),
            howToModal: document.getElementById('how-to-modal'),
            hud: document.getElementById('hud'),
            speed: document.getElementById('speed'),
            speedLabel: document.querySelector('.speed-card small')
        };
    }

    createWorld() {
        // Ground with Texture
        const grassTex = new THREE.TextureLoader().load('grass.jpg');
        grassTex.wrapS = THREE.RepeatWrapping;
        grassTex.wrapT = THREE.RepeatWrapping;
        grassTex.repeat.set(100, 100); // Repeat across the 1000x1000 field

        const ground = new THREE.Mesh(
            new THREE.PlaneGeometry(1000, 1000),
            new THREE.MeshLambertMaterial({ map: grassTex })
        );
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);

        // Simple Road Cross
        const roadMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
        const hRoad = new THREE.Mesh(new THREE.PlaneGeometry(1000, 20), roadMat);
        hRoad.rotation.x = -Math.PI / 2;
        hRoad.position.y = 0.01;
        hRoad.receiveShadow = true;
        this.scene.add(hRoad);

        const vRoad = hRoad.clone();
        vRoad.rotation.z = Math.PI / 2;
        this.scene.add(vRoad);

        // Add 50 simple buildings (Performance friendly)
        const buildingColors = [0xff6b6b, 0x4ecdc4, 0x45b7d1, 0xffadad];
        for (let i = 0; i < 60; i++) {
            const h = 5 + Math.random() * 15;
            const mesh = new THREE.Mesh(
                new THREE.BoxGeometry(10, h, 10),
                new THREE.MeshLambertMaterial({ color: buildingColors[i % 4] })
            );
            
            // Randomly scatter, avoiding roads
            let x, z;
            do {
                x = (Math.random() - 0.5) * 400;
                z = (Math.random() - 0.5) * 400;
            } while (Math.abs(x) < 15 || Math.abs(z) < 15);

            mesh.position.set(x, h/2, z);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            this.scene.add(mesh);

            // Store for collision (AABB Box logic)
            this.collidables.push({
                x: x,
                z: z,
                hw: 5, // Half-width (Building is 10x10)
                hd: 5, // Half-depth
                type: 'building'
            });
        }

        // Add low-poly trees (Box trees)
        for (let i = 0; i < 100; i++) {
            this.createTree(
                (Math.random() - 0.5) * 500,
                (Math.random() - 0.5) * 500
            );
        }
    }

    createTree(x, z) {
        if (Math.abs(x) < 20 || Math.abs(z) < 20) return; // Stay off roads
        
        const group = new THREE.Group();
        const trunk = new THREE.Mesh(
            new THREE.BoxGeometry(1, 4, 1),
            new THREE.MeshLambertMaterial({ color: 0x8b4513 })
        );
        trunk.position.y = 2;
        trunk.castShadow = true;
        group.add(trunk);

        const leaves = new THREE.Mesh(
            new THREE.BoxGeometry(4, 4, 4),
            new THREE.MeshLambertMaterial({ color: 0x228b22 })
        );
        leaves.position.y = 5;
        leaves.castShadow = true;
        group.add(leaves);

        group.position.set(x, 0, z);
        this.scene.add(group);

        this.collidables.push({
            x: x,
            z: z,
            hw: 2, // Half-width (Tree leaves are 4x4)
            hd: 2,
            type: 'tree'
        });
    }

    createCar() {
        this.car = new THREE.Group();
        this.scene.add(this.car);

        // 1. Add a Placeholder
        const placeholder = new THREE.Mesh(
            new THREE.BoxGeometry(2.5, 1.2, 4.5),
            new THREE.MeshLambertMaterial({ color: 0xff4444 })
        );
        placeholder.position.y = 1;
        this.car.add(placeholder);

        // Check if running via file:// (CORS will fail)
        if (window.location.protocol === 'file:') {
            console.error("ERROR: Browsers block 3D models when opening HTML files directly. You must use a Local Server (like VS Code Live Server).");
            // Show message in UI
            const msg = document.createElement('div');
            msg.style.cssText = "position:fixed; top:10px; left:50%; transform:translateX(-50%); background:red; color:white; padding:10px; z-index:1000; border-radius:5px; font-family:sans-serif; text-align:center;";
            msg.innerHTML = "<b>Security Error:</b> Browser blocked the 3D model.<br>Please use a <u>Local Server</u> to see your car.";
            document.body.appendChild(msg);
            return;
        }

        // 2. Load the actual .glb file
        const loader = new THREE.GLTFLoader();
        console.log("Starting to load car.glb...");
        
        loader.load('car1.glb', 
            (gltf) => {
                console.log("car.glb successfully loaded!");
                this.car.remove(placeholder);
                const model = gltf.scene;
                
                // Auto-scale model to fit the game world perfectly
                const box = new THREE.Box3().setFromObject(model);
                const size = new THREE.Vector3();
                box.getSize(size);
                
                // We want the car to be roughly 5 units long (Z-axis)
                const targetLength = 5;
                const scale = targetLength / Math.max(size.x, size.y, size.z);
                model.scale.set(scale, scale, scale);
                
                // Center the model so it sits correctly on the origin
                const center = new THREE.Vector3();
                box.getCenter(center);
                model.position.x = -center.x * scale;
                model.position.y = -box.min.y * scale; // Keep bottom on ground
                model.position.z = -center.z * scale;
                
                // Orient the car model (Flipped to 0 to fix reverse)
                model.rotation.y = 0; 
                
                // Shadows enabled for the car
                model.traverse(node => {
                    if (node.isMesh) {
                        node.castShadow = true;
                        node.receiveShadow = true;
                    }
                });

                this.car.add(model);
            },
            (xhr) => {
                console.log((xhr.loaded / xhr.total * 100) + '% loaded');
            },
            (error) => {
                console.error("Failed to load car.glb:", error);
                placeholder.material.color.setHex(0xffaa00); // Change color to orange on error
            }
        );
    }

    setupInput() {
        window.addEventListener('keydown', e => {
            this.keys[e.code] = true;
            
            // Toggle Cruise Mode
            if (e.code === 'KeyL' && this.gameState === 'PLAYING') {
                this.isCruiseMode = !this.isCruiseMode;
                if (this.isCruiseMode) {
                    this.cruiseSpeed = Math.max(10, Math.abs(this.speed));
                }
            }

            // Pause toggle
            if (e.code === 'Escape') {
                if (this.gameState === 'PLAYING') {
                    this.pause();
                } else if (this.gameState === 'PAUSED') {
                    this.resume();
                }
            }

            // Enter to start from menu
            if (e.code === 'Enter' && this.gameState === 'MENU') {
                this.startGame();
            }
        });
        window.addEventListener('keyup', e => this.keys[e.code] = false);

        // Menu Button Listeners
        document.getElementById('start-btn').onclick = () => this.startGame();
        document.getElementById('resume-btn').onclick = () => this.resume();
        document.getElementById('restart-btn').onclick = () => this.resetGame(true);
        document.getElementById('quit-btn').onclick = () => this.showMainMenu();
        document.getElementById('how-to-btn').onclick = () => this.toggleHowTo(true);
        document.getElementById('close-how-to').onclick = () => this.toggleHowTo(false);

        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    // --- State Management ---

    startGame() {
        this.gameState = 'PLAYING';
        this.ui.mainMenu.classList.add('hidden');
        this.ui.hud.classList.remove('hidden');
    }

    pause() {
        this.gameState = 'PAUSED';
        this.ui.pauseMenu.classList.remove('hidden');
        this.ui.hud.classList.add('hidden');
    }

    resume() {
        this.gameState = 'PLAYING';
        this.ui.pauseMenu.classList.add('hidden');
        this.ui.hud.classList.remove('hidden');
    }

    showMainMenu() {
        this.gameState = 'MENU';
        this.ui.pauseMenu.classList.add('hidden');
        this.ui.mainMenu.classList.remove('hidden');
        this.ui.hud.classList.add('hidden');
        this.resetGame(false);
    }

    resetGame(shouldPlay) {
        this.speed = 0;
        this.angle = 0;
        this.driftAngle = 0;
        this.car.position.set(0, 0, 0);
        this.car.rotation.set(0, 0, 0);
        this.camera.position.set(0, 5, -10); // Quick reset camera
        if (shouldPlay) this.resume();
    }

    toggleHowTo(show) {
        if (show) {
            this.ui.howToModal.classList.remove('hidden');
        } else {
            this.ui.howToModal.classList.add('hidden');
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        const dt = Math.min(this.clock.getDelta(), 0.1);
        
        // Always render, but only update physics if playing
        if (this.gameState !== 'PLAYING') {
            this.renderer.render(this.scene, this.camera);
            return;
        }

        // Physics Constants
        const ACCEL = 50;
        const MAX_SPEED = 50;
        const FRICTION = 0.5; // Drag coefficient
        const BRAKE_FORCE = 120;

        // Input Handling
        let inputActive = this.keys['KeyW'] || this.keys['KeyS'] || this.keys['Space'];
        if (inputActive) this.isCruiseMode = false;

        if (this.keys['KeyW']) {
            // Stronger acceleration during drift to push through friction
            const accelPower = this.isDrifting ? ACCEL * 0.8 : ACCEL;
            this.speed += accelPower * dt;
        } 
        
        // Soft Brake (KeyS) - Controlled deceleration
        if (this.keys['KeyS']) {
            const SOFT_BRAKE = 45; 
            if (this.speed > 0.5) {
                this.speed -= SOFT_BRAKE * dt;
            } else if (this.speed > -MAX_SPEED * 0.3) {
                this.speed -= ACCEL * 0.3 * dt; // Slow reverse
            }
        }

        if (this.isCruiseMode && !this.keys['KeyW'] && !this.keys['KeyS']) {
            // Cruise Mode Logic
            this.speed += (this.cruiseSpeed - this.speed) * 2 * dt;
        }

        // Dynamic factors
        const speedFactor = Math.abs(this.speed) / MAX_SPEED;

        const isHandbraking = this.keys['Space'];
        const isTurning = this.keys['KeyA'] || this.keys['KeyD'];

        // Drift Logic - Initiation
        if (isHandbraking && speedFactor > 0.15 && isTurning) {
            this.isDrifting = true;
        }
        
        // Drift Logic - Termination
        if (this.isDrifting) {
            const isStraightening = !isTurning && Math.abs(this.driftAngle) < 0.15;
            const isTooSlow = speedFactor < 0.05;
            
            if (isStraightening || isTooSlow) {
                this.isDrifting = false;
            }
        }

        // Apply handbrake braking
        if (isHandbraking) {
            // During active drift, handbrake barely brakes, mostly just maintains skid
            const brakeEffect = (this.isDrifting ? 5 : BRAKE_FORCE) * dt;
            this.speed -= Math.sign(this.speed) * brakeEffect;
        }

        // Standard Drag
        if (!this.isCruiseMode && !isHandbraking) {
            this.speed -= FRICTION * this.speed * dt;
        }

        // DRIFT DRAG: Real cars lose speed, but we want to stay in 20-30 range
        if (this.isDrifting) {
            // Friction is higher only when near/above the cap
            const baseDriftDrag = 10;
            const extraDriftDrag = Math.max(0, this.speed - 25) * 2; // Resist going over 30
            this.speed -= (baseDriftDrag + extraDriftDrag) * dt;
        }

        // STRICT Speed Limit with Drift Cap
        const currentMax = this.isDrifting ? 30 : MAX_SPEED;
        this.speed = Math.max(-MAX_SPEED * 0.3, Math.min(currentMax, this.speed));

        // Steering Power
        let steerPower = Math.min(1.5, 2.5 / (1 + speedFactor * 0.5));
        if (this.isDrifting) steerPower *= 2.0; 
        
        let steerInput = 0;
        if (this.keys['KeyA']) steerInput = 1;
        if (this.keys['KeyD']) steerInput = -1;
        
        this.angle += steerInput * steerPower * dt * Math.sign(this.speed);

        // Drift Visual Angle
        let targetDrift = 0;
        if (this.isDrifting) {
            targetDrift = steerInput * 0.75; 
        } else {
            targetDrift = steerInput * speedFactor * 0.15; 
        }
        this.driftAngle = THREE.MathUtils.lerp(this.driftAngle, targetDrift, 5 * dt);

        // Position Updates (Momentum Lag)
        if (this.moveDirection === undefined) this.moveDirection = this.angle;
        const gripFactor = this.isDrifting ? 2.0 : 8.0; 
        this.moveDirection = THREE.MathUtils.lerp(this.moveDirection, this.angle, gripFactor * dt);
        
        this.car.position.x += Math.sin(this.moveDirection) * this.speed * dt;
        this.car.position.z += Math.cos(this.moveDirection) * this.speed * dt;
        
        // Final Car Rotation
        this.car.rotation.y = this.angle + this.driftAngle;

        // --- COLLISION CHECK ---
        this.checkCollisions(dt);
        
        // Grounded Body Roll (Very subtle to keep wheels down)
        const targetRoll = steerInput * speedFactor * 0.04; 
        this.car.rotation.z = THREE.MathUtils.lerp(this.car.rotation.z, targetRoll, 5 * dt);
        
        // Pitch
        let targetPitch = 0;
        if (this.keys['KeyW']) targetPitch = -0.02;
        if (this.keys['KeyS'] || isHandbraking) targetPitch = 0.04;
        this.car.rotation.x = THREE.MathUtils.lerp(this.car.rotation.x, targetPitch, 5 * dt);

        // Speed Cap Enforcement (Safety Check)
        if (Math.abs(this.speed) > MAX_SPEED) this.speed = Math.sign(this.speed) * MAX_SPEED;

        // Particles (Smoke)
        if (this.isDrifting || (isHandbraking && speedFactor > 0.3)) {
            this.spawnSmoke();
        }
        this.updateParticles(dt);

        // Camera Follow (Fixed Forza/GTA Tight Cam)
        const camDistance = 6.5; // Locked distance
        const camHeight = 1.8;   // Lower, sportier angle
        const speedZoom = (Math.abs(this.speed) * 0.01); // Minimal zoom expansion
        
        const camOffset = new THREE.Vector3(
            -Math.sin(this.angle) * (camDistance + speedZoom),
            camHeight,
            -Math.cos(this.angle) * (camDistance + speedZoom)
        );
        
        const targetCamPos = this.car.position.clone().add(camOffset);
        this.camera.position.lerp(targetCamPos, 0.1);
        
        // Look slightly ahead/above the car for better visibility
        const lookTarget = this.car.position.clone();
        lookTarget.y += 1.5; 
        this.camera.lookAt(lookTarget);

        // UI update
        this.ui.speed.innerText = Math.abs(Math.round(this.speed));
        
        // Visual indicator for Cruise Mode
        if (this.ui.speedLabel) {
            this.ui.speedLabel.innerText = this.isCruiseMode ? `CRUISE @ ${Math.round(this.cruiseSpeed)}` : "KM/H";
            this.ui.speedLabel.style.color = this.isCruiseMode ? "#4ecdc4" : "rgba(255,255,255,0.7)";
        }

        this.renderer.render(this.scene, this.camera);
    }
    spawnSmoke() {
        const smokeGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
        const smokeMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 });
        const smoke = new THREE.Mesh(smokeGeo, smokeMat);
        
        // Position smoke at rear of car
        const offset = new THREE.Vector3((Math.random() - 0.5) * 2, 0.2, -2);
        offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.car.rotation.y);
        smoke.position.copy(this.car.position).add(offset);
        
        smoke.userData = {
            life: 1.0,
            velocity: new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 2, (Math.random() - 0.5) * 2)
        };
        
        this.scene.add(smoke);
        this.particles.push(smoke);
    }

    updateParticles(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.userData.life -= dt * 1.5;
            
            p.position.addScaledVector(p.userData.velocity, dt);
            p.scale.multiplyScalar(1.02); // Grow
            p.material.opacity = p.userData.life;
            
            if (p.userData.life <= 0) {
                this.scene.remove(p);
                p.geometry.dispose();
                p.material.dispose();
                this.particles.splice(i, 1);
            }
        }
    }

    checkCollisions(dt) {
        const carX = this.car.position.x;
        const carZ = this.car.position.z;
        const carRadius = 1.8; // Approximate car collision radius

        for (const obj of this.collidables) {
            // Find closest point on Box to Circle center
            const closestX = Math.max(obj.x - obj.hw, Math.min(carX, obj.x + obj.hw));
            const closestZ = Math.max(obj.z - obj.hd, Math.min(carZ, obj.z + obj.hd));
            
            const dx = carX - closestX;
            const dz = carZ - closestZ;
            const distSq = dx * dx + dz * dz;

            if (distSq < carRadius * carRadius) {
                // Collision!
                const impactForce = Math.abs(this.speed);
                this.speed = -this.speed * 0.4;
                
                const dist = Math.sqrt(distSq) || 0.1;
                const overlap = carRadius - dist;
                
                // Normal of collision
                const nx = dx / dist;
                const nz = dz / dist;
                
                this.car.position.x += nx * overlap;
                this.car.position.z += nz * overlap;
                
                if (impactForce > 10) {
                    this.car.rotation.x += (Math.random() - 0.5) * 0.2;
                    this.car.rotation.z += (Math.random() - 0.5) * 0.2;
                    this.isDrifting = false;
                }
                
                break;
            }
        }
    }
    // ——— MUSIC SYSTEM ———
    setupMusic() {
        // Define your tracks here. Add filenames from the music/ folder.
        // Supported: .mp3, .ogg, .wav
        this.musicTracks = [
            'music/track1.mp3',
            'music/track2.mp3',
            'music/track3.mp3',
            'music/track4.mp3',
            'music/track5.mp3'
        ];
        this.currentTrackIndex = 0;
        this.musicEnabled = false;
        this.audio = new Audio();
        this.audio.volume = 0.4;

        // When a track ends, play the next one
        this.audio.addEventListener('ended', () => {
            this.currentTrackIndex = (this.currentTrackIndex + 1) % this.musicTracks.length;
            this.playCurrentTrack();
        });

        // Handle load errors (skip to next track)
        this.audio.addEventListener('error', () => {
            if (this.musicEnabled) {
                this.currentTrackIndex = (this.currentTrackIndex + 1) % this.musicTracks.length;
                // Avoid infinite loop if all tracks fail
                this._errorCount = (this._errorCount || 0) + 1;
                if (this._errorCount < this.musicTracks.length) {
                    this.playCurrentTrack();
                } else {
                    console.warn('No playable music tracks found in music/ folder.');
                    this.musicEnabled = false;
                    this.updateMusicUI();
                }
            }
        });

        // Toggle button
        const btn = document.getElementById('music-toggle');
        btn.addEventListener('click', () => this.toggleMusic());
    }

    toggleMusic() {
        this.musicEnabled = !this.musicEnabled;
        this._errorCount = 0;

        if (this.musicEnabled) {
            this.playCurrentTrack();
        } else {
            this.audio.pause();
            this.audio.currentTime = 0;
        }
        this.updateMusicUI();
    }

    playCurrentTrack() {
        const track = this.musicTracks[this.currentTrackIndex];
        this.audio.src = track;
        this.audio.play().catch(() => {});
        this.updateMusicUI();
    }

    updateMusicUI() {
        const btn = document.getElementById('music-toggle');
        const icon = document.getElementById('music-icon');
        const label = document.getElementById('music-label');
        const nowPlaying = document.getElementById('now-playing');

        if (this.musicEnabled) {
            btn.classList.add('active');
            icon.textContent = '♪';
            label.textContent = 'MUSIC ON';

            // Show track name
            const trackName = this.musicTracks[this.currentTrackIndex]
                .split('/').pop()
                .replace(/\.[^.]+$/, '')
                .replace(/[_-]/g, ' ')
                .toUpperCase();
            nowPlaying.textContent = '♪ NOW PLAYING: ' + trackName;
            nowPlaying.classList.remove('hidden');
        } else {
            btn.classList.remove('active');
            icon.textContent = '♪';
            label.textContent = 'MUSIC OFF';
            nowPlaying.classList.add('hidden');
        }
    }
}

new ToonGame();
