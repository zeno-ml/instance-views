<script lang="ts">
  // List of objects with keys corresponding to the following props.
  export let entry;
  export let options;
  // Key for model outputs.
  export let modelColumn;
  // Key for groundtruth labels.
  export let labelColumn;
  // Key for the input data.
  export let dataColumn;
  export let dataOrigin;
  // Key for the transformed data (current transform).
  export let transformColumn;
  // Key for unique identifier of each item.
  export let idColumn;
</script>

<div class="box">
  <span>{entry[dataColumn]}</span>
  <br />
  <span class="label">label: </span><span class="value">
    {entry[labelColumn]}
  </span>
  {#if modelColumn && entry[modelColumn] !== undefined}
    <br />
    <span class="label">output: </span>
    <span class="value">{entry[modelColumn]} </span>
  {/if}
</div>

<style>
  .label {
    font-size: 12px;
    color: rgba(0, 0, 0, 0.5);
    font-variant: small-caps;
  }
  .value {
    font-size: 12px;
  }
  .box {
    padding: 10px;
    margin: 10px;
    border: 0.5px solid rgb(224, 224, 224);
  }
</style>
