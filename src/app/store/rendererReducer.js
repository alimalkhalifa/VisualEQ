import { CHANGE_RENDERER } from './actionTypes'

export default function positionReducer(state = null, action) {
  switch(action.type) {
    case CHANGE_RENDERER:
      return action.renderer
    default:
      return state
  }
}