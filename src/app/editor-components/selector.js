import * as THREE from 'three'
import { store } from '../store';
import { updateSelected } from '../store/actions';

export default class Selector {
  constructor() {
    this.mousePos = new THREE.Vector2()
    this.connect()
  }

  connect() {
    document.addEventListener('mousedown', this.onMouseDown.bind(this))
    document.addEventListener('mousemove', this.onMouseMove.bind(this))
  }

  onMouseDown() {
    if ( event.target !== store.getState().editor.scene.renderer.domElement ) {
      return
    }
    if (event.button !== 0) return
    let scene = store.getState().editor.scene
    scene.raycaster.setFromCamera(this.mousePos, scene.camera.object)
    let intersections = scene.raycaster.intersectObjects(scene.scene.children, true)
    if (intersections.length > 0) {
      for (let i of intersections) {
        if (i.object.userData.selectable) {
          this.changeSelectedObject(i.object)
          return
        }
      }
    }
    this.nullSelectedObject()
  }

  onMouseMove(event) {
    this.mousePos.x = ( event.clientX / window.innerWidth ) * 2 - 1
    this.mousePos.y = - ( event.clientY / window.innerHeight ) * 2 + 1
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
}
