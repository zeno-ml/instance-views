<script lang="ts">
  import AssistantBlock from "./AssistantBlock.svelte";
  import UserBlock from "./UserBlock.svelte";

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
  // Key for unique identifier of each item.
  export let idColumn;
</script>

<div id="container">
  {#if entry[dataColumn]}
    <UserBlock input={entry[dataColumn]} />
  {/if}
  {#if entry[modelColumn]}
    <AssistantBlock input={entry[modelColumn]} output={true} />
  {/if}
  {#if entry[labelColumn]}
    <p><span class="label">ideal:</span> {entry[labelColumn]}</p>
  {/if}
</div>

<style>
  #container {
    border: 0.5px solid rgb(224, 224, 224);
    min-width: 350px;
    border-radius: 2px;
    padding: 10px;
  }
  .label {
    margin-right: 5px;
    font-weight: 700;
  }
  p {
    margin: 5px;
    overflow-wrap: anywhere;
  }
</style>
