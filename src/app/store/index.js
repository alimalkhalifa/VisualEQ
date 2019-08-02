import { createStore, combineReducers } from 'redux'
import spawnReducer from './spawnReducer'
import sceneReducer from './sceneReducer'
import movesReducer from './movesReducer'
import selectedReducer from './selectedReducer'
import zoneReducer from './zoneReducer'

let storeReducers = combineReducers({
  spawn: spawnReducer,
  scene: sceneReducer,
  moves: movesReducer,
  selected: selectedReducer,
  zone: zoneReducer
})

export const store = createStore(storeReducers)
