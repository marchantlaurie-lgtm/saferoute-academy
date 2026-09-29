export const FRAT_RETAIN_CONTROL = "No effective control identified — retain the current risk and seek further review";

export function hasRecordedControl(control) {
  return Boolean(control) && (control.actions?.length > 0 || Boolean(control.note?.trim()));
}

export function canControlReduce(question, control) {
  return Boolean(control?.actions?.some(action =>
    action !== FRAT_RETAIN_CONTROL && !question.nonReducingMitigations?.includes(action)
  ));
}
