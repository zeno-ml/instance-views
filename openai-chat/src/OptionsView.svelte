<script lang="ts">
  // Callback function to set an object with options for instance views.
  export let setOptions;

  $: setOptions({ optionA: "hello world" });
</script>
