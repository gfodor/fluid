function AABB (min, max) {
    this.min = [min[0], min[1], min[2]];
    this.max = [max[0], max[1], max[2]];
}

AABB.prototype.computeVolume = function () {
    var volume = 1;
    for (var i = 0; i < 3; ++i) {
        volume *= (this.max[i] - this.min[i]);
    }
    return volume;
}

AABB.prototype.randomPoint = function () {
    var point = [];
    for (var i = 0; i < 3; ++i) {
        point[i] = this.min[i] + Math.random() * (this.max[i] - this.min[i]);
    }
    return point;
}

const SPAWN_BOX = new AABB([14.9, 29.9, 0], [15.1, 26.45, 2])

var FluidParticles = (function () {
    var FOV = Math.PI / 3;

    var GRID_WIDTH = 30,
        GRID_HEIGHT = 30,
        GRID_DEPTH = 5;

    var PARTICLES_PER_CELL = 10;

    function FluidParticles () {
        var canvas = this.canvas = document.getElementById('canvas');
        // Initialize Three.js scene
        this.scene = new THREE.Scene();
        
        // Create ThreeJS camera with matching FOV
        this.threeCamera = new THREE.PerspectiveCamera(
            FOV * 180 / Math.PI, 
            canvas.width / canvas.height,
            0.1,
            100.0
        );
        
        const context = canvas.getContext("webgl2", {
          powerPreference: "high-performance",
          antialias: false,
          stencil: true,
          depth: true,
          alpha: true,
          // preserveDrawingBuffer: true,
        });

        // Initialize Three.js renderer sharing the WebGL context
        this.threeRenderer = new THREE.WebGLRenderer({ context });
        var wgl = this.wgl = new WrappedGL(context);

        this.threeRenderer.setSize(canvas.width, canvas.height);
        this.threeRenderer.setPixelRatio(1.0);
        this.threeRenderer.autoClear = false;

        // Setup basic Three.js scene with a sphere
        this.scene.background = new THREE.Color(0x990000);

        const light = new THREE.DirectionalLight(0xffffff, 1);
        light.position.set(10, 20, 10);
        this.scene.add(light);
        this.scene.add(new THREE.AmbientLight(0x404040));

        const geometry = new THREE.SphereGeometry(5, 32, 32);
        const material = new THREE.MeshPhongMaterial({ color: 0xffff00 });
        const sphere = new THREE.Mesh(geometry, material);
        sphere.position.y = 20;
        sphere.position.x = 10;
        this.scene.add(sphere);

        this.projectionMatrix = Utilities.makePerspectiveMatrix(new Float32Array(16), FOV, this.canvas.width / this.canvas.height, 0.1, 100.0);
        this.camera = new Camera(this.canvas, [GRID_WIDTH / 2, 15, GRID_DEPTH / 2]);

        this.simulatorRenderer = new SimulatorRenderer(this.canvas, this.wgl, this.projectionMatrix, this.camera, [GRID_WIDTH, GRID_HEIGHT, GRID_DEPTH], (function () {
            start.call(this);
        }).bind(this));

        function start() {
            setTimeout(() => this.startSimulation());

            this.currentPresetIndex = 0;
            this.editedSinceLastPreset = false;
            this.gridCellDensity = 0.5;

            if (document.location.toString().indexOf('desktop') !== -1) {
                this.timeStep = 1.0 / 60.0;
            } else {
                this.timeStep = 1.0 / 30.0;
            }

            canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
            canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
            document.addEventListener('mouseup', this.onMouseUp.bind(this));
            document.addEventListener('touchmove', this.onMouseMove.bind(this));
            document.addEventListener('touchstart', this.onMouseDown.bind(this));
            document.addEventListener('touchend', this.onMouseUp.bind(this));
            document.addEventListener('keydown', this.onKeyDown.bind(this));
            window.addEventListener('resize', this.onResize.bind(this));
            
            this.onResize();

            var lastTime = 0;
            var update = (function (currentTime) {
                var deltaTime = currentTime - lastTime || 0;
                lastTime = currentTime;

                // Update Three.js camera to match fluid camera
                const pos = this.camera.getPosition();
                this.threeCamera.position.set(pos[0], pos[1], pos[2]);
                this.threeCamera.lookAt(GRID_WIDTH / 2, 15, GRID_DEPTH / 2);
                
                // Clear everything
                //this.wgl.gl.clear(this.wgl.gl.COLOR_BUFFER_BIT | this.wgl.gl.DEPTH_BUFFER_BIT);

                // Render Three.js scene first
                this.threeRenderer.render(this.scene, this.threeCamera);

                // Then render fluid simulation
                this.simulatorRenderer.update(this.timeStep);

                requestAnimationFrame(update);
            }).bind(this);

            setTimeout(() => update());
        }
    }

    FluidParticles.prototype.onResize = function (event) {
        this.canvas.width = 800;
        this.canvas.height = 800;
        
        Utilities.makePerspectiveMatrix(this.projectionMatrix, FOV, this.canvas.width / this.canvas.height, 0.1, 100.0);
        this.threeRenderer.setSize(this.canvas.width, this.canvas.height);
        this.threeCamera.aspect = this.canvas.width / this.canvas.height;
        this.threeCamera.updateProjectionMatrix();
        
        this.simulatorRenderer.onResize(event);
    }

    FluidParticles.prototype.onMouseMove = function (event) {
        if (event.touches) event = event.touches[0];
        this.simulatorRenderer.onMouseMove(event);
    };

    FluidParticles.prototype.onMouseDown = function (event) {
        if (event.touches) event = event.touches[0];
        this.simulatorRenderer.onMouseDown(event);
    };

    FluidParticles.prototype.onMouseUp = function (event) {
        if (event.touches) event = event.touches[0];
        this.simulatorRenderer.onMouseUp(event);
    };

    FluidParticles.prototype.onKeyDown = function (event) {
        this.simulatorRenderer.onKeyDown(event);
    };

    FluidParticles.prototype.startSimulation = function () {
        var desiredParticleCount = 6000;
        var particlesWidth = 512;
        var particlesHeight = Math.ceil(desiredParticleCount / particlesWidth);

        var particleCount = particlesWidth * particlesHeight;
        var particlePositions = [];
        
        var totalVolume = SPAWN_BOX.computeVolume();

        for (var j = 0; j < particleCount; ++j) {
            var position = SPAWN_BOX.randomPoint();
            particlePositions.push(position);
        }

        var gridCells = GRID_WIDTH * GRID_HEIGHT * GRID_DEPTH * this.gridCellDensity;
        var gridResolutionY = Math.ceil(Math.pow(gridCells / 2, 1.0 / 3.0));
        var gridResolutionZ = gridResolutionY * 1;
        var gridResolutionX = gridResolutionY * 2;

        var gridSize = [GRID_WIDTH, GRID_HEIGHT, GRID_DEPTH];
        var gridResolution = [gridResolutionX, gridResolutionY, gridResolutionZ];

        var sphereRadius = 0.275;
        this.simulatorRenderer.init(particlesWidth, particlesHeight, particlePositions, gridSize, gridResolution, PARTICLES_PER_CELL, sphereRadius);

        this.camera.setBounds(0, Math.PI / 2);
    }

    return FluidParticles;
}());
