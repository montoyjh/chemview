

var MolecularViewer = function ($el) {
	/* A MolecularViewer displays and manages a set of representations for a chemical system.

	*/

	this.container = $el;
	this.container.widthInv  = 1 / this.container.width();
	this.container.heightInv = 1 / this.container.height();
	this.container.whratio = this.container.width() / this.container.height();
	this.container.hwratio = this.container.height() / this.container.width();
	this.renderer = new THREE.WebGLRenderer({
		canvas: this.container.get(0),
		antialias: true,
        preserveDrawingBuffer: true,
	});
	this.effects = {
        // 'anaglyph': new THREE.AnaglyphEffect(this.renderer),
        // 'parallax barrier': new THREE.ParallaxBarrierEffect(this.renderer),
        // 'oculus rift': new THREE.OculusRiftEffect(this.renderer),
        // 'stereo': new THREE.StereoEffect(this.renderer),
		'none': this.renderer,
	};

	this.camera_z = -150;
	this.perspectiveCamera = new THREE.PerspectiveCamera(20, this.container.whratio, 1, 800);
	this.perspectiveCamera.position.set(0, 0, this.camera_z);
	this.perspectiveCamera.lookAt(new THREE.Vector3(0, 0, 0));
	this.orthographicCamera = new THREE.OrthographicCamera();
	this.orthographicCamera.position.set(0, 0, this.camera_z);
	this.orthographicCamera.lookAt(new THREE.Vector3(0, 0, 0));
	this.cameras = {
		 perspective: this.perspectiveCamera,
		orthographic: this.orthographicCamera,
	};
	this.camera = this.perspectiveCamera;

	this.slabNear = -50; // relative to the center of rot
	this.slabFar  = +50;

	var background = 0x000000;
	this.renderer.setClearColor(background, 1);

	this.scene = new THREE.Scene();
	this.scene.fog = new THREE.FogExp2(background);

	var directionalLight = new THREE.DirectionalLight(0xFFFFFF, 1.2);
	directionalLight.position.set(0.2, 0.2, -1).normalize();
	var ambientLight = new THREE.AmbientLight(0x202020);
	
	this.scene.add(directionalLight);
	this.scene.add(ambientLight);
	//this.scene.add(this.camera);

	//this.controls = new THREE.TrackballControls(this.camera, this.container);
    this.controls = new THREE.ArcballControls(this.camera, this.container.get(0));
    this.controls.zoomInto = function () {};
    this.controls.handleResize = function () {};

	this.controls.rotateSpeed = 0.4;
	this.controls.zoomSpeed = 1.2;
	this.controls.panSpeed = 0.8;
	this.controls.dynamicDampingFactor = 0.2;

	this.controls.keys = [ 65, 83, 68 ];
	this.controls.addEventListener( 'change', this.render.bind(this));

    this.representations = {};
	this.render();
};

MolecularViewer.prototype = {
    
    addRepresentation: function (representation, repId) {
    	representation.addToScene(this.scene);
        this.representations[repId] = representation;
    },

    getRepresentation: function (repId) {
        return this.representations[repId];
    },

    removeRepresentation: function (repId) {
        var rep = this.getRepresentation(repId);
        rep.removeFromScene(this.scene);
    },

    render: function () {
    	//if (this.controls.screen.width == 0 || this.controls.screen.height == 0)
    	//	this.controls.handleResize();

    	this.renderer.render(this.scene, this.camera);
    },

    animate: function () {
    	//console.log(this);

		window.requestAnimationFrame(this.animate.bind(this));
		this.controls.update();

	},

	zoomInto: function (coordinates) {
		/* TODO: this function may be out of place */

		// Calulate current geometric centre
		var cur_gc = new THREE.Vector3(0.0, 0.0, 0.0);
		for (var i = 0; i < coordinates.length/3; i++) {
			cur_gc.x += coordinates[3*i + 0];
			cur_gc.y += coordinates[3*i + 1];
			cur_gc.z += coordinates[3*i + 2];
		}
		cur_gc.divideScalar(coordinates.length/3);

		this.controls.target.copy(cur_gc);


		// Calculate the bounding sphere
		var bound = 0;
		for (var i = 0; i < coordinates.length/3; i++) {
			var point = new THREE.Vector3( coordinates[3*i + 0],
									 coordinates[3*i + 1],
									 coordinates[3*i + 2]);
			bound = Math.max(bound, point.distanceTo(cur_gc));
		}

		var fov_topbottom = this.camera.fov*Math.PI/180.0;
		var dist = (bound + this.camera.near)/Math.tan(fov_topbottom * 0.5);
        
        // Calculate distance vector
        var c = new THREE.Vector3();
        c.subVectors(this.camera.position, this.controls.target);
        c.normalize();

        // move camera at a distance
        c.multiplyScalar(dist);
        this.camera.position.copy(c);
		this.controls.update();
	},

	resize: function (width, height) {
		this.renderer.setSize(width, height);
		this.controls.handleResize();
		this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.render();
	},

    exportPng: function() {
        this.renderer.domElement.toDataUrl();
    },
};

