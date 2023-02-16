<script lang="ts">
  import { HighlightAuto } from "svelte-highlight";
  import github from "svelte-highlight/styles/github";

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

<svelte:head>
  {@html github}
</svelte:head>

<div id="container">
  {#if entry[dataColumn]}
    <HighlightAuto code={entry[dataColumn]} />
  {/if}
  {#if entry[labelColumn]}
    <hr />
    <pre class="label">label</pre>
    <HighlightAuto code={entry[labelColumn]} />
  {/if}
  {#if entry[modelColumn]}
    <hr />
    <pre class="label">model prediction</pre>
    <HighlightAuto code={entry[modelColumn]} />
  {/if}
</div>

<style>
  #container {
    width: min-content;
    padding: 5px;
    border: 0.5px solid rgb(224, 224, 224);
  }
  .label {
    margin-top: 5px;
    margin-bottom: 0px;
  }
  :global(pre code.hljs) {
    background: var(--Y2);
  }
</style>
