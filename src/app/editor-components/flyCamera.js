import * as THREE from 'three'

export default class Camera {
  constructor() {
    this.camera = new THREE.PerspectiveCamera( 55, window.innerWidth / window.innerHeight, 1, 1000 );
    this.camera.up.set(0,0,1);
    this.cameraSpeed = 50
    this.doubleSpeed = false
    this.cameraRotationSpeed = 0.002
    this.mousePos = new THREE.Vector3()
    this.mouseLocked = false
    this.mouseState = [false, false, false]
    this.mouseJustState = [false, false, false]
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
  }

  updateCameraRotation() {
    let quat = new THREE.Quaternion()
    quat.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2)
    quat.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.cameraRotation))
    quat.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.cameraPitch))
    this.camera.quaternion.copy(quat)
  }

  updateCamera(camera, input, delta) {
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
  
    velocity.multiplyScalar(delta * this.cameraSpeed * (this.doubleSpeed ? 2 : 1)).applyQuaternion(this.camera.quaternion)
    this.camera.position.add(velocity)
  }
}