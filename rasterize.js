//Abhishek Pandey
//CG Assignment 3, 2017
/*The following code has been inspired from http://learningwebgl.com/blog/?p=507 ,
 http://learningwebgl.com/blog/?p=859 ,
 https://webglfundamentals.org/webgl/lessons/webgl-2-textures.html*/
/* GLOBAL CONSTANTS AND VARIABLES */

/* assignment specific globals */
const INPUT_TRIANGLES_URL = "https://ncsucgclass.github.io/prog3/triangles.json"; // triangles file loc
const INPUT_ELLIPSOIDS_URL = "https://ncsucgclass.github.io/prog3/ellipsoids.json"; // ellipsoids file loc
const INPUT_TEXTURE_URL = "https://ncsucgclass.github.io/prog3/"; // texture source location

var defaultEye = vec3.fromValues(0.5,0.5,-0.5); // default eye position in world space
var defaultCenter = vec3.fromValues(0.5,0.5,0.5); // default view direction in world space
var defaultUp = vec3.fromValues(0,1,0); // default view up vector
var lightAmbient = vec3.fromValues(1,1,1); // default light ambient emission
var lightDiffuse = vec3.fromValues(1,1,1); // default light diffuse emission
var lightSpecular = vec3.fromValues(1,1,1); // default light specular emission
var lightPosition = vec3.fromValues(2,4,-0.5); // default light position
var rotateTheta = Math.PI/50; // how much to rotate models by with each key press

/* webgl and geometry data */
var gl = null; // the all powerful gl object. It's all here folks!
var inputTriangles = []; // the triangle data as loaded from input files
var numTriangleSets = 0; // how many triangle sets in input scene
var inputEllipsoids = []; // the ellipsoid data as loaded from input files
var numEllipsoids = 0; // how many ellipsoids in the input scene

var vertexBuffers = []; // this contains vertex coordinate lists by set, in triples
var normalBuffers = []; // this contains normal component lists by set, in triples
var triSetSizes = []; // this contains the size of each triangle set
var triangleBuffers = []; // lists of indices into vertexBuffers by set, in triples

/* var opaqueTriangles = [];
var transTriangles = []; */

var textureBuffers = []; // this contains texture in sets
var textures = []; // the list to hold all the textures



var tOpaqueIndex = [];
var tTransIndex = [];
var eOpaqueIndex = [];
var eTransIndex = [];
var sortedModels = [];



/* shader parameter locations */
var vPosAttribLoc; // where to put position for vertex shader
var vNormAttribLoc; // where to put position for normal shader
var vTextureAttribLocation; // where to put position for texture
var sUniform; // shader Uniform
var alphaUniform; // alpha Uniform for shaders
var lightModeUniform; // light Mode Uniform for shaders
var mMatrixULoc; // where to put model matrix for vertex shader
var pvmMatrixULoc; // where to put project model view matrix for vertex shader
var ambientULoc; // where to put ambient reflecivity for fragment shader
var diffuseULoc; // where to put diffuse reflecivity for fragment shader
var specularULoc; // where to put specular reflecivity for fragment shader
var shininessULoc; // where to put specular exponent for fragment shader

/* interaction variables */
var Eye = vec3.clone(defaultEye); // eye position in world space
var Center = vec3.clone(defaultCenter); // view direction in world space
var Up = vec3.clone(defaultUp); // view up vector in world space
var viewDelta = 0; // how much to displace view with each key press

var lightMode = 0;

// ASSIGNMENT HELPER FUNCTIONS

// get the JSON file from the passed URL
function getJSONFile(url,descr) {
    try {
        if ((typeof(url) !== "string") || (typeof(descr) !== "string"))
            throw "getJSONFile: parameter not a string";
        else {
            var httpReq = new XMLHttpRequest(); // a new http request
            httpReq.open("GET",url,false); // init the request
            httpReq.send(null); // send the request
            var startTime = Date.now();
            while ((httpReq.status !== 200) && (httpReq.readyState !== XMLHttpRequest.DONE)) {
                if ((Date.now()-startTime) > 3000)
                    break;
            } // until its loaded or we time out after three seconds
            if ((httpReq.status !== 200) || (httpReq.readyState !== XMLHttpRequest.DONE))
                throw "Unable to open "+descr+" file!";
            else
                return JSON.parse(httpReq.response); 
        } // end if good params
    } // end try    
    
    catch(e) {
        console.log(e);
        return(String.null);
    }
} // end get input json file

