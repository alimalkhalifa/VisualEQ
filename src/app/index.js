import Scene from './editor-components/scene'
import { store } from './store'
import { changeZone } from './store/actions'

store.subscribe(() => console.log(store.getState()))
let zone = store.getState().zone

//store.dispatch(addSpawn('test'))

let scene = new Scene(store.getState().zone)

store.subscribe(() => {
  if (store.getState().zone !== zone) {
    console.log("Zone Changed")
    zone = store.getState().zone
    scene.dispose()
    scene = new Scene()
  }
})

let zoneSelector = document.getElementById("zone-select")
fetch('/zone').then(res => {
  return res.json()
}).then(res => {
  let html = '<option disabled>Zone Selection</option>'
  for (let zone of res) {
    html = html.concat(`<option value=${zone.short_name}>${zone.long_name}</option>`)
  }
  zoneSelector.innerHTML = html
  zoneSelector.value = store.getState().zone
})
zoneSelector.onchange = (e) => {
  const target = e.target
  const value = target.value
  document.getElementById('loading-container').style.visibility = 'visible'
  store.dispatch(changeZone(value))
}

