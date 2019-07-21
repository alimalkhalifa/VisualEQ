import * as THREE from 'three'
import { store } from '../store'

export default class Camera {
  constructor() {
    this.windowSizeX = window.innerWidth
    this.windowSizeY = window.innerHeight
    this.object = new THREE.PerspectiveCamera( 55, this.windowSizeX / this.windowSizeY, 1, 1000 );
    this.object.up.set(0,0,1);
    this.cameraSpeed = 100
    this.doubleSpeed = false
    this.halfSpeed = false
    this.cameraRotationSpeed = 1
    this.mousePos = new THREE.Vector3()
    this.mouseLocked = false
    this.mouseState = [false, false, false]
    this.cameraRotation = 0
    this.cameraPitch = 0
    this.cameraMovementInput = {
      forward: 0,
      back: 0,
      left: 0,
      right: 0,
      up: 0,
      down: 0
    }
    this.connect()
  }

  updateCameraRotation() {
    let quat = new THREE.Quaternion()
    quat.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2)
    quat.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.cameraRotation))
    quat.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.cameraPitch))
    this.object.quaternion.copy(quat)
  }

  updateCamera(delta) {
    var velocity = new THREE.Vector3()
    if (this.cameraMovementInput.forward > 0) {
      velocity.z -= 1
    }
    if (this.cameraMovementInput.back > 0) {
      velocity.z += 1
    }
    if (this.cameraMovementInput.left > 0) {
      velocity.x -= 1
    }
    if (this.cameraMovementInput.right > 0) {
      velocity.x += 1
    }
    if (this.cameraMovementInput.up > 0) {
      velocity.y += 1
    }
    if (this.cameraMovementInput.down > 0) {
      velocity.y -= 1
    }
  
    velocity.multiplyScalar(delta * this.cameraSpeed * (this.doubleSpeed ? 2 : 1) * (this.halfSpeed ? 0.5 : 1)).applyQuaternion(this.object.quaternion)
    this.object.position.add(velocity)
  }

  connect() {
    window.addEventListener('resize', this.onViewportResize.bind(this))
    document.addEventListener('pointerlockchange', this.onPointerLockChange.bind(this))
    document.addEventListener('mousedown', this.onMouseDown.bind(this))
    document.addEventListener('keydown', this.onKeyDown.bind(this))
    document.addEventListener('keyup', this.onKeyUp.bind(this))
    store.getState().editor.scene.on('render', this.updateCamera.bind(this))
  }

  onMouseDown(event) {
    if ( event.target !== store.getState().editor.scene.renderer.domElement ) {
      return
    }
    if (event.button !== 2) return
    if (this.mouseLocked) return
    this.lockPointer()
    document.addEventListener('mouseup', this.onMouseUp.bind(this))
    document.addEventListener('mousemove', this.onMouseMove.bind(this))
  }

  onMouseUp(event) {
    if (event.button !== 2) return
    if (!this.mouseLocked) return
    this.unlockPointer()
    document.removeEventListener('mouseup', this.onMouseUp.bind(this))
    document.removeEventListener('mousemove', this.onMouseMove.bind(this))
  }

  onMouseMove(event) {
    if (!this.mouseLocked) {
      return
    }
    
    let mouseMoveX = event.movementX || event.mozMovementX || event.webkitMovementX || 0
    let mouseMoveY = event.movementY || event.mozMovementY || event.webkitMovementY || 0
  
    this.cameraRotation -= mouseMoveX / this.windowSizeX * this.cameraRotationSpeed * this.object.aspect
    this.cameraPitch -= mouseMoveY / this.windowSizeY * this.cameraRotationSpeed
    this.cameraPitch = Math.max(-(Math.PI/2), Math.min( (Math.PI/2), this.cameraPitch))
    this.updateCameraRotation()
  }

  onPointerLockChange(_) {
    let renderer = store.getState().editor.scene.renderer.domElement
    if (document.pointerLockElement === renderer || document.mozPointerLockElement === renderer) {
      this.mouseLocked = true
    } else {
      this.mouseLocked = false
    }
  }

  lockPointer() {
    store.getState().editor.scene.renderer.domElement.requestPointerLock()
  }

  unlockPointer() {
    document.exitPointerLock()
  }

  onViewportResize() {
    this.windowSizeX = window.innerWidth
    this.windowSizeY = window.innerHeight
    this.object.aspect = this.windowSizeX / window.innerHeight
    this.object.updateProjectionMatrix()
  }

  onKeyDown( event ) {
    switch ( event.keyCode ) {
      case 87: /*W*/
        this.cameraMovementInput.forward = 1
        break
      case 65: /*A*/
        this.cameraMovementInput.left = 1
        break
      case 83: /*S*/
        this.cameraMovementInput.back = 1
        break
      case 68: /*D*/
        this.cameraMovementInput.right = 1
        break
      case 81: // Q
        this.cameraMovementInput.down = 1
        break
      case 69: // E
        this.cameraMovementInput.up = 1
        break
      case 16: // Shift
        this.doubleSpeed = true
        break
      /*case 17: // Ctrl
        this.halfSpeed = true
        break*/
    }
  }

  onKeyUp( event ) {
    switch ( event.keyCode ) {
      case 87: /*W*/
        this.cameraMovementInput.forward = 0
        break;
      case 65: /*A*/
        this.cameraMovementInput.left = 0
        break;
      case 83: /*S*/
        this.cameraMovementInput.back = 0
        break;
      case 68: /*D*/
        this.cameraMovementInput.right = 0
        break;
      case 81: // Q
        this.cameraMovementInput.up = 0
        break;
      case 69: // E
        this.cameraMovementInput.down = 0
        break;
      case 16: // Shift
        this.doubleSpeed = false
        break;
      /*case 17: // Ctrl
        this.halfSpeed = false
        break*/
    }
  }
}