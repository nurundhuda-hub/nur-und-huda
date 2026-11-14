import type { Firestore } from 'firebase-admin/firestore';
import type { EditorHead, EditorStore } from './sermon-editor.js';

// Separate from prayer, push and access documents. No new client permissions.
export function firestoreEditorStore(db: Firestore): EditorStore {
  const ref = (id: string) => db.collection('privateSermonEdits').doc(id);
  return {
    async read(id) {
      const snapshot = await ref(id).get();
      return snapshot.exists ? (snapshot.data() as EditorHead) : null;
    },
    transact: (id, work) =>
      db.runTransaction(async (tx) => {
        const head = ref(id);
        const snapshot = await tx.get(head);
        const next = work(
          snapshot.exists ? (snapshot.data() as EditorHead) : null,
        );
        const revisions = next.archive ?? [];
        const refs = revisions.map((r) =>
          head.collection('revisions').doc(String(r.number)),
        );
        const previous = await Promise.all(refs.map((r) => tx.get(r)));
        revisions.forEach((r, i) => {
          if (!previous[i]!.exists) tx.create(refs[i]!, r);
          else if (previous[i]!.data()?.sha256 !== r.sha256)
            throw Error('IMMUTABLE_REVISION_MISMATCH');
        });
        tx.set(head, next.head);
        return next.result;
      }),
  };
}

export function firestoreManagementStore(
  db: Firestore,
): import('./sermon-management.js').ManagementStore {
  const root = db.collection('privateSermonManagement').doc('state');
  return {
    async read() {
      const snap = await root.get();
      return snap.exists
        ? (snap.data() as import('./sermon-management.js').ManagementState)
        : null;
    },
    transact: (id, work) =>
      db.runTransaction(async (tx) => {
        const current = await tx.get(root),
          head = id ? db.collection('privateSermonEdits').doc(id) : null;
        const content = head ? await tx.get(head) : null;
        const next = work(
          current.exists
            ? (current.data() as import('./sermon-management.js').ManagementState)
            : null,
          content?.exists ? (content.data() as EditorHead) : null,
        );
        if (next.event)
          tx.create(
            root.collection('events').doc(String(next.event.version)),
            next.event,
          );
        if (next.head && head) tx.create(head, next.head);
        tx.set(root, next.state);
        return next.result;
      }),
  };
}
