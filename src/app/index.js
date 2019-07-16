import Scene from './editor-components/scene'
import { store } from './store'
import {
  addSpawn
} from './store/actions'

//store.subscribe(() => console.log(store.getState()))

//store.dispatch(addSpawn('test'))

let scene = new Scene('crushbone')
