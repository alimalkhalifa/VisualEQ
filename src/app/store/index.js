import { createStore, combineReducers } from 'redux'
import positionReducer from './positionReducer'
import rendererReducer from './rendererReducer'
import spawnReducer from './spawnReducer'
import sceneReducer from './sceneReducer'
import movesReducer from './movesReducer'
import selectedReducer from './selectedReducer'
import zoneReducer from './zoneReducer'

let storeReducers = combineReducers({
  position: positionReducer,
  renderer: rendererReducer,
  spawn: spawnReducer,
  scene: sceneReducer,
  moves: movesReducer,
  selected: selectedReducer,
  zone: zoneReducer
})

export const store = createStore(storeReducers)
