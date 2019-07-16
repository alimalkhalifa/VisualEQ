import { store } from '../src/app/store'
import {
  addSpawn
} from '../src/app/store/actions'

store.subscribe(() => console.log(store.getState()))

store.dispatch(addSpawn(['test1', 'test2']))
