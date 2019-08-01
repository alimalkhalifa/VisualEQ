import { store } from "../store";

export default class InfoBox {
  constructor() {
    this.domElement = document.getElementById('info-box')
    store.subscribe(() => this.updateInfoBox())
  }

  updateInfoBox() {
    let selected = store.getState().selected
    if (selected === null) {
      this.emptyInfo()
      return
    }
    switch (selected.userData.type) {
      case "SpawnPoint":
        this.spawnPointInfo(selected)
        break
      default:
        this.emptyInfo()
    }
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
    this.getSpawnGroup(object)
  }
  getSpawnGroup(object) {
    let group = object.userData.spawngroup
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
    this.domElement.appendChild(card)
    this.getSpawnEntries(object)
  }

  getSpawnEntries(object) {
    let entries = object.userData.spawnentry
    for (let entry of entries) {
      let card = document.createElement("div")
      card.setAttribute("class", "card text-white bg-dark")
      card.innerHTML = `
      <h5 class="card-title">Spawn Entry</h5>
      <div class="card-text">
        npcID: ${entry.npcID}<br/>
        Chance: ${entry.chance}<br/>
      </div>
      `
      this.domElement.appendChild(card)
      this.getNPC(object, entry.npcID)
    }
  }

  getNPC(object, id) {
    let npc
    for (let n of object.userData.npcTypes) {
      if (n.id === id) {
        npc = n
      }
    }
    let card = document.createElement("div")
    card.setAttribute("class", "card text-white bg-dark")
    card.innerHTML = `
    <h5 class="card-title">NPC</h5>
    <h6 class="card-subtitle mb2 text-muted">ID ${npc.id}</h6>
    <div class="card-text">
      Name: ${npc.name}<br/>
      Race: ${npc.race}<br/>
      Helm: ${npc.helmtexture}<br/>
    </div>
    `
    this.domElement.appendChild(card)
  }
}