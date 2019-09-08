import React from 'react'
import Field from './Field'

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

const SpawnGroup = ({group}) => (
  <div class="mt-4">
    <h6 class="card-subtitle mb-2 text-muted">
      Spawn Group
    </h6>
    <p>
      {
        Object.keys(group).map((fieldName, i) => {
          return (
            <Field title={getName(fieldName)} value={group[fieldName]} disabled={true} />
          )
        })
      }
    </p>
  </div>
)

export default SpawnGroup