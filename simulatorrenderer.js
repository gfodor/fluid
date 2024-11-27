var SimulatorRenderer = (function () {
    function SimulatorRenderer (canvas, wgl, projectionMatrix, camera, gridDimensions, onLoaded) {
        this.canvas = canvas;
        this.wgl = wgl;
        this.projectionMatrix = projectionMatrix;
        this.camera = camera;

        wgl.getExtension('OES_texture_float_linear');
        wgl.getExtension('EXT_color_buffer_float');

        var rendererLoaded = false,
            simulatorLoaded = false;

        this.renderer = new Renderer(this.canvas, this.wgl, gridDimensions, (function () {
            rendererLoaded = true;  
            if (rendererLoaded && simulatorLoaded) {
                start.call(this);
            }
        }).bind(this));

        this.simulator = new Simulator(this.wgl, (function () {
            simulatorLoaded = true;
            if (rendererLoaded && simulatorLoaded) {
                start.call(this);
            }
        }).bind(this));

        setTimeout(() => {
            document.querySelector("#pump").addEventListener("click", () => {
                this.simulator.startSpawning();
            });

            document.querySelector("#reset").addEventListener("click", () => {
                this.simulator.resetParticles();
            });

            document.querySelector("#match").addEventListener("click", () => {
                this.simulator.toggleMatchState();
            });
        }, 2000);

        this.simulator.loadTargetColorTexture(function() {
            console.log("Target color texture loaded");
        });

        function start () {
            /////////////////////////////////////////////
            // interaction stuff

            //mouse position is in [-1, 1]
            this.mouseX = 0;
            this.mouseY = 0;

            //the mouse plane is a plane centered at the camera orbit point and orthogonal to the view direction
            this.lastMousePlaneX = 0;
            this.lastMousePlaneY = 0;

            setTimeout(onLoaded, 1);
        }
    }

    SimulatorRenderer.prototype.onMouseMove = function (event) {
        var position = Utilities.getMousePosition(event, this.canvas);
        var normalizedX = position.x / this.canvas.width;
        var normalizedY = position.y / this.canvas.height;

        this.mouseX = normalizedX * 2.0 - 1.0;
        this.mouseY = (1.0 - normalizedY) * 2.0 - 1.0;

    };

    SimulatorRenderer.prototype.onMouseDown = function (event) {
    };

    SimulatorRenderer.prototype.onMouseUp = function (event) {
    };

    SimulatorRenderer.prototype.onKeyDown = function (event) {
        // Spacebar
        if (event.keyCode === 32) {
            console.log("Spacebar pressed");
            this.simulator.toggleMatchState()
        } else if (event.keyCode === /* right arrow */ 39) {
            this.simulator.lowerCylinderRadius(0.01);
        } else if (event.keyCode === /* r key */ 82) {
            this.simulator.resetParticles();
        } else if (event.keyCode === 83) { // S key
            this.simulator.startSpawning();
        }
    };

    SimulatorRenderer.prototype.init = function (particlesWidth, particlesHeight, particlePositions, gridSize, gridResolution, particleDensity, sphereRadius) {
        this.simulator.reset(particlesWidth, particlesHeight, particlePositions, gridSize, gridResolution, particleDensity);
        this.renderer.reset(particlesWidth, particlesHeight, sphereRadius);
    }

    SimulatorRenderer.prototype.update = function (timeStep) {
        var gl = this.wgl.gl;
        
        // Save GL state we're going to modify
        const savedState = {
            viewport: gl.getParameter(gl.VIEWPORT),
            blend: gl.isEnabled(gl.BLEND),
            depthTest: gl.isEnabled(gl.DEPTH_TEST),
            depthMask: gl.getParameter(gl.DEPTH_WRITEMASK),
            depthFunc: gl.getParameter(gl.DEPTH_FUNC),
            cullFace: gl.isEnabled(gl.CULL_FACE),
            frontFace: gl.getParameter(gl.FRONT_FACE),
            program: gl.getParameter(gl.CURRENT_PROGRAM),
            arrayBuffer: gl.getParameter(gl.ARRAY_BUFFER_BINDING),
            elementArrayBuffer: gl.getParameter(gl.ELEMENT_ARRAY_BUFFER_BINDING),
            framebuffer: gl.getParameter(gl.FRAMEBUFFER_BINDING),
            activeTexture: gl.getParameter(gl.ACTIVE_TEXTURE),
            texture2D: gl.getParameter(gl.TEXTURE_BINDING_2D),
            scissorTest: gl.isEnabled(gl.SCISSOR_TEST),
            colorMask: gl.getParameter(gl.COLOR_WRITEMASK),
            blendEquationRGB: gl.getParameter(gl.BLEND_EQUATION_RGB),
            blendEquationAlpha: gl.getParameter(gl.BLEND_EQUATION_ALPHA), 
            blendSrcRGB: gl.getParameter(gl.BLEND_SRC_RGB),
            blendSrcAlpha: gl.getParameter(gl.BLEND_SRC_ALPHA),
            blendDstRGB: gl.getParameter(gl.BLEND_DST_RGB),
            blendDstAlpha: gl.getParameter(gl.BLEND_DST_ALPHA)
        };

        gl.disable(gl.CULL_FACE);

        // Calculate mouse and interaction parameters
        var fov = 2.0 * Math.atan(1.0 / this.projectionMatrix[5]);

        var viewSpaceMouseRay = [
            this.mouseX * Math.tan(fov / 2.0) * (this.canvas.width / this.canvas.height),
            this.mouseY * Math.tan(fov / 2.0),
            -1.0
        ];

        var mousePlaneX = viewSpaceMouseRay[0] * this.camera.distance;
        var mousePlaneY = viewSpaceMouseRay[1] * this.camera.distance;
        
        var mouseVelocityX = mousePlaneX - this.lastMousePlaneX;
        var mouseVelocityY = mousePlaneY - this.lastMousePlaneY;

        if (this.camera.isMouseDown()) {
            mouseVelocityX = 0.0;
            mouseVelocityY = 0.0;
        }

        this.lastMousePlaneX = mousePlaneX;
        this.lastMousePlaneY = mousePlaneY;

        var inverseViewMatrix = Utilities.invertMatrix([], this.camera.getViewMatrix());
        var worldSpaceMouseRay = Utilities.transformDirectionByMatrix([], viewSpaceMouseRay, inverseViewMatrix);
        Utilities.normalizeVector(worldSpaceMouseRay, worldSpaceMouseRay);

        var cameraViewMatrix = this.camera.getViewMatrix();
        var cameraRight = [cameraViewMatrix[0], cameraViewMatrix[4], cameraViewMatrix[8]];
        var cameraUp = [cameraViewMatrix[1], cameraViewMatrix[5], cameraViewMatrix[9]];

        var mouseVelocity = [];
        for (var i = 0; i < 3; ++i) {
            mouseVelocity[i] = mouseVelocityX * cameraRight[i] + mouseVelocityY * cameraUp[i];
        }

        try {
            // Run simulation and rendering
            this.simulator.simulate(timeStep, mouseVelocity, this.camera.getPosition(), worldSpaceMouseRay);
            this.renderer.draw(this.simulator, this.projectionMatrix, this.camera.getViewMatrix());
        } finally {
            // Restore all GL state
            //gl.bindFramebuffer(gl.FRAMEBUFFER, savedState.framebuffer);
            //gl.viewport(...savedState.viewport);
            //
            //savedState.blend ? gl.enable(gl.BLEND) : gl.disable(gl.BLEND);
            //savedState.depthTest ? gl.enable(gl.DEPTH_TEST) : gl.disable(gl.DEPTH_TEST);
            //savedState.cullFace ? gl.enable(gl.CULL_FACE) : gl.disable(gl.CULL_FACE);
            //savedState.scissorTest ? gl.enable(gl.SCISSOR_TEST) : gl.disable(gl.SCISSOR_TEST);
            //
            //gl.depthMask(savedState.depthMask);
            //gl.depthFunc(savedState.depthFunc);
            //gl.frontFace(savedState.frontFace);
            //gl.useProgram(savedState.program);
            //gl.bindBuffer(gl.ARRAY_BUFFER, savedState.arrayBuffer);
            //gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, savedState.elementArrayBuffer);
            //gl.activeTexture(savedState.activeTexture);
            //gl.bindTexture(gl.TEXTURE_2D, savedState.texture2D);
            //gl.colorMask(...savedState.colorMask);
            //
            //gl.blendEquationSeparate(savedState.blendEquationRGB, savedState.blendEquationAlpha);
            //gl.blendFuncSeparate(
            //    savedState.blendSrcRGB, 
            //    savedState.blendDstRGB,
            //    savedState.blendSrcAlpha, 
            //    savedState.blendDstAlpha
            //);
        }
    };

    SimulatorRenderer.prototype.onResize = function (event) {
        this.renderer.onResize(event);
    }

    return SimulatorRenderer;
}());