// does stuff when keys are pressed
function handleKeyDown(event) {
    
    const modelEnum = {TRIANGLES: "triangles", ELLIPSOID: "ellipsoid"}; // enumerated model type
    const dirEnum = {NEGATIVE: -1, POSITIVE: 1}; // enumerated rotation direction
    
    function highlightModel(modelType,whichModel) {
        if (handleKeyDown.modelOn != null)
            handleKeyDown.modelOn.on = false;
        handleKeyDown.whichOn = whichModel;
        if (modelType == modelEnum.TRIANGLES)
            handleKeyDown.modelOn = inputTriangles[whichModel]; 
        else
            handleKeyDown.modelOn = inputEllipsoids[whichModel]; 
        handleKeyDown.modelOn.on = true; 
    } // end highlight model
    
    function translateModel(offset) {
        if (handleKeyDown.modelOn != null)
            vec3.add(handleKeyDown.modelOn.translation,handleKeyDown.modelOn.translation,offset);
    } // end translate model

    function rotateModel(axis,direction) {
        if (handleKeyDown.modelOn != null) {
            var newRotation = mat4.create();

            mat4.fromRotation(newRotation,direction*rotateTheta,axis); // get a rotation matrix around passed axis
            vec3.transformMat4(handleKeyDown.modelOn.xAxis,handleKeyDown.modelOn.xAxis,newRotation); // rotate model x axis tip
            vec3.transformMat4(handleKeyDown.modelOn.yAxis,handleKeyDown.modelOn.yAxis,newRotation); // rotate model y axis tip
        } // end if there is a highlighted model
    } // end rotate model
    
    // set up needed view params
    var lookAt = vec3.create(), viewRight = vec3.create(), temp = vec3.create(); // lookat, right & temp vectors
    lookAt = vec3.normalize(lookAt,vec3.subtract(temp,Center,Eye)); // get lookat vector
    viewRight = vec3.normalize(viewRight,vec3.cross(temp,lookAt,Up)); // get view right vector
    
    // highlight static variables
    handleKeyDown.whichOn = handleKeyDown.whichOn == undefined ? -1 : handleKeyDown.whichOn; // nothing selected initially
    handleKeyDown.modelOn = handleKeyDown.modelOn == undefined ? null : handleKeyDown.modelOn; // nothing selected initially

    switch (event.code) {
        
        // model selection
        case "Space": 
            if (handleKeyDown.modelOn != null)
                handleKeyDown.modelOn.on = false; // turn off highlighted model
            handleKeyDown.modelOn = null; // no highlighted model
            handleKeyDown.whichOn = -1; // nothing highlighted
            break;
        case "ArrowRight": // select next triangle set
            highlightModel(modelEnum.TRIANGLES,(handleKeyDown.whichOn+1) % numTriangleSets);
            break;
        case "ArrowLeft": // select previous triangle set
            highlightModel(modelEnum.TRIANGLES,(handleKeyDown.whichOn > 0) ? handleKeyDown.whichOn-1 : numTriangleSets-1);
            break;
        case "ArrowUp": // select next ellipsoid
            highlightModel(modelEnum.ELLIPSOID,(handleKeyDown.whichOn+1) % numEllipsoids);
            break;
        case "ArrowDown": // select previous ellipsoid
            highlightModel(modelEnum.ELLIPSOID,(handleKeyDown.whichOn > 0) ? handleKeyDown.whichOn-1 : numEllipsoids-1);
            break;
            
        // view change
        case "KeyA": // translate view left, rotate left with shift
            Center = vec3.add(Center,Center,vec3.scale(temp,viewRight,viewDelta));
            if (!event.getModifierState("Shift"))
                Eye = vec3.add(Eye,Eye,vec3.scale(temp,viewRight,viewDelta));
            break;
        case "KeyD": // translate view right, rotate right with shift
            Center = vec3.add(Center,Center,vec3.scale(temp,viewRight,-viewDelta));
            if (!event.getModifierState("Shift"))
                Eye = vec3.add(Eye,Eye,vec3.scale(temp,viewRight,-viewDelta));
            break;
        case "KeyS": // translate view backward, rotate up with shift
            if (event.getModifierState("Shift")) {
                Center = vec3.add(Center,Center,vec3.scale(temp,Up,viewDelta));
                Up = vec3.cross(Up,viewRight,vec3.subtract(lookAt,Center,Eye)); /* global side effect */
            } else {
                Eye = vec3.add(Eye,Eye,vec3.scale(temp,lookAt,-viewDelta));
                Center = vec3.add(Center,Center,vec3.scale(temp,lookAt,-viewDelta));
            } // end if shift not pressed
            break;
        case "KeyW": // translate view forward, rotate down with shift
            if (event.getModifierState("Shift")) {
                Center = vec3.add(Center,Center,vec3.scale(temp,Up,-viewDelta));
                Up = vec3.cross(Up,viewRight,vec3.subtract(lookAt,Center,Eye)); /* global side effect */
            } else {
                Eye = vec3.add(Eye,Eye,vec3.scale(temp,lookAt,viewDelta));
                Center = vec3.add(Center,Center,vec3.scale(temp,lookAt,viewDelta));
            } // end if shift not pressed
            break;
        case "KeyQ": // translate view up, rotate counterclockwise with shift
            if (event.getModifierState("Shift"))
                Up = vec3.normalize(Up,vec3.add(Up,Up,vec3.scale(temp,viewRight,-viewDelta)));
            else {
                Eye = vec3.add(Eye,Eye,vec3.scale(temp,Up,viewDelta));
                Center = vec3.add(Center,Center,vec3.scale(temp,Up,viewDelta));
            } // end if shift not pressed
            break;
        case "KeyE": // translate view down, rotate clockwise with shift
            if (event.getModifierState("Shift"))
                Up = vec3.normalize(Up,vec3.add(Up,Up,vec3.scale(temp,viewRight,viewDelta)));
            else {
                Eye = vec3.add(Eye,Eye,vec3.scale(temp,Up,-viewDelta));
                Center = vec3.add(Center,Center,vec3.scale(temp,Up,-viewDelta));
            } // end if shift not pressed
            break;
			
		case "KeyB":
			if (event.getModifierState("Shift")){
				lightMode = lightMode == 0 ? 1 : 0; 
			}
			break;	
		
        case "Escape": // reset view to default
            Eye = vec3.copy(Eye,defaultEye);
            Center = vec3.copy(Center,defaultCenter);
            Up = vec3.copy(Up,defaultUp);
            break;
            
        // model transformation
        case "KeyK": // translate left, rotate left with shift
            if (event.getModifierState("Shift"))
                rotateModel(Up,dirEnum.NEGATIVE);
            else
                translateModel(vec3.scale(temp,viewRight,viewDelta));
            break;
        case "Semicolon": // translate right, rotate right with shift
            if (event.getModifierState("Shift"))
                rotateModel(Up,dirEnum.POSITIVE);
            else
                translateModel(vec3.scale(temp,viewRight,-viewDelta));
            break;
        case "KeyL": // translate backward, rotate up with shift
            if (event.getModifierState("Shift"))
                rotateModel(viewRight,dirEnum.POSITIVE);
            else
                translateModel(vec3.scale(temp,lookAt,-viewDelta));
            break;
        case "KeyO": // translate forward, rotate down with shift
            if (event.getModifierState("Shift"))
                rotateModel(viewRight,dirEnum.NEGATIVE);
            else
                translateModel(vec3.scale(temp,lookAt,viewDelta));
            break;
        case "KeyI": // translate up, rotate counterclockwise with shift 
            if (event.getModifierState("Shift"))
                rotateModel(lookAt,dirEnum.POSITIVE);
            else
                translateModel(vec3.scale(temp,Up,viewDelta));
            break;
        case "KeyP": // translate down, rotate clockwise with shift
            if (event.getModifierState("Shift"))
                rotateModel(lookAt,dirEnum.NEGATIVE);
            else
                translateModel(vec3.scale(temp,Up,-viewDelta));
            break;
        case "Backspace": // reset model transforms to default
            for (var whichTriSet=0; whichTriSet<numTriangleSets; whichTriSet++) {
                vec3.set(inputTriangles[whichTriSet].translation,0,0,0);
                vec3.set(inputTriangles[whichTriSet].xAxis,1,0,0);
                vec3.set(inputTriangles[whichTriSet].yAxis,0,1,0);
            } // end for all triangle sets
            for (var whichEllipsoid=0; whichEllipsoid<numEllipsoids; whichEllipsoid++) {
                vec3.set(inputEllipsoids[whichEllipsoid].translation,0,0,0);
                vec3.set(inputEllipsoids[whichTriSet].xAxis,1,0,0);
                vec3.set(inputEllipsoids[whichTriSet].yAxis,0,1,0);
            } // end for all ellipsoids
            break;			
				
    } // end switch
} // end handleKeyDown


// set up the webGL environment
function setupWebGL() {

    // Set up keys
    document.onkeydown = handleKeyDown; // call this when key pressed

    // Get the image canvas, render an image in it
    var imageCanvas = document.getElementById("myImageCanvas"); // create a 2d canvas
    var cw = imageCanvas.width, ch = imageCanvas.height;
    imageContext = imageCanvas.getContext("2d");
    var bkgdImage = new Image();
    bkgdImage.crossOrigin = "Anonymous";
    bkgdImage.src = "https://ncsucgclass.github.io/prog3/sky.jpg";
    bkgdImage.onload = function () {
        var iw = bkgdImage.width, ih = bkgdImage.height;
        imageContext.drawImage(bkgdImage, 0, 0, iw, ih, 0, 0, cw, ch);
    } // end onload callback

    // create a webgl canvas and set it up
    var webGLCanvas = document.getElementById("myWebGLCanvas"); // create a webgl canvas
    gl = webGLCanvas.getContext("webgl"); // get a webgl object from it
    try {
        if (gl == null) {
            throw "unable to create gl context -- is your browser gl ready?";
        } else {
            //gl.clearColor(0.0, 0.0, 0.0, 1.0); // use black when we clear the frame buffer
            gl.clearDepth(1.0); // use max when we clear the depth buffer
            gl.enable(gl.DEPTH_TEST); // use hidden surface removal (with zbuffering)
        }
    } // end try

    catch (e) {
        console.log(e);
    } // end catch
} // end setupWebGL

