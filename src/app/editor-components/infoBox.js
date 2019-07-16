import { store } from "../store";

export default class InfoBox {
  constructor() {
    this.domElement = document.getElementById('info-box')
    store.subscribe(() => this.updateInfoBox())
  }

  updateInfoBox() {
    let selected = store.getState().editor.selected
    if (!selected) {
      this.domElement.style.visibility = "hidden"
      return
    }
    switch (selected.userData.type) {
      case "SpawnPoint":
        this.spawnPointInfo(selected)
        break
      default:
        this.emptyInfo()
    }
    this.domElement.style.visibility = "visible"
  }

  emptyInfo() {
    this.domElement.innerText = `Empty`
  }

  spawnPointInfo(object) {
    let spawn = object.userData.spawnInfo
    this.domElement.innerHTML = `
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
    //this.getSpawnGroup(spawn.spawngroupID)
  }
}