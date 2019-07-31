import { CHANGE_SCENE } from './actionTypes'

export default function sceneReducer(state = null, action) {
  switch(action.type) {
    case CHANGE_SCENE:
      return action.scene
    default:
      return state
  }
}