/** 
 * Flat points in space
 * 
 * :param Float32Aarray coordinates: a (flattened) array of coordinates
 * :param list colors: a list of colors (one for each point) expressed as hexadecimal numbers
 * :param list sizes: a list of sizes for the points
 */
var PointsRepresentation = function (coordinates, colors, sizes) {

    var DEFAULT_SIZE = 0.15,
        DEFAULT_COLOR = 0xffffff;

    // pre-processing for optional arguments
    if (sizes == undefined) {
        var sizes = [];
        for (var i=0; i < coordinates.length/3; i++) {
            sizes.push(DEFAULT_SIZE);
        }
    }

    if (colors == undefined) {
        var colors = [];
        for (var i=0; i < coordinates.length/3; i++) {
            colors.push(DEFAULT_COLOR);
        }
    }

    // That is the points part
    var geo = new THREE.Geometry();
    this.geometry = geo;

    var attributes = {

        color: { type: 'c', value: []},
        pointSize: { type: 'f', value: sizes},

    };


    for (var p = 0; p < coordinates.length/3; p++) {
        var particle = new THREE.Vector3(coordinates[3 * p + 0],
                                         coordinates[3 * p + 1],
                                         coordinates[3 * p + 2]);
        geo.vertices.push(particle);
        attributes.color.value.push(new THREE.Color(colors[p]));
    }

    
    var vertex_shader = "\
        attribute vec3 color;\
        attribute float pointSize;\
        varying vec3 vColor;\
        \
        void main() {\
            vColor = color;\
            vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );\
            gl_PointSize = pointSize * ( 150.0 / length( mvPosition.xyz ));\
            gl_Position = projectionMatrix * mvPosition;\
        }\
    ";

    var fragment_shader = "\
        varying vec3 vColor;\
        \
        void main() {\
        if (length(gl_PointCoord*2.0 - 1.0) > 1.0)\
            discard;\
        gl_FragColor = vec4( vColor,  1.0);\
    }\
    ";



    var shaderMaterial = new THREE.ShaderMaterial( {
        attributes:     attributes,
        vertexShader:   vertex_shader,
        fragmentShader: fragment_shader,
        transparent:    false
    });
    this.material = shaderMaterial;

    this.particleSystem = new THREE.PointCloud(this.geometry, shaderMaterial);

    this.update = function (options) {
        var coordinates = options.coordinates;

        if (options.coordinates != undefined) {
            // There has been no update in coordinates
            for (var p=0; p < coordinates.length/3; p++) {
                this.geometry.vertices[p].x = coordinates[3 * p + 0];
                this.geometry.vertices[p].y = coordinates[3 * p + 1];
                this.geometry.vertices[p].z = coordinates[3 * p + 2];
            }

            this.particleSystem.geometry.verticesNeedUpdate = true;
        }

        if (options.sizes != undefined) {
            this.particleSystem.material.attributes.pointSize.value = options.sizes;
            this.particleSystem.material.attributes.pointSize.needsUpdate = true;  
        }

    };

    this.addToScene = function(scene) {
        scene.add(this.particleSystem);
    };

    this.removeFromScene = function(scene) {
        scene.remove(this.particleSystem);
    };

};

/** Flat lines in space given a start and end coordinate of each line.
 *
 *  :param Float32Array startCoords: A flattened array of the coordinates where the lines start.
 *  :param Float32Array endCoords: The end coordinates
 *  :param list startColors: The colors of the start coordinate
 *  :param list endColors: The end color of the end coordinate
 */
