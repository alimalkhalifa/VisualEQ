import {
  UPDATE_POSITION,
  ADD_SPAWN,
  CHANGE_SCENE,
  UPDATE_SELECTED,
  MOVE_OBJECT,
  MOVE_UNDO,
  CHANGE_ZONE,
  CHANGE_RENDERER
} from './actionTypes'

export function updatePosition(pos) {
  return {
    type: UPDATE_POSITION,
    x: pos[0],
    y: pos[1],
    z: pos[2]
  }
}

export function changeRenderer(renderer) {
  return {
    type: CHANGE_RENDERER,
    renderer
  }
}

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