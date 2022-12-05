<script lang="ts">
  export let entry;
  export let options;
  export let modelColumn;
  export let labelColumn;
  export let dataColumn;
  export let dataOrigin;
  export let transformColumn;
  export let idColumn;
</script>

<div class="box" style:background-color="white">
  <img
    src="{dataOrigin}{entry[idColumn]}"
    style:max-width="200px"
    alt="Image thumbnail for instance {entry[idColumn]}"
  />
  {#if transformColumn}
    <img
      src={`/cache/${transformColumn}/${entry[transformColumn]}`}
      style:max-width="200px"
      alt="Image thumbnail for instance {entry[transformColumn]}"
    />
  {/if}
  <br />
  <div>
    <span class="label">label: </span><span class="value">
      {entry[labelColumn]}
    </span>
  </div>
  {#if modelColumn && entry[modelColumn]}
    <div>
      <span class="label">output: </span>
      <span class="value">{entry[modelColumn]} </span>
    </div>
  {/if}
</div>

<style>
  .label {
    font-size: 10px;
    color: rgba(0, 0, 0, 0.5);
    font-variant: small-caps;
  }
  .value {
    font-size: 10px;
  }
  .box {
    width: min-content;
    min-width: 50px;
    padding: 10px;
    margin: 10px;
    border: 0.5px solid rgb(224, 224, 224);
  }
</style>
