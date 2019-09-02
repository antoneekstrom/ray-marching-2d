
/// <reference path="node_modules/@types/p5/global.d.ts" />

const MODE_RENDER = "render";
const MODE_SCENE = "scene";

let ray;
let camera;
let objects;

let objectCount = 10;
let renderMode = MODE_SCENE;
let autoMarch = true;

let marchingOptions;

class Transform {
    constructor(pos, s, c) {
        this.pos = pos.copy();
        this.scale = s.copy();
        this.color = c;
    }
    get signedDist() {
        return (pos) => signedDistanceCircle(pos, this);
    }
    draw() {}
}

class Ray {

    constructor(origin, dir, dist, scene) {
        this.origin = origin; // the current position (origin + dist)
        this.dist = dist; // the distance vector the ray has traveled
        this.color = color(255);
        this.dir = dir; // angle/direction of ray
        this.len = origin.dist(this.dist); // the length traveled (number)
        this.minDist = 0; // current minimum distance to object
        this.steps = 0;
        this.history = [];

        this.collisionThreshold = 0.1;

        if (scene != null) this.calcMinDist(scene);
    }

    get position() {
        return this.origin.copy().add(this.distance);
    }

    get distance() {
        return this.dist;
    }

    get state() {
        return {
            origin: this.origin,
            position: this.position,
            minDist: this.minDist,
            color: this.color,
            step: this.steps
        };
    }

    unshiftState() {
        this.history.unshift(this.state);
    }

    resetState(scene) {
        this.len = 0;
        this.dist = createVector(0, 0);
        this.steps = 0;
        this.minDist = 0;
        this.history = [this.state];

        if (scene != null) this.calcMinDist(scene);
    }

    get hasCollided() {
        return this.minDist <= this.collisionThreshold;
    }

    get lastResult() {
        return Object.assign(this.state, {
            minDist: this.minDist,
            collided: this.hasCollided,
        });
    }

    march(distance, options) {

        if (options != undefined) {
            const { xRange, yRange, maxLen } = options;
            if (xRange != undefined && this.position.x < xRange.x && this.position.x > xRange.y) return this.lastResult;
            if (yRange != undefined && this.position.y < yRange.x && this.position.y > yRange.y) return this.lastResult;
            if (maxLen != undefined && this.len >= maxLen) return this.lastResult;
        }
        if (this.hasCollided) return this.lastResult;

        this.unshiftState();
        this.steps++;

        const dist = distance || this.minDist;
        const delta = createVector(this.dir.x * dist, this.dir.y * dist);
        this.dist.add(delta);
        this.len = dist;

        return this.lastResult;
    }

    drawState(s) {
        if (s == undefined) return;
        const { position, origin, minDist } = s;

        noFill();
        stroke(s.color);
        strokeWeight(8);
        line(origin.x, origin.y, position.x, position.y);

        drawRadius(position, minDist);

        noStroke();
        fill(255);
        circle(origin.x, origin.y, 8);
    }

    calcMinDist(objects) {
        if (objects.length < 1) return;

        this.minDist = objects[0].signedDist(this.position);
    
        for (let i = 1; i < objects.length; i++) {
            const obj = objects[i];
            const dist = obj.signedDist(this.position);
            if (dist < this.minDist) this.minDist = dist;
        }
        return this.minDist;
    }

    draw() {
        this.drawState(this.state);
    }
}

class Camera {
    constructor(scene, pos, rotation, fov, res) {
        this.scene = scene;
        this.pos = pos;
        this.rotation = rotation;
        this.fov = fov;
        this.res = res;

        this.renderFinished = false;
        this.rays = [];
    }

    get cameraDirection() {
        return createVector(cos(this.rotation), sin(this.rotation));
    }

    init() {
        const camDir = this.cameraDirection;
        const halfView = camDir.copy().mult(0.5);
        for (let i = 0; i < this.res; i++) {
            const dir = camDir.copy().sub(halfView).add(camDir.copy().mult((this.fov / this.res) * i));
            console.log(dir);
            const dist = createVector(0, 0);
            const ray = new Ray(this.pos, dir, dist, objects);
            this.rays.push(ray);
        }
    }

