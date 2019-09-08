import React from 'react'
import { connect } from 'react-redux'
import Translation from './Translation'

const Location = ({position}) => (
  <Translation position={position} title='Location' />
)

const mapStateToProps = (state) => {
  return {
    position: state.position
  }
}

export default connect(
  mapStateToProps
)(Location)