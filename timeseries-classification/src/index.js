import InstanceView from "./InstanceView.svelte";

export function getInstance(
  div,
  viewOptions,
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
      viewOptions: viewOptions,
      modelColumn: modelColumn,
      labelColumn: labelColumn,
      dataColumn: dataColumn,
      dataOrigin: dataOrigin,
      idColumn: idColumn,
    },
    hydrate: true,
  });
}
