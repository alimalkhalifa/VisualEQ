import React from 'react'

const DebugStringify = ({object}) => (
  <div class="card mb-3">
    <div class="card-header">
      Selected
    </div>
    <div class="card-body">
      <pre class="card-text">{JSON.stringify(object, null, 2)}</pre>
    </div>
  </div>
)

export default DebugStringify