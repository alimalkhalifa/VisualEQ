import * as THREE from 'three'
import {MTLLoader, OBJLoader} from 'three-obj-mtl-loader'

var infoBox = document.getElementById('info-box')

var scene = new THREE.Scene();

var camera = new THREE.PerspectiveCamera( 55, window.innerWidth / window.innerHeight, 0.1, 2000 );
camera.up.set(0,0,1);
const cameraSpeed = 50
let doubleSpeed = false
const cameraRotationSpeed = 0.002
let mousePos = new THREE.Vector3()
let mouseLocked = false
let mouseState = [false, false, false]
let mouseJustState = [false, false, false]
let cameraRotation = 0
let cameraPitch = 0
var cameraMovementInput = {
  forward: 0,
  back: 0,
  left: 0,
  right: 0,
  up: 0,
  down: 0
}
scene.add(camera)
updateCameraRotation()

var clock = new THREE.Clock()

var raycaster = new THREE.Raycaster()

var ambientLight = new THREE.AmbientLight( 0xffffff, 1 );
scene.add( ambientLight );

var objLoader = new OBJLoader()
var mtlLoader = new MTLLoader()
mtlLoader.setPath('zone/file/crushbone/')
objLoader.setPath('zone/file/crushbone/')
mtlLoader.load('crushbone.mtl', materials => {
  materials.preload()
  objLoader.setMaterials(materials)
  objLoader.load('crushbone.obj', object => {
    scene.add(object)
  })
})

camera.position.z = 200

let spawnPoints = []
let selectedObject = null
let zoneInfo = {}

fetch('/zone/shortname/crushbone').then(res => {
  return res.json()
}).then(res => {
  console.log(`Zone fetched: ${res[0].long_name}`)
  zoneInfo = res[0]
  camera.position.set(zoneInfo.safe_y, zoneInfo.safe_x, zoneInfo.safe_z+2)
  scene.fog = new THREE.Fog(rgbToHex(zoneInfo.fog_red, zoneInfo.fog_green, zoneInfo.fog_blue), zoneInfo.fog_minclip, zoneInfo.fog_maxclip)
  getSpawns()
})

var renderer = new THREE.WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
document.getElementById('viewport').appendChild( renderer.domElement );
window.addEventListener('resize', onViewportResize, false)
document.addEventListener('keydown', onKeyDown, false)
document.addEventListener('keyup', onKeyUp, false)
document.addEventListener('mousemove', onMouseMove, false)
document.addEventListener('mousedown', onMouseDown, false)
document.addEventListener('mouseup', onMouseUp, false)
document.addEventListener('pointerlockchange', onPointerLockChange, false)
 
animate()

function animate() {
  requestAnimationFrame(animate)
  render()
}

function render() {
  let delta = clock.getDelta()
  renderer.render(scene, camera)
  updateCamera(camera, cameraMovementInput, delta)
  lockPointer()
  raycastSelect()
  consumeMouseJustState()
}

function getSpawns() {
  fetch('/zone/spawns/crushbone').then(res => {
    return res.json()
  }).then(res => {
    let geometry = new THREE.SphereGeometry(1, 16, 16)
    let material = new THREE.MeshBasicMaterial({color: 0xffff00})
    for (let spawn of res) {
      let sphere = new THREE.Mesh(geometry, material)
      sphere.position.set(spawn.y, spawn.x, spawn.z)
      sphere.userData.selectable = true
      sphere.userData.type = "SpawnPoint"
      sphere.userData.spawnInfo = spawn
      spawnPoints.push(sphere)
      scene.add(sphere)
    }
  })
}

function onViewportResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize( window.innerWidth, window.innerHeight );
}

function lockPointer() {
  if (mouseState[2] === true && !mouseLocked) {
    renderer.domElement.requestPointerLock()
  } else if (mouseState[2] === false && mouseLocked) {
    document.exitPointerLock()
  }
}