// read models in, load them into webgl buffers
function loadModels() {
	
	/* triangleBuffers = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffers); // activate that buffer
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2]), gl.STATIC_DRAW); */

    // make an ellipsoid, with numLongSteps longitudes.
    // start with a sphere of radius 1 at origin
    // Returns verts, tris and normals.
    function makeEllipsoid(currEllipsoid, numLongSteps) {

        try {
            if (numLongSteps % 2 != 0)
                throw "in makeSphere: uneven number of longitude steps!";
            else if (numLongSteps < 4)
                throw "in makeSphere: number of longitude steps too small!";
            else { // good number longitude steps

                //console.log("ellipsoid xyz: " + ellipsoid.x + " " + ellipsoid.y + " " + ellipsoid.z);

                var uvToAdd = [];
                uvToAdd.push(0,1);

                // make vertices
                var ellipsoidVertices = [0,-1,0]; // vertices to return, init to south pole
                var angleIncr = (Math.PI + Math.PI) / numLongSteps; // angular increment
                var latLimitAngle = angleIncr * (Math.floor(numLongSteps/4)-1); // start/end lat angle
                var latRadius, latY; // radius and Y at current latitude
                for (var latAngle = -latLimitAngle; latAngle <= latLimitAngle; latAngle += angleIncr) {
                    latRadius = Math.cos(latAngle); // radius of current latitude
                    latY = Math.sin(latAngle); // height at current latitude
                    for (var longAngle = 0; longAngle < 2 * Math.PI; longAngle += angleIncr) { // for each long
                        ellipsoidVertices.push(latRadius * Math.sin(longAngle), latY, latRadius * Math.cos(longAngle));
                        var u = longAngle / (2*Math.PI);
                        var v = (latAngle + latLimitAngle) / (2*latLimitAngle);
                        uvToAdd.push(u, v);
                    }
                } // end for each latitude
                uvToAdd.push(0,0);
                ellipsoidVertices.push(0,1,0); // add north pole
                ellipsoidVertices = ellipsoidVertices.map(function (val, idx) { // position and scale ellipsoid
                    switch (idx % 3) {
                        case 0: // x
                            return (val * currEllipsoid.a + currEllipsoid.x);
                        case 1: // y
                            return (val * currEllipsoid.b + currEllipsoid.y);
                        case 2: // z
                            return (val * currEllipsoid.c + currEllipsoid.z);
                    } // end switch
                });

                // make normals using the ellipsoid gradient equation
                // resulting normals are unnormalized: we rely on shaders to normalize
                var ellipsoidNormals = ellipsoidVertices.slice(); // start with a copy of the transformed verts
                ellipsoidNormals = ellipsoidNormals.map(function (val, idx) { // calculate each normal
                    switch (idx % 3) {
                        case 0: // x
                            return (2 / (currEllipsoid.a * currEllipsoid.a) * (val - currEllipsoid.x));
                        case 1: // y
                            return (2 / (currEllipsoid.b * currEllipsoid.b) * (val - currEllipsoid.y));
                        case 2: // z
                            return (2 / (currEllipsoid.c * currEllipsoid.c) * (val - currEllipsoid.z));
                    } // end switch
                });

                // make triangles, from south pole to middle latitudes to north pole
                var ellipsoidTriangles = []; // triangles to return
                for (var whichLong = 1; whichLong < numLongSteps; whichLong++) // south pole
                    ellipsoidTriangles.push(0, whichLong, whichLong + 1);
                ellipsoidTriangles.push(0, numLongSteps, 1); // longitude wrap tri
                var llVertex; // lower left vertex in the current quad
                for (var whichLat = 0; whichLat < (numLongSteps / 2 - 2); whichLat++) { // middle lats
                    for (var whichLong=0; whichLong<numLongSteps-1; whichLong++) {
                        llVertex = whichLat * numLongSteps + whichLong + 1;
                        ellipsoidTriangles.push(llVertex, llVertex + numLongSteps, llVertex + numLongSteps + 1);
                        ellipsoidTriangles.push(llVertex, llVertex + numLongSteps + 1, llVertex + 1);
                    } // end for each longitude
                    ellipsoidTriangles.push(llVertex + 1, llVertex + numLongSteps + 1, llVertex + 2);
                    ellipsoidTriangles.push(llVertex + 1, llVertex + 2, llVertex - numLongSteps + 2);
                } // end for each latitude
                for (var whichLong = llVertex + 2; whichLong < llVertex + numLongSteps + 1; whichLong++) // north pole
                    ellipsoidTriangles.push(whichLong, ellipsoidVertices.length / 3 - 1, whichLong + 1);
                ellipsoidTriangles.push(ellipsoidVertices.length / 3 - 2, ellipsoidVertices.length / 3 - 1,
                    ellipsoidVertices.length / 3 - numLongSteps - 1); // longitude wrap
            } // end if good number longitude steps
			
			/* var nums = ellipsoidTriangles.length / 3;
                for (var i = 0; i < nums; i++) {
                    var tri = {vertices: [], bufferIndex: 0, whichset: 0};
                    var triToAdd = [ellipsoidTriangles[i * 3], ellipsoidTriangles[i * 3 + 1], ellipsoidTriangles[i * 3 + 2]];
                    var vertices = [
                        ellipsoidVertices[triToAdd[0] * 3], ellipsoidVertices[triToAdd[0] * 3 + 1], ellipsoidVertices[triToAdd[0] * 3 + 2],
                        ellipsoidVertices[triToAdd[1] * 3], ellipsoidVertices[triToAdd[1] * 3 + 1], ellipsoidVertices[triToAdd[1] * 3 + 2],
                        ellipsoidVertices[triToAdd[2] * 3], ellipsoidVertices[triToAdd[2] * 3 + 1], ellipsoidVertices[triToAdd[2] * 3 + 2]
                    ];

                    var normals = [
                        ellipsoidNormals[triToAdd[0] * 3], ellipsoidNormals[triToAdd[0] * 3 + 1], ellipsoidNormals[triToAdd[0] * 3 + 2],
                        ellipsoidNormals[triToAdd[1] * 3], ellipsoidNormals[triToAdd[1] * 3 + 1], ellipsoidNormals[triToAdd[1] * 3 + 2],
                        ellipsoidNormals[triToAdd[2] * 3], ellipsoidNormals[triToAdd[2] * 3 + 1], ellipsoidNormals[triToAdd[2] * 3 + 2]
                    ];

                    var uvs = [
                        uvToAdd[triToAdd[0] * 2], uvToAdd[triToAdd[0] * 2 + 1],
                        uvToAdd[triToAdd[1] * 2], uvToAdd[triToAdd[1] * 2 + 1],
                        uvToAdd[triToAdd[2] * 2], uvToAdd[triToAdd[2] * 2 + 1],
                    ];

                    vertexBuffers.push(gl.createBuffer());
                    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffers[vertexBuffers.length - 1]);
                    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

                    normalBuffers.push(gl.createBuffer()); // init empty webgl set normal component buffer
                    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffers[normalBuffers.length - 1]); // activate that buffer
                    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW); // data in

                    textureBuffers.push(gl.createBuffer());
                    gl.bindBuffer(gl.ARRAY_BUFFER, textureBuffers[textureBuffers.length - 1]);
                    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uvs), gl.STATIC_DRAW);

                    tri.whichset = whichSet;
                    tri.bufferIndex = vertexBuffers.length - 1;
                    tri.vertices = vertices;
                    if (currEllipsoid.alpha == 1) {
                        opaqueTriangles.push(tri);
                    } else {
                        transTriangles.push(tri);
                    }

                } */
            return({vertices:ellipsoidVertices, normals:ellipsoidNormals, triangles:ellipsoidTriangles, textures: uvToAdd});
        } // end try

        catch (e) {
            console.log(e);
        } // end catch
    } // end make ellipsoid

    inputTriangles = getJSONFile(INPUT_TRIANGLES_URL, "triangles"); // read in the triangle data

    try {
        if (inputTriangles == String.null)
            throw "Unable to load triangles file!";
        else {
            var whichSetVert; // index of vertex in current triangle set
            var whichSetTri; // index of triangle in current triangle set
            var vtxToAdd; // vtx coords to add to the coord array
            var normToAdd; // vtx normal to add to the coord array
            var uvToAdd; // uv coords to add to the uv arry
            var triToAdd; // tri indices to add to the index array
            var maxCorner = vec3.fromValues(Number.MIN_VALUE, Number.MIN_VALUE, Number.MIN_VALUE); // bbox corner
            var minCorner = vec3.fromValues(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE); // other corner

            // process each triangle set to load webgl vertex and triangle buffers
            numTriangleSets = inputTriangles.length; // remember how many tri sets
            for (var whichSet = 0; whichSet < numTriangleSets; whichSet++) { // for each tri set

                if (inputTriangles[whichSet].material.alpha == 1) {
                    tOpaqueIndex.push(whichSet);
                } else {
                    tTransIndex.push(whichSet);
                }

                // set up hilighting, modeling translation and rotation
                inputTriangles[whichSet].center = vec3.fromValues(0,0,0);  // center point of tri set
                inputTriangles[whichSet].on = false; // not highlighted
                inputTriangles[whichSet].translation = vec3.fromValues(0,0,0); // no translation
                inputTriangles[whichSet].xAxis = vec3.fromValues(1,0,0); // model X axis
                inputTriangles[whichSet].yAxis = vec3.fromValues(0,1,0); // model Y axis

                // set up the vertex and normal arrays, define model center and axes
                inputTriangles[whichSet].glVertices = []; // flat coord list for webgl
                inputTriangles[whichSet].glNormals = []; // flat normal list for webgl
                inputTriangles[whichSet].textureCoords = [];

                var numVerts = inputTriangles[whichSet].vertices.length; // num vertices in tri set
                for (whichSetVert = 0; whichSetVert < numVerts; whichSetVert++) { // verts in set
                    vtxToAdd = inputTriangles[whichSet].vertices[whichSetVert]; // get vertex to add
                    normToAdd = inputTriangles[whichSet].normals[whichSetVert]; // get normal to add
                    uvToAdd = inputTriangles[whichSet].uvs[whichSetVert];

                    inputTriangles[whichSet].glVertices.push(vtxToAdd[0], vtxToAdd[1], vtxToAdd[2]); // put coords in set coord list
                    inputTriangles[whichSet].glNormals.push(normToAdd[0], normToAdd[1], normToAdd[2]); // put normal in set coord list
                    inputTriangles[whichSet].textureCoords.push(uvToAdd[0], uvToAdd[1]);

                    vec3.max(maxCorner, maxCorner, vtxToAdd); // update world bounding box corner maxima
                    vec3.min(minCorner, minCorner, vtxToAdd); // update world bounding box corner minima
                    vec3.add(inputTriangles[whichSet].center, inputTriangles[whichSet].center, vtxToAdd); // add to ctr sum
                } // end for vertices in set
                vec3.scale(inputTriangles[whichSet].center, inputTriangles[whichSet].center, 1 / numVerts); // avg ctr sum

                // send the vertex coords and normals to webGL
                vertexBuffers[whichSet] = gl.createBuffer(); // init empty webgl set vertex coord buffer
                gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffers[whichSet]); // activate that buffer
                gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(inputTriangles[whichSet].glVertices), gl.STATIC_DRAW); // data in

                normalBuffers[whichSet] = gl.createBuffer(); // init empty webgl set normal component buffer
                gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffers[whichSet]); // activate that buffer
                gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(inputTriangles[whichSet].glNormals), gl.STATIC_DRAW); // data in

                textureBuffers[whichSet] = gl.createBuffer();
                gl.bindBuffer(gl.ARRAY_BUFFER, textureBuffers[whichSet]);
                gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(inputTriangles[whichSet].textureCoords), gl.STATIC_DRAW);

                // set up the triangle index array, adjusting indices across sets
                inputTriangles[whichSet].glTriangles = []; // flat index list for webgl
                triSetSizes[whichSet] = inputTriangles[whichSet].triangles.length; // number of tris in this set

                for (whichSetTri = 0; whichSetTri < triSetSizes[whichSet]; whichSetTri++) {
                    triToAdd = inputTriangles[whichSet].triangles[whichSetTri]; // get tri to add
                    inputTriangles[whichSet].glTriangles.push(triToAdd[0], triToAdd[1], triToAdd[2]); // put indices in set list
					
					/* var tri = {vertices: [], bufferIndex: 0, whichset: 0};
                    var vertices = [
                        inputTriangles[whichSet].glVertices[triToAdd[0] * 3], inputTriangles[whichSet].glVertices[triToAdd[0] * 3 + 1], inputTriangles[whichSet].glVertices[triToAdd[0] * 3 + 2],
                        inputTriangles[whichSet].glVertices[triToAdd[1] * 3], inputTriangles[whichSet].glVertices[triToAdd[1] * 3 + 1], inputTriangles[whichSet].glVertices[triToAdd[1] * 3 + 2],
                        inputTriangles[whichSet].glVertices[triToAdd[2] * 3], inputTriangles[whichSet].glVertices[triToAdd[2] * 3 + 1], inputTriangles[whichSet].glVertices[triToAdd[2] * 3 + 2]
                    ];

                    var normals = [
                        inputTriangles[whichSet].glNormals[triToAdd[0] * 3], inputTriangles[whichSet].glNormals[triToAdd[0] * 3 + 1], inputTriangles[whichSet].glNormals[triToAdd[0] * 3 + 2],
                        inputTriangles[whichSet].glNormals[triToAdd[1] * 3], inputTriangles[whichSet].glNormals[triToAdd[1] * 3 + 1], inputTriangles[whichSet].glNormals[triToAdd[1] * 3 + 2],
                        inputTriangles[whichSet].glNormals[triToAdd[2] * 3], inputTriangles[whichSet].glNormals[triToAdd[2] * 3 + 1], inputTriangles[whichSet].glNormals[triToAdd[2] * 3 + 2]
                    ];

                    var uvs = [
                        inputTriangles[whichSet].textureCoords[triToAdd[0] * 2], inputTriangles[whichSet].textureCoords[triToAdd[0] * 2 + 1],
                        inputTriangles[whichSet].textureCoords[triToAdd[1] * 2], inputTriangles[whichSet].textureCoords[triToAdd[1] * 2 + 1],
                        inputTriangles[whichSet].textureCoords[triToAdd[2] * 2], inputTriangles[whichSet].textureCoords[triToAdd[2] * 2 + 1],
                    ];

                    vertexBuffers.push(gl.createBuffer());
                    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffers[vertexBuffers.length - 1]);
                    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

                    normalBuffers.push(gl.createBuffer()); // init empty webgl set normal component buffer
                    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffers[normalBuffers.length - 1]); // activate that buffer
                    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW); // data in

                    textureBuffers.push(gl.createBuffer());
                    gl.bindBuffer(gl.ARRAY_BUFFER, textureBuffers[textureBuffers.length - 1]);
                    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uvs), gl.STATIC_DRAW);

                    tri.whichset = whichSet;
                    tri.bufferIndex = vertexBuffers.length - 1;
                    tri.vertices = vertices;
                    if (inputTriangles[whichSet].material.alpha == 1) {
                        opaqueTriangles.push(tri);
                    } else {
                        console.log("...");
                        transTriangles.push(tri);
                    } */
                } // end for triangles in set

                // send the triangle indices to webGL
                triangleBuffers.push(gl.createBuffer()); // init empty triangle index buffer
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffers[whichSet]); // activate that buffer
                gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(inputTriangles[whichSet].glTriangles), gl.STATIC_DRAW); // data in

            } // end for each triangle set 

            inputEllipsoids = getJSONFile(INPUT_ELLIPSOIDS_URL, "ellipsoids"); // read in the ellipsoids

            if (inputEllipsoids == String.null)
                throw "Unable to load ellipsoids file!";
            else {

                // init ellipsoid highlighting, translation and rotation; update bbox
                var ellipsoid; // current ellipsoid
                var ellipsoidModel; // current ellipsoid triangular model
                var temp = vec3.create(); // an intermediate vec3
                var minXYZ = vec3.create(), maxXYZ = vec3.create();  // min/max xyz from ellipsoid
                numEllipsoids = inputEllipsoids.length; // remember how many ellipsoids
                for (var whichEllipsoid = 0; whichEllipsoid < numEllipsoids; whichEllipsoid++) {

                    // set up various stats and transforms for this ellipsoid
                    ellipsoid = inputEllipsoids[whichEllipsoid];
                    ellipsoid.on = false; // ellipsoids begin without highlight
                    ellipsoid.translation = vec3.fromValues(0, 0, 0); // ellipsoids begin without translation
                    ellipsoid.xAxis = vec3.fromValues(1, 0, 0); // ellipsoid X axis
                    ellipsoid.yAxis = vec3.fromValues(0, 1, 0); // ellipsoid Y axis
                    ellipsoid.center = vec3.fromValues(ellipsoid.x, ellipsoid.y, ellipsoid.z); // locate ellipsoid ctr
                    vec3.set(minXYZ, ellipsoid.x - ellipsoid.a, ellipsoid.y - ellipsoid.b, ellipsoid.z - ellipsoid.c);
                    vec3.set(maxXYZ, ellipsoid.x + ellipsoid.a, ellipsoid.y + ellipsoid.b, ellipsoid.z + ellipsoid.c);
                    vec3.min(minCorner, minCorner, minXYZ); // update world bbox min corner
                    vec3.max(maxCorner, maxCorner, maxXYZ); // update world bbox max corner

                    if (ellipsoid.alpha == 1) {
                        eOpaqueIndex.push(whichEllipsoid);
                    } else {
                        eTransIndex.push(whichEllipsoid);
                    }

                    // make the ellipsoid model
                    ellipsoidModel = makeEllipsoid(ellipsoid, 32);

                    // send the ellipsoid vertex coords and normals to webGL
                    vertexBuffers.push(gl.createBuffer()); // init empty webgl ellipsoid vertex coord buffer
                    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffers[vertexBuffers.length - 1]); // activate that buffer
                    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(ellipsoidModel.vertices), gl.STATIC_DRAW); // data in
                    normalBuffers.push(gl.createBuffer()); // init empty webgl ellipsoid vertex normal buffer
                    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffers[normalBuffers.length - 1]); // activate that buffer
                    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(ellipsoidModel.normals), gl.STATIC_DRAW); // data in

                    textureBuffers.push(gl.createBuffer());
                    gl.bindBuffer(gl.ARRAY_BUFFER, textureBuffers[textureBuffers.length - 1]);
                    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(ellipsoidModel.textures), gl.STATIC_DRAW);

                    triSetSizes.push(ellipsoidModel.triangles.length);


                    // send the triangle indices to webGL
                    triangleBuffers.push(gl.createBuffer()); // init empty triangle index buffer
                    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffers[triangleBuffers.length - 1]); // activate that buffer
                    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(ellipsoidModel.triangles), gl.STATIC_DRAW); // data in
					
					//makeEllipsoid(ellipsoid, 32, whichEllipsoid + numTriangleSets);
                } // end for each ellipsoid

                viewDelta = vec3.length(vec3.subtract(temp, maxCorner, minCorner)) / 100; // set global
            } // end if ellipsoid file loaded
        } // end if triangle file loaded
    } // end try 

    catch (e) {
        console.log(e);
    } // end catch
} // end load models

