'use strict'

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

AABB.prototype.computeSurfaceArea = function () {
    var width = this.max[0] - this.min[0];
    var height = this.max[1] - this.min[1];
    var depth = this.max[2] - this.min[2];

    return 2 * (width * height + width * depth + height * depth);
}

//returns new AABB with the same min and max (but not the same array references)
AABB.prototype.clone = function () {
    return new AABB(
        [this.min[0], this.min[1], this.min[2]],
        [this.max[0], this.max[1], this.max[2]]
    );
}

AABB.prototype.randomPoint = function () { //random point in this AABB
    var point = [];
    for (var i = 0; i < 3; ++i) {
        point[i] = this.min[i] + Math.random() * (this.max[i] - this.min[i]);
    }
    return point;
}

const SPAWN_BOX = new AABB([14.2, 29.9, 0], [15.7, 29.45, 2])

var FluidParticles = (function () {
    var FOV = Math.PI / 3;

    var State = {
        EDITING: 0,
        SIMULATING: 1
    };

    var GRID_WIDTH = 30,
        GRID_HEIGHT = 30,
        GRID_DEPTH = 5;

    var PARTICLES_PER_CELL = 10;

    function FluidParticles () {

        var canvas = this.canvas = document.getElementById('canvas');
        var wgl = this.wgl = new WrappedGL(canvas);

        window.wgl = wgl;

        this.projectionMatrix = Utilities.makePerspectiveMatrix(new Float32Array(16), FOV, this.canvas.width / this.canvas.height, 0.1, 100.0);
        this.camera = new Camera(this.canvas, [GRID_WIDTH / 2, 15, GRID_DEPTH / 2]);

        this.simulatorRenderer = new SimulatorRenderer(this.canvas, this.wgl, this.projectionMatrix, this.camera, [GRID_WIDTH, GRID_HEIGHT, GRID_DEPTH], (function () {
            start.call(this);
        }).bind(this));

        function start(programs) {
            this.state = State.EDITING;

            setTimeout(() => this.startSimulation());

            this.currentPresetIndex = 0;
            this.editedSinceLastPreset = false; //whether the user has edited the last set preset

            //using gridCellDensity ensures a linear relationship to particle count
            this.gridCellDensity = 0.5; //simulation grid cell density per world space unit volume

            if (document.location.toString().indexOf('desktop') !== -1) {
              this.timeStep = 1.0 / 60.0; // speed
            } else {
              this.timeStep = 1.0 / 30.0; // speed
            }
            // fluidity: this.simulatorRenderer.simulator.flipness = value;

            ///////////////////////////////////////////////////////
            // interaction state stuff


            canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
            canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
            document.addEventListener('mouseup', this.onMouseUp.bind(this));
            // Use events that work on both mouse and touchscreen:
            document.addEventListener('touchmove', this.onMouseMove.bind(this));
            document.addEventListener('touchstart', this.onMouseDown.bind(this));
            document.addEventListener('touchend', this.onMouseUp.bind(this));
          
            document.addEventListener('keydown', this.onKeyDown.bind(this));

            window.addEventListener('resize', this.onResize.bind(this));
            this.onResize();

            ////////////////////////////////////////////////////
            // start the update loop

            var lastTime = 0;
            var update = (function (currentTime) {
                var deltaTime = currentTime - lastTime || 0;
                lastTime = currentTime;

                this.simulatorRenderer.update(this.timeStep);

                requestAnimationFrame(update);
            }).bind(this);

            // Hacky, wait a tick so textuers are created.
            setTimeout(() => update());
        }
    }

    FluidParticles.prototype.onResize = function (event) {
        this.canvas.width = 800;
        this.canvas.height = 800;
        Utilities.makePerspectiveMatrix(this.projectionMatrix, FOV, this.canvas.width / this.canvas.height, 0.1, 100.0);

        this.simulatorRenderer.onResize(event);
    }

    FluidParticles.prototype.onMouseMove = function (event) {
        if (event.touches) {
          event = event.touches[0];
        }

        this.simulatorRenderer.onMouseMove(event);
    };

    FluidParticles.prototype.onMouseDown = function (event) {
        if (event.touches) {
          event = event.touches[0];
        }
        this.simulatorRenderer.onMouseDown(event);
    };

    FluidParticles.prototype.onMouseUp = function (event) {
        if (event.touches) {
          event = event.touches[0];
        }

        this.simulatorRenderer.onMouseUp(event);
    };

    // Add keydown event that listens for spacebar and S key
    FluidParticles.prototype.onKeyDown = function (event) {
      this.simulatorRenderer.onKeyDown(event);
    };

    //the UI elements are all created in the constructor, this just updates the DOM elements
    //should be called every time state changes

    //compute the number of particles for the current boxes and grid density
    FluidParticles.prototype.getParticleCount = function () {
        var gridCells = GRID_WIDTH * GRID_HEIGHT * GRID_DEPTH * this.gridCellDensity;

        //assuming x:y:z ratio of 2:1:1
        var gridResolutionY = Math.ceil(Math.pow(gridCells / 2, 1.0 / 3.0));
        var gridResolutionZ = gridResolutionY * 1;
        var gridResolutionX = gridResolutionY * 2;

        var totalGridCells = gridResolutionX * gridResolutionY * gridResolutionZ;


        var totalVolume = 0;

        var box = SPAWN_BOX;
        var volume = box.computeVolume();

        totalVolume += volume;

        var fractionFilled = totalVolume / (GRID_WIDTH * GRID_HEIGHT * GRID_DEPTH);

        var desiredParticleCount = fractionFilled * totalGridCells * PARTICLES_PER_CELL; //theoretical number of particles

        return desiredParticleCount;
    }

    //begin simulation using boxes from box editor
    //EDITING -> SIMULATING
    FluidParticles.prototype.startSimulation = function () {
        this.state = State.SIMULATING;

        var desiredParticleCount = 6000;
        var particlesWidth = 512; //we fix particlesWidth
        var particlesHeight = Math.ceil(desiredParticleCount / particlesWidth); //then we calculate the particlesHeight that produces the closest particle count

        var particleCount = particlesWidth * particlesHeight;
        var particlePositions = [];
        
        var totalVolume = SPAWN_BOX.computeVolume();

        var particlesCreatedSoFar = 0;
        var box = SPAWN_BOX;
        
        var particlesInBox = particleCount;

        for (var j = 0; j < particlesInBox; ++j) {
            var position = box.randomPoint();
            particlePositions.push(position);
        }

        particlesCreatedSoFar += particlesInBox;

        var gridCells = GRID_WIDTH * GRID_HEIGHT * GRID_DEPTH * this.gridCellDensity;

        //assuming x:y:z ratio of 2:1:1
        var gridResolutionY = Math.ceil(Math.pow(gridCells / 2, 1.0 / 3.0));
        var gridResolutionZ = gridResolutionY * 1;
        var gridResolutionX = gridResolutionY * 2;


        var gridSize = [GRID_WIDTH, GRID_HEIGHT, GRID_DEPTH];
        var gridResolution = [gridResolutionX, gridResolutionY, gridResolutionZ];

        var sphereRadius = 0.275;
        this.simulatorRenderer.reset(particlesWidth, particlesHeight, particlePositions, gridSize, gridResolution, PARTICLES_PER_CELL, sphereRadius);

        this.camera.setBounds(0, Math.PI / 2);
    }

    return FluidParticles;
}());

