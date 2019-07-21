import * as THREE from 'three'
import { store } from '../store';
import { updateSelected, moveObject, moveUndo } from '../store/actions';

export default class Selector {
  constructor() {
    this.mousePos = new THREE.Vector2()
    this.mouseDrag = false
    this.mouseDragThreshold = 1
    this.objectStartPos = new THREE.Vector3()
    this.objectOrigin = new THREE.Vector3()
    this.objectHeight = 0
    this.holdCtrl = false
    this.connect()
  }

  connect() {
    document.addEventListener('mousedown', this.onMouseDown.bind(this))
    document.addEventListener('mousemove', this.onMouseMove.bind(this))
    document.addEventListener('keypress', this.onKeyPress.bind(this))
  }

  onMouseDown() {
    if ( event.target !== store.getState().editor.scene.renderer.domElement ) {
      return
    }
    if (event.button !== 0) return
    let intersections = this.raycastFromCamera()
    if (intersections.length > 0) {
      for (let i of intersections) {
        if (i.object.userData.selectable) {
          if (this.isSelectedObject(i.object)) {
            this.mouseDrag = true
            let floor = this.getObjectPositionOnFloor(i.object)
            this.objectHeight = floor.h
            this.objectStartPos.copy(floor.pos)
            this.objectOrigin.copy(i.object.position)
            document.addEventListener('mouseup', this.onEndMouseDrag.bind(this))
            document.removeEventListener('mousedown', this.onMouseDown.bind(this))
          } else {
            this.changeSelectedObject(i.object)
          }
          return
        }
      }
    }
    this.nullSelectedObject()
  }

  onMouseMove(event) {
    this.mousePos.x = ( event.clientX / window.innerWidth ) * 2 - 1
    this.mousePos.y = - ( event.clientY / window.innerHeight ) * 2 + 1

    if (this.mouseDrag) {
      let intersections = this.raycastFromCamera()
      for (let i of intersections) {
        if (i.object.userData.levelgeometry) {
          if (i.point.distanceTo(this.objectStartPos) > this.mouseDragThreshold) {
            let selectedObject = store.getState().editor.selected
            selectedObject.position.copy(i.point.add(new THREE.Vector3(0, 0, this.objectHeight)))
          }
        }
      }
    }
  }

  onEndMouseDrag(event) {
    if (event.button !== 0 || !this.mouseDrag) return
    this.mouseDrag = false
    let selectedObject = store.getState().editor.selected
    store.dispatch(moveObject(selectedObject, new THREE.Vector3().copy(this.objectOrigin), new THREE.Vector3().copy(selectedObject.position)))
    document.removeEventListener('mouseup', this.onEndMouseDrag.bind(this))
    document.addEventListener('mousedown', this.onMouseDown.bind(this))
  }

  onKeyPress(event) {
    if (event.keyCode === 26) { // Control-Z
      this.undoLastMove()
    }
  }

  nullSelectedObject() {
    let selectedObject = store.getState().editor.selected
    if (selectedObject !== null) {
      selectedObject.material = selectedObject.userData.defaultMaterial
    }
    store.dispatch(updateSelected(null))
  }

  changeSelectedObject(object) {
    this.nullSelectedObject()
    if (object.userData.selectable) {
      store.dispatch(updateSelected(object))
      object.userData.defaultMaterial = object.material
      object.material = new THREE.MeshBasicMaterial({color: 0x00FF00})
    }
  }

  isSelectedObject(object) {
    return object === store.getState().editor.selected
  }

  getObjectPositionOnFloor(object) {
    let intersections = this.raycastToFloor(object)
    if (intersections.length === 0) return {err: "No floor"}
    let floor = null
    for (let i of intersections) {
      if (i.object.userData.levelgeometry) {
        floor = i
      }
    }
    if (floor) {
      return {
        pos: floor.point,
        h: floor.distance
      }
    } else return {err: "No floor"}
  }

  raycastToFloor(object) {
    let scene = store.getState().editor.scene
    scene.raycaster.set(object.position, new THREE.Vector3(0, 0, -1))
    let intersections = scene.raycaster.intersectObjects(scene.scene.children, true)
    return intersections
  }

  raycastFromCamera() {
    let scene = store.getState().editor.scene
    scene.raycaster.setFromCamera(this.mousePos, scene.camera.object)
    let intersections = scene.raycaster.intersectObjects(scene.scene.children, true)
    return intersections
  }

  undoLastMove() {
    let move = store.getState().editor.moves.slice(-1)
    if (move.length > 0) {
      move[0].object.position.copy(move[0].from)
      store.dispatch(moveUndo())
    }
  }
}
