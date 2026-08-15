import * as THREE from "three";

const GRID_SIZE = 20;
const MOUSE_RADIUS = 0.25;
const STRENGTH = 0.1;
const RELAXATION = 0.925;
const DISPLACEMENT = 0.015;
const ABERRATION = 0.15;

const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D uTexture;
  uniform sampler2D uDataTexture;
  varying vec2 vUv;

  void main() {
    vec4 offset = texture2D(uDataTexture, vUv);
    vec2 shift = ${DISPLACEMENT.toFixed(6)} * offset.rg;
    vec2 split = shift * ${ABERRATION.toFixed(6)};

    float r = texture2D(uTexture, vUv - shift + split).r;
    float g = texture2D(uTexture, vUv - shift).g;
    float b = texture2D(uTexture, vUv - shift - split).b;

    gl_FragColor = vec4(r, g, b, 1.0);
  }
`;

function getGridDimensions(width, height) {
  const aspect = width / height;
  const gridX = aspect >= 1 ? Math.round(GRID_SIZE * aspect) : GRID_SIZE;
  const gridY = aspect >= 1 ? GRID_SIZE : Math.round(GRID_SIZE / aspect);
  return [Math.max(1, gridX), Math.max(1, gridY)];
}

function createDataTexture(gridX, gridY) {
  const data = new Float32Array(gridX * gridY * 4);
  const texture = new THREE.DataTexture(
    data,
    gridX,
    gridY,
    THREE.RGBAFormat,
    THREE.FloatType,
  );
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.needsUpdate = true;
  return { texture, data };
}

function getCoverScale(video, width, height) {
  const videoAspect = (video.videoWidth || 16) / (video.videoHeight || 9);
  const containerAspect = width / height;
  const scaleX = containerAspect < videoAspect ? videoAspect / containerAspect : 1;
  const scaleY = containerAspect > videoAspect ? containerAspect / videoAspect : 1;
  return [scaleX, scaleY];
}

// Mounts a mouse-reactive WebGL distortion effect over `video`, rendering it
// into a canvas appended to `canvasContainer`. Pointer tracking listens on
// `pointerRoot` instead of `canvasContainer` - the canvas layer sits behind
// the hero's text/CTA and is `pointer-events: none` so clicks pass through
// to them, which means it can never be a hit-test target itself; `pointerRoot`
// must be a hit-testable ancestor (e.g. the hero section) that covers the
// same area. Returns a cleanup function that disposes every GPU resource and
// removes all listeners/DOM nodes it created, or `null` if WebGL isn't
// available - callers should keep the plain <video> visible in that case
// instead of hiding it behind a canvas that never mounts.
export function mountHeroVideoDistortion(pointerRoot, canvasContainer, video) {
  const container = canvasContainer;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch {
    return null;
  }

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 1;

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.domElement.style.position = "absolute";
  renderer.domElement.style.inset = "0";
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  renderer.domElement.style.zIndex = "1";
  container.appendChild(renderer.domElement);

  // The <video> stays mounted and playing throughout - VideoTexture reads
  // its frames live - it's just hidden behind the canvas while this effect
  // owns the visuals, and restored on cleanup.
  video.style.opacity = "0";

  const videoTexture = new THREE.VideoTexture(video);
  videoTexture.minFilter = THREE.LinearFilter;
  videoTexture.magFilter = THREE.LinearFilter;
  videoTexture.generateMipmaps = false;

  let [gridX, gridY] = getGridDimensions(
    container.offsetWidth || 1,
    container.offsetHeight || 1,
  );
  let { texture: dataTexture, data: gridData } = createDataTexture(gridX, gridY);

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTexture: { value: videoTexture },
      uDataTexture: { value: dataTexture },
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
  });

  const geometry = new THREE.PlaneGeometry(2, 2);
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  const mouse = { x: 0.5, y: 0.5, prevX: 0.5, prevY: 0.5, vX: 0, vY: 0 };

  function applySize() {
    const width = container.offsetWidth || 1;
    const height = container.offsetHeight || 1;
    renderer.setSize(width, height);

    const [scaleX, scaleY] = getCoverScale(video, width, height);
    mesh.scale.set(scaleX, scaleY, 1);

    const [nextGridX, nextGridY] = getGridDimensions(width, height);
    if (nextGridX !== gridX || nextGridY !== gridY) {
      gridX = nextGridX;
      gridY = nextGridY;
      dataTexture.dispose();
      const next = createDataTexture(gridX, gridY);
      dataTexture = next.texture;
      gridData = next.data;
      material.uniforms.uDataTexture.value = dataTexture;
    }
  }

  applySize();

  function handlePointerMove(event) {
    const rect = container.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;

    mouse.vX = x - mouse.prevX;
    mouse.vY = y - mouse.prevY;
    mouse.prevX = mouse.x;
    mouse.prevY = mouse.y;
    mouse.x = x;
    mouse.y = y;
  }

  function handleResize() {
    applySize();
  }

  function handleLoadedData() {
    applySize();
  }

  pointerRoot.addEventListener("pointermove", handlePointerMove);
  window.addEventListener("resize", handleResize);
  video.addEventListener("loadeddata", handleLoadedData);

  function updateDataTexture() {
    for (let i = 0; i < gridData.length; i += 4) {
      gridData[i] *= RELAXATION;
      gridData[i + 1] *= RELAXATION;
    }

    const gridMouseX = gridX * mouse.x;
    const gridMouseY = gridY * (1 - mouse.y);
    const maxDist = GRID_SIZE * MOUSE_RADIUS;

    for (let i = 0; i < gridX; i++) {
      for (let j = 0; j < gridY; j++) {
        const distSq = (gridMouseX - i) ** 2 + (gridMouseY - j) ** 2;
        if (distSq > maxDist * maxDist) continue;

        const index = 4 * (i + gridX * j);
        // Math.min caps the falloff so a cursor sitting exactly on a grid
        // vertex (distSq === 0) yields Infinity/NaN-free power via the
        // Math.min(10, ...) clamp rather than a singularity.
        const power = Math.min(10, maxDist / Math.sqrt(distSq));

        gridData[index] += STRENGTH * 100 * mouse.vX * power;
        gridData[index + 1] -= STRENGTH * 100 * mouse.vY * power;
      }
    }

    mouse.vX *= 0.9;
    mouse.vY *= 0.9;

    dataTexture.needsUpdate = true;
  }

  function renderFrame() {
    updateDataTexture();
    renderer.render(scene, camera);
  }

  // Only render while the hero is actually on screen - without this the
  // animation loop (and its per-frame GPU work) runs for the entire page
  // lifetime regardless of scroll position, which competes with the
  // compositor for the whole rest of the page and can show up as scroll
  // jank/visual glitches far from the hero itself.
  const visibilityObserver = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        // Drop any velocity accrued right before scrolling away, so coming
        // back doesn't replay it as a sudden burst of distortion.
        mouse.vX = 0;
        mouse.vY = 0;
        renderer.setAnimationLoop(renderFrame);
      } else {
        renderer.setAnimationLoop(null);
      }
    },
    { threshold: 0 },
  );
  visibilityObserver.observe(pointerRoot);

  return function destroy() {
    visibilityObserver.disconnect();
    renderer.setAnimationLoop(null);
    pointerRoot.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("resize", handleResize);
    video.removeEventListener("loadeddata", handleLoadedData);
    video.style.opacity = "";
    container.removeChild(renderer.domElement);
    geometry.dispose();
    material.dispose();
    videoTexture.dispose();
    dataTexture.dispose();
    renderer.dispose();
  };
}
