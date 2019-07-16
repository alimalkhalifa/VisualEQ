import {
  ADD_SPAWN
} from './actionTypes'

export function addSpawn(spawn) {
  return {
    type: ADD_SPAWN,
    spawn
  }
}