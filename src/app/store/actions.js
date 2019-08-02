import {
  ADD_SPAWN,
  CHANGE_SCENE,
  UPDATE_SELECTED,
  MOVE_OBJECT,
  MOVE_UNDO,
  CHANGE_ZONE
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

export function moveObject(object, from, to) {
  return {
    type: MOVE_OBJECT,
    object,
    from,
    to
  }
}

export function moveUndo() {
  return {
    type: MOVE_UNDO
  }
}

export function changeZone(zone) {
  return {
    type: CHANGE_ZONE,
    zone
  }
}