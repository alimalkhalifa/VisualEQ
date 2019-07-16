import * as THREE from 'three'
import { store } from '../store';
import { updateSelected } from '../store/actions';

export default class Selector {
  constructor() {
    this.connect()
  }

  connect() {
    document.addEventListener('mousedown', this.onMouseDown.bind(this))
  }

  onMouseDown() {
    if (event.button !== 0) return
    let scene = store.getState().editor.scene
    scene.raycaster.setFromCamera(scene.camera.mousePos, scene.camera.object)
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



/*changeSelectedObject(object) {
  this.nullSelectedObject()
  if (object.userData.selectable) {
    this.selectedObject = object
    this.selectedObject.userData.defaultMaterial = this.selectedObject.material
    this.selectedObject.material = new THREE.MeshBasicMaterial({color: 0x00FF00})
    if (object.userData.type === "SpawnPoint") {
      let spawn = object.userData.spawnInfo
      this.infoBox.innerHTML = `
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
      this.getSpawnGroup(spawn.spawngroupID)
    }
    this.infoBox.style.visibility = "visible"
  }
}*/
