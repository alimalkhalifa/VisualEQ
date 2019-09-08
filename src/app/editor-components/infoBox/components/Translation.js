import React from 'react'
import Field from './Field'

const Translation = ({title, position}) => (
  <div class="card mb-3">
    <div class="card-header">
      {title ? title : 'Translation'}
    </div>
    <div class="card-body">
      <p class="card-text">
        <Field title="X" value={parseFloat(position.x).toFixed(2)} disabled={true} />
        <Field title="Y" value={parseFloat(position.y).toFixed(2)} disabled={true} />
        <Field title="Z" value={parseFloat(position.z).toFixed(2)} disabled={true} />
      </p>
    </div>
  </div>
)

export default Translation