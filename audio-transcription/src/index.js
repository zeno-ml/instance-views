import InstanceView from "./InstanceView.svelte";

export function getInstance(
  div,
  options,
  entry,
  modelColumn,
  labelColumn,
  dataColumn,
  transformColumn,
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
      transformColumn: transformColumn,
      idColumn: idColumn,
    },
    hydrate: true,
  });
}
