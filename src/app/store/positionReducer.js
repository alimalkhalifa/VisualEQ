import { MOVE_OBJECT, MOVE_UNDO, UPDATE_POSITION } from './actionTypes'

export default function positionReducer(state = {x: 0, y: 0, z: 0}, action) {
  switch(action.type) {
    case UPDATE_POSITION:
      return Object.assign({}, state, {
        x: action.x,
        y: action.y,
        z: action.z
      })
    default:
      return state
  }
}