var LineRepresentation = function (startCoords, endCoords, startColors, endColors) {
    var geo = new THREE.Geometry();
    for (var i = 0; i < startCoords.length/3; i++) {
        geo.vertices.push(new THREE.Vector3(startCoords[3*i + 0],
                                            startCoords[3*i + 1],
                                            startCoords[3*i + 2]));
        geo.colors.push(new THREE.Color(startColors[i]));

        geo.vertices.push(new THREE.Vector3(endCoords[3*i + 0],
                                            endCoords[3*i + 1],
                                            endCoords[3*i + 2]));
        geo.colors.push(new THREE.Color(endColors[i]));
    }
    
    var material = new THREE.LineBasicMaterial({
            color: 0xffffff,
            vertexColors: THREE.VertexColors,
    });

    this.lines = new THREE.Line(geo, material, THREE.LinePieces);
    this.lines.geometry.dynamic = true;

    this.update = function (options) {
        if ( options.startCoords != undefined || options.endCoords != undefined ) {
            var geo = this.lines.geometry,
                startCoords = options.startCoords,
                endCoords = options.endCoords;

            for (var i = 0; i < startCoords.length/3; i++) {
                geo.vertices[2*i].set(startCoords[3*i + 0],
                                      startCoords[3*i + 1],
                                      startCoords[3*i + 2]);

                geo.vertices[2*i + 1].set(endCoords[3*i + 0],
                                          endCoords[3*i + 1],
                                          endCoords[3*i + 2]);
            }
            geo.verticesNeedUpdate = true;
        }
    };

    this.addToScene = function(scene) {
        scene.add(this.lines);
    };

    this.removeFromScene = function(scene) {
        scene.remove(this.lines);
    };    
};

/**
  *  SurfaceRepresentation displays a surface
  */
var SurfaceRepresentation = function (verts, faces, style) {

    var DEFAULT_STYLE = "wireframe";
    var style = style != undefined ? style : DEFAULT_STYLE;

    if (style == "solid") {
        var material = new THREE.MeshPhongMaterial( { color: 0Xffffff, 
                                                      specular: 0xffffff, 
                                                      shininess: 1});
    }

    if (style == "wireframe") {
        var material = new THREE.MeshBasicMaterial({wireframe:true, color: 0xffffff});
    }

	var geometry = new THREE.Geometry();

	for (var i = 0; i < verts.length/3; i++) {
		geometry.vertices.push(new THREE.Vector3(verts[i * 3 + 0],
												 verts[i * 3 + 1], 
												 verts[i * 3 + 2]));
	}

	for (var i = 0; i < faces.length/3; i++) {
		geometry.faces.push(new THREE.Face3(faces[i * 3 + 0],
											faces[i * 3 + 1], 
											faces[i * 3 + 2]));
	}

    geometry.mergeVertices();
	geometry.computeFaceNormals();
	geometry.computeVertexNormals();
	this.mesh = new THREE.Mesh(geometry, material);

	this.addToScene = function(scene) {
		scene.add(this.mesh);
	};

	this.update = function (data) {
		// Nothing
	};

    this.removeFromScene = function(scene) {
        scene.remove(this.mesh);
    };

};

/** Spheres 
 */
var SphereRepresentation = function (coordinates, radii, colors, resolution) {

    if (resolution == undefined)
        resolution = 16;

    var sphereTemplate = new THREE.SphereGeometry(1, resolution, resolution); // Our template

    // We want to have a single geometry to be updated, for speed reasons
    var geometry = new THREE.Geometry();
    for (var i=0; i < coordinates.length/3; i ++) {
        for (var j=0; j < sphereTemplate.vertices.length; j++){
            var vertex = new THREE.Vector3();

            vertex.copy(sphereTemplate.vertices[j]);
            vertex.multiplyScalar(radii[i]);
            vertex.add(new THREE.Vector3(coordinates[3 * i + 0],
                                         coordinates[3 * i + 1],
                                         coordinates[3 * i + 2]));
            geometry.vertices.push(vertex);
            geometry.colors.push(new THREE.Color(colors[i]));
        }

        for (var j=0; j < sphereTemplate.faces.length; j++) {
            var face = sphereTemplate.faces[j].clone();
            face.a += sphereTemplate.vertices.length * i;
            face.b += sphereTemplate.vertices.length * i;
            face.c += sphereTemplate.vertices.length * i;
            face.color.setHex(colors[i]);
            geometry.faces.push(face);
        }
            
    }

    var material = new THREE.MeshPhongMaterial({color: 0xffffff, 
                                                vertexColors: THREE.VertexColors});
    this.mesh = new THREE.Mesh(geometry, material);

    this.addToScene = function (scene) {
        scene.add(this.mesh);
    }

    this.update = function(options) {
        if (options.coordinates != undefined ) {
            var coordinates = options.coordinates;

            for (var i=0; i < coordinates.length/3; i ++) {
                for (var j=0; j < sphereTemplate.vertices.length; j++){
                    var vertex = new THREE.Vector3();

                    vertex.copy(sphereTemplate.vertices[j]);
                    vertex.multiplyScalar(radii[i]);
                    vertex.add(new THREE.Vector3(coordinates[3 * i + 0],
                                                 coordinates[3 * i + 1],
                                                 coordinates[3 * i + 2]));

                    var offset = i * sphereTemplate.vertices.length;
                    geometry.vertices[offset + j].copy(vertex);
                }
            }
            geometry.verticesNeedUpdate = true;
        }
    };

    this.removeFromScene = function(scene) {
        scene.remove(this.mesh);
    };
};

