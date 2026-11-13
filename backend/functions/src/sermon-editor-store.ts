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
