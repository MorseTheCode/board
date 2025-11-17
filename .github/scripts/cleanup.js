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

    const STALE_THRESHOLD_MINUTES = 1;
    const threshold = new Date(Date.now() - STALE_THRESHOLD_MINUTES * 60 * 1000);

    const appId = 'evidence-board';

    const usersCol = db.collection('artifacts').doc(appId)
                           .collection('public').doc('data')
                           .collection('userPasswords');

    const staleUsersQuery = usersCol
      .where('currentUserId', '!=', null)
      .where('last_seen', '<', threshold);

    const snapshot = await staleUsersQuery.get();

    if (snapshot.empty) {
      console.log('No stale users found. Exiting.');
      return;
    }

    console.log(`Found ${snapshot.size} stale user(s) to process...`);

    for (const staleUserDoc of snapshot.docs) {
      const user = staleUserDoc.id;
      const currentUserId = staleUserDoc.data().currentUserId;
      console.log(`- Processing stale user: ${user} (user: ${currentUserId})`);

      try {
        await staleUserDoc.ref.update({
          currentUserId: admin.firestore.FieldValue.delete()
        });
        console.log(`  - Successfully released user: ${user}`);

      } catch (err) {
        console.error(`  - Error processing user ${user}:`, err.message);
      }
    }

    console.log('All stale users processed.');

  } catch (error) {
    console.error('Error during cleanup script execution:', error);
    process.exit(1);
  }
}

cleanupStaleUsers().then(() => {
    console.log('Script finished.');
    if (admin.apps.length) {
        admin.app().delete();
    }
}).catch(() => {
    process.exit(1);
});