/** Draw a single box in the viewer (useful for bounding boxes and alike) */
var BoxRepresentation = function(start, end, color) {
    var geometry = new THREE.Geometry();
    var vS = new THREE.Vector3(start[0], start[1], start[2]);
    var vE = new THREE.Vector3(end[0], end[1], end[2]);

    geometry.vertices.push(vS);
    geometry.vertices.push(new THREE.Vector3(vE.x, vS.y, vS.z));

    geometry.vertices.push(vS);
    geometry.vertices.push(new THREE.Vector3(vS.x, vE.y, vS.z));
    
    geometry.vertices.push(vS);
    geometry.vertices.push(new THREE.Vector3(vS.x, vS.y, vE.z));

    geometry.vertices.push(vE);
    geometry.vertices.push(new THREE.Vector3(vS.x, vE.y, vE.z));

    geometry.vertices.push(vE);
    geometry.vertices.push(new THREE.Vector3(vE.x, vS.y, vE.z));

    geometry.vertices.push(vE);
    geometry.vertices.push(new THREE.Vector3(vE.x, vE.y, vS.z));

    geometry.vertices.push(new THREE.Vector3(vE.x, vE.y, vS.z));
    geometry.vertices.push(new THREE.Vector3(vE.x, vS.y, vS.z));

    geometry.vertices.push(new THREE.Vector3(vE.x, vE.y, vS.z));
    geometry.vertices.push(new THREE.Vector3(vS.x, vE.y, vS.z));

    geometry.vertices.push(new THREE.Vector3(vE.x, vS.y, vE.z));
    geometry.vertices.push(new THREE.Vector3(vE.x, vS.y, vS.z));

    geometry.vertices.push(new THREE.Vector3(vE.x, vS.y, vE.z));
    geometry.vertices.push(new THREE.Vector3(vS.x, vS.y, vE.z));

    geometry.vertices.push(new THREE.Vector3(vS.x, vE.y, vE.z));
    geometry.vertices.push(new THREE.Vector3(vS.x, vE.y, vS.z));

    geometry.vertices.push(new THREE.Vector3(vS.x, vE.y, vE.z));
    geometry.vertices.push(new THREE.Vector3(vS.x, vS.y, vE.z));
    
    var material = new THREE.LineBasicMaterial( {color: color} );
    var cube = new THREE.Line( geometry, material, THREE.LinePieces );
    this.cube = cube;

    this.addToScene = function(scene) {
        scene.add( this.cube );
    };

    this.removeFromScene = function(scene) {
        scene.remove( this.cube );
    };

    this.update = function (options) {};
};


var SmoothLineRepresentation = function (coordinates, color, resolution) {
    var resolution = (resolution != undefined) ? resolution : 16;
    var color = (color != undefined) ? color : 0xffffff;
    this.resolution = resolution;
    // We could use our friendly splite provided by threejs
    var points = []
    for (var i = 0; i < coordinates.length/3; i++) {
        points.push(new THREE.Vector3(coordinates[3 * i + 0],
                                      coordinates[3 * i + 1],
                                      coordinates[3 * i + 2]));
    }
    var path = new THREE.SplineCurve3(points);

    var geometry = new THREE.Geometry();
    geometry.vertices = path.getPoints(resolution * points.length);

    var material = new THREE.LineBasicMaterial( { color: color, 
                                                  fog: true } );

    this.geometry = geometry;
    this.material = material;

    this.line = new THREE.Line(geometry, material);

    this.addToScene = function(scene) {
        scene.add(this.line);
    };

    this.removeFromScene = function(scene) {
        scene.remove(this.line);
    };

    this.update = function (options) {

        if (options.coordinates != undefined) {
            var coordinates = options.coordinates;

            // Regenerate the spline geometry
            var points = [];
            for (var i = 0; i < coordinates.length/3; i++) {
                points.push(new THREE.Vector3(coordinates[3 * i + 0],
                                              coordinates[3 * i + 1],
                                              coordinates[3 * i + 2]));
            }
            var path = new THREE.SplineCurve3(points);
            this.geometry.vertices = path.getPoints(resolution * points.length);
            this.geometry.verticesNeedUpdate = true;
        }
    };
};

