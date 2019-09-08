import React from 'react'

const NamePlate = ({object}) => (
  <div class="card mb-3">
    <div class="card-header">
      Selected
    </div>
    <div class="card-body">
      <h5 class="card-title">{object.userData.type}</h5>
    </div>
  </div>
)

export default NamePlate