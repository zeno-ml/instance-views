import InstanceView from "./InstanceView.svelte";

export function getInstance(
  div,
  options,
  entry,
  modelColumn,
  labelColumn,
  dataColumn,
  idColumn
) {
  new InstanceView({
    target: div,
    props: {
      entry: entry,
      options: options,
      modelColumn: modelColumn,
      labelColumn: labelColumn,
      dataColumn: dataColumn,
      idColumn: idColumn,
    },
    hydrate: true,
  });
}