var SmoothTubeRepresentation = function (coordinates, radius, color, resolution) {
    var resolution = (resolution != undefined) ? resolution : 4;
    var color = (color != undefined) ? color : 0xffffff;
    this.resolution = resolution;
    var CIRCLE_RESOLUTION = 8;

    // We could use our friendly splite provided by threejs
    var points = []
    for (var i = 0; i < coordinates.length/3; i++) {
        points.push(new THREE.Vector3(coordinates[3 * i + 0],
                                      coordinates[3 * i + 1],
                                      coordinates[3 * i + 2]));
    }
    var path = new THREE.SplineCurve3(points);

    var geometry = new THREE.TubeGeometry(path, resolution * points.length, radius, CIRCLE_RESOLUTION, false);
    var material = new THREE.MeshPhongMaterial( { color: color , fog: true} );

    this.geometry = geometry;
    this.material = material;

    this.mesh = new THREE.Mesh(geometry, material);

    this.addToScene = function(scene) {
        scene.add(this.mesh);
    };

    this.removeFromScene = function(scene) {
        scene.remove(this.mesh);
    };

    this.update = function (options) {

        if (options.coordinates != undefined) {
            var coordinates = options.coordinates;

            // Regenerate the spline geometry
            var points = []
            for (var i = 0; i < coordinates.length/3; i++) {
                points.push(new THREE.Vector3(coordinates[3 * i + 0],
                                              coordinates[3 * i + 1],
                                              coordinates[3 * i + 2]));
            }
            var path = new THREE.SplineCurve3(points);

            var geometry = new THREE.TubeGeometry(path, resolution * points.length, radius, CIRCLE_RESOLUTION, false);
            this.geometry.vertices = geometry.vertices;
            this.geometry.verticesNeedUpdate = true;
        }
    };
};

/**
 * Draw a series of solid cylinders given their start/end coordinates, radii and colors.
 *
 * This is to be used sparingly (max ~100 cylinders because it's inefficient). If you need to render bonds, use 
 * the LineRepresentation class, much much faster.
 *  
 * :param Float32Array startCoords:
 * :param Float32Array endCoords:
 * :param list radii:
 * :param list colors:
 */
var CylinderRepresentation = function (startCoords, endCoords, radii, colors, resolution) {
    var resolution = (resolution != undefined) ? resolution : 16;
    var cylinders = [];

    for (var i=0; i < startCoords.length/3; i++) {
        var startVec = new THREE.Vector3(startCoords[3*i + 0], 
                                         startCoords[3*i + 1], 
                                         startCoords[3*i + 2]);

        var endVec = new THREE.Vector3(endCoords[3*i + 0], 
                                       endCoords[3*i + 1], 
                                       endCoords[3*i + 2]);

        var length = startVec.distanceTo(endVec);

        var geometry = new THREE.CylinderGeometry(radii[i], radii[i], length, resolution);
        var material = new THREE.MeshPhongMaterial({color: colors[i]});

        // Rotate the geometry vertices to align the cylinder with the z-axis
        var orientation = new THREE.Matrix4();
        orientation.makeRotationFromEuler(new THREE.Euler(-Math.PI * 0.5,0,0, 'XYZ'));//rotate on X 90 degrees
        orientation.setPosition(new THREE.Vector3(0,0,0.5*length));//move half way on Z, since default pivot is at centre
        geometry.applyMatrix(orientation);//apply transformation for geometry

        // Position the cylinder normally
        var cylinder = new THREE.Mesh(geometry, material);
        cylinder.position.copy(startVec);
        cylinder.lookAt(endVec);

        cylinders.push(cylinder);
    }

    this.addToScene = function(scene) {
        for (var i=0; i < cylinders.length; i++) {
            scene.add(cylinders[i]);
        }
    };

    this.removeFromScene = function(scene) {
        for (var i=0; i < cylinders.length; i++) {
            scene.remove(cylinders[i]);
        }
    };

    this.update = function (options) {

        if (options.startCoords != undefined || options.endCoords != undefined) {
            var startCoords = options.startCoords;
            var endCoords = options.endCoords;

            for (var i=0; i < startCoords.length/3; i++) {
                var startVec = new THREE.Vector3(startCoords[3*i + 0], 
                                                 startCoords[3*i + 1], 
                                                 startCoords[3*i + 2]);

                var endVec = new THREE.Vector3(endCoords[3*i + 0], 
                                               endCoords[3*i + 1], 
                                               endCoords[3*i + 2]);
                var cylinder = cylinders[i];
                cylinder.position.copy(startVec);
                cylinder.lookAt(endVec);
                cylinder.geometry.verticesNeedUpdate = true;
            }
        }
    }

};