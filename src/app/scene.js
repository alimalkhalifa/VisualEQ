import * as THREE from 'three'
//import {MTLLoader, OBJLoader} from 'three-obj-mtl-loader'

var infoBox = document.getElementById('info-box')

var scene = new THREE.Scene();

var camera = new THREE.PerspectiveCamera( 55, window.innerWidth / window.innerHeight, 1, 1000 );
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

var ambientLight = new THREE.AmbientLight( 0xffffff, 1 );
scene.add( ambientLight );
scene.background = new THREE.Color().setHex(0x82eaff);
scene.fog = new THREE.Fog(new THREE.Color().setHex(0x82eaff), 600, 1000)

var clock = new THREE.Clock()

var raycaster = new THREE.Raycaster()

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
  //scene.fog = new THREE.Fog(new Three.COLOR(zoneInfo.fog_red, zoneInfo.fog_green, zoneInfo.fog_blue).getHEX(), zoneInfo.fog_minclip, zoneInfo.fog_maxclip)
  getSpawns()
})

fetch('/zone/s3d/crushbone').then(res => {
  return res.json()
}).then(res => {
  console.log("Fetched zone Geometry")
  let wld = res.wld
  for (let fragIndex in wld) {
    let fragment = wld[fragIndex]
    if (fragment.type === "Mesh") {
      fragment.textureListRef = wld[fragment.textureList]
      for (let t in fragment.polygonTextures) {
        fragment.polygonTextures[t].texture = wld[fragment.textureListRef.textureInfoRefsList[fragment.polygonTextures[t].textureIndex]]
        let textureInfoRef = wld[fragment.polygonTextures[t].texture.textureInfoRef]
        fragment.polygonTextures[t].textureInfo = wld[textureInfoRef.textureInfo]
        let texturePathsRef = fragment.polygonTextures[t].textureInfo.texturePaths
        fragment.polygonTextures[t].texturePaths = []
        for (let p of texturePathsRef) {
          fragment.polygonTextures[t].texturePaths.push(wld[p])
        }
      }
      let polygons = fragment.polygons
      let scale = 1.0 / (1 << fragment.scale)
      let centerX = fragment.centerX
      let centerY = fragment.centerY
      let centerZ = fragment.centerZ
      var geometry = new THREE.BufferGeometry()
      let vertices = []
      let normals = []
      let uvs = []
      let polygonTexCount = 0
      let polygonTexIndex = 0
      for (let i = 0; i < polygons.length; i++) {
        let p = polygons[i]
        let vertex1 = fragment.vertices[p.vertex3]
        let vertex2 = fragment.vertices[p.vertex2]
        let vertex3 = fragment.vertices[p.vertex1]
        let normal1 = fragment.vertexNormals[p.vertex3]
        let normal2 = fragment.vertexNormals[p.vertex2]
        let normal3 = fragment.vertexNormals[p.vertex1]
        let uv1 = fragment.textureCoords[p.vertex3]
        let uv2 = fragment.textureCoords[p.vertex2]
        let uv3 = fragment.textureCoords[p.vertex1]
        vertices.push(
          vertex1.x * scale + centerX, vertex1.y * scale + centerY, vertex1.z * scale + centerZ,
          vertex2.x * scale + centerX, vertex2.y * scale + centerY, vertex2.z * scale + centerZ,
          vertex3.x * scale + centerX, vertex3.y * scale + centerY, vertex3.z * scale + centerZ
        )
        normals.push(
          normal1.x, normal1.y, normal1.z,
          normal2.x, normal2.y, normal2.z,
          normal3.x, normal3.y, normal3.z
        )
        let uvDivisor = 256.0
        uvs.push(
          uv1.x / uvDivisor, uv1.z / uvDivisor,
          uv2.x / uvDivisor, uv2.z / uvDivisor,
          uv3.x / uvDivisor, uv3.z / uvDivisor,
        )
        polygonTexCount++
        if (polygonTexCount >= fragment.polygonTextures[polygonTexIndex].polygonCount) {
          geometry.addAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3))
          geometry.addAttribute('normal', new THREE.BufferAttribute(new Float32Array(normals), 3))
          geometry.addAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2))
          geometry.computeBoundingBox()
          let textureRaw = res.s3d.files[fragment.polygonTextures[polygonTexIndex].texturePaths[0].files[0].toLowerCase()]
          let textureData = new Buffer(textureRaw).toString('base64')
          let textureURI = `data:image/bmp;base64,${textureData}`
          let texture = new THREE.Texture()
          texture.wrapS = THREE.RepeatWrapping
          texture.wrapT = THREE.RepeatWrapping
          let image = new Image()
          image.onload = () => {
            texture.image = image
            texture.needsUpdate = true
          }
          image.src = textureURI
          let material = new THREE.MeshLambertMaterial({
            map: texture,
            transparent: fragment.polygonTextures[polygonTexIndex].texture.transparent,
            opacity: (fragment.polygonTextures[polygonTexIndex].texture.transparent? 0 : 1)
          })
          var mesh = new THREE.Mesh(geometry, material)
          mesh.userData.fragIndex = fragIndex
          mesh.userData.fragment = fragment
          scene.add(mesh)
          geometry = new THREE.BufferGeometry()
          vertices = []
          normals = []
          uvs = []
          polygonTexIndex++
          polygonTexCount = 0
        }
      }
    }
  }
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
