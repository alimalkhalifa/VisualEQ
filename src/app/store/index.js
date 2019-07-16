import { createStore } from 'redux'
import {
  ADD_SPAWN
} from './actionTypes'

let defaultState = {
  spawn: []
}

function reducer(state = defaultState, action) {
  switch(action.type) {
    case ADD_SPAWN:
      if (!Array.isArray(action.spawn)) action.spawn = [action.spawn]
      return Object.assign({}, state, {
        spawn: state.spawn.concat(action.spawn)
      })
    default:
      return state
  }
}

export const store = createStore(reducer)
