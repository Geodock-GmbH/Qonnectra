/** Reactive stand-in for `$app/state`'s `page`, so tests can navigate between projects. */
export const page = $state<{ params: { projectId?: string } }>({ params: {} });
