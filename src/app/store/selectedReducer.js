import { UPDATE_SELECTED } from './actionTypes'

export default function selectedReducer(state = null, action) {
  switch(action.type) {
    case UPDATE_SELECTED:
      return action.object
    default:
      return state
  }
}