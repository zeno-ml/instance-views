<script lang="ts">
  import AssistantBlock from "./AssistantBlock.svelte";
  import SystemBlock from "./SystemBlock.svelte";
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

  let showall = entry[dataColumn].length <= 5;
  let hovered = false;

  $: entries = showall ? entry[dataColumn] : entry[dataColumn].slice(-4);
</script>

<div id="container">
  {#if !showall}
    <div
      class="show-all"
      class:hover={hovered}
      on:click={() => (showall = true)}
      on:keydown={() => {}}
      on:focus={() => (hovered = true)}
      on:blur={() => (hovered = false)}
      on:mouseover={() => (hovered = true)}
      on:mouseout={() => (hovered = false)}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
        <path d="m12 8-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z" />
      </svg>
      <span>Show All</span>
    </div>
  {/if}
  {#if entry[dataColumn]}
    {#if typeof entry[dataColumn] === "string"}
      <UserBlock input={entry[dataColumn]} />
    {:else}
      {#each entries as item}
        {#if item["role"] === "system"}
          <SystemBlock input={item["content"]} />
        {:else if item["role"] === "assistant"}
          <AssistantBlock input={item["content"]} />
        {:else if item["role"] === "user"}
          <UserBlock input={item["content"]} />
        {/if}
      {/each}
    {/if}
  {/if}
  {#if entry[modelColumn]}
    <AssistantBlock input={entry[modelColumn]} output={true} />
  {/if}
  {#if entry[labelColumn]}
    <p><span class="label">Expected:</span> {entry[labelColumn]}</p>
  {/if}
</div>

<style>
  #container {
    display: flex;
    flex-direction: column;
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
  .show-all {
    align-self: center;
    border: none;
    background-color: transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    padding: 5px;
    border-radius: 20px;
  }
  .hover {
    background-color: var(--G5);
  }
  .show-all span {
    padding-right: 5px;
  }
  .show-all svg {
    min-width: 24px;
    width: 24px;
    fill: var(--G3);
  }
</style>
