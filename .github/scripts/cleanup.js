const admin = require('firebase-admin');

async function cleanupStaleUsers() {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    }

    const db = admin.firestore();
    console.log('Firebase Admin initialized successfully.');

    const STALE_THRESHOLD_HOURS = 24;
    const threshold = new Date(Date.now() - STALE_THRESHOLD_HOURS * 60 * 60 * 1000);

    const appId = 'evidence-board';

    const usersCol = db.collection('artifacts').doc(appId)
                           .collection('public').doc('data')
                           .collection('users');

    const staleUsersQuery = usersCol
      .where('isAnon', '==', true)
      .where('last_seen', '<', threshold);

    const snapshot = await staleUsersQuery.get();

    if (snapshot.empty) {
      console.log('No stale anonymous users found. Exiting.');
      return;
    }

    console.log(`Found ${snapshot.size} stale anonymous user(s) to delete...`);

    const batch = db.batch();
    let deletedCount = 0;

    for (const staleUserDoc of snapshot.docs) {
      const userId = staleUserDoc.id;
      const nickname = staleUserDoc.data().nickname || '(no nickname)';
      console.log(`- Queuing deletion for stale user: ${userId} (Nickname: ${nickname})`);
      batch.delete(staleUserDoc.ref);
      deletedCount++;

      if (deletedCount % 499 === 0) {
        console.log('Committing partial batch...');
        await batch.commit();
        batch = db.batch();
      }
    }

    if (deletedCount % 499 !== 0) {
        console.log('Committing final batch...');
        await batch.commit();
    }

    console.log(`All stale anonymous users processed (${deletedCount} deleted).`);

  } catch (error) {
    console.error('Error during cleanup script execution:', error);
    process.exit(1);
  }
}

cleanupStaleUsers().then(() => {
    console.log('Script finished.');
    if (admin.apps.length) {
        admin.app().delete().then(() => {
            console.log('Firebase Admin app deleted.');
        });
    }
}).catch((err) => {
    console.error('Script failed:', err);
    process.exit(1);
});
