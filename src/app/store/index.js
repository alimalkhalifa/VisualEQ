import { createStore } from 'redux'
import {
  ADD_SPAWN,
  CHANGE_SCENE,
  UPDATE_SELECTED
} from './actionTypes'

let defaultState = {
  spawn: [],
  editor: {
    selected: null,
    scene: null
  }
}

function storeReducers(state = defaultState, action) {
  switch(action.type) {
    case ADD_SPAWN:
      if (!Array.isArray(action.spawn)) action.spawn = [action.spawn]
      return Object.assign({}, state, {
        spawn: [...state.spawn, action.spawn]
      })
    case CHANGE_SCENE:
      return Object.assign({}, state, {
        editor: {
          ...state.editor,
          scene: action.scene
        }
      })
    case UPDATE_SELECTED:
      return Object.assign({}, state, {
        editor: {
          ...state.editor,
          selected: action.object
        }
      })
    default:
      return state
  }
}

export const store = createStore(storeReducers)
