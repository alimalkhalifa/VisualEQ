import { ADD_SPAWN } from './actionTypes'

export default function spawnReducer(state = [], action) {
  switch(action.type) {
    case ADD_SPAWN:
      if (!Array.isArray(action.spawn)) action.spawn = [action.spawn]
      return spawn.concat(action.spawn)
    default:
      return state
  }
}