<script lang="ts">
  import SegmentedButton, { Label, Segment } from "@smui/segmented-button";

  export let setOptions;

  let choices = ["Label", "Model"];
  let selected = ["Label"];

  $: setOptions({ mask: selected });
</script>

<div style:margin-left="10px">
  <SegmentedButton segments={choices} let:segment bind:selected>
    <Segment {segment}>
      <Label>{segment}</Label>
    </Segment>
  </SegmentedButton>
</div>