    render() {
        if (this.renderFinished) return;
        let collided = true;
        for (const ray of this.rays) {
            if (!ray.hasCollided) {
                ray.calcMinDist(this.scene);
                const result = ray.march(null, marchingOptions);
                if (result.collided) console.log(ray);
                collided = false;
            }
        }
        this.renderFinished = collided;
    }
}

class Circle extends Transform {
    constructor(x, y, r) {
        super(createVector(x, y), createVector(r, r), color(255));
    }
    draw() {
        noStroke();
        fill(this.color);
        circle(this.pos.x, this.pos.y, this.scale.x);
    }
}

class Rectangle extends Transform {
    constructor(x, y, w, h) {
        super(createVector(x, y), createVector(w, h), color(255));
    }
    get left() {
        return this.x;
    }
    get right() {
        return this.y;
    }
    get width() {
        return this.scale.x;
    }
    get height() {
        return this.scale.y;
    }
    get signedDist() {
        return (pos) => signedDistanceRectangle(pos, this);
    }
    draw() {
        rectMode(CENTER);
        noStroke();
        fill(this.color);
        rect(this.pos.x, this.pos.y, this.scale.x, this.scale.y);
    }
}

function signedDistanceCircle(origin, circle) {
    return origin.dist(circle.pos) - circle.scale.x;
}

function signedDistanceLine(origin, a, b) {

}

function signedDistanceRectangle(origin, r) {

    const axis = (a1, a2) => {
        const d = createVector(abs(origin.x), abs(origin.y)).sub(createVector(a1, a2));
        return min(max(d.x, d.y), 0) + maxVec(d, createVector(0, 0)).mag();
    }

    return axis(r.x, r.x + r.width);
}

function maxVec(a, b) {
    return a.mag() > b.mag() ? a : b;
}

function drawRadius(pos, r) {
    noStroke();
    fill(255, 100);
    circle(pos.x, pos.y, r);
}

function setup() {
    createCanvas(windowWidth, windowHeight);

    marchingOptions = {
        xRange: createVector(0, width),
        yRange: createVector(0, height),
        maxLen: sqrt(width * width + height * height)
    }

    objects = createScene(objectCount);
    //ray = new Ray(createVector(width / 4, height / 2), createVector(1, 0), createVector(0, 0), objects);
    camera = new Camera(objects, createVector(width / 4, height / 2), 0, 45, 10);
    camera.init();

    oncontextmenu = (ev) => false;
}

function mouseReleased(e) {
    const m = createVector(mouseX, mouseY);

    if (mouseButton == LEFT) {
        const dir = m.sub(ray.origin).normalize();
        setRayDirection(dir);
    }
    else if (mouseButton == RIGHT) {
        setRayPosition(m);
    }
}

function keyReleased(e) {
    if (key === " ") {
        ray.calcMinDist(objects);
        const r = ray.march(null, marchingOptions);
        if (r.collided) console.log(r);
    }
    else if (key === "r") {
        reset(createScene(objectCount));
    }
}

function setRayDirection(dir) {
    ray.dist = createVector(0, 0);
    ray.dir = dir;
    ray.resetState(objects);
}

function setRayPosition(pos) {
    ray.origin = pos;
    ray.resetState(objects);
}

function createScene(circles) {
    let scene = [];

    for (let i = 0; i < circles; i++) {
        const c = new Circle(random(0, width), random(0, height), random(15, 100));
        scene.push(c);
    }

    return scene;
}

function reset(scene) {
    objects = scene;
    ray.resetState(scene);
}

function drawScene(ray, scene) {
    ray.history.forEach(ray.drawState);
    scene.forEach(obj => obj.draw());
}

function renderScene(ray, scene) {
}

function updateRay(ray, scene) {
    if (autoMarch && !ray.hasCollided) {
        ray.calcMinDist(scene);
        const r = ray.march(null, marchingOptions);
        if (r.collided) console.log(r);
    }

    if (renderMode == MODE_RENDER) renderScene(ray, scene);
    else if (renderMode == MODE_SCENE) drawScene(ray, scene);
}

function draw() {
    background(0);
    camera.render();

    noStroke();
    fill(255);
    camera.rays.forEach(r => {
        //circle(r.position.x, r.position.y, 5);
        r.draw();
    });
}