// setup the webGL shaders
function setupShaders() {

    // define vertex shader in essl using es6 template strings
    var vShaderCode = `
        attribute vec3 aVertexPosition; // vertex position
        attribute vec3 aVertexNormal; // vertex normal
        
        attribute vec2 a_texcoord;
        
        uniform mat4 umMatrix; // the model matrix
        uniform mat4 upvmMatrix; // the project view model matrix
        
        varying vec3 vWorldPos; // interpolated world position of vertex
        varying vec3 vVertexNormal; // interpolated normal for frag shader
        
        varying vec2 v_texcoord;

        void main(void) {
            
            // vertex position
            vec4 vWorldPos4 = umMatrix * vec4(aVertexPosition, 1.0);
            vWorldPos = vec3(vWorldPos4.x,vWorldPos4.y,vWorldPos4.z);
            gl_Position = upvmMatrix * vec4(aVertexPosition, 1.0);

            // vertex normal (assume no non-uniform scale)
            vec4 vWorldNormal4 = umMatrix * vec4(aVertexNormal, 0.0);
            vVertexNormal = normalize(vec3(vWorldNormal4.x,vWorldNormal4.y,vWorldNormal4.z)); 
            
            v_texcoord = a_texcoord;
        }
    `;

    // define fragment shader in essl using es6 template strings
    var fShaderCode = `
        precision mediump float; // set float to medium precision

        // eye location
        uniform vec3 uEyePosition; // the eye's position in world
        
        // light properties
        uniform vec3 uLightAmbient; // the light's ambient color
        uniform vec3 uLightDiffuse; // the light's diffuse color
        uniform vec3 uLightSpecular; // the light's specular color
        uniform vec3 uLightPosition; // the light's position
        
        // material properties
        uniform vec3 uAmbient; // the ambient reflectivity
        uniform vec3 uDiffuse; // the diffuse reflectivity
        uniform vec3 uSpecular; // the specular reflectivity
        uniform float uShininess; // the specular exponent
        
        // geometry properties
        varying vec3 vWorldPos; // world xyz of fragment
        varying vec3 vVertexNormal; // normal of fragment
        
        varying vec2 v_texcoord;
        uniform float uAlpha;

        uniform sampler2D uSampler;
        uniform int uLightMode;
            
        void main(void) {
            vec3 lightWeighting;
        
            // ambient term
            vec3 ambient = uAmbient*uLightAmbient; 
            
            // diffuse term
            vec3 normal = normalize(vVertexNormal); 
            vec3 light = normalize(uLightPosition - vWorldPos);
            float lambert = max(0.0,dot(normal,light));
            vec3 diffuse = uDiffuse*uLightDiffuse*lambert; // diffuse term
                      
            // specular term
            vec3 eye = normalize(uEyePosition - vWorldPos);
            vec3 halfVec = normalize(light+eye);
            float highlight = pow(max(0.0,dot(normal,halfVec)),uShininess);
            vec3 specular = uSpecular*uLightSpecular*highlight; // specular term
            
            lightWeighting = uLightAmbient + uLightDiffuse*lambert + uLightSpecular*highlight;
            
            // combine to output color
            vec3 colorOut = ambient + diffuse + specular; // no specular yet
            vec4 textureColor = texture2D(uSampler, vec2(v_texcoord.s, v_texcoord.t));
            if(uLightMode == 0){
                gl_FragColor = vec4(textureColor.rgb * lightWeighting, textureColor.a * uAlpha); 
            }
            if(uLightMode == 1){
                gl_FragColor = vec4(textureColor.rgb * colorOut, textureColor.a * uAlpha); 
            }
        }
    `;

    try {
        var fShader = gl.createShader(gl.FRAGMENT_SHADER); // create frag shader
        gl.shaderSource(fShader, fShaderCode); // attach code to shader
        gl.compileShader(fShader); // compile the code for gpu execution

        var vShader = gl.createShader(gl.VERTEX_SHADER); // create vertex shader
        gl.shaderSource(vShader, vShaderCode); // attach code to shader
        gl.compileShader(vShader); // compile the code for gpu execution

        if (!gl.getShaderParameter(fShader, gl.COMPILE_STATUS)) { // bad frag shader compile
            throw "error during fragment shader compile: " + gl.getShaderInfoLog(fShader);
            gl.deleteShader(fShader);
        } else if (!gl.getShaderParameter(vShader, gl.COMPILE_STATUS)) { // bad vertex shader compile
            throw "error during vertex shader compile: " + gl.getShaderInfoLog(vShader);
            gl.deleteShader(vShader);
        } else { // no compile errors
            var shaderProgram = gl.createProgram(); // create the single shader program
            gl.attachShader(shaderProgram, fShader); // put frag shader in program
            gl.attachShader(shaderProgram, vShader); // put vertex shader in program
            gl.linkProgram(shaderProgram); // link program into gl context

            if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) { // bad program link
                throw "error during shader program linking: " + gl.getProgramInfoLog(shaderProgram);
            } else { // no shader program link errors
                gl.useProgram(shaderProgram); // activate shader program (frag and vert)

                // locate and enable vertex attributes
                vPosAttribLoc = gl.getAttribLocation(shaderProgram, "aVertexPosition"); // ptr to vertex pos attrib
                gl.enableVertexAttribArray(vPosAttribLoc); // connect attrib to array
                vNormAttribLoc = gl.getAttribLocation(shaderProgram, "aVertexNormal"); // ptr to vertex normal attrib
                gl.enableVertexAttribArray(vNormAttribLoc); // connect attrib to array

                vTextureAttribLocation = gl.getAttribLocation(shaderProgram, "a_texcoord");
                gl.enableVertexAttribArray(vTextureAttribLocation);

                // locate vertex uniforms
                mMatrixULoc = gl.getUniformLocation(shaderProgram, "umMatrix"); // ptr to mmat
                pvmMatrixULoc = gl.getUniformLocation(shaderProgram, "upvmMatrix"); // ptr to pvmmat

                // locate fragment uniforms
                var eyePositionULoc = gl.getUniformLocation(shaderProgram, "uEyePosition"); // ptr to eye position
                var lightAmbientULoc = gl.getUniformLocation(shaderProgram, "uLightAmbient"); // ptr to light ambient
                var lightDiffuseULoc = gl.getUniformLocation(shaderProgram, "uLightDiffuse"); // ptr to light diffuse
                var lightSpecularULoc = gl.getUniformLocation(shaderProgram, "uLightSpecular"); // ptr to light specular
                var lightPositionULoc = gl.getUniformLocation(shaderProgram, "uLightPosition"); // ptr to light position
                ambientULoc = gl.getUniformLocation(shaderProgram, "uAmbient"); // ptr to ambient
                diffuseULoc = gl.getUniformLocation(shaderProgram, "uDiffuse"); // ptr to diffuse
                specularULoc = gl.getUniformLocation(shaderProgram, "uSpecular"); // ptr to specular
                shininessULoc = gl.getUniformLocation(shaderProgram, "uShininess"); // ptr to shininess

                sUniform = gl.getUniformLocation(shaderProgram, "uSampler");
                alphaUniform = gl.getUniformLocation(shaderProgram, "uAlpha");
                lightModeUniform = gl.getUniformLocation(shaderProgram, "uLightMode");

                // pass global constants into fragment uniforms
                gl.uniform3fv(eyePositionULoc, Eye); // pass in the eye's position
                gl.uniform3fv(lightAmbientULoc, lightAmbient); // pass in the light's ambient emission
                gl.uniform3fv(lightDiffuseULoc, lightDiffuse); // pass in the light's diffuse emission
                gl.uniform3fv(lightSpecularULoc, lightSpecular); // pass in the light's specular emission
                gl.uniform3fv(lightPositionULoc, lightPosition); // pass in the light's position
            } // end if no shader program link errors
        } // end if no compile errors
    } // end try 

    catch (e) {
        console.log(e);
    } // end catch
} // end setup shaders

