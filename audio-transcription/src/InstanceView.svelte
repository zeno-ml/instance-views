<script lang="ts">
  export let entry;
  // Key for model outputs.
  export let options;
  export let modelColumn;
  // Key for groundtruth labels.
  export let labelColumn;
  // Key for the input data.
  export let dataColumn;
  // Path to fetch data from.
  export let dataOrigin;
  // Key for unique identifier of each item.
  export let idColumn;
</script>

<div id="container">
  <div class="box">
    <div style:display="flex">
      <audio controls src={`${dataOrigin}${entry[idColumn]}`}>
        <source
          src={`${dataOrigin}${entry[idColumn]}`}
          type={"audio/" + entry[idColumn].split(".").at(-1)}
        />
      </audio>
    </div>
    <span class="label">label: </span><span class="value">
      {entry[labelColumn]}
    </span>
    {#if modelColumn && entry[modelColumn] !== undefined}
      <br />
      <span class="label">output: </span>
      <span class="value">{entry[modelColumn]} </span>
    {/if}
  </div>
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
    border: 0.5px solid rgb(224, 224, 224);
    max-width: 400px;
  }
  #container {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
  }

  :global(spectrogram canvas) {
    z-index: 0 !important;
  }
  :global(wave canvas) {
    z-index: 0 !important;
  }
  :global(wave) {
    z-index: 0 !important;
  }
</style>