function onPointerLockChange(event) {
  if (document.pointerLockElement === renderer.domElement || document.mozPointerLockElement === renderer.domElement) {
    mouseLocked = true
  } else {
    mouseLocked = false
  }
}

function raycastSelect() {
  if (mouseJustState[0] && !mouseLocked) {
    raycaster.setFromCamera(mousePos, camera)
    let intersections = raycaster.intersectObjects(scene.children, true)
    if (intersections.length > 0) {
      changeSelectedObject(intersections[0].object)
    } else {
      nullSelectedObject()
    }
  }
}

function consumeMouseJustState() {
  mouseJustState = [false, false, false]
}

function onKeyDown( event ) {
  switch ( event.keyCode ) {
    case 87: /*W*/
      cameraMovementInput.forward = 1
      break;
    case 65: /*A*/
      cameraMovementInput.left = 1
      break;
    case 83: /*S*/
      cameraMovementInput.back = 1
      break;
    case 68: /*D*/
      cameraMovementInput.right = 1
      break;
    case 81: // Q
      cameraMovementInput.up = 1
      break;
    case 90: // Z
      cameraMovementInput.down = 1
      break;
    case 16: // Shift
      doubleSpeed = true
      break;
    default:
      console.log(`${event.keyCode} not bound`)
  }
}

function onKeyUp( event ) {
  switch ( event.keyCode ) {
    case 87: /*W*/
      cameraMovementInput.forward = 0
      break;
    case 65: /*A*/
      cameraMovementInput.left = 0
      break;
    case 83: /*S*/
      cameraMovementInput.back = 0
      break;
    case 68: /*D*/
      cameraMovementInput.right = 0
      break;
    case 81: // Q
      cameraMovementInput.up = 0
      break;
    case 90: // Z
      cameraMovementInput.down = 0
      break;
    case 16: // Shift
      doubleSpeed = false
      break;
  }
}

function onMouseDown(event) {
  if ( event.target !== renderer.domElement ) {
    return
  }
  mouseState[event.button] = true
  mouseJustState[event.button] = true
}

function onMouseUp(event) {
  mouseState[event.button] = false
}

function onMouseMove(event) {
  mousePos.x = ( event.clientX / window.innerWidth ) * 2 - 1
  mousePos.y = - ( event.clientY / window.innerHeight ) * 2 + 1

  if (!mouseLocked) {
    return
  }
  
  let mouseMoveX = event.movementX || event.mozMovementX || event.webkitMovementX || 0
  let mouseMoveY = event.movementY || event.mozMovementY || event.webkitMovementY || 0

  cameraRotation -= mouseMoveX * cameraRotationSpeed
  cameraPitch -= mouseMoveY * cameraRotationSpeed
  cameraPitch = Math.max(-(Math.PI/2), Math.min( (Math.PI/2), cameraPitch))
  updateCameraRotation()
}

function updateCamera(camera, input, delta) {
  var velocity = new THREE.Vector3()
  if (input.forward > 0) {
    velocity.z -= 1
  }
  if (input.back > 0) {
    velocity.z += 1
  }
  if (input.left > 0) {
    velocity.x -= 1
  }
  if (input.right > 0) {
    velocity.x += 1
  }
  if (input.up > 0) {
    velocity.y += 1
  }
  if (input.down > 0) {
    velocity.y -= 1
  }

  velocity.multiplyScalar(delta * cameraSpeed * (doubleSpeed ? 2 : 1)).applyQuaternion(camera.quaternion)
  camera.position.add(velocity)
}

function updateCameraRotation() {
  let quat = new THREE.Quaternion()
  quat.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2)
  quat.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), cameraRotation))
  quat.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), cameraPitch))
  camera.quaternion.copy(quat)
}

function rgbToHex(R,G,B) {return parseInt(toHex(R)+toHex(G)+toHex(B), 16)}
function toHex(n) {
 n = parseInt(n,10);
 if (isNaN(n)) return "00";
 n = Math.max(0,Math.min(n,255));
 return "0123456789ABCDEF".charAt((n-n%16)/16)
      + "0123456789ABCDEF".charAt(n%16);
}

