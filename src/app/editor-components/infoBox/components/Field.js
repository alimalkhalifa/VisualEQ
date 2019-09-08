import React from 'react'

const Field = ({title, value, disabled}) => (
  <div class="input-group mb-3">
    <div class="input-group-prepend">
      <span class="input-group-text" id="basic-addon1">{title}</span>
    </div>
    <input type="text" class="form-control" {...{disabled}} value={value} aria-label={title} aria-describedby="basic-addon1" />
  </div>
)

export default Field