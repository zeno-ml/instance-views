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
  // Key for unique identifier of each item.
  export let idColumn;

  // Split each column by newlines then spaces.
  $: dataEntries = entry[dataColumn].split("\n").map((x) => x.split(" "));
  $: labelEntries = entry[labelColumn].split("\n").map((x) => x.split(" "));
  $: modelEntries = entry[modelColumn].split("\n").map((x) => x.split(" "));
</script>

<div id="container">
  <table id="example_table">
    <tbody>
      {#each dataEntries as entry (entry)}
        <tr>
            <th>Data: </th>
          {#each entry as cell (cell)}
            <td>{cell}</td>
          {/each}
        </tr>
      {/each}
      {#each labelEntries as entry (entry)}
        <tr class="label">
          <th>Label: </th>
          {#each entry as cell (cell)}
            <td>{cell}</td>
          {/each}
        </tr>
      {/each}
      {#each modelEntries as entry (entry)}
        <tr>
          <th>Output: </th>
          {#each entry as cell (cell)}
            <td>{cell}</td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  #container {
    display: flex;
    flex-direction: column;
    border: 1px solid rgb(224, 224, 224);
    min-width: 350px;
    border-radius: 2px;
    padding: 10px;
    margin: 2.5px;
  }
  #example_table {
    font-family: Arial, Helvetica, sans-serif;
    border-collapse: collapse;
    width: 100%;
  }

  #example_table td, #example_table th {
    border: 1px solid #ddd;
    padding: 8px;
  }

  #example_table tr.label{background-color: #f2f2f2;}
</style>
