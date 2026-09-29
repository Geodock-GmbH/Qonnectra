/** Reactive stand-in for `$app/state`'s `page`, so tests can navigate between projects and nodes. */
export const page = $state<{ params: { projectId?: string; nodeUuid?: string } }>({ params: {} });
