type PreviewDraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

let activeStorage: PreviewDraftStorage | null = null;

/** Preview drafts live only in this page's memory, never the customer/operating stores. */
export function activatePreviewDraftStorage(): () => void {
  const previous = activeStorage, values = new Map<string, string>();
  const storage: PreviewDraftStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: key => { values.delete(key); },
  };
  activeStorage = storage;
  return () => { if (activeStorage === storage) activeStorage = previous; };
}

export function getPreviewDraftStorage(): PreviewDraftStorage | null {
  return activeStorage;
}