function nullSelectedObject() {
  if (selectedObject !== null) {
    selectedObject.material = selectedObject.userData.defaultMaterial
  }
  infoBox.style.visibility = "hidden"
}

function changeSelectedObject(object) {
  nullSelectedObject()
  if (object.userData.selectable) {
    selectedObject = object
    selectedObject.userData.defaultMaterial = selectedObject.material
    selectedObject.material = new THREE.MeshBasicMaterial({color: 0x00FF00})
    if (object.userData.type === "SpawnPoint") {
      let spawn = object.userData.spawnInfo
      infoBox.innerHTML = `
        <div class="card text-white bg-dark">
          <div class="card-body">
            <h5 class="card-title">Spawn</h5>
            <h6 class="card-subtitle mb2 text-muted">ID ${spawn.id}</h6>
          </div>
        </div>
        <div class="card text-white bg-dark">
          <div class="card-body">
            <h5 class="card-title">Position</h5>
            <div class="card-text">
              X: ${spawn.x}<br/>
              Y: ${spawn.y}<br/>
              Z: ${spawn.z}<br/>
              H: ${spawn.heading}<br/>
            </div>
          </div>
        </div>
        <div class="card text-white bg-dark">
          <div class="card-body">
            <h5 class="card-title">Attributes</h5>
            <div class="card-text">
              Enabled: ${spawn.enabled}<br/>
              Pathgrid: ${spawn.pathgrid}</br>
              RespawnTime: ${spawn.respawntime}</br>
              Variance: ${spawn.variance}<br/>
            </div>
          </div>
        </div>
      `
      getSpawnGroup(spawn.spawngroupID)
    }
    infoBox.style.visibility = "visible"
  }
}

function getSpawnGroup(id) {
  fetch(`/spawngroup/group/${id}`).then(res => {
    return res.json()
  }).then(res => {
    let group = res[0]
    let card = document.createElement("div")
    card.setAttribute("class", "card text-white bg-dark")
    card.innerHTML = `
      <div class="card-body">
        <h5 class="card-title">Spawngroup</h5>
        <h6 class="card-subtitle mb2 text-muted">ID ${group.id}</h6>
        <div class="card-text">
          Name: ${group.name}<br/>
          Spawn Limit: ${group.spawn_limit}<br/>
          Distance: ${group.dist}<br/>
          Max X: ${group.max_x}<br/>
          Min X: ${group.min_x}<br/>
          Max Y: ${group.max_y}<br/>
          Min Y: ${group.min_y}<br/>
          Delay: ${group.delay}<br/>
          Minimum Delay: ${group.mindelay}<br/>
          Despawn: ${group.despawn}<br/>
          Despawn Timer: ${group.despawn_timer}<br/>
        </div>
      </div>
    `
    infoBox.appendChild(card)
    getSpawnEntries(id)
  })
}

function getSpawnEntries(id) {
  fetch(`/spawngroup/entry/${id}`).then(res => {
    return res.json()
  }).then(res => {
    for (let entry of res) {
      let card = document.createElement("div")
      card.setAttribute("class", "card text-white bg-dark")
      card.innerHTML = `
      <h5 class="card-title">Spawn Entry</h5>
      <div class="card-text">
        npcID: ${entry.npcID}<br/>
        Chance: ${entry.chance}<br/>
      </div>
      `
      infoBox.appendChild(card)
      getNPC(entry.npcID)
    }
  })
}

function getNPC(id) {
  fetch(`/npc/${id}`).then(res => {
    return res.json()
  }).then(res => {
    let npc = res[0]
    let card = document.createElement("div")
    card.setAttribute("class", "card text-white bg-dark")
    card.innerHTML = `
    <h5 class="card-title">NPC</h5>
    <h6 class="card-subtitle mb2 text-muted">ID ${npc.id}</h6>
    <div class="card-text">
      Name: ${npc.name}<br/>
    </div>
    `
    infoBox.appendChild(card)
  })
}
