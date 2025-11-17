const admin = require('firebase-admin');

async function cleanupStaleNicknames() {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    }

    const db = admin.firestore();
    console.log('Firebase Admin initialized successfully.');

    const STALE_THRESHOLD_MINUTES = 1;
    const threshold = new Date(Date.now() - STALE_THRESHOLD_MINUTES * 60 * 1000);

    const appId = 'evidence-board';

    const nicknamesCol = db.collection('artifacts').doc(appId)
                           .collection('public').doc('data')
                           .collection('nicknamePasswords');

    const staleNicknamesQuery = nicknamesCol
      .where('currentUserId', '!=', null)
      .where('last_seen', '<', threshold);

    const snapshot = await staleNicknamesQuery.get();

    if (snapshot.empty) {
      console.log('No stale nicknames found. Exiting.');
      return;
    }

    console.log(`Found ${snapshot.size} stale nickname(s) to process...`);

    for (const staleNicknameDoc of snapshot.docs) {
      const nickname = staleNicknameDoc.id;
      const currentUserId = staleNicknameDoc.data().currentUserId;
      console.log(`- Processing stale nickname: ${nickname} (user: ${currentUserId})`);

      try {
        await staleNicknameDoc.ref.update({
          currentUserId: admin.firestore.FieldValue.delete()
        });
        console.log(`  - Successfully released nickname: ${nickname}`);

      } catch (err) {
        console.error(`  - Error processing nickname ${nickname}:`, err.message);
      }
    }

    console.log('All stale nicknames processed.');

  } catch (error) {
    console.error('Error during cleanup script execution:', error);
    process.exit(1);
  }
}

cleanupStaleNicknames().then(() => {
    console.log('Script finished.');
    if (admin.apps.length) {
        admin.app().delete();
    }
}).catch(() => {
    process.exit(1);
});
