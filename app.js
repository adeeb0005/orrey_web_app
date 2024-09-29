// Initialize Three.js Scene
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Add OrbitControls for better camera manipulation
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Add Lighting
const ambientLight = new THREE.AmbientLight(0x404040, 2);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 3, 5).normalize();
scene.add(directionalLight);

// Game State
let score = 0;
let currentMission = 1;
let timeMultiplier = 1;
let missionsCompleted = 0;

// DOM Elements
const scoreElement = document.getElementById('score');
const missionElement = document.getElementById('mission');
const missionDetailsElement = document.getElementById('missionDetails');
const timeSlider = document.getElementById('timeSlider');

// Load Sound Effects
const miningSound = document.getElementById('miningSound');
const deflectionSound = document.getElementById('deflectionSound');
const landingSound = document.getElementById('landingSound');

// Update Score Display
function updateScore(points) {
    score += points;
    scoreElement.innerText = `Score: ${score}`;
}

// Update Mission Display
function updateMission(text, details = '') {
    missionElement.innerText = `Mission ${currentMission}: ${text}`;
    missionDetailsElement.innerText = details;
}

// Handle Time Slider
timeSlider.addEventListener('input', () => {
    timeMultiplier = parseFloat(timeSlider.value);
});

// Celestial Body Class
class CelestialBody {
    constructor(radius, color, distance, name, type, textureURL = null) {
        const geometry = new THREE.SphereGeometry(radius, 32, 32);
        let material;
        if (textureURL) {
            const texture = new THREE.TextureLoader().load(textureURL);
            material = new THREE.MeshPhongMaterial({ map: texture });
        } else {
            material = new THREE.MeshPhongMaterial({ color: color });
        }
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.x = distance;
        this.name = name;
        this.type = type; // 'planet', 'asteroid', 'PHA', 'star'
        this.distance = distance;
        this.angle = Math.random() * Math.PI * 2;
        this.orbitSpeed = this.setOrbitSpeed();
        scene.add(this.mesh);
    }

    setOrbitSpeed() {
        switch(this.name.toLowerCase()) {
            case 'mercury': return 0.04;
            case 'venus': return 0.02;
            case 'earth': return 0.01;
            case 'mars': return 0.008;
            case 'asteroid': return 0.015;
            case 'pha': return 0.012;
            default: return 0.01;
        }
    }

    updatePosition(deltaTime) {
        if(this.type !== 'star') {
            this.angle += this.orbitSpeed * deltaTime * timeMultiplier;
            this.mesh.position.x = this.distance * Math.cos(this.angle);
            this.mesh.position.z = this.distance * Math.sin(this.angle);
        }
    }
}

// Create Celestial Bodies
const sun = new CelestialBody(1.5, 0xffff00, 0, 'Sun', 'star', 'textures/sun.jpg');
const mercury = new CelestialBody(0.2, 0xb87333, 2, 'Mercury', 'planet', 'textures/mercury.jpg');
const venus = new CelestialBody(0.4, 0xe5c67b, 3.5, 'Venus', 'planet', 'textures/venus.jpg');
const earth = new CelestialBody(0.5, 0x0000ff, 5, 'Earth', 'planet', 'textures/earth.jpg');
const mars = new CelestialBody(0.3, 0xff0000, 7, 'Mars', 'planet', 'textures/mars.jpg');

// Initialize Asteroids Array
let asteroids = [];
let PHAs = [];

// Fetch Real-Time Asteroid Data from NASA NEO API
async function fetchNEOData() {
    const apiKey = '5wCjirylgZOTFozTbcpUpp2NdRrXcoKRzgdHzRJ0'; // Replace with your NASA API Key
    const today = new Date();
    const startDate = today.toISOString().split('T')[0];
    const endDate = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const apiURL = `https://api.nasa.gov/neo/rest/v1/feed?start_date=${startDate}&end_date=${endDate}&api_key=${apiKey}`;

    try {
        const response = await fetch(apiURL);
        const data = await response.json();
        const nearEarthObjects = data.near_earth_objects;

        for (let date in nearEarthObjects) {
            nearEarthObjects[date].forEach(asteroidData => {
                const distance = parseFloat(asteroidData.close_approach_data[0].miss_distance.kilometers) / 100000; // Scale down
                const size = Math.max(0.1, parseFloat(asteroidData.estimated_diameter.meters.estimated_diameter_min) / 1000); // Scale size
                const name = asteroidData.name;
                const isPHA = asteroidData.is_potentially_hazardous_asteroid;
                const asteroid = new CelestialBody(size, 0x808080, distance, name, isPHA ? 'PHA' : 'asteroid', 'textures/asteroid.jpg');
                if(isPHA) {
                    PHAs.push(asteroid);
                } else {
                    asteroids.push(asteroid);
                }
            });
        }
    } catch (error) {
        console.error('Error fetching NEO data:', error);
    }
}

