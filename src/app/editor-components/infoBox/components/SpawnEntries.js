import React from 'react'
import raceCodes from '../../../../common/constants/raceCodeConstants.json'
import Field from './Field'
import NpcViewer from '../../npcViewer/components/NpcViewer'

function getName(name) {
  switch(name) {
    case "id":
      return "ID"
    case "name":
      return "Name"
    case "spawn_limit":
      return "Spawn Limit"
    case "dist":
      return "Distance"
    case "max_x":
      return "Max X"
    case "min_x":
      return "Min X"
    case "max_y":
      return "Max Y"
    case "min_y":
      return "Min Y"
    case "delay":
      return "Delay"
    case "min_delay":
      return "Min Delay"
    case "despawn":
      return "Despawn"
    case "despawn_timer":
        return "Despawn Timer"
    default:
      return name
  }
}

const SpawnEntries = ({entries, npcs}) => (
  <div class="card mb-3">
    <div class="card-header">
      Spawn Entries
    </div>
    <div class="card-body">
      <p class="card-text">
        {
          entries.map((entry, i) => {
            let npc = npcs.filter(value => value.id === entry.npcID)
            npc = npc.length === 0 ? null : npc[0]
            if (npc) {
              return (
                <div key={i}>
                  <h6 class="card-subtitle text-muted mb-1">{npc.name}</h6>
                  <NpcViewer race={raceCodes[npc.race][npc.gender === 0 ? 'male' : npc.gender === 1 ? 'female' : 'neutral']} texture={npc.texture} helm={npc.helmtexture} face={npc.face} />
                  <Field title="Chance" value={entry.chance} disabled={true} />
                </div>
              )
            } else {
              return (
                <div key={i}>
                  Invalid NPC
                </div>
              )
            }
          })
        }
      </p>
    </div>
  </div>
)

export default SpawnEntries