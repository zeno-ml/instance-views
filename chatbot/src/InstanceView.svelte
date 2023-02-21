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
</script>

<div id="container">
  <div class="box">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512">
      <path
        d="M224 256A128 128 0 1 0 224 0a128 128 0 1 0 0 256zm-45.7 48C79.8 304 0 383.8 0 482.3C0 498.7 13.3 512 29.7 512H418.3c16.4 0 29.7-13.3 29.7-29.7C448 383.8 368.2 304 269.7 304H178.3z"
      />
    </svg>
    <p class="chat">{entry[dataColumn]}</p>
  </div>
  <div class="box-reverse">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512">
      <path
        d="M320 0c17.7 0 32 14.3 32 32V96H472c39.8 0 72 32.2 72 72V440c0 39.8-32.2 72-72 72H168c-39.8 0-72-32.2-72-72V168c0-39.8 32.2-72 72-72H288V32c0-17.7 14.3-32 32-32zM208 384c-8.8 0-16 7.2-16 16s7.2 16 16 16h32c8.8 0 16-7.2 16-16s-7.2-16-16-16H208zm96 0c-8.8 0-16 7.2-16 16s7.2 16 16 16h32c8.8 0 16-7.2 16-16s-7.2-16-16-16H304zm96 0c-8.8 0-16 7.2-16 16s7.2 16 16 16h32c8.8 0 16-7.2 16-16s-7.2-16-16-16H400zM264 256a40 40 0 1 0 -80 0 40 40 0 1 0 80 0zm152 40a40 40 0 1 0 0-80 40 40 0 1 0 0 80zM48 224H64V416H48c-26.5 0-48-21.5-48-48V272c0-26.5 21.5-48 48-48zm544 0c26.5 0 48 21.5 48 48v96c0 26.5-21.5 48-48 48H576V224h16z"
      />
    </svg>
    <p class="chat">{entry[modelColumn]}</p>
  </div>
  <div class="box">
    <span class="label">label:</span>
    <p>{entry[labelColumn]}</p>
  </div>
</div>

<style>
  #container {
    border: 0.5px solid rgb(224, 224, 224);
    border-radius: 2px;
    max-width: 350px;
    padding: 10px;
  }
  .box {
    display: flex;
    flex-direction: row;
    align-items: center;
  }
  .box-reverse {
    display: flex;
    flex-direction: row-reverse;
  }
  .chat {
    padding: 10px;
    border: 1px solid #6a1a9a;
    border-radius: 5px;
  }
  .label {
    margin-right: 5px;
    font-size: 10px;
    color: rgba(0, 0, 0, 0.5);
    font-variant: small-caps;
  }
  p {
    margin: 5px;
  }
  .box svg {
    min-width: 24px;
    width: 24px;
    margin-right: 10px;
    fill: #6a1a9a;
  }
  .box-reverse svg {
    min-width: 30px;
    width: 30px;
    margin-left: 10px;
    fill: #6a1a9a;
  }
</style>
