import InstanceView from "./InstanceView.svelte";
import OptionsView from "./OptionsView.svelte";

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

export function getOptions(div, setOptions) {
  new OptionsView({
    target: div,
    props: {
      setOptions,
    },
  });
}