// render the loaded model
function renderModels() {

    sortedModels = [];
    // construct the model transform matrix, based on model state
    function makeModelTransform(currModel) {
        var zAxis = vec3.create(), sumRotation = mat4.create(), temp = mat4.create(), negCtr = vec3.create();

        // move the model to the origin
        mat4.fromTranslation(mMatrix, vec3.negate(negCtr, currModel.center));

        // scale for highlighting if needed
        if (currModel.on)
            mat4.multiply(mMatrix, mat4.fromScaling(temp, vec3.fromValues(1.2, 1.2, 1.2)), mMatrix); // S(1.2) * T(-ctr)

        // rotate the model to current interactive orientation
        vec3.normalize(zAxis, vec3.cross(zAxis, currModel.xAxis, currModel.yAxis)); // get the new model z axis
        mat4.set(sumRotation, // get the composite rotation
            currModel.xAxis[0], currModel.yAxis[0], zAxis[0], 0,
            currModel.xAxis[1], currModel.yAxis[1], zAxis[1], 0,
            currModel.xAxis[2], currModel.yAxis[2], zAxis[2], 0,
            0, 0, 0, 1);
        mat4.multiply(mMatrix, sumRotation, mMatrix); // R(ax) * S(1.2) * T(-ctr)

        // translate back to model center
        mat4.multiply(mMatrix, mat4.fromTranslation(temp, currModel.center), mMatrix); // T(ctr) * R(ax) * S(1.2) * T(-ctr)

        // translate model to current interactive orientation
        mat4.multiply(mMatrix, mat4.fromTranslation(temp, currModel.translation), mMatrix); // T(pos)*T(ctr)*R(ax)*S(1.2)*T(-ctr)


    } // end make model transform

    // var hMatrix = mat4.create(); // handedness matrix
    var pMatrix = mat4.create(); // projection matrix
    var vMatrix = mat4.create(); // view matrix
    var mMatrix = mat4.create(); // model matrix
    var pvMatrix = mat4.create(); // hand * proj * view matrices
    var pvmMatrix = mat4.create(); // hand * proj * view * model matrices

    window.requestAnimationFrame(renderModels); // set up frame render callback

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); // clear frame/depth buffers

    // set up projection and view
    // mat4.fromScaling(hMatrix,vec3.fromValues(-1,1,1)); // create handedness matrix
    mat4.perspective(pMatrix, 0.5 * Math.PI, 1, 0.1, 10); // create projection matrix
    mat4.lookAt(vMatrix, Eye, Center, Up); // create view matrix
    mat4.multiply(pvMatrix, pvMatrix, pMatrix); // projection
    mat4.multiply(pvMatrix, pvMatrix, vMatrix); // projection * view
	
	/* var currSet; // the tri set and its material properties
    for (var whichTriSet = 0; whichTriSet < numTriangleSets; whichTriSet++) {
        currSet = inputTriangles[whichTriSet]; */

    function renderOpaque() {
		/* gl.disable(gl.BLEND);
        gl.enable(gl.DEPTH_TEST);
        gl.depthMask(true); */
        var currSet; // the tri set and its material properties
        for (var whichTriSet of tOpaqueIndex) {
		//for (var triangle of opaqueTriangles){
            currSet = inputTriangles[whichTriSet];
			
			/* if (triangle.whichset < numTriangleSets) {
                currSet = inputTriangles[triangle.whichset];
            } else {
                currSet = inputEllipsoids[triangle.whichset - numTriangleSets];
            } */

            gl.disable(gl.BLEND);
            gl.enable(gl.DEPTH_TEST);
            gl.depthMask(true);
            // make model transform, add to view project
            makeModelTransform(currSet);
            mat4.multiply(pvmMatrix, pvMatrix, mMatrix); // project * view * model
            gl.uniformMatrix4fv(mMatrixULoc, false, mMatrix); // pass in the m matrix
            gl.uniformMatrix4fv(pvmMatrixULoc, false, pvmMatrix); // pass in the hpvm matrix

            // reflectivity: feed to the fragment shader
            gl.uniform3fv(ambientULoc, currSet.material.ambient); // pass in the ambient reflectivity
            gl.uniform3fv(diffuseULoc, currSet.material.diffuse); // pass in the diffuse reflectivity
            gl.uniform3fv(specularULoc, currSet.material.specular); // pass in the specular reflectivity
            gl.uniform1f(shininessULoc, currSet.material.n); // pass in the specular exponent
			
			/* if (triangle.whichset < numTriangleSets) {
                // reflectivity: feed to the fragment shader
                gl.uniform3fv(ambientULoc, currSet.material.ambient); // pass in the ambient reflectivity
                gl.uniform3fv(diffuseULoc, currSet.material.diffuse); // pass in the diffuse reflectivity
                gl.uniform3fv(specularULoc, currSet.material.specular); // pass in the specular reflectivity
                gl.uniform1f(shininessULoc, currSet.material.n); // pass in the specular exponent
                gl.uniform1f(alphaUniform, currSet.material.alpha);
            } else {
                // reflectivity: feed to the fragment shader
                gl.uniform3fv(ambientULoc, currSet.ambient); // pass in the ambient reflectivity
                gl.uniform3fv(diffuseULoc, currSet.diffuse); // pass in the diffuse reflectivity
                gl.uniform3fv(specularULoc, currSet.specular); // pass in the specular reflectivity
                gl.uniform1f(shininessULoc, currSet.n); // pass in the specular exponent
                gl.uniform1f(alphaUniform, currSet.alpha);
            } */

            gl.uniform1f(alphaUniform, currSet.material.alpha);
            gl.uniform1i(lightModeUniform, lightMode);

            // vertex buffer: activate and feed into vertex shader
            gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffers[whichTriSet]); // activate
            gl.vertexAttribPointer(vPosAttribLoc, 3, gl.FLOAT, false, 0, 0); // feed
            gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffers[whichTriSet]); // activate
            gl.vertexAttribPointer(vNormAttribLoc, 3, gl.FLOAT, false, 0, 0); // feed

            gl.bindBuffer(gl.ARRAY_BUFFER, textureBuffers[whichTriSet]);
            gl.vertexAttribPointer(vTextureAttribLocation, 2, gl.FLOAT, false, 0, 0);

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, textures[whichTriSet]);
            gl.uniform1i(sUniform, 0);

            // triangle buffer: activate and render
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffers[whichTriSet]); // activate

            gl.drawElements(gl.TRIANGLES, 3 * triSetSizes[whichTriSet], gl.UNSIGNED_SHORT, 0); // render

        } // end for each triangle set

        // render each ellipsoid
        var ellipsoid, instanceTransform = mat4.create(); // the current ellipsoid and material

        for (var whichEllipsoid of eOpaqueIndex) {
            ellipsoid = inputEllipsoids[whichEllipsoid];
			
			//gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,triangleBuffers); // activate

            gl.disable(gl.BLEND);
            gl.enable(gl.DEPTH_TEST);
            gl.depthMask(true);
			
			//gl.drawElements(gl.TRIANGLES,3,gl.UNSIGNED_SHORT,0); // render

            // define model transform, premult with pvmMatrix, feed to vertex shader
            makeModelTransform(ellipsoid);
            pvmMatrix = mat4.multiply(pvmMatrix, pvMatrix, mMatrix); // premultiply with pv matrix
            gl.uniformMatrix4fv(mMatrixULoc, false, mMatrix); // pass in model matrix
            gl.uniformMatrix4fv(pvmMatrixULoc, false, pvmMatrix); // pass in project view model matrix

            // reflectivity: feed to the fragment shader
            gl.uniform3fv(ambientULoc, ellipsoid.ambient); // pass in the ambient reflectivity
            gl.uniform3fv(diffuseULoc, ellipsoid.diffuse); // pass in the diffuse reflectivity
            gl.uniform3fv(specularULoc, ellipsoid.specular); // pass in the specular reflectivity
            gl.uniform1f(shininessULoc, ellipsoid.n); // pass in the specular exponent

            gl.uniform1f(alphaUniform, ellipsoid.alpha);
            gl.uniform1i(lightModeUniform, lightMode);

            gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffers[numTriangleSets + whichEllipsoid]); // activate vertex buffer
            gl.vertexAttribPointer(vPosAttribLoc, 3, gl.FLOAT, false, 0, 0); // feed vertex buffer to shader
            gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffers[numTriangleSets + whichEllipsoid]); // activate normal buffer
            gl.vertexAttribPointer(vNormAttribLoc, 3, gl.FLOAT, false, 0, 0); // feed normal buffer to shader

            gl.bindBuffer(gl.ARRAY_BUFFER, textureBuffers[numTriangleSets + whichEllipsoid]);
            gl.vertexAttribPointer(vTextureAttribLocation, 2, gl.FLOAT, false, 0, 0);

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, textures[numTriangleSets + whichEllipsoid]);
            gl.uniform1i(sUniform, 0);


            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffers[numTriangleSets + whichEllipsoid]); // activate tri buffer
            // draw a transformed instance of the ellipsoid
            gl.drawElements(gl.TRIANGLES, triSetSizes[numTriangleSets + whichEllipsoid], gl.UNSIGNED_SHORT, 0); // render
        } // end for each ellipsoid


    }
	
	/* function renderTransparent() {
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.enable(gl.BLEND);
        gl.depthMask(false);
        gl.disable(gl.DEPTH_TEST);
		
        var currSet; // the tri set and its material properties
        for (var whichTriSet of tTransIndex) {
            currSet = inputTriangles[whichTriSet];
		for (var triangle of transTriangles) {
			if (triangle.whichset < numTriangleSets) {
                currSet = inputTriangles[triangle.whichset];
                console.log("Aloha");
            } else {
                currSet = inputEllipsoids[triangle.whichset - numTriangleSets];
            }

            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            gl.enable(gl.BLEND);
            gl.depthMask(false);
            gl.disable(gl.DEPTH_TEST);
            // make model transform, add to view project
            makeModelTransform(currSet);
            mat4.multiply(pvmMatrix, pvMatrix, mMatrix); // project * view * model
            gl.uniformMatrix4fv(mMatrixULoc, false, mMatrix); // pass in the m matrix
            gl.uniformMatrix4fv(pvmMatrixULoc, false, pvmMatrix); // pass in the hpvm matrix

            // reflectivity: feed to the fragment shader
            gl.uniform3fv(ambientULoc, currSet.material.ambient); // pass in the ambient reflectivity
            gl.uniform3fv(diffuseULoc, currSet.material.diffuse); // pass in the diffuse reflectivity
            gl.uniform3fv(specularULoc, currSet.material.specular); // pass in the specular reflectivity
            gl.uniform1f(shininessULoc, currSet.material.n); // pass in the specular exponent

            gl.uniform1f(alphaUniform, currSet.material.alpha);
            gl.uniform1i(lightModeUniform, lightMode);

            // vertex buffer: activate and feed into vertex shader
            gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffers[whichTriSet]); // activate
            gl.vertexAttribPointer(vPosAttribLoc, 3, gl.FLOAT, false, 0, 0); // feed
            gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffers[whichTriSet]); // activate
            gl.vertexAttribPointer(vNormAttribLoc, 3, gl.FLOAT, false, 0, 0); // feed

            gl.bindBuffer(gl.ARRAY_BUFFER, textureBuffers[whichTriSet]);
            gl.vertexAttribPointer(vTextureAttribLocation, 2, gl.FLOAT, false, 0, 0);

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, textures[whichTriSet]);
            gl.uniform1i(sUniform, 0);

            // triangle buffer: activate and render
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffers[whichTriSet]); // activate

            gl.drawElements(gl.TRIANGLES, 3 * triSetSizes[whichTriSet], gl.UNSIGNED_SHORT, 0); // render

        } // end for each triangle set

        // render each ellipsoid
        var ellipsoid, instanceTransform = mat4.create(); // the current ellipsoid and material

        for (var whichEllipsoid of eTransIndex) {
            ellipsoid = inputEllipsoids[whichEllipsoid];

            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            gl.enable(gl.BLEND);
            gl.depthMask(false);
            gl.disable(gl.DEPTH_TEST);

            // define model transform, premult with pvmMatrix, feed to vertex shader
            makeModelTransform(ellipsoid);
            pvmMatrix = mat4.multiply(pvmMatrix, pvMatrix, mMatrix); // premultiply with pv matrix
            gl.uniformMatrix4fv(mMatrixULoc, false, mMatrix); // pass in model matrix
            gl.uniformMatrix4fv(pvmMatrixULoc, false, pvmMatrix); // pass in project view model matrix

            // reflectivity: feed to the fragment shader
            gl.uniform3fv(ambientULoc, ellipsoid.ambient); // pass in the ambient reflectivity
            gl.uniform3fv(diffuseULoc, ellipsoid.diffuse); // pass in the diffuse reflectivity
            gl.uniform3fv(specularULoc, ellipsoid.specular); // pass in the specular reflectivity
            gl.uniform1f(shininessULoc, ellipsoid.n); // pass in the specular exponent

            gl.uniform1f(alphaUniform, ellipsoid.alpha);
            gl.uniform1i(lightModeUniform, lightMode);

            gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffers[numTriangleSets + whichEllipsoid]); // activate vertex buffer
            gl.vertexAttribPointer(vPosAttribLoc, 3, gl.FLOAT, false, 0, 0); // feed vertex buffer to shader
            gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffers[numTriangleSets + whichEllipsoid]); // activate normal buffer
            gl.vertexAttribPointer(vNormAttribLoc, 3, gl.FLOAT, false, 0, 0); // feed normal buffer to shader

            gl.bindBuffer(gl.ARRAY_BUFFER, textureBuffers[numTriangleSets + whichEllipsoid]);
            gl.vertexAttribPointer(vTextureAttribLocation, 2, gl.FLOAT, false, 0, 0);

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, textures[numTriangleSets + whichEllipsoid]);
            gl.uniform1i(sUniform, 0);


            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffers[numTriangleSets + whichEllipsoid]); // activate tri buffer
            // draw a transformed instance of the ellipsoid
            gl.drawElements(gl.TRIANGLES, triSetSizes[numTriangleSets + whichEllipsoid], gl.UNSIGNED_SHORT, 0); // render
        } // end for each ellipsoid
    } */

    function renderTransparent() {
        var currSet; // the tri set and its material properties
        for (var whichTriSet of tTransIndex) {
            currSet = inputTriangles[whichTriSet];
            makeModelTransform(currSet);

            var center = currSet.center;
            var center4 = vec4.fromValues(center[0], center[1], center[2], 1.0);
            mat4.multiply(center4, mMatrix, center4);
            var depth = getDepth(center4[2]);
            sortedModels.push({depth: depth, index: whichTriSet});

        }

        var ellipsoid, instanceTransform = mat4.create(); // the current ellipsoid and material

        for (var whichEllipsoid of eTransIndex) {
            ellipsoid = inputEllipsoids[whichEllipsoid];
            makeModelTransform(ellipsoid);

            var center = ellipsoid.center;
            var center4 = vec4.fromValues(center[0], center[1], center[2], 1.0);
            mat4.multiply(center4, mMatrix, center4);
            var depth = getDepth(center4[2]);
            sortedModels.push({depth: depth, index: whichEllipsoid + numTriangleSets});
        }

        sortedModels.sort(function (x, y) {
            return y.depth - x.depth;
        })

        for (var item of sortedModels) {
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            gl.enable(gl.BLEND);
            gl.depthMask(false);
            gl.disable(gl.DEPTH_TEST);
            if (item.index < numTriangleSets) {
                var index = item.index;
                currSet = inputTriangles[item.index];
                makeModelTransform(currSet);
                mat4.multiply(pvmMatrix, pvMatrix, mMatrix); // project * view * model
                gl.uniformMatrix4fv(mMatrixULoc, false, mMatrix); // pass in the m matrix
                gl.uniformMatrix4fv(pvmMatrixULoc, false, pvmMatrix); // pass in the hpvm matrix

                // reflectivity: feed to the fragment shader
                gl.uniform3fv(ambientULoc, currSet.material.ambient); // pass in the ambient reflectivity
                gl.uniform3fv(diffuseULoc, currSet.material.diffuse); // pass in the diffuse reflectivity
                gl.uniform3fv(specularULoc, currSet.material.specular); // pass in the specular reflectivity
                gl.uniform1f(shininessULoc, currSet.material.n); // pass in the specular exponent

                gl.uniform1f(alphaUniform, currSet.material.alpha);
                gl.uniform1i(lightModeUniform, lightMode);

                // vertex buffer: activate and feed into vertex shader
                gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffers[index]); // activate
                gl.vertexAttribPointer(vPosAttribLoc, 3, gl.FLOAT, false, 0, 0); // feed
                gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffers[index]); // activate
                gl.vertexAttribPointer(vNormAttribLoc, 3, gl.FLOAT, false, 0, 0); // feed

                gl.bindBuffer(gl.ARRAY_BUFFER, textureBuffers[index]);
                gl.vertexAttribPointer(vTextureAttribLocation, 2, gl.FLOAT, false, 0, 0);

                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, textures[index]);
                gl.uniform1i(sUniform, 0);

                // triangle buffer: activate and render
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffers[index]); // activate

                gl.drawElements(gl.TRIANGLES, 3 * triSetSizes[index], gl.UNSIGNED_SHORT, 0); // render
            }
            if (item.index >= numTriangleSets) {
                var index = item.index - numTriangleSets;
                ellipsoid = inputEllipsoids[index];
                // define model transform, premult with pvmMatrix, feed to vertex shader
                makeModelTransform(ellipsoid);
                pvmMatrix = mat4.multiply(pvmMatrix, pvMatrix, mMatrix); // premultiply with pv matrix
                gl.uniformMatrix4fv(mMatrixULoc, false, mMatrix); // pass in model matrix
                gl.uniformMatrix4fv(pvmMatrixULoc, false, pvmMatrix); // pass in project view model matrix

                // reflectivity: feed to the fragment shader
                gl.uniform3fv(ambientULoc, ellipsoid.ambient); // pass in the ambient reflectivity
                gl.uniform3fv(diffuseULoc, ellipsoid.diffuse); // pass in the diffuse reflectivity
                gl.uniform3fv(specularULoc, ellipsoid.specular); // pass in the specular reflectivity
                gl.uniform1f(shininessULoc, ellipsoid.n); // pass in the specular exponent

                gl.uniform1f(alphaUniform, ellipsoid.alpha);
                gl.uniform1i(lightModeUniform, lightMode);

                gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffers[numTriangleSets + index]); // activate vertex buffer
                gl.vertexAttribPointer(vPosAttribLoc, 3, gl.FLOAT, false, 0, 0); // feed vertex buffer to shader
                gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffers[numTriangleSets + index]); // activate normal buffer
                gl.vertexAttribPointer(vNormAttribLoc, 3, gl.FLOAT, false, 0, 0); // feed normal buffer to shader

                gl.bindBuffer(gl.ARRAY_BUFFER, textureBuffers[numTriangleSets + index]);
                gl.vertexAttribPointer(vTextureAttribLocation, 2, gl.FLOAT, false, 0, 0);

                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, textures[numTriangleSets + index]);
                gl.uniform1i(sUniform, 0);


                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffers[numTriangleSets + index]); // activate tri buffer
                // draw a transformed instance of the ellipsoid
                gl.drawElements(gl.TRIANGLES, triSetSizes[numTriangleSets + index], gl.UNSIGNED_SHORT, 0); // render
            }

        }
    }

    renderOpaque();
    renderTransparent();

} // end render model

