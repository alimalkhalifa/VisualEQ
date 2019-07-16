import {
  ADD_SPAWN,
  CHANGE_SCENE,
  UPDATE_SELECTED
} from './actionTypes'

export function addSpawn(spawn) {
  return {
    type: ADD_SPAWN,
    spawn
  }
}

export function changeScene(scene) {
  return {
    type: CHANGE_SCENE,
    scene
  }
}

export function updateSelected(object) {
  return {
    type: UPDATE_SELECTED,
    object
  }
}