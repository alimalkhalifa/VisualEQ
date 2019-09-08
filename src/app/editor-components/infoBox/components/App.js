import React from 'react'
import { connect } from 'react-redux'
import Location from './Location'
import SelectedInfo from './SelectedInfo'

const App = ({selected}) => (
  <div>
    <Location />
    { selected && <SelectedInfo /> }
  </div>
)

const mapStateToProps = (state) => {
  return {
    selected: state.selected
  }
}

export default connect(
  mapStateToProps
)(App)