function getDepth(zModel) {
    var zEye = Eye[2];
    return Math.abs(zModel - zEye);
}

function isPowerOf2(value) {
    return (value & (value - 1)) == 0;
}

function loadTexture() {

    for (var whichTriSet = 0; whichTriSet < numTriangleSets; whichTriSet++) {
        textures[whichTriSet] = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, textures[whichTriSet]);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 255, 255])); // blue

        textures[whichTriSet].image = new Image();
        textures[whichTriSet].image.crossOrigin = "Anonymous";
        (function (whichTriSet) {
            textures[whichTriSet].image.onload = function () {
				//console.log("whichTriset" + whichTriSet);
                handleLoadedTexture(textures[whichTriSet]);
            }
        })(whichTriSet);

        textures[whichTriSet].image.src = INPUT_TEXTURE_URL + inputTriangles[whichTriSet].material.texture;
    }

    for (var whichEllipsoid = 0; whichEllipsoid < numEllipsoids; whichEllipsoid++) {
        var index = numTriangleSets + whichEllipsoid;
        textures[index] = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, textures[index]);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 255, 255])); // blue

        textures[index].image = new Image();
        textures[index].image.crossOrigin = "Anonymous";

        (function (index) {
            textures[index].image.onload = function () {
                handleLoadedTexture(textures[index]);
            }
        })(index);
        textures[index].image.src = INPUT_TEXTURE_URL + inputEllipsoids[whichEllipsoid].texture;

    }
}


function handleLoadedTexture(texture) {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
	/* if (isPowerOf2(texture.image.width) && isPowerOf2(texture.image.height)) {
       // Yes, it's a power of 2. Generate mips.
       gl.generateMipmap(gl.TEXTURE_2D);
    } else {
       // No, it's not a power of 2. Turn of mips and set
       // wrapping to clamp to edge
       gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
       gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
       gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    } */
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture.image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
	//gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	//gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	//gl.bindTexture(gl.TEXTURE_2D, null);
}


/* MAIN -- HERE is where execution begins after window load */

function main() {

    setupWebGL(); // set up the webGL environment
    loadModels(); // load in the models from tri file
    setupShaders(); // setup the webGL shaders
    loadTexture(); // load the textures
    renderModels(); // draw the triangles using webGL


} // end main
