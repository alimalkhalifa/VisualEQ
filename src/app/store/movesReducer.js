import { MOVE_OBJECT, MOVE_UNDO } from './actionTypes'

export default function movesReducer(state = [], action) {
  switch(action.type) {
    case MOVE_OBJECT:
      return state.concat({object: action.object, from: action.from, to: action.to})
    case MOVE_UNDO:
      return state.slice(0, -1)
    default:
      return state
  }
}