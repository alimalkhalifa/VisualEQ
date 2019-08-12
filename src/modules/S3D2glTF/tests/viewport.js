import * as THREE from 'three'
import GLTFLoader from 'three-gltf-loader'

let cameraMovementInput = {
  forward: 0,
  back: 0,
  left: 0,
  right: 0,
  up: 0,
  down: 0
}
let doubleSpeed = false
let halfSpeed = false
let mouseLocked = false
let cameraRotation = 0
let cameraPitch = 0
let cameraRotationSpeed = 1
let cameraSpeed = 100

let scene =  new THREE.Scene()
let camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
scene.add(camera)
let quat = new THREE.Quaternion()
quat.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2)
quat.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), cameraRotation))
quat.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), cameraPitch))
camera.quaternion.copy(quat)
let ambientLight = new THREE.AmbientLight( 0xffffff, 1 )
scene.add( ambientLight )
scene.background = new THREE.Color().setHex(0x82eaff)
scene.fog = new THREE.Fog(new THREE.Color().setHex(0x82eaff), 600, 1000)
let clock = new THREE.Clock()
let loader = new GLTFLoader()
loader.load('graphics/crushbone/crushbone.gltf', gltf => {
  console.log(gltf)
  scene.add(gltf.scene)
  console.log(gltf.scene)
  gltf.scene.traverse(child => {
    if (child.userData.texture) {
      let texInfo = gltf.scene.userData.textures[child.userData.texture]
      let textureFile = texInfo.texturePaths[0].files[0].toLowerCase()
      var texture = new THREE.TextureLoader().load(`graphics/crushbone/textures/${textureFile.substr(0, textureFile.indexOf('.'))}.png`)
      texture.wrapS = THREE.RepeatWrapping
      texture.wrapT = THREE.RepeatWrapping
      child.material = new THREE.MeshLambertMaterial({
        map: texture
      })
    }
  })
}, xhr => {
  console.log(`${xhr.loaded / xhr.total * 100} loaded`)
}, err => {
  console.error(err)
})
let renderer = new THREE.WebGLRenderer()
let viewport = document.getElementById('viewport')
renderer.setSize( window.innerWidth, window.innerHeight )
viewport.appendChild( renderer.domElement )
animate()

document.addEventListener('keydown', onKeyDown)
document.addEventListener('keyup', onKeyUp)
document.addEventListener('mousedown', onMouseDown)
document.addEventListener('pointerlockchange', onPointerLockChange)

function animate() {
  let delta = clock.getDelta()
  requestAnimationFrame(() => animate())
  renderer.render(scene, camera)
  let velocity = new THREE.Vector3()
  if (cameraMovementInput.forward > 0) {
    velocity.z -= 1
  }
  if (cameraMovementInput.back > 0) {
    velocity.z += 1
  }
  if (cameraMovementInput.left > 0) {
    velocity.x -= 1
  }
  if (cameraMovementInput.right > 0) {
    velocity.x += 1
  }
  if (cameraMovementInput.up > 0) {
    velocity.y += 1
  }
  if (cameraMovementInput.down > 0) {
    velocity.y -= 1
  }

  velocity.multiplyScalar(delta * cameraSpeed * (doubleSpeed ? 2 : 1) * (halfSpeed ? 0.5 : 1)).applyQuaternion(camera.quaternion)
  camera.position.add(velocity)
}

function onKeyDown(event) {
  switch ( event.keyCode ) {
    case 87: /*W*/
      cameraMovementInput.forward = 1
      break
    case 65: /*A*/
      cameraMovementInput.left = 1
      break
    case 83: /*S*/
      cameraMovementInput.back = 1
      break
    case 68: /*D*/
      cameraMovementInput.right = 1
      break
    case 81: // Q
      cameraMovementInput.down = 1
      break
    case 69: // E
      cameraMovementInput.up = 1
      break
    case 16: // Shift
      doubleSpeed = true
      break
    /*case 17: // Ctrl
      this.halfSpeed = true
      break*/
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
      cameraMovementInput.down = 0
      break;
    case 69: // E
      cameraMovementInput.up = 0
      break;
    case 16: // Shift
      doubleSpeed = false
      break;
    /*case 17: // Ctrl
      this.halfSpeed = false
      break*/
  }
}

function onMouseDown(event) {
  if ( event.target !== renderer.domElement ) {
    return
  }
  if (event.button !== 2) return
  if (mouseLocked) return
  lockPointer()
  document.addEventListener('mouseup', onMouseUp)
  document.addEventListener('mousemove', onMouseMove)
}

function onMouseUp(event) {
  if (event.button !== 2) return
  if (!mouseLocked) return
  unlockPointer()
  document.removeEventListener('mouseup', onMouseUp)
  document.removeEventListener('mousemove', onMouseMove)
}

function onMouseMove(event) {
  if (!mouseLocked) {
    return
  }
  
  let mouseMoveX = event.movementX || event.mozMovementX || event.webkitMovementX || 0
  let mouseMoveY = event.movementY || event.mozMovementY || event.webkitMovementY || 0

  cameraRotation -= mouseMoveX / window.innerWidth * cameraRotationSpeed * camera.aspect
  cameraPitch -= mouseMoveY / window.innerHeight * cameraRotationSpeed
  cameraPitch = Math.max(-(Math.PI/2), Math.min( (Math.PI/2), cameraPitch))
  let quat = new THREE.Quaternion()
  quat.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2)
  quat.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), cameraRotation))
  quat.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), cameraPitch))
  camera.quaternion.copy(quat)
}

function onPointerLockChange(_) {
  if (document.pointerLockElement === renderer.domElement || document.mozPointerLockElement === renderer.domElement) {
    mouseLocked = true
  } else {
    mouseLocked = false
  }
}

function lockPointer() {
  renderer.domElement.requestPointerLock()
}

function unlockPointer() {
  document.exitPointerLock()
}
