<script lang="ts">
  import SegmentedButton, { Label, Segment } from "@smui/segmented-button";

  export let setOptions;

  let choices = ["Label", "Model"];
  let selected = ["Label"];

  $: setOptions({ mask: selected });
  $: console.log(selected);
</script>

<div style:margin-left="10px">
  <SegmentedButton segments={choices} let:segment bind:selected>
    <Segment {segment}>
      <Label>{segment}</Label>
    </Segment>
  </SegmentedButton>
  <button on:click={() => console.log("hi")}>click</button>
</div>
