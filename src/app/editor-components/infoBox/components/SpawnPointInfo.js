import React from 'react'
import Field from './Field'
import SpawnGroup from './SpawnGroup'
import SpawnEntries from './SpawnEntries'

function getName(name) {
  switch(name) {
    case "id":
      return "ID"
    case "enabled":
      return "Enabled"
    case "heading":
      return "Heading"
    case "respawntime":
      return "Respawn Time"
    case "variance":
      return "Variance"
    case "pathgrid":
      return "Path Grid"
    case "version":
      return "Version"
    default:
      return name
  }
}

const SpawnPointInfo = ({object: { userData}}) => (
  <div class="card mb-3">
    <div class="card-header">
      Spawn Point
    </div>
    <div class="card-body">
      <Field title="ID" value={userData.spawnInfo.id} disabled={true} />
      <Field title="Enabled" value={userData.spawnInfo.enabled} disabled={true} />
      <Field title="Heading" value={userData.spawnInfo.heading} disabled={true} />
      <Field title="Respawn Time" value={userData.spawnInfo.respawntime} disabled={true} />
      <Field title="Variance" value={userData.spawnInfo.variance} disabled={true} />
      <Field title="Path Grid" value={userData.spawnInfo.pathgrid} disabled={true} />
      <Field title="Version" value={userData.spawnInfo.version} disabled={true} />
      { userData.spawngroup && <SpawnGroup group={userData.spawngroup} /> }
      { userData.spawnentry && userData.spawnentry.length > 0 && <SpawnEntries entries={userData.spawnentry} {...(userData.npcTypes && userData.npcTypes.length > 0) ? {npcs: userData.npcTypes} : {}} /> }
    </div>
  </div>
)

export default SpawnPointInfo