// Call the fetch function
fetchNEOData();

// Camera Position
camera.position.z = 15;

// Raycaster for Interaction
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Interaction Handler
window.addEventListener('click', onMouseClick, false);

function onMouseClick(event) {
    // Convert mouse position to normalized device coordinates
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Update the picking ray with the camera and mouse position
    raycaster.setFromCamera(mouse, camera);

    // Calculate objects intersecting the picking ray
    const intersects = raycaster.intersectObjects(scene.children, true);

    if (intersects.length > 0) {
        const object = intersects[0].object.parent ? intersects[0].object.parent : intersects[0].object;
        const celestialBody = getCelestialBodyByName(object.name);

        if (celestialBody) {
            handleInteraction(celestialBody);
        }
    }
}

// Helper Function to Get CelestialBody Instance by Name
function getCelestialBodyByName(name) {
    const allBodies = [sun, mercury, venus, earth, mars, ...asteroids, ...PHAs];
    return allBodies.find(body => body.name === name);
}

// Handle Interactions Based on Celestial Body Type and Current Mission
function handleInteraction(body) {
    switch(currentMission) {
        case 1:
            if(body.type === 'asteroid') {
                mineAsteroid(body);
            } else {
                alert('Mission 1: You need to mine asteroids. Click on an asteroid.');
            }
            break;
        case 2:
            if(body.type === 'PHA') {
                deflectPHA(body);
            } else {
                alert('Mission 2: You need to deflect a Potentially Hazardous Asteroid (PHA). Click on a PHA.');
            }
            break;
        case 3:
            if(body.type === 'planet') {
                landOnPlanet(body);
            } else {
                alert('Mission 3: Explore planets. Click on a planet to land.');
            }
            break;
        default:
            alert('All missions completed! Congratulations!');
    }
}

// Mission 1: Mine Asteroids
function mineAsteroid(body) {
    // Play mining sound
    miningSound.play();

    // Update score
    updateScore(10);

    // Remove asteroid from scene and array
    scene.remove(body.mesh);
    asteroids = asteroids.filter(a => a !== body);

    // Update mission details
    missionsCompleted++;
    if(missionsCompleted >= 3) {
        currentMission++;
        updateMission('Deflect the PHA!', 'Click on a Potentially Hazardous Asteroid to deflect it and save Earth.');
    } else {
        updateMission('Mine Asteroids', `Mined ${missionsCompleted} out of 3 required asteroids.`);
    }
}

// Mission 2: Deflect PHA
function deflectPHA(body) {
    // Play deflection sound
    deflectionSound.play();

    // Update score
    updateScore(50);

    // Apply force to deflect asteroid
    body.orbitSpeed *= 1.5; // Example: Increase orbit speed to simulate deflection

    // Update mission details
    currentMission++;
    updateMission('Explore Planets!', 'Click on a planet to land and gather resources.');
}

// Mission 3: Land on Planets
function landOnPlanet(body) {
    // Play landing sound
    landingSound.play();

    // Pause the game
    controls.enabled = false;

    // Display landing information
    alert(`Landing on ${body.name}... Gathering resources!`);

    // Simulate resource gathering
    setTimeout(() => {
        updateScore(100);
        alert(`Resources gathered from ${body.name}!`);

        // Resume the game
        controls.enabled = true;

        // Update mission
        currentMission++;
        updateMission('All Missions Completed!', 'Congratulations! You have successfully completed all missions.');
    }, 2000);
}

// Animation Loop
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);

    const deltaTime = clock.getDelta();

    // Update positions of celestial bodies
    [sun, mercury, venus, earth, mars, ...asteroids, ...PHAs].forEach(body => {
        body.updatePosition(deltaTime);
    });

    // Update controls
    controls.update();

    renderer.render(scene, camera);
}

animate();

// Handle Window Resize
window.addEventListener('resize', onWindowResize, false);

function onWindowResize(){
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}
