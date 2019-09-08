import React from 'react'
import { connect } from 'react-redux'
import NamePlate from './NamePlate'
import Translation from './Translation'
import SpawnPointInfo from './SpawnPointInfo'
import DebugStringify from './DebugStringify'

const SelectedInfo = ({selected}) => (
  <div>
    <NamePlate object={selected} />
    <Translation position={selected.position} />
    { selected.userData.type === "SpawnPoint" && <SpawnPointInfo object={selected} />}
    <DebugStringify object={selected} />
  </div>
)

const mapStateToProps = (state) => {
  return {
    selected: state.selected
  }
}

export default connect(
  mapStateToProps
)(SelectedInfo)