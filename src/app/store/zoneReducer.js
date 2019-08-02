import { CHANGE_ZONE } from './actionTypes'

export default function zoneReducer(state = 'felwitheb', action) {
  switch(action.type) {
    case CHANGE_ZONE:
      return action.zone
    default:
      return state
  }
}