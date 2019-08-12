import { CHANGE_ZONE } from './actionTypes'

export default function zoneReducer(state = 'crushbone', action) {
  switch(action.type) {
    case CHANGE_ZONE:
      return action.zone
    default:
      return state
  }
}