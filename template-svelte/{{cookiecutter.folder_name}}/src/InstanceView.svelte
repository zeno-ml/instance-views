<script lang="ts">
  // Object returned from the Options component.
  export let options;
  // Objects with keys corresponding to the following props.
  export let entry;
  // Key for model outputs.
  export let modelColumn;
  // Key for groundtruth labels.
  export let labelColumn;
  // Key for the input data.
  export let dataColumn;
  // Path or URL from witch to fetch data.
  export let dataOrigin;
  // Key for unique identifier of each item.
  export let idColumn;
</script>

<div id="container" />

<style>
  #container {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
  }
</style>
