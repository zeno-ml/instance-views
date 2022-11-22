<script lang="ts">
  import Button, { Group } from "@smui/button";

  export let setOptions;

  let choices = ["Label", "Model"];
  let selected = ["Label"];

  $: setOptions({ mask: selected });
</script>

<div>
  <Group>
    {#each choices as choice}
      <Button
        variant={selected.includes(choice) ? "raised" : "outlined"}
        on:click={() => {
          if (selected.includes(choice)) {
            selected = selected.filter((c) => c !== choice);
          } else {
            selected = [...selected, choice];
          }
        }}>{choice}</Button
      >
    {/each}
  </Group>
</div>
