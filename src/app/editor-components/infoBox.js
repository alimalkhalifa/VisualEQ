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
    this.getSpawnGroup(spawn.spawngroupID)
  }
  getSpawnGroup(id) {
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
      this.domElement.appendChild(card)
      this.getSpawnEntries(id)
    })
  }

  getSpawnEntries(id) {
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
        this.domElement.appendChild(card)
        this.getNPC(entry.npcID)
      }
    })
  }

  getNPC(id) {
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
      this.domElement.appendChild(card)
    })
  }
}