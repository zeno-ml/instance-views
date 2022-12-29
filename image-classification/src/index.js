import InstanceView from "./InstanceView.svelte";

export function getInstance(
  div,
  options,
  entry,
  modelColumn,
  labelColumn,
  dataColumn,
  dataOrigin,
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
      dataOrigin: dataOrigin,
      idColumn: idColumn,
    },
    hydrate: true,
  });
}
